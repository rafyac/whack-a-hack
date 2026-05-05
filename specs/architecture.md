# Architecture Reference

## System shape
- **Client**: React + Vite SPA for login, voting, results, and admin workflows.
- **Server**: Express API handling auth, session management, vote validation, results, and static asset hosting.
- **Data store**: PostgreSQL accessed directly from the Node server.

## Core runtime model
1. Admin signs in with an admin cookie session.
2. Admin configures a voting session and adds teams plus an optional commissioner.
3. Teams/commissioner sign in with session-specific credentials.
4. Ballots are validated server-side and stored in PostgreSQL.
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
- `/api` is fronted by Express rate limiting with a separate stricter limiter for login endpoints; health checks bypass the API limiter.

## Auth and session handling
- **Admin auth**: shared admin code from `ADMIN_CODE`, signed HttpOnly cookie, and startup failure when `ADMIN_CODE` is missing.
- **Voter auth**: signed HttpOnly cookie tied to one participant record.
- Session scoping is enforced on login, vote submission, and results queries.

## Deployment model
### Native local development
- `npm run dev` starts:
  - Vite client on `:5173`
  - Express server on `:8080`
- PostgreSQL runs separately and the server connects via `DATABASE_URL`.

### Local container parity
- `docker compose up --build` runs the app container plus a PostgreSQL container.
- The caller provides `ADMIN_CODE`, `COOKIE_SECRET`, and `POSTGRES_PASSWORD` (for example via a repo-root `.env` file consumed by Docker Compose).
- The app still runs as one web container; PostgreSQL provides durable state across restarts.

### Production/container target
- One Node-based container builds the SPA and serves the API.
- Deployments must inject `ADMIN_CODE`, `COOKIE_SECRET`, and `DATABASE_URL`; no admin-code fallback is baked into the server.
- Durable state lives in PostgreSQL rather than a mounted application volume.
- The repo includes optional **Azure Container Apps Bicep** under `infra/` for deployers who want Azure-hosted demos without committing subscription-specific values.
- The checked-in Azure option provisions Azure Database for PostgreSQL Flexible Server and wires the connection string into Container Apps as a secret.

## Testing architecture
- **Server tests**: `node:test` + `supertest` validate API contracts and business rules against a reset test database.
- **Client unit tests**: `vitest` covers session-selection behavior used by login and results flows.
- **E2E tests**: Playwright validates browser flows against the built app.
- Current coverage emphasizes end-to-end session lifecycle, commissioner/team voting, isolation between sessions, and public results visibility.
