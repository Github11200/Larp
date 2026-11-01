// Chunk 1 · One live conversation. Owns the transcript and fans events out to LiveListeners.
// Features plug in as listeners (src/listeners.ts) instead of editing this file, so chunks don't collide.
import type {
  ClientMsg,
  Conversation,
  Event,
  Hint,
  Link,
  Participant,
  Person,
  Profile,
  ServerMsg,
  Speaker,
  Utterance,
} from "@larp/shared";
import { db, newId } from "../../lib/db";
import { catchNames, matchAttendee } from "./names";
import { openersFor } from "./openers";
import { openStt, sttAvailable, type SttStream } from "./stt";
import { synthesize } from "./tts";

export interface LiveContext {
  readonly userId: string;
  readonly profile: Profile | null;
  /** Who you're talking to (the primary person), with their dossier if prepped. */
  readonly person: Person | null;
  /** Every prepped person in the conversation (groups have several). Unknowns are only in conversation.participants. */
  readonly people: readonly Person[];
  /** The event this conversation is at, if any. */
  readonly event: Event | null;
  readonly conversation: Conversation;
  send(msg: ServerMsg): void;
  /** Speak a hint into the earbud (and show it on screen). A newer whisper cuts off an older one. */
  whisper(text: string): Promise<void>;
  /** Pop a link card on screen. Repeats of the same URL are ignored. */
  shareLink(link: Link): void;
  /** Correct who said a line. The mic can't tell speakers apart, so lines start as "unknown". */
  setSpeaker(u: Utterance, speaker: Speaker): void;
  /** Background work (e.g. a timer-fired hint) that stop() should briefly wait for before saving. */
  track(p: Promise<unknown>): void;
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

/** How long a conversation survives its socket closing (refresh, tunnel, locked phone) before it's saved. */
export const GRACE_MS = 90_000;
/** A saved conversation active this recently can still be picked back up (e.g. after a server restart). */
const RESUME_WINDOW_MS = 10 * 60_000;
/** Saving never waits longer than this on a slow hint. */
export const STOP_WAIT_MS = 2000;

const NO_TRANSPORT: Transport = { json() {}, binary() {} };
/** Conversations in progress, so a reconnecting phone gets the same one back. */
const open = new Map<string, LiveSession>();
const key = (userId: string, conversationId: string) => `${userId}\u0000${conversationId}`;

/** The session a socket should talk to: the in-progress one it asks to resume, or a fresh one. */
export function sessionFor(userId: string, transport: Transport, listeners: LiveListener[], conversationId?: string): LiveSession {
  const existing = conversationId ? open.get(key(userId, conversationId)) : undefined;
  if (existing) {
    existing.attach(transport);
    return existing;
  }
  return new LiveSession(userId, transport, listeners);
}

export class LiveSession implements LiveContext {
  profile: Profile | null = null;
  person: Person | null = null;
  people: Person[] = [];
  event: Event | null = null;
  conversation: Conversation = { id: newId(), startedAt: Date.now(), transcript: [], hints: [], linksShared: [], participants: [] };
  private stt: SttStream | null = null;
  private started = false;
  private ended = false;
  /** Utterance handling still running (e.g. a hint being generated); stop() waits briefly for it. */
  private inflight = new Set<Promise<unknown>>();
  /** Bumped per whisper; an older whisper stops streaming audio once a newer one starts. */
  private whisperSeq = 0;
  private lineIds = new WeakMap<Utterance, string>();
  private graceTimer?: NodeJS.Timeout;
  /** Saves run one after another, so a late mid-chat snapshot can never overwrite the final save. */
  private saving = Promise.resolve();

  constructor(
    readonly userId: string,
    private transport: Transport,
    private listeners: LiveListener[],
  ) {}

