# Whack-A-Hack

**Whack-A-Hack** is a hackathon voting app built as one web container backed by PostgreSQL. Admins create voting sessions, teams and the commissioner sign in with session-scoped credentials, votes are validated in the Node backend, and final standings unlock when voting closes.

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

2. Start PostgreSQL locally. The simplest option is the bundled Compose service:

   Copy the repo-root `.env.example` to `.env` and set `POSTGRES_PASSWORD` there. That repo-root file is for Docker Compose values only.

   ```bash
   docker compose up -d postgres
   ```

3. Copy `server/.env.example` to `server/.env`. Set your own `ADMIN_CODE` and `COOKIE_SECRET`.
   If you are using the bundled Compose postgres from step 2, set `DATABASE_URL` to:

   ```dotenv
   DATABASE_URL=postgresql://whack_a_hack:<POSTGRES_PASSWORD-from-repo-root-.env>@127.0.0.1:5432/whack_a_hack
   ```

   This file is for the native server runtime.
4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.
    - Vite serves the UI on `:5173`
    - the Express API runs on `:8080`
    - `/admin` uses the `ADMIN_CODE` value from `server/.env`

Reset local state by clearing the configured PostgreSQL schema:

```bash
npm run dev:reset
```

### Local production-style container

Use the included compose file when you want the same single-app-container shape used for deployment:

1. Copy the repo-root `.env.example` to `.env` for Docker Compose and set your own values there:

   ```dotenv
    ADMIN_CODE=choose-a-local-admin-code
    COOKIE_SECRET=choose-a-long-random-cookie-secret
    POSTGRES_PASSWORD=choose-a-local-postgres-password
   ```

2. Start the container:

```bash
docker compose up --build
```

3. Open `http://localhost:8080`.

   - Admin login code: the `ADMIN_CODE` value from your repo-root `.env`
   - Persistent PostgreSQL volume: Docker volume `postgres-data`

## What the app does

- Creates multiple voting sessions with separate team and commissioner point budgets.
- Auto-creates a commissioner account for each session.
- Lets admins add teams manually or bulk-generate animal-themed team names with passwords.
- Prevents self-voting and keeps votes isolated per session.
- Shows live admin results during voting and public results only after a session is closed.

## Deployment

### Recommended path: self-hosted single container

The current app architecture is designed around one Node container plus an external PostgreSQL database:

- the React app is built into `server/public`
- Express serves both the SPA and `/api`
- the app connects through `DATABASE_URL`
- production durability comes from PostgreSQL, not an app volume

Build the app image directly:

```bash
docker build -t whack-a-hack .
```

Then run it with your own PostgreSQL connection details:

```bash
docker run -d --name whack-a-hack -p 8080:8080 -e ADMIN_CODE=change-me -e COOKIE_SECRET=replace-with-a-long-random-secret -e DATABASE_URL=postgresql://user:password@host:5432/whack_a_hack -e DATABASE_SSL_MODE=require whack-a-hack
```

If you prefer, `docker-compose.yml` is already set up as the simplest starting point for local or small self-hosted installs.

If you do not want to build your own image, you can also use the public image published by this repo directly: `ghcr.io/rafyac/whack-a-hack:latest`.

### Azure Container Apps via Bicep

The repo now includes **generic Azure Bicep** under `infra/` for deploying the same single-container app to **Azure Container Apps** with:

- external ingress on port `8080`
- Azure Database for PostgreSQL Flexible Server for durable state
- secure deployment parameters for `ADMIN_CODE`, `COOKIE_SECRET`, and PostgreSQL admin credentials
- no baked-in subscription IDs, resource group names, or personal Azure details

Suggested flow:

1. Use `ghcr.io/rafyac/whack-a-hack:latest` directly, or build and publish your own image to a registry you control.
2. Create or choose a resource group in the Azure subscription you want to use.
3. Review `infra/main.parameters.example.json` and adjust the non-secret values.
4. Deploy the stack with your own secure values:

```bash
az group create --name <resource-group> --location <azure-region>
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.example.json \
  --parameters containerImage=<registry>/<image>:<tag> \
               adminCode=<your-admin-code> \
               cookieSecret=<long-random-secret> \
               postgresAdminLogin=<postgres-admin-login> \
               postgresAdminPassword=<postgres-admin-password>
```

If you use a **private** registry, also pass:

```bash
--parameters registryServer=<registry-server> \
             registryUsername=<registry-username> \
             registryPassword=<registry-password-or-token>
```

### Operational notes

- Set `ADMIN_CODE`, `COOKIE_SECRET`, and `DATABASE_URL` in your platform's env/secret configuration before first start; the image does not include a fallback admin code.
- Use `DATABASE_SSL_MODE=require` for managed PostgreSQL services such as Azure Database for PostgreSQL Flexible Server.
- Put the container behind your normal TLS/reverse-proxy setup if exposing it publicly.
- Back up the PostgreSQL database as part of normal operations.

> The checked-in Azure files are intentionally generic. The deployer supplies subscription, resource group, image reference, and secret values at deployment time.

## Verification

Run the existing test suite with:

```bash
npm test
```

Validate the production container build with:

```bash
docker build -t whack-a-hack .
```

## Open-source repo basics

- **License:** [MIT](LICENSE)
- **Contributing guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Code of conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

### Contribution flow

1. Open an issue or describe the change in your PR.
2. Fork the repo and create a focused branch.
3. Make the change, update docs/specs when behavior changes, and run the local checks.
4. Open a pull request for review.

### GitHub Actions

The repo includes a GitHub Actions workflow that:

- runs `npm test` on pull requests and on `main`
- validates the production container build with `docker build`
- publishes `ghcr.io/<owner>/<repo>:latest` and a short commit SHA tag when changes land on `main`

Pull requests only validate the image build. The publish step is reserved for trusted pushes to `main`.
