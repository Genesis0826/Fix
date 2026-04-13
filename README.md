# BluesClues HRIS

A monorepo containing the authentication API and manager/applicant dashboard for the BluesClues HR Information System. Purely para sa devs lang to check progress ng lahat and para madali iconnect front at backend.

## Sprint 3 Session Summary

What was fixed and added in this session:

- Restored the backend SFIA/admin wiring so the API can boot with the ranking and health-check services.
- Fixed the login flow issue that required the correct `rememberMe` payload.
- Validated that SFIA candidate ranking still returns demand vs supply breakdown data.
- Added requirement audit docs for SFIA, onboarding, and job requisition coverage.
- Added `DATABASE_MIGRATIONS.md` to document schema work needed for the remaining gaps.
- Identified and corrected a backend table-name mismatch by switching the scheduled health-check query from `companies` to `company`.
- Pushed the updated work to the requested repository.

Known gaps still left for future work:

- Recruitment timeline handoff tracking.
- Interview evaluation persistence.
- Offer management and compensation/benefits flow.
- Any remaining schema/table naming mismatches that are still not aligned with the code.

GDocs Link:
https://docs.google.com/document/d/1QbcjtozYNobPMb_ffn4uEWH5RwJ_TpOB4eTlkHVu4oE/edit?tab=t.0

**Stack:** NestJS 11 · Next.js 16 · React Native (Expo) · Supabase · JWT · Tailwind CSS · shadcn/ui

---

## Repository Structure

```
blues-clues-hris-backend-frontend-mobile/
├── tribeX-hris-auth-api/                          # NestJS backend — runs on port 5000
├── frontend/blues-clues-hris-frontend-web/        # Next.js frontend — runs on port 3000
└── blues-clues-hris-mobile/                       # Expo React Native app
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Expo Go app (for mobile)

---

### Step 1 — Clone and pull latest

```bash
git clone https://github.com/dreiiiiim/blues-clues-hris-backend-frontend-mobile.git
cd blues-clues-hris-backend-frontend-mobile
git pull origin main
```

> Always pull before starting work to avoid conflicts.

---

### Step 2 — Set up environment files

**The main branch connects to the deployed Railway backend by default.**
If you are adding features that touch the backend, switch to localhost (see [Switching Environments](#switching-environments) below).

#### Backend — create `tribeX-hris-auth-api/.env`

```env
PORT=5000
SUPABASE_URL=https://xvofqboilmzlhrnkyyif.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2b2ZxYm9pbG16bGhybmt5eWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk2MTA0NCwiZXhwIjoyMDg4NTM3MDQ0fQ.DYBGofSYAG_bsv9_bYo8ZvhsO4lx4W5wcfjWtXMoBxg
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2b2ZxYm9pbG16bGhybmt5eWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjEwNDQsImV4cCI6MjA4ODUzNzA0NH0.b6T6Auv69Hrxs2klwZpv8Vg1HfqRTzQI_BSb6ppbCKc
JWT_SECRET=sc078c0eaf7b200f45077475fabba72e2f1d0947992d53619cac9f77e6df32820
MAIL_USER=bluesclueshris@gmail.com
MAIL_PASS=ulvr ecfb ghbj zmnk
APP_URL=http://localhost:3000
```

#### Frontend — create `frontend/blues-clues-hris-frontend-web/.env.local`

For local development (pointing to localhost backend):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
```

#### Mobile — edit `blues-clues-hris-mobile/.env`

