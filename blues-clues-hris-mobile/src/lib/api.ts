// Uses EXPO_PUBLIC_API_BASE_URL env var when set (e.g. for production builds),
// falls back to local IP for development (run `ipconfig` to find your Wi-Fi IPv4).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "http://192.168.1.4:5000/api/tribeX/auth/v1";
