import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { Colors } from "../constants/colors";
import { UserSession } from "../services/auth";

type ChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
};

type FilterMode = "all" | "pending" | "completed" | "locked";

const BASE_TASKS: ChecklistItem[] = [
  { id: "id_docs", title: "Upload identification documents", completed: false },
  { id: "handbook", title: "Review employee handbook", completed: false },
  { id: "tax", title: "Complete tax forms", completed: false },
  { id: "deposit", title: "Set up direct deposit", completed: false },
  { id: "security", title: "IT security training", completed: false },
];

export const EmployeeDashboardScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [tasks, setTasks] = useState<ChecklistItem[]>(BASE_TASKS);
  const [filter, setFilter] = useState<FilterMode>("all");

  const coreTasks = tasks.slice(0, 4);
  const coreDone = coreTasks.filter((t) => t.completed).length;
  const trainingLocked = coreDone < coreTasks.length;

  const taskState = useMemo(() => {
    return tasks.map((task) => {
      const locked = task.id === "security" ? trainingLocked : false;
      return { ...task, locked };
    });
  }, [tasks, trainingLocked]);

  const unlockedTasks = taskState.filter((t) => !t.locked);
  const completedCount = unlockedTasks.filter((t) => t.completed).length;
  const pendingCount = unlockedTasks.filter((t) => !t.completed).length;
  const lockedCount = taskState.filter((t) => t.locked).length;
  const progress = unlockedTasks.length ? Math.round((completedCount / unlockedTasks.length) * 100) : 0;


  const visibleTasks = taskState.filter((task) => {
    if (filter === "pending") return !task.locked && !task.completed;
    if (filter === "completed") return task.completed;
    if (filter === "locked") return task.locked;
    return true;
  });

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const lockedNow = task.id === "security" ? trainingLocked : false;
        if (lockedNow) return task;
        return { ...task, completed: !task.completed };
      }),
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.rootRow}>
        {!isMobile && (
          <Sidebar
            role="employee"
            userName={session.name}
            email={session.email}
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainCol}>
          {isMobile ? (
            <MobileRoleMenu
              role="employee"
              userName={session.name}
              email={session.email}
              activeScreen="Dashboard"
              navigation={navigation}
            />
          ) : (
            <Header role="employee" userName={session.name} />
          )}

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <GradientHero style={{ marginBottom: 0 }}>
              <Text style={styles.heroEyebrow}>Staff Portal</Text>
              <Text style={styles.heroTitle}>Welcome back, {session.name.split(" ")[0]}</Text>
              <Text style={styles.heroSub}>Complete your onboarding tasks and track your progress below.</Text>

              <View style={styles.progressWrap}>
                <View style={styles.progressTopRow}>
                  <Text style={styles.progressLabel}>Onboarding Progress</Text>
                  <Text style={styles.progressValue}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${progress}%` }]} />
                </View>
              </View>
            </GradientHero>

            <View style={styles.metricsRow}>
              <StatTile label="Completed" value={`${completedCount}`} helper="done" accent="#16a34a" />
              <StatTile label="Pending" value={`${pendingCount}`} helper="to do" accent="#d97706" />
              <StatTile label="Locked" value={`${lockedCount}`} helper="blocked" accent="#64748b" />
            </View>

            {/* Quick Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <View style={styles.quickActionsRow}>
                <Pressable
                  style={styles.quickAction}
                  onPress={() => navigation.replace("EmployeeTimekeeping", { session })}
                >
                  <Text style={styles.quickActionLabel}>Clock In / Out</Text>
                  <Text style={styles.quickActionSub}>Timekeeping</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile Snapshot</Text>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Full Name</Text>
                <Text style={styles.profileValue}>{session.name}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Email</Text>
                <Text style={styles.profileValue}>{session.email || "—"}</Text>
              </View>
              <View style={styles.profileRowNoBorder}>
                <Text style={styles.profileLabel}>Role</Text>
                <Text style={styles.profileValue}>Internal Staff</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.checklistHead}>
                <Text style={styles.cardTitle}>Onboarding Checklist</Text>
                <Text style={styles.checklistTag}>{progress}% Complete</Text>
              </View>

              <View style={styles.filterRow}>
                {(["all", "pending", "completed", "locked"] as FilterMode[]).map((mode) => {
                  const active = filter === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setFilter(mode)}
                      style={[styles.filterChip, active ? styles.filterChipActive : undefined]}
                    >
                      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : undefined]}>{mode}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {visibleTasks.length === 0 ? (
                <Text style={styles.emptyText}>No tasks in this filter.</Text>
              ) : (
                visibleTasks.map((task) => {
                  const status = getTaskStatus(task.locked, task.completed);
                  let statusStyle = styles.statusPending;
                  if (task.locked) statusStyle = styles.statusLocked;
                  else if (task.completed) statusStyle = styles.statusDone;
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => toggleTask(task.id)}
                      disabled={task.locked}
                      style={[styles.taskRow, task.locked ? styles.taskRowLocked : undefined]}
                    >
                      <View style={styles.taskTextCol}>
                        <Text style={[styles.taskTitle, task.locked ? styles.taskTitleMuted : undefined]}>{task.title}</Text>
                        <Text style={styles.taskHint}>{task.locked ? "Complete prerequisite tasks to unlock" : "Tap to toggle completion"}</Text>
                      </View>

                      <View style={[styles.statusBadge, statusStyle]}>
                        <Text style={styles.statusText}>{status}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

function getTaskStatus(locked: boolean, completed: boolean): string {
  if (locked) return "Locked";
  if (completed) return "Completed";
  return "Pending";
}

function StatTile({ label, value, helper, accent = "#111827" }: { readonly label: string; readonly value: string; readonly helper: string; readonly accent?: string }) {
  return (
    <View style={[styles.statTile, { borderTopColor: accent, borderTopWidth: 3 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgApp,
  },
  rootRow: {
    flex: 1,
    flexDirection: "row",
  },
  mainCol: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 24,
    gap: 12,
  },
  hero: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickActionLabel: {
    color: "#1E3A8A",
    fontSize: 13,
    fontWeight: "800",
  },
  quickActionSub: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  heroSub: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  progressWrap: {
    marginTop: 14,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "700",
  },
  progressValue: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  progressTrack: {
    height: 7,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#93C5FD",
    borderRadius: 999,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
  },
  statHelper: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  cardSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  profileRow: {
    paddingTop: 9,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  profileRowNoBorder: {
    paddingTop: 9,
    paddingBottom: 2,
  },
  profileLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  profileValue: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  checklistHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  checklistTag: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.bgMuted,
  },
  filterChipActive: {
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryLight,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 12,
    paddingVertical: 8,
  },
  taskRow: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  taskRowLocked: {
    backgroundColor: Colors.bgMuted,
  },
  taskTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  taskTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  taskTitleMuted: {
    color: Colors.textMuted,
  },
  taskHint: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPending: {
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningLight,
  },
  statusDone: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  statusLocked: {
    borderColor: Colors.border,
    backgroundColor: Colors.bgSubtle,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
