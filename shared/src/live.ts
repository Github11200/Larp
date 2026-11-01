// WebSocket protocol for a live conversation (phone <-> server). One socket per conversation.
//
// Text frames: JSON matching ClientMsg / ServerMsg below.
// Binary frames, client -> server: mic audio, MIC_AUDIO format.
// Binary frames, server -> client: whisper audio for the latest hint, WHISPER_AUDIO format.
import { z } from "zod";
import { Link, Speaker } from "./models";

export const LIVE_PATH = "/live";

/** Mic audio the phone streams up. Matches what ElevenLabs realtime STT accepts. */
export const MIC_AUDIO = { encoding: "pcm_s16le", sampleRate: 16000, channels: 1 } as const;
/** Whisper audio the server streams down. Raw PCM so the browser can play chunks as they arrive. */
export const WHISPER_AUDIO = { encoding: "pcm_s16le", sampleRate: 24000, channels: 1 } as const;

export const ClientMsg = z.discriminatedUnion("type", [
  /** Begin a conversation, optionally with a known person (their dossier powers hints). */
  z.object({ type: z.literal("start"), personId: z.string().optional() }),
  /** Switch who you're talking to mid-session. */
  z.object({ type: z.literal("set_person"), personId: z.string() }),
  /** Inject a transcript line without a mic. Used by tests, the sim script, and demo fallback. */
  z.object({ type: z.literal("say"), speaker: Speaker, text: z.string() }),
  /** End the conversation; server saves it and runs end-of-conversation listeners. */
  z.object({ type: z.literal("stop") }),
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

export const ServerMsg = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), conversationId: z.string() }),
  z.object({ type: z.literal("transcript"), speaker: Speaker, text: z.string(), final: z.boolean() }),
  /** A whisper. Its audio (if any) follows as binary frames. */
  z.object({ type: z.literal("hint"), id: z.string(), text: z.string() }),
  z.object({ type: z.literal("link_card"), link: Link }),
  z.object({ type: z.literal("person"), personId: z.string(), name: z.string() }),
  z.object({ type: z.literal("ended"), conversationId: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type ServerMsg = z.infer<typeof ServerMsg>;
