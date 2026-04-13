
// Uses NEXT_PUBLIC_API_BASE_URL env var when set (e.g. in Railway / Vercel),
// falls back to localhost for local development.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:5000/api/tribeX/auth/v1";