  async handle(msg: ClientMsg): Promise<void> {
    switch (msg.type) {
      case "start":
        return this.start(msg.personId, msg.conversationId);
      case "set_person":
        return this.setPerson(msg.personId);
      case "add_participant":
        return this.addParticipant(msg);
      case "remove_participant":
        return this.removeParticipant(msg);
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
    const mine = ++this.whisperSeq;
    this.conversation.hints.push(hint);
    this.send({ type: "hint", ...hint });
    const t0 = Date.now();
    let firstAudio = 0;
    try {
      for await (const chunk of synthesize(text)) {
        // Audio frames carry no hint id, so a superseded whisper must go quiet before the new one's frames.
        if (this.ended || mine !== this.whisperSeq) break;
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
    this.send({ type: "transcript", speaker, text: u.text, final: true, id: this.lineId(u) });
  }

  track(p: Promise<unknown>): void {
    this.inflight.add(p);
    void p.finally(() => this.inflight.delete(p));
  }

  /** A new socket took over this conversation (reconnect). */
  attach(transport: Transport): void {
    clearTimeout(this.graceTimer);
    this.transport = transport;
  }

  /** The socket went away. Keep the conversation for a while in case the phone comes back. */
  detach(transport: Transport): void {
    if (this.transport !== transport || this.ended) return; // a newer socket already took over
    this.transport = NO_TRANSPORT;
    this.stt?.close();
    this.stt = null;
    if (!this.started) return;
    this.graceTimer = setTimeout(() => void this.stop(), GRACE_MS);
    this.graceTimer.unref();
  }

  async stop(): Promise<void> {
    if (!this.started || this.ended) return;
    this.ended = true;
    clearTimeout(this.graceTimer);
    open.delete(key(this.userId, this.conversation.id));
    this.stt?.close();
    // Wait for a hint in progress, but a stalled LLM/TTS call must never block saving.
    await Promise.race([Promise.allSettled(this.inflight), sleep(STOP_WAIT_MS)]);
    this.conversation.endedAt = Date.now();
    if (this.conversation.transcript.length > 0) {
      await this.save();
      await this.fanOut("onEnd", (l) => l.onEnd?.(this));
    }
    this.send({ type: "ended", conversationId: this.conversation.id });
  }

  private async start(personId?: string, conversationId?: string): Promise<void> {
    if (this.started) return this.resumeLive(); // reconnect to a conversation still in memory
    this.started = true;
    this.profile = await db.profiles.get(this.userId, "me");
    const resumed = conversationId ? await this.adoptSaved(conversationId) : false;
    open.set(key(this.userId, this.conversation.id), this);
    if (!resumed && personId) await this.setPerson(personId);
    if (!this.event) await this.pickEvent();
    this.openStt();
    this.sendReady(resumed);
  }

  /** Pick a recently saved conversation back up (the server restarted or the grace period ran out). */
  private async adoptSaved(conversationId: string): Promise<boolean> {
    const saved = await db.conversations.get(this.userId, conversationId);
    const lastActive = saved?.endedAt ?? saved?.transcript.at(-1)?.at ?? saved?.startedAt ?? 0;
    if (!saved || Date.now() - lastActive > RESUME_WINDOW_MS) return false;
    this.conversation = { ...saved, endedAt: undefined };
    for (const p of saved.participants) {
      const person = p.personId ? await db.people.get(this.userId, p.personId) : null;
      if (person) this.people.push(person);
    }
    this.person = this.people.find((p) => p.id === saved.personId) ?? this.people[0] ?? null;
    if (saved.eventId) this.event = await db.events.get(this.userId, saved.eventId);
    return true;
  }

  private resumeLive(): void {
    if (this.ended) return this.send({ type: "ended", conversationId: this.conversation.id });
    this.openStt();
    this.sendReady(true);
  }

  private openStt(): void {
    this.stt ??= openStt({
      onPartial: (text, speaker) => this.partial(text, speaker),
      onCommit: (text, speaker) => this.track(this.commit(text, speaker)),
    });
  }

  /** Ready, then everything the screen needs to pick up where it was. */
  private sendReady(resumed: boolean): void {
    this.send({ type: "ready", conversationId: this.conversation.id, resumed, ears: sttAvailable, eventId: this.event?.id });
    for (const u of this.conversation.transcript) {
      this.send({ type: "transcript", speaker: u.speaker, text: u.text, final: true, id: this.lineId(u) });
    }
    const lastHint = this.conversation.hints.at(-1);
    if (resumed && lastHint) this.send({ type: "hint", ...lastHint });
    this.sendParticipants();
  }

  /** The person's event, else the newest one: whose attendees caught names are matched against. */
  private async pickEvent(): Promise<void> {
    const eventId = this.person?.eventId ?? (await db.events.list(this.userId)).at(-1)?.id;
    this.event = eventId ? await db.events.get(this.userId, eventId) : null;
    this.conversation.eventId = this.event?.id;
  }

  /** Make someone the primary person. A bad id keeps whoever was there before. */
  private async setPerson(personId: string): Promise<void> {
    const person = await db.people.get(this.userId, personId);
    if (!person) return this.send({ type: "error", message: `unknown person ${personId}` });
    this.person = person;
    this.conversation.personId = person.id;
    this.join(person);
    if (this.event?.id !== person.eventId) {
      this.event = await db.events.get(this.userId, person.eventId);
      this.conversation.eventId = this.event?.id;
    }
    this.send({ type: "person", personId, name: person.name });
    this.sendParticipants();
  }

  private async addParticipant({ personId, name }: { personId?: string; name?: string }): Promise<void> {
    if (personId) {
      const person = await db.people.get(this.userId, personId);
      if (!person) return this.send({ type: "error", message: `unknown person ${personId}` });
      return this.welcome(person, person.name);
    }
    const said = name?.trim();
    if (said) await this.welcome(matchAttendee(said, await this.attendees()) ?? null, said);
  }

  private removeParticipant({ personId, name }: { personId?: string; name?: string }): void {
    const c = this.conversation;
    c.participants = c.participants.filter((p) => (personId ? p.personId !== personId : p.name !== name));
    this.people = this.people.filter((p) => c.participants.some((q) => q.personId === p.id));
    if (this.person && !this.people.includes(this.person)) {
      this.person = this.people[0] ?? null;
      c.personId = this.person?.id;
    }
    this.sendParticipants();
  }

  /** Someone joined (tapped or caught by name). The first prepped person becomes the primary one. */
  private async welcome(person: Person | null, name: string): Promise<void> {
    if (person && !this.person) return this.setPerson(person.id);
    if (person) this.join(person);
    else if (!this.conversation.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      this.conversation.participants.push({ name });
    }
    this.sendParticipants();
  }

  /** Add a prepped person to the participants (once), upgrading a name-only entry that was them. */
  private join(person: Person): void {
    if (!this.people.some((p) => p.id === person.id)) this.people.push(person);
    const entry: Participant = { name: person.name, personId: person.id, contactId: person.contactId };
    const list = this.conversation.participants;
    const i = list.findIndex((p) => p.personId === person.id || (!p.personId && matchAttendee(p.name, [person])));
    if (i >= 0) list[i] = entry;
    else list.push(entry);
  }

  private sendParticipants(): void {
    this.send({ type: "participants", participants: this.conversation.participants, personId: this.person?.id });
    this.send({ type: "openers", lines: openersFor(this) });
  }

  private async attendees(): Promise<Person[]> {
    const eventId = this.event?.id;
    if (!eventId) return [];
    return (await db.people.list(this.userId)).filter((p) => p.eventId === eventId);
  }

  /** Names said out loud join the conversation; a matching attendee brings their dossier. */
  private async catchNames(text: string): Promise<void> {
    const ignore = [this.profile?.name ?? "", ...(this.profile?.projects.map((p) => p.name) ?? [])];
    for (const c of catchNames(text, await this.attendees(), ignore)) await this.welcome(c.person ?? null, c.name);
  }

  /** Dossiers still cooking when the chat started may be ready now. */
  private async refreshPending(): Promise<void> {
    let changed = false;
    for (const old of this.people.filter((p) => !p.dossier)) {
      const fresh = await db.people.get(this.userId, old.id);
      if (!fresh?.dossier) continue;
      this.people = this.people.map((p) => (p.id === fresh.id ? fresh : p));
      if (this.person?.id === fresh.id) this.person = fresh;
      changed = true;
    }
    if (changed) this.send({ type: "openers", lines: openersFor(this) });
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
    this.send({ type: "transcript", speaker, text, final: true, id: this.lineId(u) });
    if (this.started) void this.save(); // snapshot: a server restart mid-chat can resume from here
    try {
      await this.catchNames(text);
      await this.refreshPending();
    } catch (e) {
      console.error("[live] names", e); // knowing who's there is a bonus; never lose the line over it
    }
    await this.fanOut("onUtterance", (l) => l.onUtterance?.(this, u));
  }

  private save(): Promise<void> {
    const snapshot = structuredClone(this.conversation);
    this.saving = this.saving
      .then(() => db.conversations.put(this.userId, snapshot))
      .then(
        () => {},
        (e) => console.error("[live] save", e),
      );
    return this.saving;
  }

  private lineId(u: Utterance): string {
    return this.lineIds.get(u) ?? this.lineIds.set(u, newId()).get(u)!;
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms).unref());

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
