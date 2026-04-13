import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { TimekeepingTable, TimekeepingLog } from "../components/TimekeepingTable";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// Parse Supabase timestamps (no Z suffix) as UTC
function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function formatTime(ts: string | null): string {
  if (!ts) return "--";
  return parseTs(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatHours(timeIn: string | null, timeOut: string | null): string {
  if (!timeIn || !timeOut) return "0h 00m";
  const diff =
    (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3_600_000;
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function deriveStatus(
  timeIn: string | null
): "Present" | "Late" | "Absent" {
  if (!timeIn) return "Absent";
  const hour = Number.parseInt(
    parseTs(timeIn).toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Manila",
    }),
    10
  );
  return hour >= 9 ? "Late" : "Present";
}

function todayPHT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out";
  timestamp: string;
};

type UserRow = {
  user_id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
};

function buildTimekeepingLogs(
  users: UserRow[],
  punches: PunchRow[],
  dateStr: string
): TimekeepingLog[] {
  const dateDisplay = formatDateDisplay(dateStr);

  const punchMap: Record<
    string,
    { timeIn: string | null; timeOut: string | null }
  > = {};
  for (const p of punches) {
    if (!punchMap[p.employee_id])
      punchMap[p.employee_id] = { timeIn: null, timeOut: null };
    if (p.log_type === "time-in" && !punchMap[p.employee_id].timeIn)
      punchMap[p.employee_id].timeIn = p.timestamp;
    if (p.log_type === "time-out")
      punchMap[p.employee_id].timeOut = p.timestamp;
  }

  return users
    .filter((u) => u.account_status?.toLowerCase() !== "inactive")
    .map((u) => {
      const punched = punchMap[u.employee_id] ?? {
        timeIn: null,
        timeOut: null,
      };
      const name =
        `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown";
      return {
        id: u.employee_id,
        employeeName: name,
        date: dateDisplay,
        timeIn: formatTime(punched.timeIn),
        timeOut: formatTime(punched.timeOut),
        totalHours: formatHours(punched.timeIn, punched.timeOut),
        status: deriveStatus(punched.timeIn),
      } satisfies TimekeepingLog;
    });
}

export function ManagerDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? {
    name: "Manager",
    email: "",
    role: "manager",
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [logs, setLogs] = useState<TimekeepingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const today = todayPHT();
      const [timesheetsRes, usersRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/timekeeping/timesheets?date=${today}`),
        authFetch(`${API_BASE_URL}/users`),
      ]);

      if (!timesheetsRes.ok || !usersRes.ok)
        throw new Error("Failed to fetch data");

      const punches: PunchRow[] = await timesheetsRes.json();
      const users: UserRow[] = await usersRes.json();

      setLogs(buildTimekeepingLogs(users, punches, today));
    } catch {
      setError(true);
      Alert.alert("Error", "Failed to load timekeeping data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const present = logs.filter((l) => l.status === "Present").length;
  const late = logs.filter((l) => l.status === "Late").length;
  const absent = logs.filter((l) => l.status === "Absent").length;

  const summaryCards = [
    { id: "1", label: "Total Employees", value: loading ? "—" : String(logs.length), helper: "Active accounts" },
    { id: "2", label: "Present Today", value: loading ? "—" : String(present), helper: "On time" },
    { id: "3", label: "Late / Issues", value: loading ? "—" : String(late), helper: "Needs attention" },
    { id: "4", label: "Absent", value: loading ? "—" : String(absent), helper: "Not clocked in" },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="manager"
            userName={session.name}
            email={session.email}
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="manager"
              userName={session.name}
              email={session.email}
              activeScreen="Dashboard"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero>
              <Text style={styles.eyebrow}>Manager Portal</Text>
              <Text style={styles.title}>Welcome, {session.name.split(" ")[0]}</Text>
              <Text style={styles.subtitle}>
                Review daily attendance records and manage your team from one place.
              </Text>
              <Pressable
                style={styles.refreshBtn}
                onPress={loadData}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="rgba(255,255,255,0.85)" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="refresh-outline"
                      size={14}
                      color="rgba(255,255,255,0.85)"
                    />
                    <Text style={styles.refreshBtnText}>Refresh</Text>
                  </>
                )}
              </Pressable>
            </GradientHero>

            <View style={styles.summaryRow}>
              {summaryCards.map((card) => (
                <View key={card.id} style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                  <Text style={styles.summaryValue}>{card.value}</Text>
                  <Text style={styles.summaryHelper}>{card.helper}</Text>
                </View>
              ))}
            </View>

            {/* Quick Actions */}
            <View style={styles.quickRow}>
              <Pressable
                style={styles.quickCard}
                onPress={() => navigation.replace("ManagerTeam", { session })}
              >
                <Text style={styles.quickTitle}>Team Directory →</Text>
                <Text style={styles.quickSub}>View all team members and their status.</Text>
              </Pressable>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Failed to load data</Text>
                <Text style={styles.errorText}>
                  Could not fetch timekeeping records. Tap Refresh to try again.
                </Text>
              </View>
            ) : (
              <TimekeepingTable
                logs={logs}
                title="Today's Timekeeping Logs"
                subtitle="Track and filter employee attendance records."
              />
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.78)",
    marginBottom: 12,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    gap: 6,
  },
  refreshBtnText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 10,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    minWidth: "45%",
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  summaryHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
    fontWeight: "600",
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 14,
  },
  quickTitle: {
    color: "#1E3A8A",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  quickSub: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
    textAlign: "center",
    lineHeight: 20,
  },
});
