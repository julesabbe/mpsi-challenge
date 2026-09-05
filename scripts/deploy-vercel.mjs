// Deploys the repo to Vercel via the REST API (no CLI, no project pre-creation).
// Usage: VERCEL_TOKEN=xxx node scripts/deploy-vercel.mjs
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID || "team_jVqIKnHUXJNda9TsIyl2Xc9R";
const API = "https://api.vercel.com";
const NAME = "mpsi-challenge";

if (!TOKEN) {
  console.error("Missing VERCEL_TOKEN");
  process.exit(1);
}

// 1. Env vars from .env.local (never printed)
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (line.trim().startsWith("#")) continue;
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(".env.local missing Supabase vars");
  process.exit(1);
}
console.log(`env vars loaded: ${Object.keys(env).join(", ")}`);

// 2. File list from git (respects .gitignore — no .env.local, no node_modules)
const files = execSync("git ls-files", { encoding: "utf8" })
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((f) => {
    const b = readFileSync(f);
    return {
      file: f.replace(/\\/g, "/"),
      sha: createHash("sha1").update(b).digest("hex"),
      size: b.length,
    };
  });
console.log(`files to deploy: ${files.length}`);

// 3. Create the deployment
const payload = {
  name: NAME,
  target: "production",
  files,
  env,
  build: { env },
  projectSettings: { framework: "nextjs" },
};

const res = await fetch(
  `${API}/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);
const created = await res.json();

if (!res.ok) {
  console.error(
    `CREATE FAILED ${res.status}: ${JSON.stringify(created).slice(0, 400)}`
  );
  process.exit(1);
}

const dep = created.deployment ?? created;
const id = dep.id;
writeFileSync("deploy-state.json", JSON.stringify({ id, url: dep.url ?? null }));
console.log(`deployment created: ${id} (${dep.readyState ?? "?"})`);

// 4. Upload missing files if the API reports any
const missingShas = new Set((dep.missing ?? []).map((f) => f.sha));
if (missingShas.size > 0) {
  console.log(`uploading ${missingShas.size} missing file(s)...`);
  for (const f of files) {
    if (!missingShas.has(f.sha)) continue;
    const up = await fetch(
      `${API}/v2/files?teamId=${TEAM}&deploymentId=${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/octet-stream",
          "x-vercel-digest": f.sha,
        },
        body: readFileSync(f.file),
      }
    );
    if (!up.ok) {
      console.error(`UPLOAD FAILED ${f.file}: ${up.status}`);
      process.exit(1);
    }
  }
  console.log("all files uploaded");
} else {
  console.log("no file uploads reported");
}

// 5. Poll until ready
const url0 = `${API}/v13/deployments/${id}?teamId=${TEAM}`;
let last = "";
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const s = await (await fetch(url0, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })).json();
  const state = s.readyState ?? s.status;
  if (state !== last) {
    console.log(`state: ${state}`);
    last = state;
  }
  if (state === "READY" || s.readyState === "READY") {
    console.log(`DEPLOYED: https://${s.url ?? dep.url}`);
    if (s.alias) console.log(`alias: ${JSON.stringify(s.alias)}`);
    process.exit(0);
  }
  if (state === "ERROR" || state === "CANCELED") {
    console.error(`deploy failed: ${s.errorMessage ?? "unknown"}`);
    if (s.builds) {
      for (const b of s.builds) console.error(`build ${b.id}: ${b.state}`);
    }
    process.exit(1);
  }
}
console.error("timeout waiting for build (check dashboard for progress)");
process.exit(1);
