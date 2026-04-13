import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "hr" | "manager" | "employee" | "applicant";

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
}

type MockUser = {
  email: string;
  password: string;
  role: UserRole;
  name: string;
};

const SESSION_KEY = "user_session"; // mirrors web SESSION_KEY

const USERS: MockUser[] = [
  { email: "hr@company.com",        password: "Hr123!",        role: "hr",        name: "Sarah Miller"  },
  { email: "manager@company.com",   password: "Manager123!",   role: "manager",   name: "Jane Smith"    },
  { email: "employee@company.com",  password: "Employee123!",  role: "employee",  name: "John Doe"      },
  { email: "applicant@company.com", password: "Applicant123!", role: "applicant", name: "Alex Thompson" },
];

export async function mockLogin(email: string, password: string) {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const user = USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase().trim() &&
      u.password === password
  );

  if (!user) {
    return { ok: false as const, error: "Invalid email or password." };
  }

  return {
    ok: true as const,
    user: { role: user.role, name: user.name, email: user.email } as UserSession,
  };
}

// Save session to AsyncStorage (mirrors web AuthService.saveSession)
export async function saveSession(session: UserSession, persist: boolean): Promise<void> {
  try {
    if (persist) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      // For non-persistent: save to a temp key cleared on next cold start
      await AsyncStorage.setItem(`${SESSION_KEY}_temp`, JSON.stringify(session));
    }
  } catch {}
}

// Get current session (mirrors web AuthService.getSession)
export async function getSession(): Promise<UserSession | null> {
  try {
    const persistent = await AsyncStorage.getItem(SESSION_KEY);
    if (persistent) return JSON.parse(persistent);

    const temp = await AsyncStorage.getItem(`${SESSION_KEY}_temp`);
    if (temp) return JSON.parse(temp);

    return null;
  } catch {
    return null;
  }
}

// Clear session (mirrors web AuthService.logout)
export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem(`${SESSION_KEY}_temp`);
  } catch {}
}
