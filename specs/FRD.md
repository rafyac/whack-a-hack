# Functional Requirements Document

## Session administration
- Admin authentication uses a shared admin code supplied through `ADMIN_CODE`.
- Admin can explicitly log out, which clears the admin cookie session.
- Server startup fails if `ADMIN_CODE` is missing.
- Admin can create, rename, delete, reset, open, and close sessions.
- Each session stores:
  - display name
  - status (`setup`, `open`, `closed`)
  - points per team
  - commissioner points

## Team and commissioner management
- A session can contain many teams and at most one commissioner entry.
- Admin can create participants with:
  - name
  - password
  - kind (`team` or internal `judge` value for the commissioner role)
- Admin can edit names and passwords after creation.
- Commissioner is excluded from vote targets and public rankings.

## Team/commissioner login
- Login requires session id, participant name, and password.
- Only `open` sessions are available for voter login.
- Successful login creates a voter session tied to one participant and one session.

## Ballot rules
- Voters can only submit allocations inside their own session.
- Team voters cannot vote for themselves.
- No voter can allocate points to the commissioner entry.
- Allocation totals must exactly match the voter budget:
  - team -> `pointsPerTeam`
  - commissioner -> `judgePoints`
- Re-saving a ballot replaces that voter’s previous allocations.

## Results behavior
- Admin live results show per-session totals while voting is open.
- Public results are only exposed for `closed` sessions.
- Ranked results include teams only and sort by total points descending.

## Reset and change handling
- Resetting a session removes submitted votes for that session only.
- Changing a session budget invalidates prior votes for that session so new ballots match the new budget.

## Deployment and persistence
- **Native local dev**: client and server run separately; SQLite lives under `server\data`, and developers provide `ADMIN_CODE` via `server/.env` before `npm run dev`.
- **Local container parity**: `docker compose` runs the production image with persisted data in `.localdata`, using caller-supplied `ADMIN_CODE` and `COOKIE_SECRET`.
- **Cloud target**: single container deployment with mounted persistent storage for SQLite and environment-managed `ADMIN_CODE`/`COOKIE_SECRET`.
- **Azure option**: parameterized Bicep in `infra/` can deploy the app to Azure Container Apps using a caller-supplied image reference, secure secrets, and Azure Files mounted at `/data`.

## Test strategy
- Server coverage is API-level integration testing with `node:test` and `supertest`.
- Client coverage includes focused unit tests with `vitest` for session-selection logic.
- Browser coverage is Playwright end-to-end testing against the built app.
- Current test focus is critical flow coverage:
  - session setup and visibility
  - team/commissioner authentication
  - login/results session-selection helpers
  - vote validation and session isolation
  - public leaderboard behavior
