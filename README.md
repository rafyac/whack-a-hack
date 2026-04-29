# Whack-A-Hack

**Whack-A-Hack** is a single-container hackathon voting app. Admins create voting sessions, teams and the commissioner sign in with session-scoped credentials, votes are validated in the Node + SQLite backend, and final standings unlock when voting closes.

## First page

![Whack-A-Hack login page](specs/screenshots/first-page.jpg)

The default unauthenticated flow lands on the voting experience, which redirects to the login page until a team or commissioner signs in.

## Local usage

### Native development

Requires Node 20+.

1. Install dependencies:

   ```bash
   npm run install:all
   ```

2. Copy `server/.env.example` to `server/.env` and set your own `ADMIN_CODE` and `COOKIE_SECRET`.
3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.
   - Vite serves the UI on `:5173`
   - the Express API runs on `:8080`
   - `/admin` uses the `ADMIN_CODE` value from `server/.env`

SQLite data is stored in `server/data/voting.db`. Reset local state with:

```bash
npm run dev:reset
```

### Local production-style container

Use the included compose file when you want the same single-container shape used for deployment:

1. Create a repo-root `.env` file for Docker Compose with your own values:

   ```dotenv
   ADMIN_CODE=choose-a-local-admin-code
   COOKIE_SECRET=choose-a-long-random-cookie-secret
   ```

2. Start the container:

```bash
docker compose up --build
```

3. Open `http://localhost:8080`.

- Admin login code: the `ADMIN_CODE` value from your repo-root `.env`
- Persistent data directory: `./.localdata`

## What the app does

- Creates multiple voting sessions with separate team and commissioner point budgets.
- Auto-creates a commissioner account for each session.
- Lets admins add teams manually or bulk-generate animal-themed team names with passwords.
- Prevents self-voting and keeps votes isolated per session.
- Shows live admin results during voting and public results only after a session is closed.

## Deployment

### Recommended path: self-hosted single container

The current app architecture is designed around one Node container:

- the React app is built into `server/public`
- Express serves both the SPA and `/api`
- SQLite persists under `DATA_DIR`
- production should mount persistent storage at `/data`

Build and run it directly:

```bash
docker build -t whack-a-hack .
docker run -d --name whack-a-hack -p 8080:8080 -e ADMIN_CODE=change-me -e COOKIE_SECRET=replace-with-a-long-random-secret -e DATA_DIR=/data -v whack-a-hack-data:/data whack-a-hack
```

If you prefer, `docker-compose.yml` is already set up as the simplest starting point for local or small self-hosted installs, but it expects `ADMIN_CODE` and `COOKIE_SECRET` to be supplied by the caller.

### Operational notes

- Keep `/data` on persistent storage so `voting.db` survives restarts and redeploys.
- Set `ADMIN_CODE` and `COOKIE_SECRET` in your platform's env/secret configuration before first start; the image does not include a fallback admin code.
- Put the container behind your normal TLS/reverse-proxy setup if exposing it publicly.
- Back up the mounted data volume as part of normal operations.

> Cloud-specific provisioning is intentionally not checked into this repo; deploy the container with your platform's own tooling.

## Verification

Run the existing test suite with:

```bash
npm test
```
