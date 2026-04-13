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
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch, clearSession } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const ABSENCE_REASONS = [
  "Sick Leave",
  "Emergency Leave",
  "WFH / Remote",
  "Personal Leave",
  "Vacation Leave",
  "On Leave (Approved)",
  "Other",
] as const;

type AbsenceReason = (typeof ABSENCE_REASONS)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupedDayRow = {
  date: string;
  time_in: { timestamp: string; latitude?: number | null; longitude?: number | null } | null;
  time_out: { timestamp: string } | null;
  absence: {
    timestamp: string;
    absence_reason: string | null;
    absence_notes: string | null;
  } | null;
  all_logs: any[];
};

type DayRecord = {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  absenceReason: string | null;
  absenceNotes: string | null;
  status: "Present" | "Late" | "Absent" | "Excused";
};

type HistoryFilter = "week" | "month" | "all";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (diff <= 0) return "—";
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function deriveStatus(
  timeIn: string | null,
  absenceReason: string | null
): DayRecord["status"] {
  if (!timeIn) {
    return absenceReason ? "Excused" : "Absent";
  }
  const utcMs = parseTs(timeIn).getTime();
  const manilaMs = utcMs + 8 * 60 * 60 * 1000;
  const hour = Math.floor(
    (manilaMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
  );
  const minute = Math.floor((manilaMs % (60 * 60 * 1000)) / (60 * 1000));
  return hour > 9 || (hour === 9 && minute > 0) ? "Late" : "Present";
}

function todayPHT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function getDateRange(filter: HistoryFilter): { from: string; to: string } {
  const to = todayPHT();
  if (filter === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { from: d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }), to };
  }
  if (filter === "month") {
    const d = new Date();
    return {
      from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      to,
    };
  }
  // all — last 90 days
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return { from: d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }), to };
}

function buildHistoryRecords(grouped: GroupedDayRow[]): DayRecord[] {
  return grouped.map(({ date, time_in, time_out, absence }) => ({
    date,
    timeIn: time_in?.timestamp ?? null,
    timeOut: time_out?.timestamp ?? null,
    absenceReason: absence?.absence_reason ?? null,
    absenceNotes: absence?.absence_notes ?? null,
    status: deriveStatus(time_in?.timestamp ?? null, absence?.absence_reason ?? null),
  }));
}

