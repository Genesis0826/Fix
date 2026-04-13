import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type SessionSummary = {
  session_id: string;
  employee_name: string | null;
  assigned_position: string;
  assigned_department: string;
  status: string;
  progress_percentage: number;
  deadline_date: string;
};

type OnboardingItemDetail = {
  onboarding_item_id: string;
  title: string;
  status: string;
  is_required: boolean;
  type: string;
  description?: string;
  files: { file_url: string; file_name: string; uploaded_at: string }[];
  proof_of_receipt: { file_url: string; file_name: string }[];
  delivery_method?: string | null;
  delivery_address?: string | null;
};

type Remark = {
  remark_id: string;
  tab_tag: string;
  remark_text: string;
  created_at: string;
  author: string;
};

type ProfileData = {
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number: string;
  date_of_birth: string;
  civil_status: string;
  complete_address: string;
  contact_name: string;
  relationship: string;
  emergency_phone_number: string;
};

type SessionDetail = {
  session_id: string;
  employee_name: string | null;
  assigned_position: string;
  assigned_department: string;
  status: string;
  progress_percentage: number;
  deadline_date: string;
  completed_at: string | null;
  documents: OnboardingItemDetail[];
  tasks: OnboardingItemDetail[];
  equipment: OnboardingItemDetail[];
  hr_forms: OnboardingItemDetail[];
  profile: ProfileData | null;
  remarks: Remark[];
};

type DetailTab = "profile" | "documents" | "forms" | "tasks" | "equipment";

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === "approved" || status === "confirmed") return "#15803D";
  if (status === "for-review" || status === "submitted") return "#B45309";
  if (status === "in-progress") return "#1D4ED8";
  if (status === "overdue") return "#B91C1C";
  if (status === "rejected") return "#B91C1C";
  if (status === "issued") return "#7C3AED";
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

