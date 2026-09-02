# 🏁 MPSI Challenge

Application web mobile-first pour le challenge d'intégration d'une promotion MPSI :
les élèves forment des équipes de 3, réalisent des défis filmés, le Super Admin
valide les vidéos et les points alimentent un classement en temps réel.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (thème sombre « compétition », animations légères)
- **Supabase** : PostgreSQL + RLS, Auth, Storage (vidéos privées, URLs signées)
- Déployable sur **Vercel** en quelques minutes

## Configuration Supabase (≈ 10 minutes)

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → colle tout le contenu de
   `supabase/migrations/0001_init.sql` → **Run**.
   Ce script crée les tables, les policies RLS, les fonctions RPC, le bucket
   `challenge-submissions` (privé, 150 Mo max, MP4/MOV/WebM) et 18 défis
   d'exemple.
3. **Settings → API** : copie l'`URL` et la clé `anon` dans `.env.local` :

   ```bash
   cp .env.example .env.local
   # puis renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. **Authentication → Providers → Email** : activé (par défaut). Pour une
   promo, tu peux désactiver « Confirm email » (Auto-confirm users) pour que
   les élèves se connectent directement avec mot de passe.
5. Crée le compte du Super Admin : **Authentication → Users → Add user**
   (email + mot de passe). Récupère son **User UID**.
6. Désigne ce compte comme admin **sans jamais se fier au frontend** :
   - **Option A (recommandée)** : dans `supabase/config.toml` (ou via les
     variables d'environnement Supabase si tu as la CLI), définis :

     ```toml
     [auth]
     enable_auto_provisioning = true

     [app]
     admin_auth_user_ids = "LE_UID_DU_SUPER_ADMIN"
     ```

     Le trigger `handle_new_user` lira `app.admin_auth_user_ids` et créera le
     profil avec `role = 'admin'`.
   - **Option B (immédiate, à la main)** : dans le SQL Editor :

     ```sql
     update public.profiles set role = 'admin'
     where auth_user_id = 'LE_UID_DU_SUPER_ADMIN';
     ```

7. Ajoute les élèves dans **/admin → Élèves** (ou directement en SQL), puis
   crée les comptes correspondants dans **Authentication → Users** si tu veux
   une connexion par mot de passe (les élèves sélectionnent ensuite leur nom
   dans la liste à la première connexion).

> ⚠️ Seule la clé `anon` est exposée côté client. Le rôle admin est vérifié
> côté base de données (RLS + fonctions `security definer`), jamais dans le
> navigateur.

## Démarrage

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000 — la racine redirige vers `/welcome` (nouvel
élève) puis `/select-student`, `/create-team`, `/dashboard`.

## Parcours élève

```
Bienvenue → Qui es-tu ? → Forme ton équipe (2 camarades + nom + emoji)
→ Dashboard → Défis → Envoi vidéo → Validation admin → Points 🏆
```

- L'identité est **verrouillée** après la première sélection (modifiable
  uniquement par le Super Admin).
- Un élève ne peut appartenir qu'à **une seule équipe** (contrainte SQL
  `unique` + RPC atomique `create_team_rpc`).
- Une équipe ne peut pas soumettre deux fois le même défi en attente/validé ;
  un défi **refusé** peut être retenté.
- Les points ne sont crédités **qu'à la validation**, une seule fois
  (garde anti-double-crédit dans `review_submission_rpc`).

## Parcours Super Admin

`/admin` (réservé au rôle `admin`, sinon redirection) :

| Section        | Actions |
| -------------- | ------- |
| Dashboard      | Statistiques globales + dernières soumissions |
| Élèves         | Créer / modifier / désactiver / supprimer (avec confirmation) |
| Équipes        | Renommer, emoji, ajouter/retirer un membre, dissoudre |
| Défis          | CRUD complet, difficulté, catégorie, vidéo obligatoire, actif |
| Soumissions    | 3 onglets, lecteur vidéo (URL signée), valider / refuser avec motif |
| Points         | Bonus / malus avec aperçu du score + historique complet |

## Déploiement Vercel

1. Pousse le repo sur GitHub, puis **Import Project** sur
   [vercel.com](https://vercel.com).
2. Ajoute les variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production + Preview).
3. Dans Supabase → **Authentication → URL Configuration**, ajoute ton domaine
   Vercel aux **Redirect URLs** (ex : `https://mon-app.vercel.app/**`).
4. Build automatique à chaque push. 🚀

## Notes techniques

- **Sécurité** : RLS activée partout ; un utilisateur ne peut insérer une
  soumission que pour **son** équipe et en tant que **lui-même**
  (`my_team_id()` / `my_student_id()` côté SQL). Les vidéos sont stockées dans
  un bucket **privé** ; seuls les admins ont le droit de lecture, l'upload est
  réservé au dossier `team_id/…` de l'équipe.
- **Points** : jamais de score stocké « en dur » — le score est la somme des
  lignes de `point_transactions` (types : `challenge`, `bonus`, `penalty`,
  `manual_adjustment`).
- **Notifications** : créées par triggers SQL à la validation/refus et lors
  des bonus/malus.
- **PWA** : manifest + icônes ; installable depuis le navigateur mobile
  (« Ajouter à l'écran d'accueil »).