function formatDateStr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusStyle(status: DayRecord["status"]) {
  switch (status) {
    case "Present":
      return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
    case "Late":
      return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
    case "Excused":
      return { bg: "#F3E8FF", border: "#E9D5FF", text: "#6B21A8" };
    default:
      return { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" };
  }
}

// ─── Absence Modal ────────────────────────────────────────────────────────────

function AbsenceModal({
  visible,
  onClose,
  onSubmit,
  loading,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: AbsenceReason, notes: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [selectedReason, setSelectedReason] = useState<AbsenceReason>(
    ABSENCE_REASONS[0]
  );
  const [notes, setNotes] = useState("");

  function handleClose() {
    setNotes("");
    setSelectedReason(ABSENCE_REASONS[0]);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={absenceStyles.overlay}
      >
        <Pressable style={absenceStyles.backdrop} onPress={handleClose} />
        <View style={absenceStyles.sheet}>
          {/* Handle */}
          <View style={absenceStyles.handle} />

          <Text style={absenceStyles.title}>Report Absence</Text>
          <Text style={absenceStyles.subtitle}>
            This will be visible to your HR team
          </Text>

          {/* Reason selector */}
          <Text style={absenceStyles.fieldLabel}>
            Reason <Text style={absenceStyles.required}>*</Text>
          </Text>
          <View style={absenceStyles.reasonList}>
            {ABSENCE_REASONS.map((r) => {
              const active = selectedReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    absenceStyles.reasonChip,
                    active && absenceStyles.reasonChipActive,
                  ]}
                  onPress={() => setSelectedReason(r)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      absenceStyles.reasonChipText,
                      active && absenceStyles.reasonChipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes */}
          <Text style={absenceStyles.fieldLabel}>
            Notes{" "}
            <Text style={absenceStyles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={absenceStyles.notesInput}
            value={notes}
            onChangeText={(t) => {
              if (t.length <= 500) setNotes(t);
            }}
            placeholder="Add any additional context..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
          />
          <Text style={absenceStyles.charCount}>{notes.length}/500</Text>

          {error ? (
            <View style={absenceStyles.errorBox}>
              <Text style={absenceStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={absenceStyles.actionRow}>
            <TouchableOpacity
              style={absenceStyles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={absenceStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                absenceStyles.submitBtn,
                loading && absenceStyles.submitBtnDisabled,
              ]}
              onPress={() => onSubmit(selectedReason, notes)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={absenceStyles.submitBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function EmployeeTimekeepingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? {
    name: "Employee",
    email: "",
    role: "employee",
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayIn, setTodayIn] = useState<string | null>(null);
  const [todayOut, setTodayOut] = useState<string | null>(null);
  const [todayAbsence, setTodayAbsence] = useState<{
    reason: string;
    notes: string | null;
  } | null>(null);
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("month");

  // Absence modal
  const [absenceVisible, setAbsenceVisible] = useState(false);
  const [absenceLoading, setAbsenceLoading] = useState(false);
  const [absenceError, setAbsenceError] = useState<string | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayPHT();
      const { from, to } = getDateRange(historyFilter);
      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/my-timesheet?from=${from}&to=${to}`
      );
      if (!res.ok) throw new Error("Failed to load timesheet");
      const grouped: GroupedDayRow[] = await res.json();
      const todayRow = grouped.find((g) => g.date === today);
      setTodayIn(todayRow?.time_in?.timestamp ?? null);
      setTodayOut(todayRow?.time_out?.timestamp ?? null);
      setTodayAbsence(
        todayRow?.absence?.absence_reason
          ? {
              reason: todayRow.absence.absence_reason,
              notes: todayRow.absence.absence_notes ?? null,
            }
          : null
      );
      setHistory(buildHistoryRecords(grouped));
    } catch {
      Alert.alert("Error", "Failed to load timekeeping data.");
    } finally {
      setLoading(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Punch handlers ─────────────────────────────────────────────────────────

  function confirmTimeIn() {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    });
    Alert.alert(
      "Confirm Clock In",
      `Clock in at ${timeStr}?\n\nYour attendance will be recorded.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clock In",
          onPress: () => executePunch("time-in"),
        },
      ]
    );
  }

  function confirmTimeOut() {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
    });
    const duration = todayIn ? calcDuration(todayIn) : null;
    Alert.alert(
      "Confirm Clock Out",
      duration
        ? `Clock out at ${timeStr}?\n\nShift duration: ${duration}`
        : `Clock out at ${timeStr}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clock Out",
          onPress: () => executePunch("time-out", false),
        },
        {
          text: "Clock Out & Sign Out",
          style: "destructive",
          onPress: () => executePunch("time-out", true),
        },
      ]
    );
  }

  async function executePunch(type: "time-in" | "time-out", signOut = false) {
    setPunching(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/timekeeping/${type}`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string })?.message || "Failed to record punch"
        );
      }

      if (signOut) {
        await clearSession();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }

      await loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setPunching(false);
    }
  }

  function calcDuration(fromTs: string): string {
    const diff = Date.now() - parseTs(fromTs).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ── Absence handler ────────────────────────────────────────────────────────

  async function handleAbsenceSubmit(reason: AbsenceReason, notes: string) {
    setAbsenceLoading(true);
    setAbsenceError(null);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/timekeeping/report-absence`,
        {
          method: "POST",
          body: JSON.stringify({ reason, notes: notes || undefined }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string })?.message || "Failed to report absence."
        );
      }
      setAbsenceVisible(false);
      await loadData();
    } catch (e: any) {
      setAbsenceError(e?.message || "Something went wrong.");
    } finally {
      setAbsenceLoading(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const clockStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Manila",
  });
  const dateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });

  const canClockIn = !todayIn && !todayAbsence;
  const canClockOut = !!todayIn && !todayOut;
  const shiftDone = !!todayIn && !!todayOut;

  // Period stats
  const totalDays = history.length;
  const presentDays = history.filter(
    (r) => r.status === "Present" || r.status === "Late"
  ).length;
  const lateDays = history.filter((r) => r.status === "Late").length;
  const absentDays = history.filter(
    (r) => r.status === "Absent" || r.status === "Excused"
  ).length;
  const attendanceRate =
    totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const filterLabel: Record<HistoryFilter, string> = {
    week: "This Week",
    month: "This Month",
    all: "Last 90 Days",
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AbsenceModal
        visible={absenceVisible}
        onClose={() => {
          setAbsenceVisible(false);
          setAbsenceError(null);
        }}
        onSubmit={handleAbsenceSubmit}
        loading={absenceLoading}
        error={absenceError}
      />

      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Timekeeping"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="employee"
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
            {/* ── Hero Clock ──────────────────────────────────────────────── */}
            <GradientHero style={styles.heroCard}>
              <Text style={styles.eyebrow}>Employee Portal</Text>
              <Text style={styles.heroTime}>{clockStr}</Text>
              <Text style={styles.heroDate}>{dateStr}</Text>
            </GradientHero>

            {/* ── Today's Status Boxes ────────────────────────────────────── */}
            <View style={styles.statusRow}>
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Time In</Text>
                <Text style={styles.statusValue}>{formatTime(todayIn)}</Text>
              </View>
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Time Out</Text>
                <Text style={styles.statusValue}>{formatTime(todayOut)}</Text>
              </View>
              <View style={styles.statusBox}>
                <Text style={styles.statusLabel}>Hours</Text>
                <Text style={styles.statusValue}>
                  {formatHours(todayIn, todayOut)}
                </Text>
              </View>
            </View>

            {/* ── Status Banner ───────────────────────────────────────────── */}
            {!loading && shiftDone && (
              <View style={[styles.banner, styles.bannerDone]}>
                <View style={[styles.bannerDot, { backgroundColor: "#2563EB" }]} />
                <Text style={styles.bannerText}>
                  Shift complete — clocked out at {formatTime(todayOut)}
                </Text>
              </View>
            )}
            {!loading && todayIn && !todayOut && (
              <View style={[styles.banner, styles.bannerIn]}>
                <View style={[styles.bannerDot, { backgroundColor: "#16A34A" }]} />
                <Text style={styles.bannerText}>
                  Clocked in at {formatTime(todayIn)} — remember to clock out
                </Text>
              </View>
            )}
            {!loading && todayAbsence && (
              <View style={[styles.banner, styles.bannerAbsence]}>
                <View style={[styles.bannerDot, { backgroundColor: "#9333EA" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerText}>
                    Absence reported: {todayAbsence.reason}
                  </Text>
                  {todayAbsence.notes ? (
                    <Text style={styles.bannerSub}>{todayAbsence.notes}</Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ── Clock Buttons ────────────────────────────────────────────── */}
            {!shiftDone && !todayAbsence && (
              <View style={styles.buttonRow}>
                <Pressable
                  style={[
                    styles.punchBtn,
                    styles.clockInBtn,
                    (!canClockIn || punching) && styles.btnDisabled,
                  ]}
                  onPress={confirmTimeIn}
                  disabled={!canClockIn || punching}
                >
                  {punching && canClockIn ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.punchBtnText}>
                      {todayIn ? "Already Clocked In" : "Clock In"}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.punchBtn,
                    styles.clockOutBtn,
                    (!canClockOut || punching) && styles.btnDisabled,
                  ]}
                  onPress={confirmTimeOut}
                  disabled={!canClockOut || punching}
                >
                  {punching && canClockOut ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.punchBtnText}>
                      {todayOut ? "Already Clocked Out" : "Clock Out"}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* ── Report Absence ───────────────────────────────────────────── */}
            {!loading && canClockIn && !todayAbsence && (
              <TouchableOpacity
                style={styles.absenceBanner}
                onPress={() => {
                  setAbsenceError(null);
                  setAbsenceVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.absenceBannerLeft}>
                  <View style={styles.absenceIcon}>
                    <Text style={styles.absenceIconText}>!</Text>
                  </View>
                  <View>
                    <Text style={styles.absenceBannerTitle}>
                      Not coming in today?
                    </Text>
                    <Text style={styles.absenceBannerSub}>
                      Tap to report your absence to HR
                    </Text>
                  </View>
                </View>
                <Text style={styles.absenceBannerCta}>Report →</Text>
              </TouchableOpacity>
            )}

            {/* ── Period Stats ─────────────────────────────────────────────── */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftColor: "#2563EB" }]}>
                <Text style={styles.statValue}>{attendanceRate}%</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#16A34A" }]}>
                <Text style={styles.statValue}>{presentDays}</Text>
                <Text style={styles.statLabel}>Days Present</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}>
                <Text style={styles.statValue}>{lateDays}</Text>
                <Text style={styles.statLabel}>Days Late</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#EF4444" }]}>
                <Text style={styles.statValue}>{absentDays}</Text>
                <Text style={styles.statLabel}>Days Absent</Text>
              </View>
            </View>

            {/* ── History Header + Filter ──────────────────────────────────── */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Attendance History</Text>
                <Text style={styles.sectionSubtitle}>
                  {filterLabel[historyFilter]}
                </Text>
              </View>
              <View style={styles.filterRow}>
                {(["week", "month", "all"] as HistoryFilter[]).map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterChip,
                      historyFilter === f && styles.filterChipActive,
                    ]}
                    onPress={() => setHistoryFilter(f)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        historyFilter === f && styles.filterChipTextActive,
                      ]}
                    >
                      {f === "week" ? "Week" : f === "month" ? "Month" : "All"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── History List ─────────────────────────────────────────────── */}
            {loading && (
              <ActivityIndicator
                size="large"
                color="#1e3a8a"
                style={{ marginTop: 24 }}
              />
            )}

            {!loading && history.length === 0 && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No records found</Text>
                <Text style={styles.emptyText}>
                  Your attendance history will appear here.
                </Text>
              </View>
            )}

            {!loading &&
              history.length > 0 &&
              history.map((rec) => {
                const s = getStatusStyle(rec.status);
                return (
                  <View key={rec.date} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyDate}>
                        {formatDateStr(rec.date)}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: s.bg,
                            borderColor: s.border,
                          },
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: s.text }]}>
                          {rec.status}
                        </Text>
                      </View>
                    </View>

                    {/* Punch times */}
                    {(rec.timeIn || rec.timeOut) && (
                      <View style={styles.historyInfoRow}>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoLabel}>Time In</Text>
                          <Text style={styles.infoValue}>
                            {formatTime(rec.timeIn)}
                          </Text>
                        </View>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoLabel}>Time Out</Text>
                          <Text style={styles.infoValue}>
                            {formatTime(rec.timeOut)}
                          </Text>
                        </View>
                        <View style={[styles.infoBox, { marginRight: 0 }]}>
                          <Text style={styles.infoLabel}>Hours</Text>
                          <Text style={styles.infoValue}>
                            {formatHours(rec.timeIn, rec.timeOut)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Absence reason row */}
                    {rec.absenceReason && (
                      <View style={styles.absenceRow}>
                        <View style={styles.absenceReasonTag}>
                          <Text style={styles.absenceReasonText}>
                            {rec.absenceReason}
                          </Text>
                        </View>
                        {rec.absenceNotes ? (
                          <Text style={styles.absenceNoteText}>
                            {rec.absenceNotes}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: "#F1F5F9" },
  layout:      { flex: 1, flexDirection: "row", backgroundColor: "#F1F5F9" },
  mainContent: { flex: 1, backgroundColor: "#F1F5F9" },
  scroll:      { flex: 1 },
  content:     { padding: 16, paddingBottom: 36 },

  heroCard:  { borderRadius: 20, padding: 20, marginBottom: 16, alignItems: "center" },
  eyebrow:   { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  heroTime:  { fontSize: 42, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1, marginBottom: 6 },
  heroDate:  { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600" },

  statusRow: { flexDirection: "row", marginBottom: 12, gap: 8 },
  statusBox: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, padding: 12, alignItems: "center" },
  statusLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  statusValue: { fontSize: 15, fontWeight: "800", color: "#0F172A" },

  banner:       { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, gap: 10 },
  bannerDone:   { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  bannerIn:     { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  bannerAbsence:{ backgroundColor: "#F3E8FF", borderColor: "#E9D5FF" },
  bannerDot:    { width: 8, height: 8, borderRadius: 4 },
  bannerText:   { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F172A", lineHeight: 18 },
  bannerSub:    { fontSize: 11, color: "#6B7280", marginTop: 2 },

  buttonRow: { flexDirection: "row", marginBottom: 12, gap: 10 },
  punchBtn:  { flex: 1, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  clockInBtn:  { backgroundColor: "#16A34A" },
  clockOutBtn: { backgroundColor: "#DC2626" },
  btnDisabled: { opacity: 0.38 },
  punchBtnText:{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  absenceBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  absenceBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  absenceIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  absenceIconText: { fontSize: 14, fontWeight: "900", color: "#D97706" },
  absenceBannerTitle: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  absenceBannerSub:   { fontSize: 11, color: "#64748B", marginTop: 1 },
  absenceBannerCta:   { fontSize: 13, fontWeight: "700", color: "#2563EB" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  statCard:  {
    flex: 1, minWidth: "45%", backgroundColor: "#FFFFFF", borderWidth: 1,
    borderColor: "#E2E8F0", borderRadius: 14, padding: 14, borderLeftWidth: 3,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle:  { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  filterRow:  { flexDirection: "row", gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  filterChipText:   { fontSize: 11, fontWeight: "700", color: "#64748B" },
  filterChipTextActive: { color: "#FFFFFF" },

  emptyCard:  { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 18, padding: 28, alignItems: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  emptyText:  { fontSize: 13, color: "#64748B", textAlign: "center" },

  historyCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 18, padding: 14, marginBottom: 10 },
  historyTop:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  historyDate: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  badge:       { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  badgeText:   { fontSize: 11, fontWeight: "800" },

  historyInfoRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  infoBox:    { flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  infoLabel:  { fontSize: 10, color: "#64748B", fontWeight: "700", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.3 },
  infoValue:  { fontSize: 13, color: "#0F172A", fontWeight: "800" },

  absenceRow:       { marginTop: 8, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  absenceReasonTag: { backgroundColor: "#F3E8FF", borderWidth: 1, borderColor: "#E9D5FF", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  absenceReasonText:{ fontSize: 11, fontWeight: "700", color: "#7E22CE" },
  absenceNoteText:  { fontSize: 11, color: "#64748B", fontStyle: "italic", flex: 1 },
});

// ─── Absence Modal Styles ─────────────────────────────────────────────────────

const absenceStyles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1",
    alignSelf: "center", marginBottom: 20,
  },
  title:    { fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#64748B", marginBottom: 20 },

  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  required:   { color: "#EF4444" },
  optional:   { fontSize: 11, color: "#9CA3AF", fontWeight: "400", textTransform: "none" },

  reasonList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  reasonChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0",
  },
  reasonChipActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  reasonChipText:   { fontSize: 13, fontWeight: "600", color: "#374151" },
  reasonChipTextActive: { color: "#FFFFFF" },

  notesInput: {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#0F172A",
    textAlignVertical: "top", minHeight: 80, backgroundColor: "#F8FAFC",
  },
  charCount: { fontSize: 10, color: "#94A3B8", textAlign: "right", marginTop: 4, marginBottom: 16 },

  errorBox:  { backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  errorText: { fontSize: 13, color: "#DC2626", fontWeight: "600" },

  actionRow: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#374151" },
  submitBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