function daysLabel(deadlineDate: string, status: string): { text: string; color: string } {
  if (status === "approved") return { text: "", color: "#64748B" };
  const days = Math.ceil((new Date(deadlineDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "#B91C1C" };
  if (days <= 2) return { text: `${days}d left`, color: "#D97706" };
  return { text: `${days}d left`, color: "#64748B" };
}

// ── Main Component ─────────────────────────────────────────────────────────

export const HROfficerOnboardingScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal state
  const [selectedDetail, setSelectedDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("profile");

  // Deadline editing
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);

  // Remarks
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});
  const [savingRemark, setSavingRemark] = useState(false);

  // Item status updates
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  // Session approval
  const [approvingSession, setApprovingSession] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = () => {
    authFetch(`${API_BASE_URL}/onboarding/hr/sessions`)
      .then(res => res.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load onboarding sessions."))
      .finally(() => setLoading(false));
  };

  const openDetail = async (summary: SessionSummary) => {
    setDetailLoading(true);
    setDetailTab("profile");
    setEditingDeadline(false);
    setRemarkInputs({});
    try {
      const res = await authFetch(`${API_BASE_URL}/onboarding/hr/sessions/${summary.session_id}`);
      const data: SessionDetail = await res.json();
      setSelectedDetail(data);
    } catch {
      // silently ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedDetail) return;
    try {
      const res = await authFetch(`${API_BASE_URL}/onboarding/hr/sessions/${selectedDetail.session_id}`);
      const data: SessionDetail = await res.json();
      setSelectedDetail(data);
      // refresh summary list too
      const listRes = await authFetch(`${API_BASE_URL}/onboarding/hr/sessions`);
      const list = await listRes.json();
      setSessions(Array.isArray(list) ? list : []);
    } catch {
      // silently ignore
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: string) => {
    setUpdatingItem(itemId);
    try {
      await authFetch(`${API_BASE_URL}/onboarding/hr/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refreshDetail();
    } catch {
      // silently ignore
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleSaveDeadline = async () => {
    if (!selectedDetail || !deadlineInput) return;
    setSavingDeadline(true);
    try {
      await authFetch(`${API_BASE_URL}/onboarding/hr/sessions/${selectedDetail.session_id}/deadline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline_date: deadlineInput }),
      });
      setEditingDeadline(false);
      await refreshDetail();
    } catch {
      // silently ignore
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleAddRemark = async (tabTag: string) => {
    if (!selectedDetail || !remarkInputs[tabTag]?.trim()) return;
    setSavingRemark(true);
    try {
      await authFetch(`${API_BASE_URL}/onboarding/hr/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: selectedDetail.session_id,
          tab_tag: tabTag,
          remark_text: remarkInputs[tabTag].trim(),
        }),
      });
      setRemarkInputs(prev => ({ ...prev, [tabTag]: "" }));
      await refreshDetail();
    } catch {
      // silently ignore
    } finally {
      setSavingRemark(false);
    }
  };

  const handleApproveSession = async () => {
    if (!selectedDetail) return;
    setApprovingSession(true);
    try {
      await authFetch(`${API_BASE_URL}/onboarding/hr/sessions/${selectedDetail.session_id}/approve`, {
        method: "POST",
      });
      await refreshDetail();
    } catch {
      // silently ignore
    } finally {
      setApprovingSession(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const forReviewCount = sessions.filter(s => s.status === "for-review").length;
  const inProgressCount = sessions.filter(s => s.status === "in-progress").length;
  const approvedCount = sessions.filter(s => s.status === "approved").length;
  const overdueCount = sessions.filter(s => s.status === "overdue").length;

  // ── Detail Tab Content ─────────────────────────────────────────────────
  const detailTabs: Array<{ key: DetailTab; label: string }> = [
    { key: "profile", label: "Profile" },
    { key: "documents", label: "Docs" },
    { key: "forms", label: "Forms" },
    { key: "tasks", label: "Tasks" },
    { key: "equipment", label: "Equip" },
  ];

  const renderItemActions = (item: OnboardingItemDetail, isEquipment = false) => {
    const canReview = item.status === "submitted" || item.status === "for-review";
    if (!canReview) return null;
    return (
      <View style={detailStyles.actionRow}>
        <TouchableOpacity
          style={[detailStyles.actionBtn, isEquipment ? detailStyles.issueBtn : detailStyles.approveBtn]}
          disabled={updatingItem === item.onboarding_item_id}
          onPress={() => handleUpdateItemStatus(item.onboarding_item_id, isEquipment ? "issued" : "approved")}
        >
          <Text style={detailStyles.actionBtnText}>
            {updatingItem === item.onboarding_item_id ? "..." : isEquipment ? "Issue" : "Approve"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[detailStyles.actionBtn, detailStyles.rejectBtn]}
          disabled={updatingItem === item.onboarding_item_id}
          onPress={() => handleUpdateItemStatus(item.onboarding_item_id, "rejected")}
        >
          <Text style={detailStyles.actionBtnText}>
            {updatingItem === item.onboarding_item_id ? "..." : "Reject"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRemarks = (tabTag: string) => {
    const tabRemarks = (selectedDetail?.remarks ?? []).filter(r => r.tab_tag === tabTag);
    return (
      <View style={detailStyles.remarksSection}>
        <Text style={detailStyles.remarksSectionLabel}>HR Remarks</Text>
        {tabRemarks.length === 0 ? (
          <Text style={detailStyles.noRemarks}>No remarks yet.</Text>
        ) : (
          tabRemarks.map(r => (
            <View key={r.remark_id} style={detailStyles.remarkCard}>
              <View style={detailStyles.remarkMeta}>
                <Text style={detailStyles.remarkAuthor}>{r.author}</Text>
                <Text style={detailStyles.remarkDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={detailStyles.remarkText}>{r.remark_text}</Text>
            </View>
          ))
        )}
        <View style={detailStyles.remarkInputRow}>
          <TextInput
            style={detailStyles.remarkInput}
            placeholder="Add a remark..."
            value={remarkInputs[tabTag] || ""}
            onChangeText={v => setRemarkInputs(prev => ({ ...prev, [tabTag]: v }))}
            multiline
          />
          <TouchableOpacity
            style={[detailStyles.remarkSendBtn, (!remarkInputs[tabTag]?.trim() || savingRemark) && detailStyles.remarkSendBtnDisabled]}
            onPress={() => handleAddRemark(tabTag)}
            disabled={!remarkInputs[tabTag]?.trim() || savingRemark}
          >
            <Text style={detailStyles.remarkSendBtnText}>{savingRemark ? "..." : "Add"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    if (!selectedDetail) return null;

    if (detailTab === "profile") {
      const p = selectedDetail.profile;
      return (
        <View style={detailStyles.tabContent}>
          {p ? (
            <View style={detailStyles.profileGrid}>
              {[
                { label: "Full Name", value: `${p.first_name} ${p.last_name}` },
                { label: "Email", value: p.email_address },
                { label: "Phone", value: p.phone_number },
                { label: "Date of Birth", value: p.date_of_birth },
                { label: "Civil Status", value: p.civil_status },
                { label: "Address", value: p.complete_address },
                { label: "Emergency Contact", value: `${p.contact_name} (${p.relationship})` },
                { label: "Emergency Phone", value: p.emergency_phone_number },
              ].map(({ label, value }) => (
                <View key={label} style={detailStyles.profileField}>
                  <Text style={detailStyles.profileLabel}>{label}</Text>
                  <Text style={detailStyles.profileValue}>{value || "—"}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={detailStyles.emptyCategory}>No profile submitted yet.</Text>
          )}
          {renderRemarks("Profile")}
        </View>
      );
    }

    const itemsMap: Record<DetailTab, OnboardingItemDetail[]> = {
      profile: [],
      documents: selectedDetail.documents,
      forms: selectedDetail.hr_forms,
      tasks: selectedDetail.tasks,
      equipment: selectedDetail.equipment,
    };
    const tabTagMap: Record<DetailTab, string> = {
      profile: "Profile",
      documents: "Documents",
      forms: "Forms",
      tasks: "Tasks",
      equipment: "Equipment",
    };

    const items = itemsMap[detailTab] || [];
    const isEquipment = detailTab === "equipment";

    return (
      <View style={detailStyles.tabContent}>
        {items.length === 0 ? (
          <Text style={detailStyles.emptyCategory}>No items in this category.</Text>
        ) : (
          items.map(item => (
            <View key={item.onboarding_item_id} style={detailStyles.itemCard}>
              <View style={detailStyles.itemHeader}>
                <Text style={detailStyles.itemTitle}>{item.title}</Text>
                <View style={[detailStyles.statusPill, { backgroundColor: statusColor(item.status) + "20", borderColor: statusColor(item.status) }]}>
                  <Text style={[detailStyles.statusPillText, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              {item.description ? <Text style={detailStyles.itemDesc}>{item.description}</Text> : null}
              {isEquipment && item.delivery_method && (
                <Text style={detailStyles.deliveryText}>
                  {item.delivery_method === "office" ? "Office Pickup" : `Delivery${item.delivery_address ? ` — ${item.delivery_address}` : ""}`}
                </Text>
              )}
              {renderItemActions(item, isEquipment)}
            </View>
          ))
        )}
        {renderRemarks(tabTagMap[detailTab])}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role={session.role as any} activeScreen="HROfficerOnboarding" navigation={navigation} session={session} />
        )}
        <View style={styles.content}>
          <Header
            title="Onboarding Management"
            subtitle="Review employee onboarding progress"
            rightElement={
              <MobileRoleMenu
                role={session.role as any}
                userName={session.name}
                email={session.email}
                activeScreen="HROfficerOnboarding"
                navigation={navigation}
              />
            }
          />

          <GradientHero
            title="Onboarding Dashboard"
            subtitle="Manage and review employee sessions"
          />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderLeftColor: "#B45309" }]}>
                <Text style={styles.statNum}>{forReviewCount}</Text>
                <Text style={styles.statLabel}>For Review</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#1D4ED8" }]}>
                <Text style={styles.statNum}>{inProgressCount}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#15803D" }]}>
                <Text style={styles.statNum}>{approvedCount}</Text>
                <Text style={styles.statLabel}>Approved</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: "#B91C1C" }]}>
                <Text style={[styles.statNum, overdueCount > 0 && { color: "#B91C1C" }]}>{overdueCount}</Text>
                <Text style={styles.statLabel}>Overdue</Text>
              </View>
            </View>

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading sessions...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && sessions.length === 0 && (
              <Text style={styles.emptyText}>No onboarding sessions found.</Text>
            )}

            {sessions.map(s => {
              const dl = daysLabel(s.deadline_date, s.status);
              return (
                <TouchableOpacity
                  key={s.session_id}
                  style={[styles.sessionCard, s.status === "overdue" && styles.sessionCardOverdue]}
                  onPress={() => openDetail(s)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.empName}>{s.employee_name ?? "Unknown Employee"}</Text>
                      <Text style={styles.empRole}>{s.assigned_position} • {s.assigned_department}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusColor(s.status) + "20", borderColor: statusColor(s.status) }]}>
                      <Text style={[styles.statusPillText, { color: statusColor(s.status) }]}>
                        {statusLabel(s.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressPct}>{s.progress_percentage}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${s.progress_percentage}%` as any, backgroundColor: statusColor(s.status) }]} />
                  </View>

                  <View style={styles.deadlineRow}>
                    <Text style={styles.deadlineText}>
                      Deadline: {new Date(s.deadline_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                    {dl.text ? <Text style={[styles.daysLabel, { color: dl.color }]}>{dl.text}</Text> : null}
                  </View>

                  <Text style={styles.tapHint}>Tap to manage →</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Detail Modal */}
      <Modal
        visible={!!selectedDetail || detailLoading}
        animationType="slide"
        onRequestClose={() => setSelectedDetail(null)}
      >
        <SafeAreaView style={detailStyles.modalContainer}>
          {/* Modal Header */}
          <View style={detailStyles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={detailStyles.modalTitle}>{selectedDetail?.employee_name ?? "Loading..."}</Text>
              {selectedDetail && (
                <Text style={detailStyles.modalSubtitle}>
                  {selectedDetail.assigned_position} • {selectedDetail.assigned_department}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setSelectedDetail(null)} style={detailStyles.closeBtn}>
              <Text style={detailStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={detailStyles.centered}>
              <ActivityIndicator size="large" color="#1E40AF" />
            </View>
          ) : selectedDetail ? (
            <ScrollView style={detailStyles.modalScroll} contentContainerStyle={detailStyles.modalScrollContent}>

              {/* Summary Card */}
              <View style={detailStyles.summaryCard}>
                <View style={detailStyles.summaryRow}>
                  <Text style={detailStyles.summaryLabel}>Status</Text>
                  <View style={[detailStyles.statusPill, { backgroundColor: statusColor(selectedDetail.status) + "20", borderColor: statusColor(selectedDetail.status) }]}>
                    <Text style={[detailStyles.statusPillText, { color: statusColor(selectedDetail.status) }]}>
                      {statusLabel(selectedDetail.status)}
                    </Text>
                  </View>
                </View>
                <View style={detailStyles.summaryRow}>
                  <Text style={detailStyles.summaryLabel}>Progress</Text>
                  <Text style={detailStyles.summaryValue}>{selectedDetail.progress_percentage}%</Text>
                </View>
                <View style={detailStyles.progressBarBg}>
                  <View style={[detailStyles.progressBarFill, { width: `${selectedDetail.progress_percentage}%` as any, backgroundColor: statusColor(selectedDetail.status) }]} />
                </View>
                <View style={[detailStyles.summaryRow, { marginTop: 10 }]}>
                  <Text style={detailStyles.summaryLabel}>Deadline</Text>
                  {editingDeadline ? (
                    <View style={detailStyles.deadlineEdit}>
                      <TextInput
                        style={detailStyles.deadlineInput}
                        value={deadlineInput}
                        onChangeText={setDeadlineInput}
                        placeholder="YYYY-MM-DD"
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={detailStyles.deadlineSaveBtn}
                        onPress={handleSaveDeadline}
                        disabled={savingDeadline}
                      >
                        <Text style={detailStyles.deadlineSaveBtnText}>{savingDeadline ? "..." : "Save"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingDeadline(false)}>
                        <Text style={detailStyles.deadlineCancelText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={detailStyles.deadlineRow}>
                      <Text style={detailStyles.summaryValue}>
                        {new Date(selectedDetail.deadline_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                      {selectedDetail.status !== "approved" && (
                        <TouchableOpacity
                          onPress={() => {
                            setDeadlineInput(selectedDetail.deadline_date.slice(0, 10));
                            setEditingDeadline(true);
                          }}
                          style={detailStyles.editDeadlineBtn}
                        >
                          <Text style={detailStyles.editDeadlineBtnText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Overdue Warning */}
              {selectedDetail.status === "overdue" && (
                <View style={detailStyles.overdueBox}>
                  <Text style={detailStyles.overdueTitle}>This onboarding is overdue</Text>
                  <Text style={detailStyles.overdueText}>
                    The deadline has passed. Consider extending the deadline or following up with the employee.
                  </Text>
                </View>
              )}

              {/* Approve Button */}
              {selectedDetail.status === "for-review" && (
                <TouchableOpacity
                  style={[detailStyles.approveSessionBtn, approvingSession && detailStyles.approveSessionBtnDisabled]}
                  onPress={handleApproveSession}
                  disabled={approvingSession}
                >
                  <Text style={detailStyles.approveSessionBtnText}>
                    {approvingSession ? "Approving..." : "✓ Approve Onboarding"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Detail Tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={detailStyles.tabRow}>
                {detailTabs.map(t => (
                  <Pressable
                    key={t.key}
                    onPress={() => setDetailTab(t.key)}
                    style={[detailStyles.tab, detailTab === t.key && detailStyles.tabActive]}
                  >
                    <Text style={[detailStyles.tabText, detailTab === t.key && detailStyles.tabTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Tab Content */}
              {renderTabContent()}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ── Summary List Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10, padding: 10, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  statLabel: { fontSize: 10, color: "#64748B", marginTop: 2 },
  centered: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B" },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: "#B91C1C", fontSize: 14 },
  emptyText: { color: "#64748B", textAlign: "center", paddingVertical: 24 },
  sessionCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sessionCardOverdue: { borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FFFAFA" },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  sessionInfo: { flex: 1, marginRight: 8 },
  empName: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  empRole: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "600" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 12, color: "#64748B" },
  progressPct: { fontSize: 12, fontWeight: "600", color: "#1E293B" },
  progressBarBg: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressBarFill: { height: 6, borderRadius: 3 },
  deadlineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deadlineText: { fontSize: 11, color: "#94A3B8" },
  daysLabel: { fontSize: 11, fontWeight: "600" },
  tapHint: { fontSize: 11, color: "#CBD5E1", textAlign: "right", marginTop: 8 },
});

// ── Detail Modal Styles ────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#1E3A8A", gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  modalSubtitle: { fontSize: 13, color: "#93C5FD", marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: "#FFFFFF", fontWeight: "600" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 16, gap: 12 },

  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  progressBarBg: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  progressBarFill: { height: 6, borderRadius: 3 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  deadlineEdit: { flexDirection: "row", alignItems: "center", gap: 8 },
  deadlineInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, color: "#1E293B", minWidth: 110 },
  deadlineSaveBtn: { backgroundColor: "#1E40AF", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  deadlineSaveBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  deadlineCancelText: { color: "#64748B", fontSize: 12 },
  editDeadlineBtn: { backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  editDeadlineBtnText: { color: "#475569", fontSize: 12, fontWeight: "600" },

  overdueBox: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#FECACA" },
  overdueTitle: { fontSize: 14, fontWeight: "700", color: "#991B1B", marginBottom: 4 },
  overdueText: { fontSize: 13, color: "#B91C1C", lineHeight: 18 },

  approveSessionBtn: { backgroundColor: "#15803D", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  approveSessionBtnDisabled: { backgroundColor: "#94A3B8" },
  approveSessionBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },

  tabRow: { flexDirection: "row", marginBottom: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 20, backgroundColor: "#F1F5F9" },
  tabActive: { backgroundColor: "#1E40AF" },
  tabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  tabTextActive: { color: "#FFFFFF" },

  tabContent: { gap: 10 },
  emptyCategory: { color: "#94A3B8", fontSize: 13, textAlign: "center", paddingVertical: 16 },

  profileGrid: { gap: 12 },
  profileField: {},
  profileLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  profileValue: { fontSize: 14, color: "#1E293B" },

  itemCard: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, gap: 6 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#1E293B", flex: 1, marginRight: 8 },
  itemDesc: { fontSize: 12, color: "#64748B" },
  deliveryText: { fontSize: 12, color: "#7C3AED" },
  statusPill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: "600" },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  approveBtn: { backgroundColor: "#15803D" },
  issueBtn: { backgroundColor: "#7C3AED" },
  rejectBtn: { backgroundColor: "#B91C1C" },
  actionBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  remarksSection: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 14, marginTop: 4, gap: 8 },
  remarksSectionLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
  noRemarks: { fontSize: 13, color: "#CBD5E1", fontStyle: "italic" },
  remarkCard: { backgroundColor: "#FFFFFF", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 4 },
  remarkMeta: { flexDirection: "row", justifyContent: "space-between" },
  remarkAuthor: { fontSize: 12, fontWeight: "700", color: "#475569" },
  remarkDate: { fontSize: 11, color: "#94A3B8" },
  remarkText: { fontSize: 13, color: "#1E293B", lineHeight: 18 },
  remarkInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  remarkInput: { flex: 1, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: "#1E293B", backgroundColor: "#FFFFFF", minHeight: 60, textAlignVertical: "top" },
  remarkSendBtn: { backgroundColor: "#1E40AF", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  remarkSendBtnDisabled: { backgroundColor: "#94A3B8" },
  remarkSendBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
