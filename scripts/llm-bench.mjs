// Latency bench: Baseten vs OpenAI models, same prompt, streamed like the live hint path.
// Usage: node --env-file=.env scripts/llm-bench.mjs list
//        node --env-file=.env scripts/llm-bench.mjs [runs] model1 model2 ...   ("openai:<id>" = OpenAI)
const P = {
  baseten: { url: "https://inference.baseten.co/v1", key: process.env.BASETEN_API_KEY },
  openai: { url: "https://api.openai.com/v1", key: process.env.OPENAI_API_KEY },
};

// Mirrors llm.ts provider knobs: thinking off, so we time answers, not reasoning.
const params = (prov, n) =>
  prov === "openai"
    ? { max_completion_tokens: n, reasoning_effort: "none" }
    : { max_tokens: n, chat_template_kwargs: { enable_thinking: false, thinking: false } };

const SYSTEM =
  "You are a discreet networking coach whispering in the user's earpiece at a hackathon. The user is Sam, a backend engineer who built a voice app. Reply with one short, natural line Sam could say next. No preamble.";
const PROMPT =
  'Transcript so far:\nOther: "Yeah so I\'m doing infra at a robotics startup, mostly fleet telemetry."\nSam: "Oh nice, how big is the fleet?"\nOther: "About four hundred arms across three warehouses right now."\nWhat should Sam say next?';

async function list() {
  for (const [name, p] of Object.entries(P)) {
    if (!p.key) { console.log(`${name}: no key`); continue; }
    const res = await fetch(`${p.url}/models`, { headers: { authorization: `Bearer ${p.key}` } });
    const ids = res.ok ? (await res.json()).data.map((m) => m.id).sort() : [`HTTP ${res.status}`];
    console.log(`\n${name}:\n  ${ids.join("\n  ")}`);
  }
}

async function once(model) {
  const prov = model.startsWith("openai:") ? "openai" : "baseten";
  const id = prov === "openai" ? model.slice(7) : model;
  const t0 = performance.now();
  const res = await fetch(`${P[prov].url}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${P[prov].key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: id,
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: PROMPT }],
      stream: true,
      ...params(prov, 200),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  let ttft, text = "", buf = "";
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith("data:") || l.includes("[DONE]")) continue;
      const d = JSON.parse(l.slice(5)).choices?.[0]?.delta?.content;
      if (d) { ttft ??= performance.now() - t0; text += d; }
    }
  }
  return { ttft, total: performance.now() - t0, chars: text.length, text };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function bench(runs, models) {
  const out = Object.fromEntries(models.map((m) => [m, { ttft: [], total: [], cps: [], errs: 0, sample: "" }]));
  await Promise.all(models.map((m) => once(m).catch(() => {}))); // warm connections, not timed
  // Interleave models each round so network drift hits all of them equally.
  for (let r = 0; r < runs; r++) {
    for (const m of models) {
      try {
        const x = await once(m);
        const o = out[m];
        o.ttft.push(x.ttft); o.total.push(x.total);
        o.cps.push(x.chars / ((x.total - x.ttft) / 1000 || 1)); o.sample = x.text;
      } catch (e) { out[m].errs++; out[m].lastErr = e.message; }
    }
  }
  console.log(`\n${runs} runs each, median ms (min-max). cps = output chars/sec after first token.\n`);
  for (const [m, o] of Object.entries(out)) {
    if (!o.ttft.length) { console.log(`${m}\n  FAILED: ${o.lastErr}`); continue; }
    const f = (xs) => `${median(xs).toFixed(0)} (${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)})`;
    console.log(`${m}\n  ttft ${f(o.ttft)}  total ${f(o.total)}  cps ${median(o.cps).toFixed(0)}  errs ${o.errs}${o.errs ? ` (${o.lastErr.slice(0, 90)})` : ""}\n  "${o.sample.trim().slice(0, 110)}"`);
  }
}

const [first, ...rest] = process.argv.slice(2);
if (first === "list") await list();
else if (/^\d+$/.test(first ?? "")) await bench(Number(first), rest);
else await bench(5, [first, ...rest].filter(Boolean));
