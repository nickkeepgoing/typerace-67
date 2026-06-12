# ⚡ TypeRace 67 — Setup Guide

A global multiplayer typing race. Fastest to type the 67-character sentence wins.
Stack: **Vanilla JS + Supabase (auth, database, realtime) + Vercel (hosting)**. Cost: **$0**.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**.
2. Pick a name (e.g. `typerace-67`), set a database password, choose a region near your players, click **Create new project** and wait ~1 minute.

## 2. Run the SQL

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**, paste the entire contents of **`supabase-setup.sql`**, click **Run**.
3. You should see "Success". This creates the `profiles` and `scores` tables, all RLS policies, the `best_scores` view, and enables realtime on `scores`.

## 3. Verify dashboard settings

- **Database → Replication** (or **Realtime** section): confirm `scores` is listed under the `supabase_realtime` publication. The SQL already added it; this is just a sanity check.
- **Authentication → Sign In / Providers → Email**: make sure **Email** provider is enabled (it is by default).
- **Optional but recommended for instant play:** in **Authentication → Sign In / Providers → Email**, turn **OFF** "Confirm email". Players can then play immediately after registering. (If you leave it on, the app handles it gracefully — players are told to check their inbox first.)

## 4. Get your URL and anon key

1. Go to **Project Settings → API** (gear icon).
2. Copy:
   - **Project URL** → e.g. `https://abcdefgh.supabase.co`
   - **anon public** API key → long string starting with `eyJ...`
3. Open **`supabase-client.js`** and replace the two placeholders at the top:

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

> The anon key is safe to ship in frontend code — Row Level Security protects the data.

## 5. Test locally (optional)

ES modules need a web server (opening `index.html` directly via `file://` won't work):

```bash
npx serve .        # or: python3 -m http.server 8000
```

Open the printed URL, register two accounts in two browser windows, and race.

## 6. Deploy to Vercel

**Option A — drag & drop:** go to [vercel.com](https://vercel.com) → **Add New → Project** → drag the project folder in. It's a static site; no build settings needed (Framework Preset: **Other**, no build command, output directory: root).

**Option B — CLI:**
```bash
npm i -g vercel
vercel          # from the project folder, accept defaults
vercel --prod
```

Your game is now live at `https://your-project.vercel.app` for players worldwide. 🌍

## 7. (Recommended) Lock auth to your domain

In Supabase: **Authentication → URL Configuration** → set **Site URL** to your Vercel URL.

---

## File map

| File | Purpose |
|---|---|
| `index.html` | All screens (auth / lobby / game / result / leaderboard) |
| `style.css` | Neon design system, animations |
| `supabase-client.js` | **← put your URL + anon key here** |
| `auth.js` | Register / login / logout / session |
| `game.js` | Timer (10 ms ticks), live char coloring, particles, sounds, score save |
| `leaderboard.js` | Top 20 + realtime subscription + global rank |
| `sentences.js` | 10 sentences, each exactly 67 chars (5 EN / 5 TH) |
| `app.js` | Entry point: screen routing, session restore, sound engine |
| `supabase-setup.sql` | Run once in the Supabase SQL editor |

## Troubleshooting

- **"Could not load the leaderboard"** → check the URL/key in `supabase-client.js` and that the SQL ran without errors.
- **Leaderboard not updating live** → confirm `scores` is in the realtime publication (step 3).
- **"Check your email to confirm"** after registering → email confirmation is on; either confirm via the email or disable it (step 3).
- **Network/CORS errors locally** → make sure you're serving over `http://localhost`, not `file://`.