For local development (replace IP with your machine's Wi-Fi IPv4 from `ipconfig`):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:5000/api/tribeX/auth/v1
```

---

### Step 3 — Install dependencies and run

Open **three separate terminals**:

**Terminal 1 — Backend:**

```bash
cd tribeX-hris-auth-api
npm install
npm run start:dev
# API at http://localhost:5000
# Swagger docs at http://localhost:5000/api/docs
```

**Terminal 2 — Frontend:**

```bash
cd frontend/blues-clues-hris-frontend-web
npm install
npm run dev
# App at http://localhost:3000
```

**Terminal 3 — Mobile:**

```bash
cd blues-clues-hris-mobile
npm install
npx expo start -c
# Scan the QR code with the Expo Go app on your phone
# Your phone must be on the same Wi-Fi network as your machine
```

---

## Switching Environments

The project has two environments: **localhost** (local dev) and **Railway** (deployed production).

### When to use which

| Scenario                                      | Use                                      |
| --------------------------------------------- | ---------------------------------------- |
| Testing UI changes only                       | Railway — no need to run backend locally |
| Adding/changing backend endpoints             | Localhost — run the backend yourself     |
| Demoing or reviewing a PR                     | Railway                                  |
| Testing timekeeping, auth, or any API feature | Localhost                                |

---

### Switching the Frontend

Edit `frontend/blues-clues-hris-frontend-web/.env.local`:

**→ Localhost:**

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
```

**→ Railway:**

```env
NEXT_PUBLIC_API_BASE_URL=https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1
```

Then restart the dev server: `npm run dev`

> If `.env.local` does not exist, the frontend falls back to `localhost:5000` automatically.

---

### Switching the Mobile App

Edit `blues-clues-hris-mobile/.env`:

**→ Localhost** (find your Wi-Fi IPv4 with `ipconfig` → look for IPv4 Address under Wi-Fi):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:5000/api/tribeX/auth/v1
```

**→ Railway:**

```env
EXPO_PUBLIC_API_BASE_URL=https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1
```

After editing `.env`, always restart with cache cleared:

```bash
npx expo start -c
```

> Your phone and your machine must be on the **same Wi-Fi network** for localhost to work.

---

---

## Environment Variables Reference

### Backend — `tribeX-hris-auth-api/.env`

| Variable                    | Description                                 | Required |
| --------------------------- | ------------------------------------------- | -------- |
| `PORT`                      | Port for the API server (default: `5000`)   | No       |
| `SUPABASE_URL`              | Your Supabase project URL                   | Yes      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access)    | Yes      |
| `SUPABASE_ANON_KEY`         | Supabase anon/public key                    | Yes      |
| `JWT_SECRET`                | Secret used to sign JWT tokens              | Yes      |
| `MAIL_USER`                 | Gmail address used to send system emails    | Yes      |
| `MAIL_PASS`                 | Gmail App Password (not your real password) | Yes      |
| `APP_URL`                   | Frontend URL (used in email links)          | Yes      |

> **Never commit `.env` files.** They are in `.gitignore`. Full values are in Step 2 above.

---

## Test Accounts

Use these accounts for local development and testing.

### Company 3

| Role                                   | Identifier                        | Password      | Notes                         |
| -------------------------------------- | --------------------------------- | ------------- | ----------------------------- |
| System Admin (timekeeping/recruitment) | `afdmandrei.systemadmin`          | `andrei123`   | Full admin access — COMPANY 3 |
| Applicant                              | `montanielandrei@gmail.com`       | `password123` | COMPANY 3                     |
| Applicant                              | `andreimontanielcoding@gmail.com` | `password123` | Applicant portal COMPANY 3    |
| Manager                                | `cheenamarilenejaring@gmail.com`  | `password123` | Team management               |
| HR Officer                             | `rickgrimes`                      | `password123` | HR portal                     |
| Employee                               | `ludovicastorti`                  | `password123` | Employee                      |

### Company 2

| Role       | Identifier                | Password      | Notes            |
| ---------- | ------------------------- | ------------- | ---------------- |
| HR Officer | `chiarraalteri@gmail.com` | `password123` | COMP 2 HR portal |

> Default password for all accounts not listed above: `password123`

---

## Branch Strategy

```
feature/<ticket>-<short-description>  →  main
```

- **Never commit directly to `main`**
- Create a short-lived feature branch for every task
- Keep branch names lowercase with hyphens

```bash
# Start a new feature
git checkout main
git pull origin main
git checkout -b feature/t3-142-user-profile-header

# Sync with main while working (do this regularly)
git fetch origin
git rebase origin/main
```

---

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | When to use                                |
| ----------- | ------------------------------------------ |
| `feat:`     | Adding new functionality                   |
| `fix:`      | Fixing a bug                               |
| `refactor:` | Restructuring code without behavior change |
| `chore:`    | Deps, config, tooling changes              |
| `test:`     | Adding or updating tests                   |

**Examples from this repo:**

```
feat: make all role dashboards accessible
fix: logout flow — call logoutApi from Sidebar
chore: remove .claude folder from tracking
```

---

## Pull Request Requirements

1. Open a PR from your `feature/*` branch to `main`
2. **At least 1 peer review approval** — self-approval is not allowed
3. `npm run lint` must pass in both projects before requesting review
4. Write a clear PR description:
   - What changed and why
   - How to test it manually
   - Any affected areas or risks
5. Keep PRs small and focused — one task per PR

---

## Available Commands

### Backend (`tribeX-hris-auth-api/`)

| Command              | What it does                    |
| -------------------- | ------------------------------- |
| `npm run start:dev`  | Dev server with hot reload      |
| `npm run start:prod` | Production server               |
| `npm run build`      | Compile TypeScript to `dist/`   |
| `npm run lint`       | Lint and auto-fix               |
| `npm run test`       | Run unit tests                  |
| `npm run test:cov`   | Unit tests with coverage report |
| `npm run test:e2e`   | End-to-end tests                |

### Frontend (`frontend/blues-clues-hris-frontend-web/`)

| Command         | What it does               |
| --------------- | -------------------------- |
| `npm run dev`   | Dev server with hot reload |
| `npm run build` | Production build           |
| `npm run start` | Serve the production build |
| `npm run lint`  | Lint check                 |

### Mobile (`blues-clues-hris-mobile/`)

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npx expo start`    | Start Expo dev server                |
| `npx expo start -c` | Start with cleared cache (use this!) |

---

## API Conventions

All API routes follow this structure (already configured in `main.ts`):

```
/api/tribeX/auth/v{major}/{resource}
```

Current base: `http://localhost:5000/api/tribeX/auth/v1/`

**Rules:**

- Always version your endpoints (`/v1`, `/v2`) — never break existing consumers
- No direct database access across services — all integration must go through the API
- All endpoints are documented via Swagger at `/api/docs`

---

## Testing the API Manually (Postman / curl)

**Login:**

```
POST http://localhost:5000/api/tribeX/auth/v1/login
Content-Type: application/json

{ "identifier": "afdmandrei.systemadmin", "password": "andrei123" }
```

**Authenticated request:**

```
GET http://localhost:5000/api/tribeX/auth/v1/users
Authorization: Bearer <access_token>
```

Full API reference: `http://localhost:5000/api/docs`

---

## Definition of Done

A task is considered done only when:

- Code is merged to `main` via PR with at least 1 approval
- `npm run lint` passes in affected projects
- No regressions introduced to existing functionality
- Any behavior or config changes are reflected in documentation
