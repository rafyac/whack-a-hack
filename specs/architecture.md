# Architecture Reference

## System shape
- **Client**: React + Vite SPA for login, voting, results, and admin workflows.
- **Server**: Express API handling auth, session management, vote validation, results, and static asset hosting.
- **Data store**: SQLite database accessed directly from the Node server.

## Core runtime model
1. Admin signs in with an admin cookie session.
2. Admin configures a voting session and adds teams plus an optional commissioner.
3. Teams/commissioner sign in with session-specific credentials.
4. Ballots are validated server-side and stored in SQLite.
5. Admin can inspect live results; public results unlock only after close.

## Data model
- **sessions**: name, status, team budget, commissioner budget
- **teams**: session membership, name, password, participant kind
- **votes**: voter -> target allocations within a session

Important implemented rules:
- teams belong to one session only
- one commissioner max per session
- commissioner can vote but cannot receive votes
- team voters cannot vote for themselves
- results aggregate only voteable teams

## Application boundaries
- The client talks to the server over `/api`.
- The server owns all business rules; the client mirrors rules for UX but server validation is authoritative.
- Built client assets are served by the same Node process in deployed/containerized environments.

## Auth and session handling
- **Admin auth**: shared admin code from `ADMIN_CODE`, signed HttpOnly cookie, and startup failure when `ADMIN_CODE` is missing.
- **Voter auth**: signed HttpOnly cookie tied to one participant record.
- Session scoping is enforced on login, vote submission, and results queries.

## Deployment model
### Native local development
- `npm run dev` starts:
  - Vite client on `:5173`
  - Express server on `:8080`
- SQLite persists in `server\data\voting.db`.

### Local container parity
- `docker compose up --build` runs one container exposing `:8080`.
- `DATA_DIR=/data` stores SQLite on a bind-mounted `.localdata` folder.
- The caller provides `ADMIN_CODE` and `COOKIE_SECRET` (for example via a repo-root `.env` file consumed by Docker Compose).
- This matches the single-container production shape closely.

### Production/container target
- One Node-based container builds the SPA, serves the API, and stores SQLite on mounted persistent storage.
- Deployments must inject `ADMIN_CODE` and `COOKIE_SECRET`; no admin-code fallback is baked into the server.
- The repo includes optional **Azure Container Apps Bicep** under `infra/` for deployers who want Azure-hosted demos without committing subscription-specific values.
- Any deployment target should mount persistent storage at `/data` if session data must survive restarts or replacements.

## Testing architecture
- **Server tests**: `node:test` + `supertest` validate API contracts and business rules against a reset test database.
- **Client unit tests**: `vitest` covers session-selection behavior used by login and results flows.
- **E2E tests**: Playwright validates browser flows against the built app.
- Current coverage emphasizes end-to-end session lifecycle, commissioner/team voting, isolation between sessions, and public results visibility.
