# Claude Agent Rules

## Overall

This project is for a hackathon. All of your work and product design decisions should keep in mind `RUBRIC.md` and actually improve the design of our demo and product for judging at the Hackathon.

## Coding
Part A: Local rules

1. For nontrivial ad-hoc commands (more than 3 lines), ALWAYS write a bash script in `scripts/`. Also avoid long CLI commands like `sleep 5 && curl http://localhost | python -c...` . Write a temporary script instead, and edit it to do other ad-hoc commands.

2. Test things yourself rather than asking the user to test. Use browser automation (e.g. Playwright) for UI verification, unit tests for logic.

3. Code standards:
   - Functions single responsibility
   - No duplicated logic — extract shared code

4. Code comments: Document intent behind implementation in comments (business domain level), not low level detail that's easily seen from the code itself. Use super concise clear language. Only comment when nessecary

5. Git commits: Commit regularly and often. no need to wait for user approval. These commits serve as checkpoints for work and markers of progress. Keep commit messages concise and terse. 

6. Do not credit or mention yourself in commit messages or descriptions.

Part B: Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting. Mention it and ask for permission first.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Team integration (read `docs/integration.md` first)

Several people and agents build chunks of `plan.md` in parallel. To keep them snapping together:

1. Work inside your chunk's folders (ownership table in `docs/integration.md`). Outside them, only add one-liners to the shared glue files.
2. Chunks connect only through `shared/` contracts: models, `api` routes, live protocol, `LiveListener`, jobs. Contract changes are additive-only and go in their own commit.
3. Keep stubs working: the app must run with no API keys, no DB, and no Redis. Degrade gracefully when a key is missing.
4. Live path: no network or `await` in `onPartial`; slow work goes in prep jobs.
5. LLM calls go through `server/src/lib/llm.ts` only (provider-agnostic; don't hardcode a vendor elsewhere).
6. Before merging to `main` (auto-deploys to Render): `npm test && npm run typecheck`, plus `node scripts/ui-smoke.mjs` if web changed.
