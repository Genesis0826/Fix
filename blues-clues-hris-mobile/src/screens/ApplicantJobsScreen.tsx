import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type JobItem = {
  job_posting_id: string;
  title: string;
  department: string;
  location: string;
  posted: string;
  type: string;
  description: string;
  salary_range: string;
};

type Question = {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "full-time":  { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D" },
  "part-time":  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  "contract":   { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  "internship": { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
};

function typePill(type: string) {
  return TYPE_COLORS[type?.toLowerCase()] ?? { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" };
}

function mapJobItem(j: any): JobItem {
  return {
    job_posting_id: j.job_posting_id ?? j.job_id ?? j.id ?? String(Math.random()),
    title: j.title ?? j.job_title ?? "Untitled",
    department: j.department ?? j.department_name ?? "—",
    location: j.location ?? "—",
    posted: j.posted_at
      ? new Date(j.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—",
    type: j.employment_type ?? j.type ?? "Full-time",
    description: j.description ?? "",
    salary_range: j.salary_range ?? "",
  };
}

function validateAnswers(questions: Question[], answers: Record<string, string>): string | null {
  for (const q of questions) {
    if (q.is_required && !answers[q.question_id]?.trim()) {
      return q.question_text;
    }
  }
  return null;
}

// Department avatar — picks a color from title initial
const AVATAR_COLORS = ["#1E3A8A", "#0F766E", "#6D28D9", "#B45309", "#991B1B"];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (str.codePointAt(i) ?? 0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function ApplicantJobsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Applicant", email: "", role: "applicant" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail + apply modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "apply">("details");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/jobs/applicant/open`);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          setJobs(data.map(mapJobItem));
        }
      } catch {
        // leave empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Unique types for filter pills
  const allTypes = useMemo(() => {
    const seen = new Set<string>();
    jobs.forEach((j) => { if (j.type) seen.add(j.type); });
    return Array.from(seen);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchType = typeFilter === "all" || j.type.toLowerCase() === typeFilter.toLowerCase();
      const matchSearch = !kw ||
        j.title.toLowerCase().includes(kw) ||
        j.department.toLowerCase().includes(kw) ||
        j.location.toLowerCase().includes(kw);
      return matchType && matchSearch;
    });
  }, [search, typeFilter, jobs]);

  async function openJob(job: JobItem) {
    setSelectedJob(job);
    setActiveTab("details");
    setAnswers({});
    setQuestions([]);
    setModalVisible(true);
    setLoadingQuestions(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/jobs/${job.job_posting_id}/questions`);
      const data = await res.json().catch(() => []);
      const qs: Question[] = Array.isArray(data) ? data : [];
      qs.sort((a, b) => a.sort_order - b.sort_order);
      setQuestions(qs);
    } catch {
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }

  function setAnswer(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function toggleCheckbox(qid: string, option: string) {
    setAnswers((prev) => {
      const selected = (prev[qid] ?? "").split(",").filter(Boolean);
      const idx = selected.indexOf(option);
      if (idx === -1) selected.push(option); else selected.splice(idx, 1);
      return { ...prev, [qid]: selected.join(",") };
    });
  }

  async function handleSubmit() {
    if (!selectedJob) return;
    const unanswered = validateAnswers(questions, answers);
    if (unanswered) {
      Alert.alert("Required", `Please answer: "${unanswered}"`);
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        answers: questions.map((q) => ({
          question_id: q.question_id,
          answer_value: answers[q.question_id] ?? "",
        })),
      };
      const res = await authFetch(`${API_BASE_URL}/jobs/${selectedJob.job_posting_id}/apply`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string })?.message || "Failed to submit");
      }
      setModalVisible(false);
      Alert.alert("Submitted!", `Your application for "${selectedJob.title}" was submitted successfully.`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar role="applicant" userName={session.name} email={session.email} activeScreen="Jobs" navigation={navigation} />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu role="applicant" userName={session.name} email={session.email} activeScreen="Jobs" navigation={navigation} />
          )}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <GradientHero style={styles.heroCard}>
              {/* Decorative circles */}
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.eyebrow}>Applicant Portal</Text>
              </View>
              <Text style={styles.heroTitle}>
                Open <Text style={styles.heroAccent}>Positions</Text>
              </Text>
              <Text style={styles.heroSubtitle}>
                Browse available roles and submit your application directly from your phone.
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{loading ? "—" : jobs.length}</Text>
                  <Text style={styles.heroStatLabel}>Open Roles</Text>
                </View>
                {allTypes.length > 0 && (
                  <View style={[styles.heroStat, { marginLeft: 10 }]}>
                    <Text style={styles.heroStatValue}>{allTypes.length}</Text>
                    <Text style={styles.heroStatLabel}>Job Types</Text>
                  </View>
                )}
              </View>
            </GradientHero>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 10 }} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by title, department, location..."
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              )}
            </View>

            {/* Type filter pills */}
            {allTypes.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                <Pressable
                  style={[styles.filterPill, typeFilter === "all" && styles.filterPillActive]}
                  onPress={() => setTypeFilter("all")}
                >
                  <Text style={[styles.filterPillText, typeFilter === "all" && styles.filterPillTextActive]}>All</Text>
                </Pressable>
                {allTypes.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.filterPill, typeFilter === t && styles.filterPillActive]}
                    onPress={() => setTypeFilter(typeFilter === t ? "all" : t)}
                  >
                    <Text style={[styles.filterPillText, typeFilter === t && styles.filterPillTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Count label */}
            {!loading && (
              <View style={styles.countRow}>
                <Text style={styles.countText}>
                  {filteredJobs.length} {filteredJobs.length === 1 ? "position" : "positions"} found
                </Text>
              </View>
            )}

            {/* Job list */}
            {loading && (
              <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 32 }} />
            )}
            {!loading && filteredJobs.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="briefcase-outline" size={36} color="#D1D5DB" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>
                  {jobs.length === 0 ? "No open positions right now" : "No jobs match your search"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {jobs.length === 0 ? "Check back later for new opportunities." : "Try a different keyword or filter."}
                </Text>
              </View>
            )}
            {!loading && filteredJobs.length > 0 && filteredJobs.map((job) => {
                const pill = typePill(job.type);
                const ac = avatarColor(job.title);
                return (
                  <Pressable
                    key={job.job_posting_id}
                    style={({ pressed }) => [styles.jobCard, pressed && styles.jobCardPressed]}
                    onPress={() => openJob(job)}
                  >
                    <View style={styles.jobTop}>
                      {/* Avatar */}
                      <View style={[styles.jobAvatar, { backgroundColor: ac }]}>
                        <Text style={styles.jobAvatarText}>{job.title[0]?.toUpperCase()}</Text>
                      </View>

                      <View style={styles.jobTextWrap}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <View style={styles.jobMetaRow}>
                          <Ionicons name="business-outline" size={12} color="#9CA3AF" />
                          <Text style={styles.jobMeta}>{job.department}</Text>
                          <Text style={styles.jobMetaDot}>·</Text>
                          <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                          <Text style={styles.jobMeta}>{job.location}</Text>
                        </View>
                      </View>

                      <View style={[styles.typePill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                        <Text style={[styles.typePillText, { color: pill.text }]}>{job.type}</Text>
                      </View>
                    </View>

                    {job.description ? (
                      <Text style={styles.jobDesc} numberOfLines={2}>{job.description}</Text>
                    ) : null}

                    <View style={styles.cardFooter}>
                      <View style={styles.footerLeft}>
                        {job.salary_range ? (
                          <View style={styles.salaryBadge}>
                            <Ionicons name="cash-outline" size={12} color="#15803D" />
                            <Text style={styles.salaryText}>{job.salary_range}</Text>
                          </View>
                        ) : null}
                        <View style={styles.dateBadge}>
                          <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                          <Text style={styles.dateText}>{job.posted}</Text>
                        </View>
                      </View>
                      <View style={styles.applyHint}>
                        <Text style={styles.applyHintText}>View & Apply</Text>
                        <Ionicons name="chevron-forward" size={14} color="#1E3A8A" />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      </View>

      {/* Job Detail + Apply Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Gradient header */}
            <LinearGradient
              colors={["#0f172a", "#172554", "#134e4a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradientHeader}
            >
              <View style={styles.modalHeaderCircle1} />
              <View style={styles.modalHeaderCircle2} />

              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.modalHeaderEyebrow}>{selectedJob?.department ?? "Job Posting"}</Text>
                  <Text style={styles.modalHeaderTitle} numberOfLines={2}>
                    {selectedJob?.title ?? "Job Details"}
                  </Text>
                  <View style={styles.modalHeaderMeta}>
                    <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.modalHeaderMetaText}>{selectedJob?.location ?? "—"}</Text>
                    {selectedJob?.type && (
                      <>
                        <Text style={styles.modalHeaderMetaDot}>·</Text>
                        <Text style={styles.modalHeaderMetaText}>{selectedJob.type}</Text>
                      </>
                    )}
                  </View>
                </View>
                <Pressable style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              {selectedJob?.salary_range && (
                <View style={styles.modalSalaryBadge}>
                  <Ionicons name="cash-outline" size={13} color="#34D399" />
                  <Text style={styles.modalSalaryText}>{selectedJob.salary_range}</Text>
                </View>
              )}
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabRow}>
              {(["details", "apply"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.tab, activeTab === t && styles.tabActive]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                    {t === "details" ? "Job Details" : "Apply Now"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Details tab ── */}
              {activeTab === "details" && selectedJob && (
                <View style={{ gap: 14 }}>
                  <View style={styles.metaGrid}>
                    {[
                      { icon: "location-outline" as const, label: "Location", value: selectedJob.location || "—" },
                      { icon: "briefcase-outline" as const, label: "Type", value: selectedJob.type || "—" },
                      { icon: "cash-outline" as const, label: "Salary", value: selectedJob.salary_range || "Not specified" },
                      { icon: "calendar-outline" as const, label: "Posted", value: selectedJob.posted || "—" },
                    ].map((m) => (
                      <View key={m.label} style={styles.metaCard}>
                        <Ionicons name={m.icon} size={16} color="#1E3A8A" style={{ marginBottom: 6 }} />
                        <Text style={styles.metaLabel}>{m.label}</Text>
                        <Text style={styles.metaValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.descCard}>
                    <Text style={styles.descTitle}>About this Role</Text>
                    {selectedJob.description ? (
                      <Text style={styles.descBody}>{selectedJob.description}</Text>
                    ) : (
                      <Text style={styles.descEmpty}>No description provided for this role.</Text>
                    )}
                  </View>

                  <Pressable style={styles.applyBtn} onPress={() => setActiveTab("apply")}>
                    <Text style={styles.applyBtnText}>Apply for this Position</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {/* ── Apply tab ── */}
              {activeTab === "apply" && selectedJob && (
                <View style={{ gap: 16 }}>
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Application Form</Text>
                    <Text style={styles.formSubtitle}>{selectedJob.title}</Text>
                  </View>

                  {loadingQuestions && (
                    <ActivityIndicator color="#1E3A8A" style={{ marginVertical: 24 }} />
                  )}
                  {!loadingQuestions && questions.length === 0 && (
                    <View style={styles.noQuestionsCard}>
                      <Ionicons name="checkmark-circle-outline" size={36} color="#1E3A8A" style={{ marginBottom: 10 }} />
                      <Text style={styles.noQuestionsTitle}>No additional questions</Text>
                      <Text style={styles.noQuestionsText}>
                        This posting has no form questions. You can submit your application right away.
                      </Text>
                    </View>
                  )}
                  {!loadingQuestions && questions.length > 0 && questions.map((q, idx) => (
                      <View key={q.question_id} style={styles.questionCard}>
                        <Text style={styles.questionLabel}>
                          {idx + 1}.{"  "}{q.question_text}
                          {q.is_required && <Text style={styles.requiredStar}> *</Text>}
                        </Text>

                        {q.question_type === "text" && (
                          <TextInput
                            style={styles.textAnswer}
                            placeholder="Your answer..."
                            placeholderTextColor="#9CA3AF"
                            value={answers[q.question_id] ?? ""}
                            onChangeText={(v) => setAnswer(q.question_id, v)}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        )}

                        {q.question_type === "multiple_choice" && (q.options ?? []).map((opt, oidx) => {
                          const selected = answers[q.question_id] === opt;
                          return (
                            <Pressable
                              key={`${q.question_id}-opt-${oidx}`}
                              style={[styles.choiceOption, selected && styles.choiceOptionSelected]}
                              onPress={() => setAnswer(q.question_id, opt)}
                            >
                              <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                                {selected && <View style={styles.radioInner} />}
                              </View>
                              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{opt}</Text>
                            </Pressable>
                          );
                        })}

                        {q.question_type === "checkbox" && (q.options ?? []).map((opt, oidx) => {
                          const checked = (answers[q.question_id] ?? "").split(",").filter(Boolean).includes(opt);
                          return (
                            <Pressable
                              key={`${q.question_id}-chk-${oidx}`}
                              style={[styles.choiceOption, checked && styles.choiceOptionSelected]}
                              onPress={() => toggleCheckbox(q.question_id, opt)}
                            >
                              <View style={[styles.checkBox, checked && styles.checkBoxSelected]}>
                                {checked && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                              </View>
                              <Text style={[styles.choiceText, checked && styles.choiceTextSelected]}>{opt}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}

                  <Pressable
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>Submit Application</Text>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F1F5F9" },
  mainContent: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  // Hero
  heroCard: { borderRadius: 20, padding: 20, marginBottom: 0, overflow: "hidden" },
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
  eyebrow: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 6 },
  heroAccent: { color: "#34D399" },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  heroStats: { flexDirection: "row" },
  heroStat: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
  },
  heroStatValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 2 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center", height: 50,
    borderRadius: 16, borderWidth: 1.5, borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF", paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },

  // Filters
  filterScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  filterRow: { gap: 8, paddingRight: 8 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0",
  },
  filterPillActive: { backgroundColor: "#EFF6FF", borderColor: "#1E3A8A" },
  filterPillText: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  filterPillTextActive: { color: "#1E3A8A" },

  // Count
  countRow: { paddingHorizontal: 2 },
  countText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },

  // Empty
  emptyCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 20, padding: 32, alignItems: "center",
  },
  emptyTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  emptySubtitle: { color: "#6B7280", fontSize: 13, textAlign: "center", lineHeight: 20 },

  // Job card
  jobCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 18, padding: 16,
  },
  jobCardPressed: { opacity: 0.75 },
  jobTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  jobAvatar: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginRight: 12, flexShrink: 0,
  },
  jobAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  jobTextWrap: { flex: 1, paddingRight: 10 },
  jobTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800", marginBottom: 5 },
  jobMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  jobMeta: { color: "#6B7280", fontSize: 12 },
  jobMetaDot: { color: "#D1D5DB", fontSize: 12 },
  typePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  typePillText: { fontSize: 11, fontWeight: "800" },
  jobDesc: { color: "#6B7280", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  cardFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  salaryBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#ECFDF3", borderWidth: 1, borderColor: "#A7F3D0",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  salaryText: { color: "#15803D", fontSize: 11, fontWeight: "700" },
  dateBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  dateText: { color: "#6B7280", fontSize: 11, fontWeight: "600" },
  applyHint: { flexDirection: "row", alignItems: "center", gap: 3 },
  applyHintText: { color: "#1E3A8A", fontSize: 13, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    flex: 1, marginTop: 60, overflow: "hidden",
  },
  modalGradientHeader: {
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20,
    overflow: "hidden", position: "relative",
  },
  modalHeaderCircle1: {
    position: "absolute", top: -50, right: -50,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modalHeaderCircle2: {
    position: "absolute", bottom: -30, left: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  modalHeaderRow: { flexDirection: "row", alignItems: "flex-start" },
  modalHeaderEyebrow: {
    color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  modalHeaderTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  modalHeaderMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  modalHeaderMetaText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  modalHeaderMetaDot: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  modalSalaryBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(52,211,153,0.15)",
    borderWidth: 1, borderColor: "rgba(52,211,153,0.3)",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: "flex-start", marginTop: 12,
  },
  modalSalaryText: { color: "#34D399", fontSize: 13, fontWeight: "700" },

  // Tabs
  tabRow: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingHorizontal: 16,
  },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#1E3A8A" },
  tabText: { color: "#6B7280", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#1E3A8A" },

  // Details tab
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaCard: {
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 14, padding: 12, minWidth: 140, flexGrow: 1,
  },
  metaLabel: {
    color: "#9CA3AF", fontSize: 10, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
  },
  metaValue: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  descCard: {
    backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 14, padding: 14,
  },
  descTitle: { color: "#0F172A", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  descBody: { color: "#374151", fontSize: 13, lineHeight: 20 },
  descEmpty: { color: "#9CA3AF", fontSize: 13, fontStyle: "italic" },
  applyBtn: {
    backgroundColor: "#1E3A8A", borderRadius: 16, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  applyBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },

  // Apply tab
  formHeader: {
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 14, padding: 14,
  },
  formTitle: { color: "#1E3A8A", fontSize: 15, fontWeight: "800" },
  formSubtitle: { color: "#3B5CC8", fontSize: 13, marginTop: 2 },
  noQuestionsCard: {
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    borderRadius: 16, padding: 24, alignItems: "center",
  },
  noQuestionsTitle: { color: "#1E3A8A", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  noQuestionsText: { color: "#3B5CC8", fontSize: 13, textAlign: "center", lineHeight: 20 },
  questionCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E7EB",
    borderRadius: 14, padding: 14, gap: 10,
  },
  questionLabel: { color: "#0F172A", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  requiredStar: { color: "#DC2626" },
  textAnswer: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 12, padding: 12,
    fontSize: 14, color: "#111827", backgroundColor: "#F9FAFB", minHeight: 80,
  },
  choiceOption: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 10,
  },
  choiceOptionSelected: { borderColor: "#1E3A8A", backgroundColor: "#EFF6FF" },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D1D5DB",
    alignItems: "center", justifyContent: "center",
  },
  radioCircleSelected: { borderColor: "#1E3A8A" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1E3A8A" },
  checkBox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "#D1D5DB",
    alignItems: "center", justifyContent: "center",
  },
  checkBoxSelected: { borderColor: "#1E3A8A", backgroundColor: "#1E3A8A" },
  choiceText: { color: "#374151", fontSize: 14, flex: 1 },
  choiceTextSelected: { color: "#1E3A8A", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#1E3A8A", borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
