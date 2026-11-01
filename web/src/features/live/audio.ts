// Chunk 1 · Browser audio: mic -> MIC_AUDIO PCM chunks, and WHISPER_AUDIO PCM chunks -> earbud.
import { MIC_AUDIO, WHISPER_AUDIO } from "@larp/shared";

/** ~100ms per chunk: small enough for fast partials, big enough not to flood the socket. */
const CHUNK_SAMPLES = MIC_AUDIO.sampleRate / 10;

// Runs on the audio thread: float samples -> 16-bit PCM, posted in CHUNK_SAMPLES batches.
const WORKLET = `
class Pcm extends AudioWorkletProcessor {
  buf = new Int16Array(${CHUNK_SAMPLES}); n = 0;
  process([input]) {
    const ch = input[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.buffer, [this.buf.buffer]); this.buf = new Int16Array(${CHUNK_SAMPLES}); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("pcm", Pcm);`;

/** Starts the mic and calls onChunk with raw PCM. Returns a function that stops it. */
export async function startMic(onChunk: (pcm: ArrayBuffer) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  // The browser resamples the mic to the context rate, so no resampling code needed.
  const ctx = new AudioContext({ sampleRate: MIC_AUDIO.sampleRate });
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" })));
  const node = new AudioWorkletNode(ctx, "pcm");
  node.port.onmessage = (e) => onChunk(e.data as ArrayBuffer);
  ctx.createMediaStreamSource(stream).connect(node);
  await ctx.resume();
  return () => {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}

/** Plays streamed whisper audio gaplessly. A new hint cuts off the previous one. */
export class WhisperPlayer {
  private ctx = new AudioContext();
  private sources: AudioBufferSourceNode[] = [];
  private endsAt = 0;

  play(chunk: ArrayBuffer): void {
    void this.ctx.resume();
    const pcm = new Int16Array(chunk);
    const buffer = this.ctx.createBuffer(1, pcm.length, WHISPER_AUDIO.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    // A little lead time on the first chunk absorbs network jitter between chunks.
    const at = Math.max(this.endsAt, this.ctx.currentTime + 0.05);
    src.start(at);
    this.endsAt = at + buffer.duration;
    this.sources.push(src);
    src.onended = () => (this.sources = this.sources.filter((s) => s !== src));
  }

  cut(): void {
    this.sources.forEach((s) => s.stop());
    this.sources = [];
    this.endsAt = 0;
  }

  close(): void {
    void this.ctx.close();
  }
}
