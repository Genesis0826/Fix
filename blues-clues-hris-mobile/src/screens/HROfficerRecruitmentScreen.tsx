import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type JobPosting = {
  job_posting_id: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  salary_range: string | null;
  status: "open" | "closed" | "draft";
  posted_at: string;
  closes_at: string | null;
};

type Application = {
  application_id: string;
  status: string;
  applied_at: string;
  applicant_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    applicant_code: string;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusPillStyle(status: string) {
  if (status === "open")   return { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D" };
  if (status === "closed") return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" };
}

function appStatusStyle(status: string) {
  if (status === "hired")              return { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D",   label: "Hired" };
  if (status === "rejected")           return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C",   label: "Rejected" };
  if (status === "screening")          return { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309",   label: "Screening" };
  if (status === "first_interview")    return { bg: "#F3E8FF", border: "#DDD6FE", text: "#6D28D9",   label: "1st Interview" };
  if (status === "technical_interview")return { bg: "#E0E7FF", border: "#C7D2FE", text: "#4338CA",   label: "Technical" };
  if (status === "final_interview")    return { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9",   label: "Final" };
  return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", label: "Submitted" };
}

const AVATAR_COLORS = ["#1E3A8A", "#0F766E", "#6D28D9", "#B45309", "#991B1B"];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (str.codePointAt(i) ?? 0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

type ActiveTab = "details" | "applicants";

export const HROfficerRecruitmentScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "draft">("all");

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("details");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs`);
        const data = await res.json().catch(() => []);
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchStatus = statusFilter === "all" || job.status === statusFilter;
      const matchSearch = !q ||
        job.title.toLowerCase().includes(q) ||
        (job.location ?? "").toLowerCase().includes(q) ||
        (job.employment_type ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [jobs, search, statusFilter]);

  const openCount   = jobs.filter((j) => j.status === "open").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;
  const draftCount  = jobs.filter((j) => j.status === "draft").length;

  async function fetchApplications(jobId: string) {
    try {
      const res = await authFetch(`${API_BASE_URL}/jobs/${jobId}/applications`);
      const data = await res.json().catch(() => []);
      setApplications(Array.isArray(data) ? data : []);
    } catch {
      setApplications([]);
    } finally {
      setLoadingApplications(false);
    }
  }

  const openJobDetail = async (job: JobPosting) => {
    setSelectedJob(job);
    setActiveTab("details");
    setApplications([]);
    setDetailVisible(true);
    setLoadingApplications(true);
    await fetchApplications(job.job_posting_id);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar role="hr" userName={session.name} email={session.email} activeScreen="Recruitment" navigation={navigation} />
        )}

        <View style={styles.main}>
          {isMobile ? (
            <MobileRoleMenu role="hr" userName={session.name} email={session.email} activeScreen="Recruitment" navigation={navigation} />
          ) : null}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <GradientHero style={styles.heroCard}>
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Feather name="users" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.heroEyebrow}>HR Office</Text>
              </View>
              <Text style={styles.heroTitle}>
                Recruitment <Text style={styles.heroAccent}>Pipeline</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Manage open positions, track applicants, and move candidates through the hiring pipeline.
              </Text>
              <View style={styles.heroStatsRow}>
                {[
                  { label: "Total",  value: jobs.length,  accent: false },
                  { label: "Open",   value: openCount,    accent: true  },
                  { label: "Closed", value: closedCount,  accent: false },
                  { label: "Draft",  value: draftCount,   accent: false },
                ].map((s) => (
                  <View key={s.label} style={styles.heroStat}>
                    <Text style={[styles.heroStatValue, s.accent && { color: "#34D399" }]}>{s.value}</Text>
                    <Text style={styles.heroStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </GradientHero>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search title, location, type..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            {/* Status filter pills */}
            <View style={styles.filterRow}>
              {(["all", "open", "closed", "draft"] as const).map((f) => {
                const active = statusFilter === f;
                const counts: Record<string, number> = { all: jobs.length, open: openCount, closed: closedCount, draft: draftCount };
                return (
                  <Pressable
                    key={f}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setStatusFilter(f)}
                  >
                    <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Job list */}
            {loading && (
              <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 32 }} />
            )}
            {!loading && filteredJobs.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="briefcase" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>{jobs.length === 0 ? "No job postings yet" : "No matching jobs"}</Text>
                <Text style={styles.emptySub}>Try another keyword or create a new posting from web.</Text>
              </View>
            )}
            {!loading && filteredJobs.length > 0 && filteredJobs.map((job) => {
                const sp = statusPillStyle(job.status);
                const ac = avatarColor(job.title);
                return (
                  <Pressable
                    key={job.job_posting_id}
                    style={({ pressed }) => [styles.jobCard, pressed && { opacity: 0.75 }]}
                    onPress={() => openJobDetail(job)}
                  >
                    <View style={styles.jobTop}>
                      <View style={[styles.jobAvatar, { backgroundColor: ac }]}>
                        <Text style={styles.jobAvatarText}>{job.title[0]?.toUpperCase()}</Text>
                      </View>

                      <View style={styles.jobText}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <View style={styles.jobMetaRow}>
                          {job.location && (
                            <>
                              <Feather name="map-pin" size={12} color="#94A3B8" />
                              <Text style={styles.jobMeta}>{job.location}</Text>
                            </>
                          )}
                          {job.employment_type && (
                            <>
                              {job.location && <Text style={styles.metaDot}>·</Text>}
                              <Feather name="briefcase" size={12} color="#94A3B8" />
                              <Text style={styles.jobMeta}>{job.employment_type}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      <View style={[styles.statusPill, { backgroundColor: sp.bg, borderColor: sp.border }]}>
                        <Text style={[styles.statusText, { color: sp.text }]}>{job.status}</Text>
                      </View>
                    </View>

                    {job.description ? (
                      <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
                    ) : null}

                    <View style={styles.jobFooter}>
                      <View style={styles.footerLeft}>
                        {job.salary_range && (
                          <View style={styles.salaryChip}>
                            <Feather name="dollar-sign" size={11} color="#15803D" />
                            <Text style={styles.salaryText}>{job.salary_range}</Text>
                          </View>
                        )}
                        <View style={styles.dateChip}>
                          <Feather name="calendar" size={11} color="#64748B" />
                          <Text style={styles.dateChipText}>Posted {formatDate(job.posted_at)}</Text>
                        </View>
                      </View>
                      <View style={styles.viewHint}>
                        <Text style={styles.viewHintText}>View</Text>
                        <Feather name="chevron-right" size={14} color="#1E3A8A" />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </View>

      {/* Job Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={() => setDetailVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Gradient header */}
            {selectedJob && (
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
                    <Text style={styles.modalEyebrow}>HR · Job Posting</Text>
                    <Text style={styles.modalTitle} numberOfLines={2}>{selectedJob.title}</Text>
                    <View style={styles.modalMetaRow}>
                      {selectedJob.location && (
                        <>
                          <Feather name="map-pin" size={13} color="rgba(255,255,255,0.75)" />
                          <Text style={styles.modalMetaText}>{selectedJob.location}</Text>
                        </>
                      )}
                      {selectedJob.employment_type && (
                        <>
                          {selectedJob.location && <Text style={styles.modalMetaDot}>·</Text>}
                          <Text style={styles.modalMetaText}>{selectedJob.employment_type}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Pressable style={styles.closeBtn} onPress={() => setDetailVisible(false)}>
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View style={styles.modalBadgeRow}>
                  {(() => {
                    const sp = statusPillStyle(selectedJob.status);
                    return (
                      <View style={[styles.modalStatusBadge, { backgroundColor: sp.bg, borderColor: sp.border }]}>
                        <Text style={[styles.modalStatusText, { color: sp.text }]}>{selectedJob.status.toUpperCase()}</Text>
                      </View>
                    );
                  })()}
                  {selectedJob.salary_range && (
                    <View style={styles.modalSalaryBadge}>
                      <Feather name="dollar-sign" size={12} color="#34D399" />
                      <Text style={styles.modalSalaryText}>{selectedJob.salary_range}</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            )}

            {/* Tabs */}
            <View style={styles.tabRow}>
              <Pressable style={[styles.tab, activeTab === "details" && styles.tabActive]} onPress={() => setActiveTab("details")}>
                <Text style={[styles.tabText, activeTab === "details" && styles.tabTextActive]}>Details</Text>
              </Pressable>
              <Pressable style={[styles.tab, activeTab === "applicants" && styles.tabActive]} onPress={() => setActiveTab("applicants")}>
                <Text style={[styles.tabText, activeTab === "applicants" && styles.tabTextActive]}>
                  Applicants{!loadingApplications && applications.length > 0 ? ` (${applications.length})` : ""}
                </Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {activeTab === "details" && !!selectedJob && (
                <View style={{ gap: 14 }}>
                  <View style={styles.metaGrid}>
                    {[
                      { label: "Location", value: selectedJob.location ?? "—",               icon: "map-pin"  as const },
                      { label: "Type",     value: selectedJob.employment_type ?? "—",         icon: "briefcase" as const },
                      { label: "Salary",   value: selectedJob.salary_range ?? "Not specified", icon: "dollar-sign" as const },
                      { label: "Posted",   value: formatDate(selectedJob.posted_at),          icon: "calendar" as const },
                      { label: "Closes",   value: selectedJob.closes_at ? formatDate(selectedJob.closes_at) : "No deadline", icon: "clock" as const },
                    ].map((m) => (
                      <View key={m.label} style={styles.metaCard}>
                        <Feather name={m.icon} size={15} color="#1E3A8A" style={{ marginBottom: 6 }} />
                        <Text style={styles.metaLabel}>{m.label}</Text>
                        <Text style={styles.metaValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.descCard}>
                    <Text style={styles.descTitle}>Job Description</Text>
                    {selectedJob.description ? (
                      <Text style={styles.descBody}>{selectedJob.description}</Text>
                    ) : (
                      <Text style={styles.descEmpty}>No description provided.</Text>
                    )}
                  </View>
                </View>
              )}
              {activeTab === "applicants" && loadingApplications && (
                <ActivityIndicator color="#1E3A8A" style={{ marginTop: 24 }} />
              )}
              {activeTab === "applicants" && !loadingApplications && applications.length === 0 && (
                <View style={styles.emptyCard}>
                  <Feather name="inbox" size={28} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No applications yet</Text>
                  <Text style={styles.emptySub}>Applications will appear here when candidates apply.</Text>
                </View>
              )}
              {activeTab === "applicants" && !loadingApplications && applications.length > 0 && (
                <View style={{ gap: 10 }}>
                  {applications.map((app) => {
                    const s = appStatusStyle(app.status);
                    const fullName = [app.applicant_profile?.first_name, app.applicant_profile?.last_name]
                      .filter(Boolean).join(" ") || "Unnamed Applicant";
                    const initial = fullName[0]?.toUpperCase() ?? "?";
                    return (
                      <View key={app.application_id} style={styles.applicantCard}>
                        <View style={[styles.applicantAvatar, { backgroundColor: avatarColor(fullName) }]}>
                          <Text style={styles.applicantAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.applicantName}>{fullName}</Text>
                          <Text style={styles.applicantEmail}>{app.applicant_profile?.email ?? "No email"}</Text>
                          <Text style={styles.applicantCode}>{app.applicant_profile?.applicant_code ?? "—"}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 5 }}>
                          <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.border }]}>
                            <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                          </View>
                          <Text style={styles.applicantDate}>{formatDate(app.applied_at)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  // Hero
  heroCard: { borderRadius: 20, padding: 20, overflow: "hidden" },
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
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  heroEyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 6 },
  heroAccent: { color: "#34D399" },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  heroStatsRow: { flexDirection: "row", gap: 8 },
  heroStat: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
  },
  heroStatValue: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 2 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0",
    borderRadius: 14, paddingHorizontal: 12, height: 46,
  },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 14 },

  // Filters
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterPill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  filterPillActive: { backgroundColor: "#EFF6FF", borderColor: "#1E3A8A" },
  filterPillText: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  filterPillTextActive: { color: "#1E3A8A" },

  // Empty
  emptyCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 32, alignItems: "center", gap: 8,
  },
  emptyTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  emptySub: { color: "#64748B", fontSize: 13, textAlign: "center", lineHeight: 18 },

  // Job card
  jobCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 16,
  },
  jobTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  jobAvatar: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginRight: 12, flexShrink: 0,
  },
  jobAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  jobText: { flex: 1, paddingRight: 10 },
  jobTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800", marginBottom: 5 },
  jobMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  jobMeta: { color: "#6B7280", fontSize: 12 },
  metaDot: { color: "#D1D5DB", fontSize: 12 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  jobDesc: { color: "#6B7280", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  jobFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" },
  salaryChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#A7F3D0",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  salaryText: { color: "#15803D", fontSize: 11, fontWeight: "700" },
  dateChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  dateChipText: { color: "#64748B", fontSize: 11 },
  viewHint: { flexDirection: "row", alignItems: "center", gap: 3 },
  viewHintText: { color: "#1E3A8A", fontSize: 13, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    flex: 1, marginTop: 60, overflow: "hidden",
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
  modalMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, flexWrap: "wrap" },
  modalMetaText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  modalMetaDot: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  modalBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  modalStatusBadge: {
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  modalStatusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  modalSalaryBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(52,211,153,0.15)",
    borderWidth: 1, borderColor: "rgba(52,211,153,0.3)",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  modalSalaryText: { color: "#34D399", fontSize: 12, fontWeight: "700" },

  // Tabs
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingHorizontal: 16 },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#1E3A8A" },
  tabText: { color: "#64748B", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#1E3A8A" },

  // Details meta
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaCard: {
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 14, padding: 12, minWidth: 140, flexGrow: 1,
  },
  metaLabel: { color: "#9CA3AF", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  metaValue: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  descCard: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 14 },
  descTitle: { color: "#0F172A", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  descBody: { color: "#374151", fontSize: 13, lineHeight: 20 },
  descEmpty: { color: "#9CA3AF", fontSize: 13, fontStyle: "italic" },

  // Applicant cards
  applicantCard: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, padding: 12, gap: 10,
  },
  applicantAvatar: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  applicantAvatarText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  applicantName: { color: "#0F172A", fontSize: 14, fontWeight: "700" },
  applicantEmail: { color: "#64748B", fontSize: 12, marginTop: 2 },
  applicantCode: { color: "#94A3B8", fontSize: 11, marginTop: 1 },
  applicantDate: { color: "#94A3B8", fontSize: 11 },
});
