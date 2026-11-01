// Ad-hoc: run the profile LLM extraction on a fake resume N times, report how often the schema rejects it.
// npx tsx --env-file-if-exists=../.env scripts/profile-extract-try.ts [runs]
import { extract } from "../src/modules/profile/build";

const resumeText = `Sam Rivera
sam.rivera@example.com · Toronto
EDUCATION
University of Waterloo, BASc Computer Engineering 2027
EXPERIENCE
Software Intern, Shopify — built checkout latency dashboards (Go, React)
Research Assistant, UW — speech recognition for noisy rooms (PyTorch)
PROJECTS
Rally — voice-first group chat for runners. github.com/samr/rally
Pantry — fridge photo to recipe app (no public link)
Tiny Lisp — interpreter in Rust
SKILLS
TypeScript, Go, Rust, Python, PyTorch, React, Postgres, Docker
INTERESTS
Bouldering, film photography`;

const runs = Number(process.argv[2] ?? 3);
let failed = 0;
for (let i = 0; i < runs; i++) {
  const t = Date.now();
  const out = await extract({ userId: "try", resumeText, urls: ["https://linkedin.com/in/samr"] }, { texts: [] }, null);
  const usedFallback = out.skills.length === 0;
  if (usedFallback) failed++;
  console.log(`run ${i + 1}: ${Date.now() - t}ms fallback=${usedFallback} skills=${out.skills.length} projects=${out.projects.length}`);
}
console.log(`${failed}/${runs} fell back to the rule-based profile`);
