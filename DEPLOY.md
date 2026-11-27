# Deploying Baton

Baton is a Next.js app with a durable background worker and, for real QA, a
headless Chromium. That means it needs three things in production:

1. a PostgreSQL database,
2. a long-lived Node process for the web app,
3. a long-lived process for the worker (which can be the same process).

There are two supported shapes. Pick one.

## Shape A - one Railway service (recommended)

This is the simplest and the one the repo's `Dockerfile` is built for. Railway
builds the Playwright image, which includes Chromium, and runs `scripts/start.sh`
to apply the schema and start Next.js. The worker runs in-process.

1. Create a new Railway project from this repo (`baton`).
2. Add **PostgreSQL**.
3. On the app service, set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` = a long random string
   - `APP_URL` = the public URL (for example `https://baton.example.com`)
   - `DEEPSEEK_API_KEY` = default text provider (discovery, BRD, plan, notes)
   - `DEEPGRAM_API_KEY` = live stakeholder transcription
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` = optional, enables real PRs
4. Do **not** set a custom build or start command. `railway.json` and the
   `Dockerfile` handle it.
5. Deploy, then open the public URL and register the first company.

This is the shape to use if you want the browser QA checks to run in
production.

## Shape B - Vercel web + Railway worker

Vercel is excellent at serving the web app, but it cannot run a long-lived loop
or a full Chromium at the size the QA agents need. In this shape:

- **Vercel** serves the Next.js app and API routes with `EXTERNAL_WORKER=true`.
- **Railway** runs `npm run worker` using `railway.worker.json`.
- Both point at the **same** Postgres database and share `AUTH_SECRET` and
  `APP_URL`.

`vercel.json` already sets `EXTERNAL_WORKER=true` and the Postgres build step.
On the Railway worker service, leave `EXTERNAL_WORKER` unset.

Required on both services:

| Variable | Vercel | Railway worker |
| --- | --- | --- |
| `DATABASE_URL` | same Postgres URL | same Postgres URL |
| `AUTH_SECRET` | required | required |
| `APP_URL` | public URL | the same public URL |
| `DEEPSEEK_API_KEY` | recommended | Default text provider for every agent. |
| `DEEPGRAM_API_KEY` | recommended | Live stakeholder transcription. |
| `ANTHROPIC_API_KEY` | optional | Fallback when no DeepSeek key is set. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | optional |
| `EXTERNAL_WORKER` | `true` | leave unset |

### Postgres

Either Vercel Postgres or Railway Postgres works; the only rule is that both
services receive the same `DATABASE_URL`. Run `npx prisma db push` once against
that database (the Docker start script does this automatically on Railway).

## GitHub OAuth

Create an OAuth App at <https://github.com/settings/developers>:

- Homepage URL: `${APP_URL}`
- Authorization callback URL: `${APP_URL}/api/oauth/github/callback`

Copy the client ID and secret into the environment. The callback must match
`APP_URL` exactly (scheme and host) or the state check will reject it.

## Environment contract

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres in production. SQLite is local only. |
| `AUTH_SECRET` | yes | Long random string. `openssl rand -hex 32`. |
| `APP_URL` | yes | Public HTTPS URL. Used for OAuth callbacks. |
| `DEEPSEEK_API_KEY` | recommended | Discovery, BRD, plan, code review and release notes. |
| `DEEPSEEK_MODEL` | optional | Defaults to `deepseek-flash`. |
| `DEEPGRAM_API_KEY` | recommended | Speaker-labelled live transcription. Server-side only. |
| `DEEPGRAM_MODEL` | optional | Defaults to `nova-3`. |
| `ANTHROPIC_API_KEY` | optional | Fallback if no DeepSeek key is set. |
| `ANTHROPIC_MODEL` | optional | Defaults to a Sonnet model. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | Enables GitHub connect and real PRs. |
| `EXTERNAL_WORKER` | Vercel only | `true` skips the in-process worker. |
| `SEED_DEMO` | optional | Defaults to `true` on the Docker start path. Set `false` for a private install with no demo workspace. |

Secrets live in the host's environment store. Never commit `.env`.

## Local production check

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
npm start
```

For a single-host production run, `scripts/start.sh` does the schema push and
starts Next.js bound to `0.0.0.0:$PORT`.
