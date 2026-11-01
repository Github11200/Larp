// Chunk 1 · Browser audio: mic -> MIC_AUDIO PCM chunks, and WHISPER_AUDIO PCM chunks -> earbud.
// One AudioContext for both, created inside the Start tap: iOS Safari only lets a gesture unlock audio,
// and runs it at the hardware rate, so the worklet resamples to 16kHz itself.
import { MIC_AUDIO, WHISPER_AUDIO } from "@larp/shared";

/** ~100ms per chunk: small enough for fast partials, big enough not to flood the socket. */
const CHUNK_SAMPLES = MIC_AUDIO.sampleRate / 10;

// Runs on the audio thread: averages hardware-rate samples down to 16kHz (a cheap low-pass), as 16-bit PCM.
const WORKLET = `
class Pcm extends AudioWorkletProcessor {
  ratio = sampleRate / ${MIC_AUDIO.sampleRate}; t = 0; acc = 0; cnt = 0;
  buf = new Int16Array(${CHUNK_SAMPLES}); n = 0;
  process([input]) {
    const ch = input[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.cnt++; this.t++;
      if (this.t < this.ratio) continue;
      this.t -= this.ratio;
      const s = Math.max(-1, Math.min(1, this.acc / this.cnt));
      this.acc = 0; this.cnt = 0;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.buffer, [this.buf.buffer]); this.buf = new Int16Array(${CHUNK_SAMPLES}); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("pcm", Pcm);`;

/**
 * Auto gain evens out loudness, which hides the best clue to who's talking (the user is nearest the mic).
 * `?agc=off` turns it off for testing; remembered on this device like `?user=`.
 */
const autoGain = (() => {
  const fromUrl = new URLSearchParams(location.search).get("agc");
  try {
    if (fromUrl) localStorage.setItem("larp.agc", fromUrl);
    return (fromUrl ?? localStorage.getItem("larp.agc")) !== "off";
  } catch {
    return fromUrl !== "off";
  }
})();

export class LiveAudio {
  private ctx: AudioContext | null = null;
  private micStarted = false;
  private stopMic?: () => void;
  private sources: AudioBufferSourceNode[] = [];
  private endsAt = 0;
  private visHandler?: () => void;

  /**
   * Call synchronously from the Start tap. Unlocks playback, then asks for the mic.
   * Safe to tap twice: a second call never opens a second mic. Throws if the mic is refused.
   */
  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    const ctx = this.unlock();
    if (this.micStarted) return;
    this.micStarted = true;
    // Asked before any await, so it still counts as part of the tap.
    const streamP = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: autoGain },
    });
    try {
      const stream = await streamP;
      await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" })));
      if (this.ctx !== ctx) return stream.getTracks().forEach((t) => t.stop()); // closed while asking
      const node = new AudioWorkletNode(ctx, "pcm");
      node.port.onmessage = (e) => onChunk(e.data as ArrayBuffer);
      const src = ctx.createMediaStreamSource(stream);
      src.connect(node);
      node.connect(ctx.destination); // outputs silence; Safari only runs nodes that reach the destination
      this.stopMic = () => {
        stream.getTracks().forEach((t) => t.stop());
        src.disconnect();
        node.disconnect();
      };
      // iOS/Android suspend the AudioContext when the page backgrounds; resume it when it returns.
      this.visHandler = () => {
        if (document.visibilityState === "visible" && this.ctx?.state === "suspended") {
          void this.ctx.resume();
        }
      };
      document.addEventListener("visibilitychange", this.visHandler);
    } catch (e) {
      this.micStarted = false; // let them try again after fixing permissions
      throw e;
    }
  }

  /** Plays streamed whisper audio gaplessly. Before a tap has unlocked audio it tries anyway (desktop allows it). */
  play(chunk: ArrayBuffer): void {
    const ctx = this.ctx ?? this.unlock();
    const pcm = new Int16Array(chunk);
    const buffer = ctx.createBuffer(1, pcm.length, WHISPER_AUDIO.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    // A little lead time on the first chunk absorbs network jitter between chunks.
    const at = Math.max(this.endsAt, ctx.currentTime + 0.05);
    src.start(at);
    this.endsAt = at + buffer.duration;
    this.sources.push(src);
    src.onended = () => (this.sources = this.sources.filter((s) => s !== src));
  }

  /** A new hint cuts off the previous whisper. */
  cut(): void {
    this.sources.forEach((s) => s.stop());
    this.sources = [];
    this.endsAt = 0;
  }

  /**
   * Escape call ringtone, loud as the page allows (the web can't raise system volume).
   * Uses the context the Start tap unlocked, so it rings even when a spoken phrase triggers it. Returns stop.
   */
  ring(): () => void {
    const ctx = this.ctx ?? this.unlock();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    // A bright two-note trill, twice, then a pause: reads as "phone ringing" without copying a real ringtone.
    const burst = () => {
      const t0 = ctx.currentTime + 0.02;
      for (let i = 0; i < 12; i++) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = i % 2 ? 1320 : 1760;
        const at = t0 + i * 0.08 + (i >= 6 ? 0.25 : 0);
        env.gain.setValueAtTime(0.5, at);
        env.gain.exponentialRampToValueAtTime(0.01, at + 0.075);
        osc.connect(env).connect(out);
        osc.start(at);
        osc.stop(at + 0.08);
      }
    };
    burst();
    const timer = setInterval(burst, 2500);
    navigator.vibrate?.([800, 400, 800, 400, 800]);
    return () => {
      clearInterval(timer);
      navigator.vibrate?.(0);
      out.disconnect();
    };
  }

  /** Plays a whole clip (the fake caller's voice) through the unlocked context. Returns stop. */
  async playClip(url: string): Promise<() => void> {
    const ctx = this.ctx ?? this.unlock();
    const buffer = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    return () => src.stop();
  }

  close(): void {
    this.stopMic?.();
    this.stopMic = undefined;
    this.micStarted = false;
    if (this.visHandler) {
      document.removeEventListener("visibilitychange", this.visHandler);
      this.visHandler = undefined;
    }
    void this.ctx?.close();
    this.ctx = null;
  }

  private unlock(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // iOS unlocks output by playing something inside the gesture; one silent frame is enough.
      const blip = this.ctx.createBufferSource();
      blip.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      blip.connect(this.ctx.destination);
      blip.start();
    }
    void this.ctx.resume();
    return this.ctx;
  }
}
