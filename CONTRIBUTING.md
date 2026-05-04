# Contributing to Whack-A-Hack

Thanks for contributing.

## Before you start

- For **app behavior changes**, update `specs/PRD.md` or `specs/FRD.md` before implementation, or include the spec update in the same pull request.
- Keep changes aligned with `specs/architecture.md`, the current multi-session voting flow, and the existing test strategy.
- Do not commit secrets, local `.env` files, or SQLite data files.

## Local setup

1. Install dependencies:

   ```bash
   npm run install:all
   ```

2. Copy `server/.env.example` to `server/.env` and set your own `ADMIN_CODE` and `COOKIE_SECRET`.

3. Start the app:

   ```bash
   npm run dev
   ```

## Checks before opening a pull request

Run the same core validations that CI expects:

```bash
npm test
docker build -t whack-a-hack .
```

If your change affects docs, screenshots, or deployment guidance, update the relevant files in the same PR.

## Pull request expectations

- Keep PRs focused and explain the reason for the change.
- Mention any user-facing behavior changes clearly.
- Update tests when behavior changes or regressions are being fixed.
- Update README and deployment docs when setup or operations change.

## Review process

1. Open a pull request from your fork or branch.
2. Fill in the PR template.
3. Address review feedback.
4. Once approved and green, the PR can be merged.
