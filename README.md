# pr-review-desk

Local-first PR review desk — list GitHub PRs, run AI code reviews with Claude Code, post findings as inline comments.

## Prerequisites

- Docker
- `gh auth login` (authenticated on the host)
- Claude Code CLI authenticated on the host

## Quick start

```bash
docker compose up --build
```

Then open http://localhost:3100

## Development mode

```bash
npm install
npm run dev
```

Runs Express on `:3100` and Vite on `:5173`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | Port the Express server listens on (default `3100`) |
| `REPOS` | Comma-separated list of `owner/repo` to list PRs from |

## How it works

- Lists PRs across configured repos via the `gh` CLI
- Runs Claude Code with review skills against the PR diff
- Parses findings and lets you post them one-by-one as inline comments

## Architecture

Express backend + React frontend + SQLite, shells out to the `gh` and `claude` CLIs.
