// Chunk 1 · One live conversation. Owns the transcript and fans events out to LiveListeners.
// Features plug in as listeners (src/listeners.ts) instead of editing this file, so chunks don't collide.
import type { ClientMsg, Conversation, Hint, Link, Person, Profile, ServerMsg, Speaker, Utterance } from "@larp/shared";
import { db, newId } from "../../lib/db";
import { openStt, type SttStream } from "./stt";
import { synthesize } from "./tts";

export interface LiveContext {
  readonly userId: string;
  readonly profile: Profile | null;
  /** Who you're talking to, with their dossier if prepped. */
  readonly person: Person | null;
  readonly conversation: Conversation;
  send(msg: ServerMsg): void;
  /** Speak a hint into the earbud (and show it on screen). */
  whisper(text: string): Promise<void>;
  /** Pop a link card on screen. Repeats of the same URL are ignored. */
  shareLink(link: Link): void;
  /** Correct who said a line. The mic can't tell speakers apart, so lines start as "unknown". */
  setSpeaker(u: Utterance, speaker: Speaker): void;
}

export interface LiveListener {
  name: string;
  /** Every partial transcript, many per second. Must be cheap and synchronous: no network calls. */
  onPartial?(ctx: LiveContext, text: string, speaker: Speaker): void;
  /** Each finished utterance. */
  onUtterance?(ctx: LiveContext, u: Utterance): void | Promise<void>;
  /** After the conversation is saved. */
  onEnd?(ctx: LiveContext): void | Promise<void>;
}

export interface Transport {
  json(msg: ServerMsg): void;
  binary(chunk: Uint8Array): void;
}

export class LiveSession implements LiveContext {
  profile: Profile | null = null;
  person: Person | null = null;
  conversation: Conversation = { id: newId(), startedAt: Date.now(), transcript: [], hints: [], linksShared: [] };
  private stt: SttStream | null = null;
  private started = false;
  private ended = false;
  /** Utterance handling still running (e.g. a hint being generated); stop() waits for it. */
  private inflight = new Set<Promise<void>>();

  constructor(
    readonly userId: string,
    private transport: Transport,
    private listeners: LiveListener[],
  ) {}

  async handle(msg: ClientMsg): Promise<void> {
    switch (msg.type) {
      case "start":
        return this.start(msg.personId);
      case "set_person":
        return this.setPerson(msg.personId);
      case "say":
        this.partial(msg.text, msg.speaker);
        this.track(this.commit(msg.text, msg.speaker)); // don't block the next message on a slow hint
        return;
      case "stop":
        return this.stop();
    }
  }

  /** Raw mic audio (MIC_AUDIO format). */
  audio(chunk: Buffer): void {
    this.stt?.write(chunk);
  }

  send(msg: ServerMsg): void {
    this.transport.json(msg);
  }

  async whisper(text: string): Promise<void> {
    const hint = { id: newId(), text, at: Date.now() };
    this.conversation.hints.push(hint);
    this.send({ type: "hint", ...hint });
    const t0 = Date.now();
    let firstAudio = 0;
    try {
      for await (const chunk of synthesize(text)) {
        firstAudio ||= Date.now() - t0;
        this.transport.binary(chunk);
      }
    } catch (e) {
      console.error("[live:tts]", e); // the hint is already on screen; a silent whisper beats none
    }
    if (firstAudio) console.log(`[live] whisper "${text}" first audio +${firstAudio}ms`);
  }

  shareLink(link: Link): void {
    if (this.conversation.linksShared.some((l) => l.url === link.url)) return;
    this.conversation.linksShared.push(link);
    this.send({ type: "link_card", link });
  }

  setSpeaker(u: Utterance, speaker: Speaker): void {
    u.speaker = speaker; // u is the transcript entry itself, so the saved conversation sees it
  }

  async stop(): Promise<void> {
    if (!this.started || this.ended) return;
    this.ended = true;
    this.stt?.close();
    await Promise.all(this.inflight);
    this.conversation.endedAt = Date.now();
    if (this.conversation.transcript.length > 0) {
      await db.conversations.put(this.userId, this.conversation);
      await this.fanOut("onEnd", (l) => l.onEnd?.(this));
    }
    this.send({ type: "ended", conversationId: this.conversation.id });
  }

  private async start(personId?: string): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.profile = await db.profiles.get(this.userId, "me");
    if (personId) await this.setPerson(personId);
    this.stt = openStt({
      onPartial: (text, speaker) => this.partial(text, speaker),
      onCommit: (text, speaker) => this.track(this.commit(text, speaker)),
    });
    this.send({ type: "ready", conversationId: this.conversation.id });
  }

  private async setPerson(personId: string): Promise<void> {
    this.person = await db.people.get(this.userId, personId);
    if (!this.person) return this.send({ type: "error", message: `unknown person ${personId}` });
    this.conversation.personId = personId;
    this.send({ type: "person", personId, name: this.person.name });
  }

  private partial(text: string, speaker: Speaker): void {
    this.send({ type: "transcript", speaker, text, final: false });
    for (const l of this.listeners) {
      try {
        l.onPartial?.(this, text, speaker);
      } catch (e) {
        console.error(`[live:${l.name}] onPartial`, e);
      }
    }
  }

  private async commit(text: string, speaker: Speaker): Promise<void> {
    if (speaker === "unknown" && isEchoOfHint(text, this.conversation.hints)) return; // the mic heard the coach
    const u: Utterance = { speaker, text, at: Date.now() };
    this.conversation.transcript.push(u);
    this.send({ type: "transcript", speaker, text, final: true });
    await this.fanOut("onUtterance", (l) => l.onUtterance?.(this, u));
  }

  private track(p: Promise<void>): void {
    this.inflight.add(p);
    void p.finally(() => this.inflight.delete(p));
  }

  /** Run a hook on every listener in parallel; one listener failing never breaks the others. */
  private async fanOut(hook: string, call: (l: LiveListener) => unknown): Promise<void> {
    await Promise.all(
      this.listeners.map(async (l) => {
        try {
          await call(l);
        } catch (e) {
          console.error(`[live:${l.name}] ${hook}`, e);
        }
      }),
    );
  }
}

const ECHO_WINDOW_MS = 8000;
const words = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** On a speaker (not earbuds) the mic picks up the whisper; such lines are mostly a recent hint's words. */
export function isEchoOfHint(text: string, hints: Hint[], now = Date.now()): boolean {
  const said = words(text);
  if (said.length === 0) return false;
  return hints.some((h) => {
    if (now - h.at > ECHO_WINDOW_MS) return false;
    const hinted = new Set(words(h.text));
    return said.filter((w) => hinted.has(w)).length / said.length >= 0.6;
  });
}
