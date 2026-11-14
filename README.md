# CFP Stats

Opponent-adjusted efficiency ratings for every FBS team, built from live
[collegefootballdata.com](https://collegefootballdata.com) (CFBD) data. Used to
rank teams, predict games, and project the 12-team College Football Playoff
field.

## Stack

- **Next.js 16 (App Router) + TypeScript**, deployed on Vercel
- **Neon Postgres**, accessed with **Drizzle ORM** (`@neondatabase/serverless` HTTP driver)
- **GitHub Actions** cron, calling a protected `/api/refresh` route to pull new
  data and recompute ratings
- No external job queue — ingestion runs fully inside one API route each time it fires

## Rating methodology

See [`src/lib/ratings/engine.ts`](src/lib/ratings/engine.ts) for the full implementation.

1. Pull each team's per-game offensive/defensive PPA (predicted points added
   per play) from CFBD's advanced box score stats (`/stats/game/advanced`).
2. Iteratively opponent-adjust offense and defense (each team's efficiency is
   measured relative to the *current* strength of the opponents it faced,
   re-solved to convergence) — the same kind of iterative adjustment used by
   SRS/Massey-style ratings, applied to play-level efficiency instead of raw
   score margin.
3. Blend that adjusted-efficiency rating (70%) with a classic opponent-adjusted
   margin-of-victory rating ("SRS", 30%) for stability early in the season when
   the per-team sample size is small.
4. `overallRating` is expressed in "points above average per game." Game
   predictions ([`src/lib/ratings/engine.ts`](src/lib/ratings/engine.ts)'s
   `predictMatchup`) take the rating difference, add a flat home-field edge, and
   convert to a win probability with a logistic curve.

This is a transparent approximation of what Bill Connelly's SP+ does
conceptually — it is **not** a reproduction of the real (non-public) SP+
formula.

## CFP projection logic

See [`src/lib/ratings/cfp.ts`](src/lib/ratings/cfp.ts). Mirrors the real
12-team format:

- A conference's champion is read off its championship game result when CFBD
  has tagged one (`notes` field containing "Championship"); otherwise it falls
  back to the best conference record (ties broken by rating). This fallback
  only matters before championship weekend, or for conferences without a title
  game.
- The 5 highest-rated conference champions get automatic bids.
- The top 4 of those get seeds 1-4 and a first-round bye.
- The remaining 7 spots go to the next highest-rated teams regardless of
  conference (at-large), and are seeded 5-12 together with the 5th champion.

## One-time setup

### 1. Neon Postgres

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string into `DATABASE_URL`.
3. Run `npm run db:push` locally once to create the schema (tables are defined
   in [`src/lib/db/schema.ts`](src/lib/db/schema.ts)).

### 2. CollegeFootballData.com API key

1. Sign up for a free key at [collegefootballdata.com/key](https://collegefootballdata.com/key).
2. Put it in `CFBD_API_KEY`.

### 3. Local environment

```bash
cp .env.example .env.local
# fill in DATABASE_URL, CFBD_API_KEY, and any random string for CRON_SECRET
npm install
npm run db:push
npm run ingest        # pulls current-season data and computes ratings once
npm run dev
```

### 4. Deploy to Vercel

1. Import `eang0521/cfp-stats` into Vercel.
2. Add the same three environment variables (`DATABASE_URL`, `CFBD_API_KEY`,
   `CRON_SECRET`) in the Vercel project settings.
3. Deploy.

### 5. Keep data fresh (GitHub Actions)

Vercel's own Cron Jobs are capped at once/day on the Hobby plan, so refreshing
is instead driven by a GitHub Actions workflow
([`.github/workflows/refresh.yml`](.github/workflows/refresh.yml)) that calls
`POST /api/refresh` on a schedule (every 3 hours by default — adjust the cron
expression as you like).

Add two repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `REFRESH_URL` | `https://<your-vercel-domain>/api/refresh` |
| `CRON_SECRET` | same value as the `CRON_SECRET` env var in Vercel |

You can also trigger it manually any time from the Actions tab
(`workflow_dispatch`), or hit `/api/refresh?secret=...` in a browser while
testing.

## Known limitations / ideas for V2

- Conference-championship detection relies on CFBD tagging the game's `notes`
  field with the conference name — verify this against actual results during
  championship week.
- The rating engine recomputes from scratch on every refresh (no incremental
  state), which is simple but means a full season of games/stats is refetched
  each run.
- No player-level or injury data; ratings are purely team-level efficiency and
  margin.
- Home-field advantage and the win-probability logistic curve use fixed,
  hand-picked constants rather than being fit to historical data.
