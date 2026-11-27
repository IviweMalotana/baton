# Deploy Baton: Vercel web + Railway worker

This is the split shape. Vercel serves the Next.js app and API routes. Railway
runs the background worker and, because the repo's Dockerfile is based on the
Playwright image, it has Chromium for the browser checks. Both use the same
Postgres database.

If you want the simplest possible install instead, use the single Railway
service in [`../DEPLOY.md`](../DEPLOY.md). That shape runs the web app and the
worker in one container.

## 1. Create the database

Create a Postgres database with any provider (Neon, Supabase, Vercel Postgres or
Railway Postgres). Copy its connection string. It must be the same value on
Vercel and Railway.

## 2. Deploy the web app to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New â†’ Project â†’ Import Git Repository** and pick `baton`.
3. Framework preset: **Next.js**. Leave the build command alone; `vercel.json`
   runs the Postgres schema switch, Prisma generate, `prisma db push` and
   `next build`.
4. Add these environment variables for Production, Preview and Development:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | your Postgres connection string |
   | `AUTH_SECRET` | `openssl rand -hex 32` |
   | `APP_URL` | `https://your-domain.example` |
   | `DEEPSEEK_API_KEY` | optional, for real BRD/planner output |
| `DEEPGRAM_API_KEY` | optional, for live stakeholder transcription |
   | `GITHUB_CLIENT_ID` | optional, from the GitHub OAuth App |
   | `GITHUB_CLIENT_SECRET` | optional, from the GitHub OAuth App |

   `EXTERNAL_WORKER=true` is already set by `vercel.json`, so Vercel does not
   start an in-process worker.
5. Deploy. The first build applies the schema.

## 3. Deploy the worker to Railway

1. In Railway, **New Project â†’ Deploy from GitHub repo** and pick `baton`.
2. Create a second service from the same repo, or use one service with the
   worker start command. Set the service's config-as-code path to
   `railway.worker.json`, or set the start command to `npm run worker`.
3. Add the same environment variables as Vercel, except leave
   `EXTERNAL_WORKER` unset. The worker must see the same `DATABASE_URL`,
   `AUTH_SECRET` and `APP_URL`.
4. Deploy. The worker polls the `Job` table. A request filed on Vercel is picked
   up here.

## 4. GitHub OAuth (optional)

Create an OAuth App at <https://github.com/settings/developers>:

- Homepage URL: `${APP_URL}`
- Authorization callback URL: `${APP_URL}/api/oauth/github/callback`

Add the client ID and secret to both services and redeploy. Then connect GitHub
from **Settings â†’ Connect GitHub**.

## 5. Verify

1. Open the Vercel URL over HTTPS.
2. Press **Explore the demo workspace**. The first click seeds the demo company
   if the database is empty, then signs you in.
3. Register a fresh company at `/register`.
4. File a request and watch it move through the pipeline. With no API key or
   GitHub token it uses the deterministic fallbacks, so the whole flow still
   completes.

## Notes

- Vercel cannot run the long-lived worker or a full Chromium, so do not unset
  `EXTERNAL_WORKER` there.
- The demo is not seeded on every Vercel request. `enterDemo` creates it on
  first use, and the Docker/Railway single-service path seeds it on boot.
- Set `SEED_DEMO=false` on a private install that should not carry the demo.
