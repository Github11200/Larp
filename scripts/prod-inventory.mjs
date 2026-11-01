// Read-only: counts what a prod user has stored. Usage: node scripts/prod-inventory.mjs <user-id> [api]
const [user, api = "https://larp-api.onrender.com"] = process.argv.slice(2);
const get = async (p) => (await fetch(api + p, { headers: { "x-user-id": user } })).json();
const profile = await get("/api/profile");
console.log("profile:", profile ? profile.name : "none");
for (const p of ["/api/events", "/api/contacts", "/api/conversations", "/api/followups"]) {
  const rows = await get(p);
  console.log(p, Array.isArray(rows) ? rows.length : rows, Array.isArray(rows) ? rows.slice(0, 8).map((r) => r.name ?? r.id).join(" | ") : "");
}
