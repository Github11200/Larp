// Render Cron Job entrypoint.
import { runNudges } from "./modules/followups/nudge";

const nudged = await runNudges();
console.log(`nudged ${nudged} follow-ups`);
process.exit(0);
