import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type OnboardingItem = {
  onboarding_item_id: string;
  title: string;
  status: string;
  is_required: boolean;
  type: string;
  description?: string;
};

type OnboardingSession = {
  session_id: string;
  template_name: string | null;
  employee_name: string | null;
  assigned_position: string;
  assigned_department: string;
  status: string;
  progress_percentage: number;
  deadline_date: string;
  completed_at?: string | null;
  documents: OnboardingItem[];
  tasks: OnboardingItem[];
  equipment: OnboardingItem[];
  hr_forms: OnboardingItem[];
  profile_items: OnboardingItem[];
  welcome: OnboardingItem[];
};

function statusColor(status: string) {
  if (status === "approved" || status === "confirmed") return "#15803D";
  if (status === "for-review" || status === "submitted") return "#B45309";
  if (status === "rejected") return "#B91C1C";
  if (status === "issued") return "#7C3AED";
  if (status === "overdue") return "#B91C1C";
  return "#64748B";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    "not-started": "Not Started",
    "in-progress": "In Progress",
    "for-review": "For Review",
    approved: "Approved",
    overdue: "Overdue",
    pending: "Pending",
    submitted: "Submitted",
    rejected: "Rejected",
    issued: "Issued",
    confirmed: "Confirmed",
  };
  return map[status] ?? status;
}

