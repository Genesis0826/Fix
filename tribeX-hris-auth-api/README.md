---

# BluesClues HRIS

BluesClues HRIS is a **Human Resource Information System** built as a **monorepo** containing a NestJS authentication API and a Next.js dashboard for internal users and applicants.

## Project Overview

**Project Name:** BluesClues HRIS

**Description**

This repository contains the core services for the BluesClues HRIS platform:

- Authentication and session management API
- Manager dashboard for HR operations
- Applicant portal for job applicants

The system follows a **frontend → backend → external services architecture**, where the frontend communicates only with the NestJS backend, which then interacts with external providers.

**Tech Stack**

- **Backend:** NestJS 11
- **Frontend:** Next.js 16
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Custom JWT Authentication
- **Styling:** TailwindCSS
- **UI Components:** shadcn/ui

---

# Repository Structure

This monorepo contains two main applications.

```
BluesClues-HRIS/
│
├── tribeX-hris-auth-api/
│   NestJS authentication API
│   Runs on port 5000
│
└── frontend/
    └── manager-dashboard/
        Next.js frontend dashboard
        Runs on port 3000
```

### Backend

`tribeX-hris-auth-api/`

NestJS backend responsible for:

- Authentication (JWT access + refresh tokens)
- Login & logout history
- Role-based access
- Supabase database integration
- External service communication

Runs on:

```
http://localhost:5000
```

Swagger documentation:

```
http://localhost:5000/api/docs
```

---

### Frontend

`frontend/manager-dashboard/`

Next.js application used by internal users such as:

- System Admin
- Admin
- HR Manager
- Employees

Runs on:

```
http://localhost:3000
```

---

# Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/bluesclues-hris.git
cd bluesclues-hris
```

---

# Backend Setup

Navigate to the backend project.

```bash
cd tribeX-hris-auth-api
```

Install dependencies.

```bash
npm install
```

Copy environment file.

```
.env.example → .env
```

Fill in the required variables.

Run the development server.

```bash
npm run start:dev
```

Backend will run at:

```
http://localhost:5000
```

Swagger documentation:

```
http://localhost:5000/api/docs
```

---

# Frontend Setup

Navigate to the frontend project.

```bash
cd frontend/manager-dashboard
```

Install dependencies.

```bash
npm install
```

Run the development server.

```bash
npm run dev
```

Frontend will run at:

```
http://localhost:3000
```

---

# Environment Variables

The backend requires the following environment variables.

| Variable                  | Description                                     |
| ------------------------- | ----------------------------------------------- |
| PORT                      | Backend server port (default 5000)              |
| SUPABASE_URL              | Supabase project URL                            |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key                       |
| SUPABASE_ANON_KEY         | Supabase public anon key                        |
| JWT_SECRET                | Secret used for signing JWT tokens              |
| CORS_ORIGINS              | Allowed origins in production (comma separated) |

---

# Branch Strategy

We follow a **feature branch workflow**.

```
feature/<ticket>-<short-description>
```

Example:

```
feature/t3-142-user-profile-header
```

Rules:

- Never commit directly to `main`
- Always create a feature branch
- Use short-lived branches
- Frequently sync with main

```bash
git pull origin main
```

---

# Commit Convention

We follow **Conventional Commits**.

| Type     | Description                         |
| -------- | ----------------------------------- |
| feat     | New feature                         |
| fix      | Bug fix                             |
| refactor | Code change without behavior change |
| chore    | Tooling, dependencies, config       |
| test     | Adding or updating tests            |

Examples:

```
feat: add login history tracking
fix: resolve JWT token expiration issue
refactor: simplify auth middleware
chore: update dependencies
```

---

# Pull Request Requirements

Before merging a pull request:

- At least **1 peer review approval**
- No self-merging
- No lint errors
- `npm run lint` must pass
- Provide a clear PR description

A good PR description should include:

- What changed
- Why it changed
- How to test the change

Keep pull requests **small and focused**.

---

# Available Commands

## Backend

`tribeX-hris-auth-api/`

| Command            | Description                      |
| ------------------ | -------------------------------- |
| npm run start:dev  | Start dev server with hot reload |
| npm run start:prod | Start production server          |
| npm run build      | Compile TypeScript               |
| npm run lint       | Run lint with auto-fix           |
| npm run test       | Run unit tests                   |
| npm run test:cov   | Run tests with coverage          |
| npm run test:e2e   | Run end-to-end tests             |

---

## Frontend

`frontend/manager-dashboard/`

| Command       | Description              |
| ------------- | ------------------------ |
| npm run dev   | Start development server |
| npm run build | Create production build  |
| npm run start | Serve production build   |
| npm run lint  | Run lint checks          |

---

# API Conventions

All API routes follow this format:

```
api/tribeX/auth/v{major}/...
```

Example:

```
api/tribeX/auth/v1/login
```

Guidelines:

- All endpoints must be versioned
- Current version: **v1**
- No direct database access between services
- All data access goes through the API

Swagger documentation is available at:

```
/api/docs
```

---

# Definition of Done

A task is considered **done** only when:

- Code is merged via Pull Request
- At least **1 approval**
- Lint passes
- No regressions in existing functionality
- Documentation updated if behavior changes

---

# Sample Test Accounts

These accounts can be used for development and testing.

### System Admin

```
johndoedoe@gmail.com
```

### Admin

```
rickgrimes@gmail.com
```

### HR Manager

```
chiarraalteri@gmail.com
```

### Employee

```
ludovicastorti@gmail.com
```
