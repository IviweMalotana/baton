# Baton

**The AI senior BA for software teams.** A stakeholder files a request. Baton
investigates it, writes the business requirements as Gherkin, files the Jira
tickets, and â€” after a human approves the requirements â€” plans, builds, tests and
opens the pull request.

```
Request -> Discovery (voice + questions) -> brief confirmed -> UX check
        -> Gherkin BRD -> human approval -> Plan -> Build -> Playwright QA -> PR
```

Baton is not a chatbot and not a Jira replacement. It is the requirements and
delivery layer that sits between the people who ask for change and the tools
that ship it: Jira stays the source of truth, GitHub stays the source of code,
Playwright stays the test runner. Baton keeps the thread between them.

## What it does

- **Interviews the stakeholder.** Captures the conversation live with Deepgram
  (speaker-labelled) or accepts pasted notes, then asks one clarifying question
  at a time until every decision is confirmed. Nothing is drafted before that.
- **Understands the request.** Classifies a bug or a feature, reproduces the bug
  in headless Chromium, or scopes the feature against the repository.
- **Writes a real BRD.** Plain-language narrative plus `Given / When / Then`
  scenarios, acceptance criteria and explicit assumptions.
- **Stops for a human.** Requirements can be accepted, altered or rejected.
  Nothing is built until the gate passes.
- **Files the delivery work in Jira.** A product ticket plus design, backend,
  frontend and (only when needed) DevOps tickets, filed under the existing epic.
- **Plans and builds.** Reads the repo, writes the change on a branch, and opens
  a pull request.
- **Verifies in a browser.** Acceptance, bug-fix and regression checks run
  against the real app before the PR is considered done.
- **Keeps the trail.** Every requirement, decision, ticket, branch, PR, test and
  release is linked back to the request that caused it.

Without a DeepSeek key (Anthropic also works), a Deepgram key, GitHub connection
or app URL, each stage degrades to a deterministic fallback so the whole pipeline
still runs end to end.

## Stack

- Next.js 14 App Router, TypeScript, React Server Components and server actions
- Prisma + SQLite locally, Postgres in production
- Self-contained auth: bcrypt + signed JWT session cookie (`jose`)
- GitHub OAuth, Jira REST v3, DeepSeek (Anthropic fallback), Deepgram streaming,
  Playwright
- A durable Postgres-backed job queue with one worker per process

## Quick start

```bash
npm install
cp .env.example .env        # set AUTH_SECRET (and optionally the integrations)
npm run setup               # prisma db push + seed the demo workspace
npm run dev                 # http://localhost:3000
```

Or with Bun:

```bash
bun install
bun run setup
bun run dev
```

### Demo workspace

The seed creates a populated workspace so you can look around without connecting
anything:

| Role | Email | Password |
| --- | --- | --- |
| Owner / BA | `ada@acme.test` | `password123` |
| Collaborator | `grace@acme.test` | `password123` |
| Stakeholder | `stan@acme.test` | `password123` |

You can also just press **Explore the demo** on the login page. To create your
own workspace, register at `/register` â€” the first user owns the company and can
invite the rest of the team.

## How it fits together

```
src/
  app/
    (auth)/             register + login
    (app)/              dashboard, requests, projects, product, releases,
                        integrations, members, settings
    actions/            server actions (auth, requests, members, settings, jira)
    api/oauth/github/   OAuth start + callback
  components/           sidebar, request form, BRD approval, member form
  lib/
    auth.ts             sessions, password hashing, role helpers
    db.ts               Prisma client
    jira/client.ts      Jira REST v3 client
    agents/             uxCheck, questions, brd, impact, planner, builder,
                        tester, verification, tickets, design, release, pr,
                        orchestrator
    queue.ts            durable job queue + worker
prisma/
  schema.prisma         company, users, requests, requirements, tickets,
                        releases, knowledge model
  seed.ts               demo workspace
```

The pipeline runs in two phases in `src/lib/agents/orchestrator.ts`:
`runToApproval` (up to the human gate) and `runAfterApproval` (build through QA
and PR). Both run on the background worker so filing a request returns
immediately.

## Roles

| Role | Can do |
| --- | --- |
| Owner | Everything, including company settings and member management |
| Admin | Manage members and settings, run the pipeline |
| BA | Shape requirements and run the BA stages |
| Product | Manage projects, releases and product knowledge |
| Developer | Run the build and QA stages |
| QA | Run and review verification |
| Viewer | Read-only |

## Configuration

See `.env.example` for the full list.

- `DATABASE_URL` â€” SQLite file locally; Postgres in production.
- `AUTH_SECRET` â€” signs session cookies. Use a long random string.
- `APP_URL` â€” public base URL; used for OAuth callbacks.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` â€” a GitHub OAuth App with the
  callback `${APP_URL}/api/oauth/github/callback`.
- `DEEPSEEK_API_KEY` â€” the default text provider for discovery, BRD, plan and
  release notes. `DEEPSEEK_MODEL` defaults to `deepseek-flash`.
- `DEEPGRAM_API_KEY` - live stakeholder transcription. The browser streams audio
  to `/api/deepgram/stream`; the key never leaves the server.
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` â€” optional fallback if no DeepSeek key.
- `EXTERNAL_WORKER` â€” set to `true` on a web-only host such as Vercel; run
  `npm run worker` on a long-lived host.

## Deploy

Baton needs a database, a long-lived Node process, and (for real browser QA)
Chromium.

- **One Railway service** (simplest): the Dockerfile plus a Postgres plugin. The
  web app and worker run together.
- **Vercel web + Railway worker**: Vercel serves the app, Railway runs the
  worker and Chromium. Both use the same Postgres.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIviweMalotana%2Fbaton)

See **[DEPLOY.md](./DEPLOY.md)** for the single-service shape and
**[docs/DEPLOY-vercel-railway.md](./docs/DEPLOY-vercel-railway.md)** for the
Vercel + Railway split.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

`npm run build` is the full gate: Prisma client generation plus a production
Next.js build.
