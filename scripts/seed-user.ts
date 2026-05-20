/**
 * Seed a single test user + a default namespace so you can hit the proxy
 * with curl during Week 1 before the web app's onboarding is wired up.
 *
 * Usage:
 *   DATABASE_URL=postgresql://mnemo_user:mnemo_password@localhost:5432/mnemo_db \
 *     pnpm exec tsx seed-user.ts
 *
 * Output: the test proxy_token to use as the Authorization bearer.
 */
import "dotenv/config";
import { randomUUID, randomBytes } from "node:crypto";

const url = process.env.DATABASE_URL;
console.log("DEBUG url:", JSON.stringify(url));
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// Lightweight node-postgres import without making it a hard package.json dep:
const pgModuleName = "pg";
const pg = await import(pgModuleName).catch(() => {
  console.error("npm install pg first: pnpm add -D pg");
  process.exit(1);
});

const client = new (pg as any).default.Client({ connectionString: url });
await client.connect();

const userId = randomUUID();
const token = "test-" + randomBytes(8).toString("hex");
const suiAddr = "0x" + randomBytes(32).toString("hex");
const nsId = randomUUID();
const nsObj = "0x" + randomBytes(32).toString("hex");

await client.query(
  "INSERT INTO users (id, sui_address, proxy_token) VALUES ($1, $2, $3)",
  [userId, suiAddr, token]
);
await client.query(
  "INSERT INTO namespaces (id, user_id, sui_object_id, name, is_default) VALUES ($1, $2, $3, 'main', true)",
  [nsId, userId, nsObj]
);

console.log("seeded test user:");
console.log("  user_id     :", userId);
console.log("  sui_address :", suiAddr);
console.log("  proxy_token :", token);
console.log("  namespace_id:", nsId);
console.log("");
console.log("Test the proxy:");
console.log(`  curl http://localhost:8080/u/${userId}/v1/chat/completions \\`);
console.log(`    -H "Content-Type: application/json" \\`);
console.log(`    -H "Authorization: Bearer ${token}" \\`);
console.log(`    -d '{\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello in 5 words.\"}]}'`);

await client.end();
