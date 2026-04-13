import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type ApplicationStage =
  | "submitted"
  | "screening"
  | "interview_1"
  | "technical"
  | "final_interview"
  | "hired"
  | "rejected";

type FilterStatus = "all" | "active" | "hired" | "rejected";

type Application = {
  application_id: string;
  job_posting_id: string;
  job_title?: string;
  company_name?: string;
  location?: string;
  employment_type?: string;
  salary_range?: string;
  description?: string;
  status: ApplicationStage;
  applied_at: string;
  updated_at?: string;
};

type JobDetail = {
  title?: string;
  department?: string;
  location?: string;
  employment_type?: string;
  salary_range?: string;
  description?: string;
};

const STAGE_ORDER: ApplicationStage[] = [
  "submitted",
  "screening",
  "interview_1",
  "technical",
  "final_interview",
  "hired",
];

const STAGE_LABELS: Record<ApplicationStage, string> = {
  submitted: "Applied",
  screening: "Screening",
  interview_1: "1st Interview",
  technical: "Technical",
  final_interview: "Final Interview",
  hired: "Hired",
  rejected: "Rejected",
};

function getStatusStyle(status: ApplicationStage) {
  switch (status) {
    case "hired":       return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
    case "rejected":    return { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" };
    case "final_interview":
    case "technical":   return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
    case "interview_1":
    case "screening":   return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
    default:            return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StageProgress({ status }: { readonly status: ApplicationStage }) {
  if (status === "rejected") {
    return (
      <View style={sp.wrap}>
        <Text style={sp.rejectedText}>Application not progressed further</Text>
      </View>
    );
  }
  const current = STAGE_ORDER.indexOf(status);
  return (
    <View style={sp.wrap}>
      <View style={sp.track}>
        {STAGE_ORDER.map((stage, idx) => {
          const done = idx <= current;
          return (
            <React.Fragment key={stage}>
              <View style={[sp.dot, done ? sp.dotDone : sp.dotPending]} />
              {idx < STAGE_ORDER.length - 1 && (
                <View style={[sp.line, done && idx < current ? sp.lineDone : sp.linePending]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <View style={sp.labels}>
        {STAGE_ORDER.map((stage, idx) => {
          const done = idx <= current;
          return (
            <Text key={stage} style={[sp.labelText, done ? sp.labelDone : sp.labelPending]} numberOfLines={1}>
              {STAGE_LABELS[stage]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: { marginTop: 10 },
  track: { flexDirection: "row", alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotDone: { backgroundColor: "#1E3A8A" },
  dotPending: { backgroundColor: "#E2E8F0" },
  line: { flex: 1, height: 2 },
  lineDone: { backgroundColor: "#1E3A8A" },
  linePending: { backgroundColor: "#E2E8F0" },
  labels: { flexDirection: "row", marginTop: 4 },
  labelText: { flex: 1, fontSize: 8, textAlign: "center" },
  labelDone: { color: "#1E3A8A", fontWeight: "700" },
  labelPending: { color: "#94A3B8", fontWeight: "600" },
  rejectedText: { color: "#991B1B", fontSize: 12, fontWeight: "600" },
});

export function ApplicantApplicationsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Applicant", email: "", role: "applicant" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loadingJobDetail, setLoadingJobDetail] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/jobs/applicant/my-applications`);
      const data = await res.json().catch(() => []);
      setApps(Array.isArray(data) ? data : []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  async function openDetail(app: Application) {
    setSelectedApp(app);
    setJobDetail(null);
    // Try to fetch job details
    if (app.job_posting_id) {
      setLoadingJobDetail(true);
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs/${app.job_posting_id}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data) setJobDetail(data);
        }
      } catch {
        // ignore, will show what we have from app data
      } finally {
        setLoadingJobDetail(false);
      }
    }
  }

  const activeCount = apps.filter((a) => a.status !== "hired" && a.status !== "rejected").length;
  const hiredCount = apps.filter((a) => a.status === "hired").length;
  const rejectedCount = apps.filter((a) => a.status === "rejected").length;

  const filtered = apps.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.job_title?.toLowerCase().includes(q) ||
      a.company_name?.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q);

    const matchFilter =
      filterStatus === "all" ||
      (filterStatus === "active" && a.status !== "hired" && a.status !== "rejected") ||
      (filterStatus === "hired" && a.status === "hired") ||
      (filterStatus === "rejected" && a.status === "rejected");

    return matchSearch && matchFilter;
  });

  const active = filtered.filter((a) => a.status !== "hired" && a.status !== "rejected");
  const concluded = filtered.filter((a) => a.status === "hired" || a.status === "rejected");

  const mergedJobDetail = {
    location: jobDetail?.location ?? selectedApp?.location,
    employment_type: jobDetail?.employment_type ?? selectedApp?.employment_type,
    salary_range: jobDetail?.salary_range ?? selectedApp?.salary_range,
    description: jobDetail?.description ?? selectedApp?.description,
    department: jobDetail?.department,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar role="applicant" userName={session.name} email={session.email} activeScreen="Applications" navigation={navigation} />
        )}
        <View style={styles.main}>
          {isMobile && (
            <MobileRoleMenu role="applicant" userName={session.name} email={session.email} activeScreen="Applications" navigation={navigation} />
          )}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <GradientHero style={styles.hero}>
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.heroEyebrow}>Applicant Portal</Text>
              </View>
              <Text style={styles.heroTitle}>
                My <Text style={styles.heroAccent}>Applications</Text>
              </Text>
              <Text style={styles.heroSub}>
                Track the status of all your submitted applications in real time.
              </Text>
            </GradientHero>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatBox label="Total" value={String(apps.length)} color="#1E3A8A" />
              <StatBox label="Active" value={String(activeCount)} color="#059669" />
              <StatBox label="Hired" value={String(hiredCount)} color="#15803D" />
              <StatBox label="Rejected" value={String(rejectedCount)} color="#DC2626" />
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Feather name="search" size={16} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by job title or status..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            {/* Status filter pills */}
            <View style={styles.filterRow}>
              {(["all", "active", "hired", "rejected"] as FilterStatus[]).map((f) => {
                const active = filterStatus === f;
                const labels: Record<FilterStatus, string> = {
                  all: `All (${apps.length})`,
                  active: `Active (${activeCount})`,
                  hired: `Hired (${hiredCount})`,
                  rejected: `Rejected (${rejectedCount})`,
                };
                const colors: Record<FilterStatus, { bg: string; border: string; text: string }> = {
                  all: { bg: "#EFF6FF", border: "#1E3A8A", text: "#1E3A8A" },
                  active: { bg: "#ECFDF5", border: "#059669", text: "#059669" },
                  hired: { bg: "#DCFCE7", border: "#15803D", text: "#15803D" },
                  rejected: { bg: "#FEE2E2", border: "#DC2626", text: "#DC2626" },
                };
                return (
                  <Pressable
                    key={f}
                    style={[
                      styles.filterPill,
                      active && { backgroundColor: colors[f].bg, borderColor: colors[f].border },
                    ]}
                    onPress={() => setFilterStatus(f)}
                  >
                    <Text style={[styles.filterPillText, active && { color: colors[f].text }]}>
                      {labels[f]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {loading && (
              <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 32 }} />
            )}
            {!loading && filtered.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="inbox" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No applications found</Text>
                <Text style={styles.emptyText}>
                  {apps.length === 0
                    ? "Browse open jobs and submit your first application."
                    : "Try clearing the search or filter."}
                </Text>
              </View>
            )}
            {!loading && filtered.length > 0 && (
              <>
                {active.length > 0 && <SectionHeader title="In Progress" count={active.length} />}
                {active.map((app) => (
                  <ApplicationCard key={app.application_id} app={app} onPress={() => openDetail(app)} />
                ))}
                {concluded.length > 0 && <SectionHeader title="Concluded" count={concluded.length} />}
                {concluded.map((app) => (
                  <ApplicationCard key={app.application_id} app={app} onPress={() => openDetail(app)} />
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Detail Modal */}
      <Modal
        visible={!!selectedApp}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedApp(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Gradient header */}
            {selectedApp && (
              <LinearGradient
                colors={["#0f172a", "#172554", "#134e4a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradHeader}
              >
                <View style={styles.modalCircle1} />
                <View style={styles.modalCircle2} />
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    {mergedJobDetail.department && (
                      <Text style={styles.modalEyebrow}>{mergedJobDetail.department}</Text>
                    )}
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {selectedApp.job_title ?? "Job Application"}
                    </Text>
                    {(mergedJobDetail.location || mergedJobDetail.employment_type) && (
                      <View style={styles.modalMetaRow}>
                        {mergedJobDetail.location && (
                          <>
                            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.75)" />
                            <Text style={styles.modalMetaText}>{mergedJobDetail.location}</Text>
                          </>
                        )}
                        {mergedJobDetail.employment_type && (
                          <>
                            {mergedJobDetail.location && <Text style={styles.modalMetaDot}>·</Text>}
                            <Text style={styles.modalMetaText}>{mergedJobDetail.employment_type}</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                  <Pressable style={styles.closeBtn} onPress={() => setSelectedApp(null)}>
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Status badge in header */}
                {(() => {
                  const s = getStatusStyle(selectedApp.status);
                  return (
                    <View style={[styles.modalStatusBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
                      <Text style={[styles.modalStatusText, { color: s.text }]}>
                        {STAGE_LABELS[selectedApp.status]}
                      </Text>
                    </View>
                  );
                })()}
              </LinearGradient>
            )}

            {selectedApp && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalBody}>

                  {/* Meta grid */}
                  <View style={styles.metaGrid}>
                    <MetaItem icon="calendar" label="Applied" value={formatDate(selectedApp.applied_at)} />
                    {selectedApp.updated_at && (
                      <MetaItem icon="refresh-cw" label="Last Updated" value={formatDate(selectedApp.updated_at)} />
                    )}
                    {mergedJobDetail.location && (
                      <MetaItem icon="map-pin" label="Location" value={mergedJobDetail.location} />
                    )}
                    {mergedJobDetail.employment_type && (
                      <MetaItem icon="briefcase" label="Job Type" value={mergedJobDetail.employment_type} />
                    )}
                    {mergedJobDetail.salary_range && (
                      <MetaItem icon="dollar-sign" label="Salary" value={mergedJobDetail.salary_range} />
                    )}
                  </View>

                  {/* Application Progress */}
                  <View style={styles.progressSection}>
                    <Text style={styles.sectionLabel}>Application Progress</Text>
                    <StageProgress status={selectedApp.status} />
                  </View>

                  {/* Job Description */}
                  {loadingJobDetail && (
                    <View style={styles.descCard}>
                      <ActivityIndicator size="small" color="#1E3A8A" />
                    </View>
                  )}
                  {!loadingJobDetail && !!mergedJobDetail.description && (
                    <View style={styles.descCard}>
                      <Text style={styles.sectionLabel}>About this Role</Text>
                      <Text style={styles.descBody}>{mergedJobDetail.description}</Text>
                    </View>
                  )}

                  {/* Timeline */}
                  <View style={styles.timelineCard}>
                    <Text style={styles.sectionLabel}>Timeline</Text>
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineDot} />
                      <View>
                        <Text style={styles.timelineTitle}>Application Submitted</Text>
                        <Text style={styles.timelineDate}>{formatDate(selectedApp.applied_at)}</Text>
                      </View>
                    </View>
                    {selectedApp.updated_at && selectedApp.updated_at !== selectedApp.applied_at && (
                      <View style={styles.timelineRow}>
                        <View style={[styles.timelineDot, { backgroundColor: "#059669" }]} />
                        <View>
                          <Text style={styles.timelineTitle}>Status Updated to "{STAGE_LABELS[selectedApp.status]}"</Text>
                          <Text style={styles.timelineDate}>{formatDate(selectedApp.updated_at)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHeader({ title, count }: { readonly title: string; readonly count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{count}</Text>
      </View>
    </View>
  );
}

function ApplicationCard({ app, onPress }: { readonly app: Application; readonly onPress: () => void }) {
  const s = getStatusStyle(app.status);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{(app.job_title ?? "J")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{app.job_title ?? "Job Application"}</Text>
          {!!app.company_name && (
            <Text style={styles.cardCompany} numberOfLines={1}>{app.company_name}</Text>
          )}
        </View>
        <View style={[styles.cardBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
          <Text style={[styles.cardBadgeText, { color: s.text }]}>{STAGE_LABELS[app.status]}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {!!app.location && (
          <View style={styles.metaChip}>
            <Feather name="map-pin" size={11} color="#64748B" />
            <Text style={styles.metaChipText}>{app.location}</Text>
          </View>
        )}
        {!!app.employment_type && (
          <View style={styles.metaChip}>
            <Feather name="briefcase" size={11} color="#64748B" />
            <Text style={styles.metaChipText}>{app.employment_type}</Text>
          </View>
        )}
        <View style={styles.metaChip}>
          <Feather name="calendar" size={11} color="#64748B" />
          <Text style={styles.metaChipText}>{formatDate(app.applied_at)}</Text>
        </View>
      </View>

      <StageProgress status={app.status} />
    </Pressable>
  );
}

function StatBox({ label, value, color }: { readonly label: string; readonly value: string; readonly color: string }) {
  return (
    <View style={[styles.statBox, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetaItem({ icon, label, value }: { readonly icon: any; readonly label: string; readonly value: string }) {
  return (
    <View style={styles.metaItem}>
      <Feather name={icon} size={13} color="#64748B" />
      <View style={{ marginLeft: 6 }}>
        <Text style={styles.metaItemLabel}>{label}</Text>
        <Text style={styles.metaItemValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  // Hero
  hero: { borderRadius: 20, padding: 20, overflow: "hidden" },
  heroCircle1: {
    position: "absolute", top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  heroCircle2: {
    position: "absolute", bottom: -30, left: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  heroIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginRight: 10,
  },
  heroEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 6 },
  heroAccent: { color: "#34D399" },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 19 },

  // Stats
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12,
    borderWidth: 1, borderColor: "#E2E8F0", borderTopWidth: 3, padding: 10, alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { color: "#64748B", fontSize: 10, fontWeight: "700", marginTop: 2 },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, paddingHorizontal: 12, height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 14 },
  clearBtn: { padding: 4 },

  // Filter pills
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  filterPillText: { color: "#64748B", fontSize: 12, fontWeight: "700" },

  // Empty
  emptyCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 32, alignItems: "center", gap: 8,
  },
  emptyTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  emptyText: { color: "#64748B", fontSize: 13, textAlign: "center", lineHeight: 18 },

  // Section header
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 2 },
  sectionTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  sectionBadge: { backgroundColor: "#EFF6FF", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { color: "#1E3A8A", fontSize: 11, fontWeight: "800" },

  // Card
  card: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 14,
  },
  cardPressed: { opacity: 0.75 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  cardAvatar: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  cardAvatarText: { color: "#1E3A8A", fontSize: 16, fontWeight: "800" },
  cardTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800", lineHeight: 20 },
  cardCompany: { color: "#64748B", fontSize: 12, fontWeight: "600", marginTop: 2 },
  cardBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginLeft: "auto" },
  cardBadgeText: { fontSize: 11, fontWeight: "800" },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  metaChipText: { color: "#64748B", fontSize: 11, fontWeight: "600" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: "88%", overflow: "hidden",
  },
  modalGradHeader: {
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18,
    overflow: "hidden", position: "relative",
  },
  modalCircle1: {
    position: "absolute", top: -50, right: -50,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modalCircle2: {
    position: "absolute", bottom: -30, left: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  modalHeaderRow: { flexDirection: "row", alignItems: "flex-start" },
  modalEyebrow: {
    color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  modalMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  modalMetaText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  modalMetaDot: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  modalStatusBadge: {
    alignSelf: "flex-start", borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 12,
  },
  modalStatusText: { fontSize: 13, fontWeight: "800" },

  modalBody: { padding: 16, gap: 14 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: {
    flexDirection: "row", alignItems: "flex-start",
    width: "45%", backgroundColor: "#F8FAFC",
    borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#E2E8F0",
  },
  metaItemLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  metaItemValue: { color: "#0F172A", fontSize: 13, fontWeight: "700", marginTop: 2 },

  progressSection: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, padding: 14,
  },
  sectionLabel: { color: "#0F172A", fontSize: 14, fontWeight: "800", marginBottom: 8 },

  descCard: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, padding: 14,
  },
  descBody: { color: "#374151", fontSize: 13, lineHeight: 20 },

  timelineCard: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, padding: 14, gap: 10,
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#1E3A8A",
    marginTop: 4, flexShrink: 0,
  },
  timelineTitle: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  timelineDate: { color: "#64748B", fontSize: 12, marginTop: 2 },
});
