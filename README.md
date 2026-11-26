# Baton

**The AI senior BA for software teams.** A stakeholder files a request. Baton
investigates it, writes the business requirements as Gherkin, files the Jira
tickets, and — after a human approves the requirements — plans, builds, tests and
opens the pull request.

```
Request -> UX check -> Gherkin BRD -> human approval -> Plan -> Build -> Playwright QA -> PR
```

Baton is not a chatbot and not a Jira replacement. It is the requirements and
delivery layer that sits between the people who ask for change and the tools
that ship it: Jira stays the source of truth, GitHub stays the source of code,
Playwright stays the test runner. Baton keeps the thread between them.

## What it does

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

Without an Anthropic key, GitHub connection or app URL, each stage degrades to a
deterministic fallback so the whole pipeline still runs end to end.

## Stack

- Next.js 14 App Router, TypeScript, React Server Components and server actions
- Prisma + SQLite locally, Postgres in production
- Self-contained auth: bcrypt + signed JWT session cookie (`jose`)
- GitHub OAuth, Jira REST v3, Anthropic SDK, Playwright
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
own workspace, register at `/register` — the first user owns the company and can
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

- `DATABASE_URL` — SQLite file locally; Postgres in production.
- `AUTH_SECRET` — signs session cookies. Use a long random string.
- `APP_URL` — public base URL; used for OAuth callbacks.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — a GitHub OAuth App with the
  callback `${APP_URL}/api/oauth/github/callback`.
- `ANTHROPIC_API_KEY` — enables the real BRD, questions and planner agents.
- `ANTHROPIC_MODEL` — defaults to a Sonnet model.
- `EXTERNAL_WORKER` — set to `true` on a web-only host such as Vercel; run
  `npm run worker` on a long-lived host.

## Deploy

Baton needs a database, a long-lived Node process, and (for real browser QA)
Chromium. The simplest production shape is **one Railway service with the
Dockerfile plus a Postgres plugin**. Vercel can serve the web app, but the worker
must run elsewhere.

See **[DEPLOY.md](./DEPLOY.md)** for both shapes, the environment contract and
the GitHub OAuth callback.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

`npm run build` is the full gate: Prisma client generation plus a production
Next.js build.
