# Deploy Baton from the browser

This is the click-by-click path for getting Baton live without a terminal. It
uses Railway for the app (Docker + Chromium + worker) and your DNS host for the
custom domain.

Baton is one Next.js app. Its API routes live on the same host under `/api`, so
there is no separate API service and no `api.` subdomain.

## Before you start

- A GitHub repo containing this code.
- A Railway account, a Postgres plugin, and the domain you want to use.
- `AUTH_SECRET` — generate one with `openssl rand -hex 32` or any 64-character
  random hex string.
- Optional: an Anthropic API key for real BRD/planner output.
- Optional: a GitHub OAuth App for connecting repositories and opening PRs.

## Part A — deploy the app

1. In Railway, choose **New Project → Deploy from GitHub repo** and pick the
   Baton repo.
2. Add **New → Database → PostgreSQL**.
3. On the app service, open **Variables** and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `AUTH_SECRET` = your random secret
   - `APP_URL` = the public URL you will use
   - `ANTHROPIC_API_KEY` = optional
   - `ANTHROPIC_MODEL` = `claude-sonnet-4-5`
4. Do not set a build or start command. The repo ships `Dockerfile` and
   `railway.json`, so Railway builds the Playwright image and runs
   `scripts/start.sh`.
5. Deploy and watch the build logs. The first build pulls the Playwright image,
   so give it a few minutes.
6. Open the public URL and register the first company.

## Part B — custom domain

1. In the app service, open **Settings → Networking → Custom Domain** and add
   the domain.
2. Copy the Railway DNS target.
3. At your DNS host, add a `CNAME` from the subdomain to that target.
4. Wait for Railway to verify the domain and issue TLS. Propagation can take
   minutes to a couple of hours; that is normal.

## Part C — GitHub OAuth (optional)

1. Go to <https://github.com/settings/developers> → **New OAuth App**.
2. Set:
   - Application name: `Baton`
   - Homepage URL: your public URL
   - Authorization callback URL: `${APP_URL}/api/oauth/github/callback`
3. Copy the client ID and generate a client secret.
4. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to the app variables and
   redeploy.
5. In Baton, open **Settings → Connect GitHub** and authorize.

## Part D — verify

1. Open the site over HTTPS.
2. Press **Explore the demo** to confirm the seeded workspace loads.
3. Register a fresh company and confirm you reach the dashboard.
4. Connect GitHub, then set the "app under test" URL in Settings.

## Notes

- The demo workspace ships with three requests at different pipeline stages so
  the product is understandable before any integration is connected.
- The worker runs in the same process in this shape. If you split the web app to
  Vercel, set `EXTERNAL_WORKER=true` there and run `npm run worker` on Railway.