export const EmployeeOnboardingScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [onboarding, setOnboarding] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "tasks" | "equipment" | "forms">("documents");

  useEffect(() => {
    authFetch(`${API_BASE_URL}/onboarding/applicant/session`)
      .then(res => res.json())
      .then(data => setOnboarding(data))
      .catch(() => setError("Failed to load onboarding session."))
      .finally(() => setLoading(false));
  }, []);

  const tabs: Array<{ key: "documents" | "tasks" | "equipment" | "forms"; label: string }> = [
    { key: "documents", label: "Documents" },
    { key: "tasks", label: "Tasks" },
    { key: "equipment", label: "Equipment" },
    { key: "forms", label: "HR Forms" },
  ];

  // Exclude video tasks from the displayed list (they don't count toward progress)
  const displayTasks = (onboarding?.tasks ?? []).filter(t => t.type !== "video");

  const activeItems: OnboardingItem[] = onboarding
    ? activeTab === "documents"
      ? (onboarding.documents || [])
      : activeTab === "tasks"
      ? displayTasks
      : activeTab === "equipment"
      ? (onboarding.equipment || [])
      : (onboarding.hr_forms || [])
    : [];

  const isOverdue = onboarding?.status === "overdue";
  const isApproved = onboarding?.status === "approved";
  const isForReview = onboarding?.status === "for-review";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role={session.role as any} activeScreen="EmployeeOnboarding" navigation={navigation} session={session} />
        )}
        <View style={styles.content}>
          <Header
            title="My Onboarding"
            subtitle="Track your onboarding progress"
            rightElement={
              <MobileRoleMenu
                role={session.role as any}
                userName={session.name}
                email={session.email}
                activeScreen="EmployeeOnboarding"
                navigation={navigation}
              />
            }
          />

          <GradientHero
            title={onboarding ? `Welcome, ${onboarding.employee_name ?? session.name}` : "My Onboarding"}
            subtitle={onboarding ? `${onboarding.assigned_position} • ${onboarding.assigned_department}` : "Loading..."}
          />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading onboarding...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && !onboarding && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No Onboarding Assigned</Text>
                <Text style={styles.emptyText}>
                  You don't have an active onboarding session. Please contact your HR officer.
                </Text>
              </View>
            )}

            {onboarding && (
              <>
                {/* Progress Card */}
                <View style={styles.card}>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Overall Progress</Text>
                    <Text style={[styles.progressPct, isOverdue && { color: "#B91C1C" }]}>
                      {onboarding.progress_percentage}%
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${onboarding.progress_percentage}%` as any },
                        isOverdue && { backgroundColor: "#B91C1C" },
                        isApproved && { backgroundColor: "#15803D" },
                      ]}
                    />
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      Status:{" "}
                      <Text style={{ color: statusColor(onboarding.status), fontWeight: "600" }}>
                        {statusLabel(onboarding.status)}
                      </Text>
                    </Text>
                    <Text style={styles.metaText}>
                      Deadline: {new Date(onboarding.deadline_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                </View>

                {/* Overdue Warning */}
                {isOverdue && (
                  <View style={styles.overdueBox}>
                    <Text style={styles.overdueTitle}>Your onboarding is overdue</Text>
                    <Text style={styles.overdueText}>
                      The deadline has passed. Please complete your remaining items and contact your HR officer if you need an extension.
                    </Text>
                  </View>
                )}

                {/* For Review notice */}
                {isForReview && (
                  <View style={styles.reviewBox}>
                    <Text style={styles.reviewTitle}>Under Review</Text>
                    <Text style={styles.reviewText}>
                      Your onboarding has been submitted and is awaiting HR approval. No further action needed.
                    </Text>
                  </View>
                )}

                {/* Approved / Completion State */}
                {isApproved ? (
                  <View style={styles.completionBox}>
                    <Text style={styles.completionIcon}>✓</Text>
                    <Text style={styles.completionTitle}>Onboarding Complete!</Text>
                    <Text style={styles.completionText}>
                      Your onboarding has been approved.
                      {onboarding.completed_at
                        ? ` Completed on ${new Date(onboarding.completed_at).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}.`
                        : ""}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Tabs */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
                      {tabs.map(tab => (
                        <Pressable
                          key={tab.key}
                          onPress={() => setActiveTab(tab.key)}
                          style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                        >
                          <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                            {tab.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {/* Items List */}
                    {activeItems.length === 0 ? (
                      <Text style={styles.emptyText}>No items in this category.</Text>
                    ) : (
                      activeItems.map(item => (
                        <View key={item.onboarding_item_id} style={styles.itemCard}>
                          <View style={styles.itemHeader}>
                            <Text style={styles.itemTitle}>
                              {item.title}{item.is_required ? " *" : ""}
                            </Text>
                            <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) + "20", borderColor: statusColor(item.status) }]}>
                              <Text style={[styles.statusPillText, { color: statusColor(item.status) }]}>
                                {statusLabel(item.status)}
                              </Text>
                            </View>
                          </View>
                          {item.description && (
                            <Text style={styles.itemDesc}>{item.description}</Text>
                          )}
                        </View>
                      ))
                    )}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  centered: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B" },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: "#B91C1C", fontSize: 14 },
  emptyBox: { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 32, alignItems: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 14 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  progressPct: { fontSize: 14, fontWeight: "700", color: "#1E40AF" },
  progressBarBg: { height: 8, backgroundColor: "#E2E8F0", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: 8, backgroundColor: "#1E40AF", borderRadius: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  metaText: { fontSize: 12, color: "#64748B" },
  overdueBox: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FECACA" },
  overdueTitle: { fontSize: 14, fontWeight: "700", color: "#991B1B", marginBottom: 4 },
  overdueText: { fontSize: 13, color: "#B91C1C", lineHeight: 18 },
  reviewBox: { backgroundColor: "#FFFBEB", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FCD34D" },
  reviewTitle: { fontSize: 14, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  reviewText: { fontSize: 13, color: "#B45309", lineHeight: 18 },
  completionBox: { backgroundColor: "#F0FDF4", borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "#BBF7D0" },
  completionIcon: { fontSize: 40, color: "#15803D", marginBottom: 12 },
  completionTitle: { fontSize: 20, fontWeight: "800", color: "#14532D", marginBottom: 8 },
  completionText: { fontSize: 14, color: "#166534", textAlign: "center", lineHeight: 20 },
  tabRow: { flexDirection: "row", marginBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  activeTab: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  activeTabText: { color: "#FFFFFF" },
  itemCard: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#1E293B", flex: 1, marginRight: 8 },
  itemDesc: { fontSize: 12, color: "#64748B" },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "600" },
});
