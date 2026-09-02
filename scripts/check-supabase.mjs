// Diagnostic : vérifie l'état du projet Supabase via l'API REST publique
// (fonctionne avec la clé anon ; n'expose rien de sensible).
// Usage : node scripts/check-supabase.mjs
// Codes attendus : 200 (table accessible) / PGRST205 (table absente) / 42501 (RLS)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("Env manquantes : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const tables = ["students", "challenges", "teams", "profiles"];
for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  if (res.status === 200) {
    const rows = await res.json();
    console.log(`✅ ${t} : accessible (ex:${rows.length} ligne(s) visibles)`);
  } else {
    const body = await res.json().catch(() => ({}));
    console.log(`❌ ${t} : HTTP ${res.status} — ${body.message ?? body.error ?? "?"}`);
  }
}

// Défis seed : accessibles seulement si la migration a été exécutée
const ch = await fetch(`${url}/rest/v1/challenges?select=id,title,points&limit=100`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
});
if (ch.status === 200) {
  const list = await ch.json();
  console.log(`\n🎯 Défis en base : ${list.length}`);
  if (list.length) {
    console.log(`   ex: ${list[0]?.title} (+${list[0]?.points})`);
  }
}
