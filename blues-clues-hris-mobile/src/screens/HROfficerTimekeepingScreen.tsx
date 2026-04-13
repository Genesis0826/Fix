import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// Parse Supabase timestamps (no Z suffix) as UTC
function parseTs(ts: string): Date {
  return new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
}

function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return parseTs(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatHours(timeIn: string | null, timeOut: string | null): string {
  if (!timeIn || !timeOut) return "—";
  const diff =
    (parseTs(timeOut).getTime() - parseTs(timeIn).getTime()) / 3_600_000;
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function deriveStatus(
  timeIn: string | null
): "present" | "late" | "absent" {
  if (!timeIn) return "absent";
  // Use direct UTC+8 offset arithmetic — avoids Intl API inconsistencies on Android
  const utcMs = parseTs(timeIn).getTime();
  const manilaMs = utcMs + 8 * 60 * 60 * 1000;
  const hour = Math.floor((manilaMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minute = Math.floor((manilaMs % (60 * 60 * 1000)) / (60 * 1000));
  // Late if after 9:00 AM (9:00 exactly counts as on time)
  return hour > 9 || (hour === 9 && minute > 0) ? "late" : "present";
}

function todayPHT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day + delta);
  return d.toLocaleDateString("en-CA");
}

type PunchRow = {
  log_id: string;
  employee_id: string;
  log_type: "time-in" | "time-out";
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
};

type UserRow = {
  user_id: string;
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  account_status: string | null;
};

type RosterRow = {
  employee_id: string;
  name: string;
  timeIn: string | null;
  timeOut: string | null;
  status: "present" | "late" | "absent";
};

function buildRoster(users: UserRow[], punches: PunchRow[]): RosterRow[] {
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
      return {
        employee_id: u.employee_id,
        name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Unknown",
        timeIn: punched.timeIn,
        timeOut: punched.timeOut,
        status: deriveStatus(punched.timeIn),
      };
    });
}

const STATUS_STYLES = {
  present: { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534", label: "Present" },
  late: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E", label: "Late" },
  absent: { bg: "#E5E7EB", border: "#D1D5DB", text: "#374151", label: "Absent" },
};

export function HROfficerTimekeepingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? {
    name: "HR Officer",
    email: "",
    role: "hr",
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [selectedDate, setSelectedDate] = useState(todayPHT());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const [timesheetsRes, usersRes] = await Promise.all([
          authFetch(
            `${API_BASE_URL}/timekeeping/timesheets?from=${date}&to=${date}`
          ),
          authFetch(`${API_BASE_URL}/users`),
        ]);

        if (!timesheetsRes.ok) throw new Error("Failed to load timesheets");
        if (!usersRes.ok) throw new Error("Failed to load users");

        const punches: PunchRow[] = await timesheetsRes.json();
        const users: UserRow[] = await usersRes.json();

        setRoster(buildRoster(users, punches));
      } catch {
        Alert.alert("Error", "Failed to load timekeeping data.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  function changeDate(delta: number) {
    setSelectedDate((prev) => addDays(prev, delta));
  }

  const total = roster.length;
  const present = roster.filter((r) => r.status === "present").length;
  const late = roster.filter((r) => r.status === "late").length;
  const absent = roster.filter((r) => r.status === "absent").length;

  const isToday = selectedDate === todayPHT();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="hr"
            userName={session.name}
            email={session.email}
            activeScreen="Timekeeping"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="hr"
              userName={session.name}
              email={session.email}
              activeScreen="Timekeeping"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <GradientHero style={styles.heroCard}>
              <Text style={styles.eyebrow}>HR Portal</Text>
              <Text style={styles.heroTitle}>Timekeeping</Text>
              <Text style={styles.heroSubtitle}>
                View company-wide daily attendance records.
              </Text>
            </GradientHero>

            {/* Date Navigation */}
            <View style={styles.dateNavCard}>
              <Pressable
                style={styles.navBtn}
                onPress={() => changeDate(-1)}
              >
                <Ionicons name="chevron-back" size={20} color="#1e3a8a" />
              </Pressable>

              <View style={styles.dateCenter}>
                <Text style={styles.dateText}>
                  {formatDisplayDate(selectedDate)}
                </Text>
                {isToday && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Today</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={[styles.navBtn, isToday && styles.navBtnDisabled]}
                onPress={() => changeDate(1)}
                disabled={isToday}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={isToday ? "#CBD5E1" : "#1e3a8a"}
                />
              </Pressable>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { label: "Total", value: total, bg: "#F8FAFC", border: "#E2E8F0", text: "#0F172A" },
                { label: "Present", value: present, bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" },
                { label: "Late", value: late, bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
                { label: "Absent", value: absent, bg: "#E5E7EB", border: "#D1D5DB", text: "#374151" },
              ].map((s) => (
                <View
                  key={s.label}
                  style={[
                    styles.statCard,
                    { backgroundColor: s.bg, borderColor: s.border },
                  ]}
                >
                  <Text style={[styles.statValue, { color: s.text }]}>
                    {loading ? "—" : s.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: s.text }]}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Roster */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Attendance Roster</Text>
              <Text style={styles.sectionSubtitle}>
                {total} employee{total === 1 ? "" : "s"}
              </Text>
            </View>

            {loading && (
              <ActivityIndicator
                size="large"
                color="#1e3a8a"
                style={{ marginTop: 24 }}
              />
            )}
            {!loading && roster.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No employees found</Text>
                <Text style={styles.emptyText}>
                  No active employees in the system.
                </Text>
              </View>
            )}
            {!loading && roster.length > 0 && roster.map((row) => {
                const s = STATUS_STYLES[row.status];
                return (
                  <View key={row.employee_id} style={styles.rosterCard}>
                    <View style={styles.rosterTop}>
                      <View style={styles.rosterNameBlock}>
                        <Text style={styles.rosterName}>{row.name}</Text>
                        <Text style={styles.rosterEmpId}>{row.employee_id}</Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: s.bg, borderColor: s.border },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: s.text }]}>
                          {s.label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rosterInfoRow}>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Time In</Text>
                        <Text style={styles.infoValue}>
                          {formatTime(row.timeIn)}
                        </Text>
                      </View>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Time Out</Text>
                        <Text style={styles.infoValue}>
                          {formatTime(row.timeOut)}
                        </Text>
                      </View>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Hours</Text>
                        <Text style={styles.infoValue}>
                          {formatHours(row.timeIn, row.timeOut)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
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
  scroll: {
    flex: 1,
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
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.78)",
  },
  dateNavCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnDisabled: {
    backgroundColor: "#F1F5F9",
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  todayBadge: {
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 8,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  rosterCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  rosterTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  rosterNameBlock: {
    flex: 1,
    paddingRight: 10,
  },
  rosterName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  rosterEmpId: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  rosterInfoRow: {
    flexDirection: "row",
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "800",
  },
});
