# Product Requirements Document

## Purpose
Whack-A-Hack is a hackathon voting app where an admin runs multiple independent voting sessions. Each session contains its own teams, optional commissioner, vote budget, and results.

## Users
- **Admin**: signs into the control room, creates sessions, manages teams, opens/closes voting, monitors live results, and can explicitly log out.
- **Team voter**: logs into one session and distributes a fixed points budget across other teams.
- **Commissioner**: optional special voter with a separate budget; can vote for teams but is never a vote target.
- **Public viewer**: sees final results only after a session is closed.

## Current product scope
1. **Multi-session isolation**
   - Sessions are independent and move through `setup -> open -> closed`.
   - Teams, commissioner entry, ballots, and results are all session-scoped.
2. **Hack/team management**
   - Admin can add, edit, and delete teams within a session.
   - Passwords can be generated or entered manually and later edited by admin.
3. **Voting**
   - Team login requires session, team name, and password.
   - Teams must allocate exactly `pointsPerTeam`.
   - Self-voting is blocked.
   - Commissioner voting uses `judgePoints`.
4. **Results**
    - Admin can watch live totals during an event.
    - Public leaderboard is available only when a session is closed.
5. **Operations**
   - App runs as a single web container backed by PostgreSQL.
   - Express API traffic is rate-limited with permissive per-IP defaults, while login endpoints use stricter failed-attempt throttles.
   - Health checks and static asset delivery stay outside the API rate limit path so deployments and demos remain responsive.
   - Native local dev requires PostgreSQL plus `ADMIN_CODE`, `COOKIE_SECRET`, and `DATABASE_URL` in `server/.env`.
   - Containerized deployments must inject `ADMIN_CODE`, `COOKIE_SECRET`, and `DATABASE_URL`; there is no built-in admin fallback for deployed runtimes.
   - Optional Azure Container Apps deployment artifacts may be checked into `infra/`, but must stay generic so deployers provide their own Azure context, image reference, database credentials, and secrets.

## Success criteria
- Admin can run multiple hackathon sessions without cross-session leakage.
- Commissioner participation changes totals without appearing as a ranked hack.
- Local and deployed environments preserve state across restarts through PostgreSQL.
- Existing API and browser tests cover the main session, voting, and results flows.
