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

type ApplicationItem = {
  id: string;
  jobTitle: string;
  status: string;
  stage: string;
};

type Question = {
  question_id: string;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox";
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
};

const STAGES = ["Applied", "Screening", "Interview", "Final", "Offer"];

function formatPostedDate(j: any): string {
  if (j.posted_at) return new Date(j.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (j.created_at) return new Date(j.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return "—";
}

function stageIndex(stage: string): number {
  const s = stage?.toLowerCase() ?? "";
  if (s.includes("screen")) return 1;
  if (
    s.includes("interview") ||
    s.includes("technical") ||
    s.includes("1st") ||
    s.includes("first")
  )
    return 2;
  if (s.includes("final")) return 3;
  if (s.includes("offer") || s.includes("decision")) return 4;
  return 0;
}

function renderProgressStep(i: number, currentStageIdx: number) {
  if (i < currentStageIdx) {
    return (
      <View style={styles.progressStepDone}>
        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
      </View>
    );
  }
  if (i === currentStageIdx) {
    return (
      <View style={styles.progressStepCurrent}>
        <Text style={styles.progressStepCurrentText}>{i + 1}</Text>
      </View>
    );
  }
  return (
    <View style={styles.progressStepMuted}>
      <Text style={styles.progressStepMutedText}>{i + 1}</Text>
    </View>
  );
}

export function ApplicantDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? {
    name: "Applicant",
    email: "",
    role: "applicant",
  };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);

  // Job detail + apply modal
  const [applyVisible, setApplyVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [applyTab, setApplyTab] = useState<"details" | "apply">("details");
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
          const mapped: JobItem[] = data.map((j: any) => ({
            job_posting_id:
              j.job_posting_id ?? j.job_id ?? j.id ?? String(Math.random()),
            title: j.title ?? j.job_title ?? "Untitled",
            department: j.department ?? j.department_name ?? "—",
            location: j.location ?? "—",
            posted: formatPostedDate(j),
            type: j.employment_type ?? j.type ?? "Full-time",
            description: j.description ?? "",
            salary_range: j.salary_range ?? "",
          }));
          setJobs(mapped);
        }
      } catch {
        // leave empty
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/jobs/applicant/my-applications`
        );
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          const mapped: ApplicationItem[] = data.map((a: any) => ({
            id: a.application_id ?? a.id ?? String(Math.random()),
            jobTitle: a.job_title ?? a.title ?? "Unknown Position",
            status: a.status ?? "In Review",
            stage: a.current_stage ?? a.stage ?? "Applied",
          }));
          setApplications(mapped);
        }
      } catch {
        // leave empty
      } finally {
        if (!cancelled) setLoadingApps(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return jobs;
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(keyword) ||
        job.department.toLowerCase().includes(keyword) ||
        job.location.toLowerCase().includes(keyword) ||
        job.type.toLowerCase().includes(keyword)
    );
  }, [search, jobs]);

  const latestApp = applications[0] ?? null;
  const currentStageIdx = latestApp ? stageIndex(latestApp.stage) : -1;

  async function openJobDetail(job: JobItem) {
    setSelectedJob(job);
    setApplyTab("details");
    setAnswers({});
    setQuestions([]);
    setApplyVisible(true);
    setLoadingQuestions(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/jobs/${job.job_posting_id}/questions`
      );
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
      const current = prev[qid] ?? "";
      const selected = current ? current.split(",") : [];
      const idx = selected.indexOf(option);
      if (idx === -1) selected.push(option);
      else selected.splice(idx, 1);
      return { ...prev, [qid]: selected.join(",") };
    });
  }

  async function handleSubmit() {
    if (!selectedJob) return;

    // Validate required fields
    for (const q of questions) {
      if (q.is_required && !answers[q.question_id]?.trim()) {
        Alert.alert("Required", `Please answer: "${q.question_text}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const body = {
        answers: questions.map((q) => ({
          question_id: q.question_id,
          answer_value: answers[q.question_id] ?? "",
        })),
      };

      const res = await authFetch(
        `${API_BASE_URL}/jobs/${selectedJob.job_posting_id}/apply`,
        { method: "POST", body: JSON.stringify(body) }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string })?.message || "Failed to submit application");
      }

      setApplyVisible(false);
      Alert.alert(
        "Application Submitted",
        `Your application for "${selectedJob.title}" has been submitted successfully.`
      );
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
          <Sidebar
            role="applicant"
            userName={session.name}
            email={session.email}
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="applicant"
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
            <GradientHero style={styles.heroCard}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroEyebrow}>Candidate Portal</Text>
                <Text style={styles.heroTitle}>Welcome, {session.name.split(" ")[0]}</Text>
                <Text style={styles.heroSubtitle}>Browse jobs and track your applications below.</Text>
              </View>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {session.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </GradientHero>

            {/* Quick nav to applications */}
            <Pressable
              style={styles.appsQuickLink}
              onPress={() => navigation.replace("ApplicantApplications", { session })}
            >
              <Text style={styles.appsQuickLinkText}>View All My Applications →</Text>
            </Pressable>

            <View style={styles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={22}
                color="#6B7280"
                style={styles.searchIcon}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search jobs..."
                placeholderTextColor="#6B7280"
                style={styles.searchInput}
              />
            </View>

            {/* Application Status */}
            {loadingApps && (
              <View style={styles.sectionCard}>
                <ActivityIndicator color="#3366D6" />
              </View>
            )}
            {!loadingApps && !!latestApp && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionEyebrow}>Latest Application</Text>
                <Text style={styles.currentStatus}>
                  Status: {latestApp.status}
                </Text>
                <Text style={styles.currentRole}>{latestApp.jobTitle}</Text>
                <View style={styles.phasePill}>
                  <Text style={styles.phasePillText}>{latestApp.stage}</Text>
                </View>
              </View>
            )}

            {/* Progress Tracker */}
            {latestApp && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Application Progress</Text>
                <View style={styles.progressLabels}>
                  {STAGES.map((s, i) => (
                    <Text
                      key={s}
                      style={
                        i <= currentStageIdx
                          ? styles.progressLabelActive
                          : styles.progressLabelMuted
                      }
                      numberOfLines={1}
                    >
                      {s}
                    </Text>
                  ))}
                </View>
                <View style={styles.progressRow}>
                  {STAGES.map((s, i) => (
                    <React.Fragment key={s}>
                      {i > 0 && (
                        <View
                          style={
                            i <= currentStageIdx
                              ? styles.progressLineActive
                              : styles.progressLineMuted
                          }
                        />
                      )}
                      {renderProgressStep(i, currentStageIdx)}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            {/* Available Positions */}
            <View style={styles.positionsCard}>
              <Text style={styles.sectionTitle}>Available Positions</Text>
              <Text style={styles.positionsSubtitle}>
                Tap a job to view details and apply
              </Text>

              {loadingJobs && (
                <ActivityIndicator
                  color="#3366E8"
                  style={{ marginVertical: 20 }}
                />
              )}
              {!loadingJobs && filteredJobs.length === 0 && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    {jobs.length === 0 ? "No open positions" : "No jobs found"}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {jobs.length === 0
                      ? "Check back later for new opportunities."
                      : "Try a different keyword."}
                  </Text>
                </View>
              )}
              {!loadingJobs && filteredJobs.length > 0 && filteredJobs.map((job) => (
                  <Pressable
                    key={job.job_posting_id}
                    style={({ pressed }) => [
                      styles.jobCard,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => openJobDetail(job)}
                  >
                    <View style={styles.jobTopRow}>
                      <View style={styles.jobTextWrap}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.jobMeta}>
                          {job.department} • {job.location}
                        </Text>
                        <Text style={styles.jobPosted}>{job.posted}</Text>
                      </View>
                      <View style={styles.jobTypePill}>
                        <Text style={styles.jobTypeText}>{job.type}</Text>
                      </View>
                    </View>
                    <View style={styles.tapHint}>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#3366E8"
                      />
                      <Text style={styles.tapHintText}>
                        Tap to view &amp; apply
                      </Text>
                    </View>
                  </Pressable>
                ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Job Detail + Apply Modal */}
      <Modal
        visible={applyVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setApplyVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedJob?.title ?? "Job"}
                </Text>
                {selectedJob && (
                  <Text style={styles.modalMeta}>
                    {selectedJob.location} • {selectedJob.type}
                  </Text>
                )}
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setApplyVisible(false)}
              >
                <Ionicons name="close" size={18} color="#374151" />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tab, applyTab === "details" && styles.tabActive]}
                onPress={() => setApplyTab("details")}
              >
                <Text
                  style={[
                    styles.tabText,
                    applyTab === "details" && styles.tabTextActive,
                  ]}
                >
                  Details
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, applyTab === "apply" && styles.tabActive]}
                onPress={() => setApplyTab("apply")}
              >
                <Text
                  style={[
                    styles.tabText,
                    applyTab === "apply" && styles.tabTextActive,
                  ]}
                >
                  Apply
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {applyTab === "details" && !!selectedJob && (
                <View style={{ gap: 14 }}>
                  {/* Meta cards */}
                  <View style={styles.metaGrid}>
                    {[
                      { label: "Location", value: selectedJob.location || "—" },
                      { label: "Type", value: selectedJob.type || "—" },
                      {
                        label: "Salary",
                        value: selectedJob.salary_range || "—",
                      },
                      { label: "Posted", value: selectedJob.posted || "—" },
                    ].map((m) => (
                      <View key={m.label} style={styles.metaCard}>
                        <Text style={styles.metaLabel}>{m.label}</Text>
                        <Text style={styles.metaValue}>{m.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Description */}
                  <View style={styles.descCard}>
                    <Text style={styles.descTitle}>About this role</Text>
                    {selectedJob.description ? (
                      <Text style={styles.descBody}>
                        {selectedJob.description}
                      </Text>
                    ) : (
                      <Text style={styles.descEmpty}>
                        No description provided.
                      </Text>
                    )}
                  </View>

                  {/* CTA */}
                  <Pressable
                    style={styles.applyButton}
                    onPress={() => setApplyTab("apply")}
                  >
                    <Text style={styles.applyButtonText}>
                      Apply for this Position →
                    </Text>
                  </Pressable>
                </View>
              )}
              {applyTab === "apply" && !!selectedJob && (
                <View style={{ gap: 16 }}>
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Application Form</Text>
                    <Text style={styles.formSubtitle}>
                      {selectedJob.title}
                    </Text>
                  </View>

                  {loadingQuestions && (
                    <ActivityIndicator color="#3366E8" />
                  )}
                  {!loadingQuestions && questions.length === 0 && (
                    <View style={styles.noQuestionsCard}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={32}
                        color="#3366E8"
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={styles.noQuestionsTitle}>
                        No additional questions
                      </Text>
                      <Text style={styles.noQuestionsText}>
                        This job has no form questions. You can submit your
                        application right away.
                      </Text>
                    </View>
                  )}
                  {!loadingQuestions && questions.length > 0 && questions.map((q, idx) => (
                      <View key={q.question_id} style={styles.questionCard}>
                        <Text style={styles.questionLabel}>
                          {idx + 1}. {q.question_text}
                          {q.is_required && (
                            <Text style={styles.requiredAsterix}> *</Text>
                          )}
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

                        {q.question_type === "multiple_choice" &&
                          (q.options ?? []).map((opt, oidx) => {
                            const selected =
                              answers[q.question_id] === opt;
                            return (
                              <Pressable
                                key={`${q.question_id}-opt-${oidx}`}
                                style={[
                                  styles.radioOption,
                                  selected && styles.radioOptionSelected,
                                ]}
                                onPress={() => setAnswer(q.question_id, opt)}
                              >
                                <View
                                  style={[
                                    styles.radioCircle,
                                    selected && styles.radioCircleSelected,
                                  ]}
                                >
                                  {selected && (
                                    <View style={styles.radioInner} />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.optionText,
                                    selected && styles.optionTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}

                        {q.question_type === "checkbox" &&
                          (q.options ?? []).map((opt, oidx) => {
                            const checked = (
                              answers[q.question_id] ?? ""
                            )
                              .split(",")
                              .includes(opt);
                            return (
                              <Pressable
                                key={`${q.question_id}-chk-${oidx}`}
                                style={[
                                  styles.radioOption,
                                  checked && styles.radioOptionSelected,
                                ]}
                                onPress={() =>
                                  toggleCheckbox(q.question_id, opt)
                                }
                              >
                                <View
                                  style={[
                                    styles.checkBox,
                                    checked && styles.checkBoxSelected,
                                  ]}
                                >
                                  {checked && (
                                    <Ionicons
                                      name="checkmark"
                                      size={12}
                                      color="#FFFFFF"
                                    />
                                  )}
                                </View>
                                <Text
                                  style={[
                                    styles.optionText,
                                    checked && styles.optionTextSelected,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </Pressable>
                            );
                          })}
                      </View>
                    ))}

                  <Pressable
                    style={[
                      styles.submitBtn,
                      submitting && styles.submitBtnDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        Submit Application
                      </Text>
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
  safeArea: { flex: 1, backgroundColor: "#F3F4F6" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F3F4F6" },
  mainContent: { flex: 1, backgroundColor: "#F3F4F6" },
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextWrap: { flex: 1 },
  heroEyebrow: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  appsQuickLink: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  appsQuickLinkText: {
    color: "#1E3A8A",
    fontSize: 13,
    fontWeight: "700",
  },
  searchWrap: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: "#3366D6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  currentStatus: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  currentRole: {
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  phasePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
  },
  phasePillText: { color: "#3366D6", fontSize: 13, fontWeight: "700" },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  progressLabelActive: {
    color: "#3366D6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    flex: 1,
    textAlign: "center",
  },
  progressLabelMuted: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    flex: 1,
    textAlign: "center",
  },
  progressRow: { flexDirection: "row", alignItems: "center" },
  progressStepDone: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3366E8",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepCurrent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#3366E8",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepCurrentText: {
    color: "#3366E8",
    fontSize: 15,
    fontWeight: "800",
  },
  progressStepMuted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepMutedText: { color: "#9CA3AF", fontSize: 15, fontWeight: "800" },
  progressLineActive: { flex: 1, height: 4, backgroundColor: "#3366E8" },
  progressLineMuted: { flex: 1, height: 4, backgroundColor: "#D1D5DB" },
  positionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  positionsSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: -8,
  },
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  jobTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  jobTextWrap: { flex: 1, paddingRight: 10 },
  jobTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  jobMeta: { color: "#6B7280", fontSize: 13, lineHeight: 20, marginBottom: 2 },
  jobPosted: { color: "#9CA3AF", fontSize: 12 },
  jobTypePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  jobTypeText: { color: "#374151", fontSize: 12, fontWeight: "700" },
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  tapHintText: { color: "#3366E8", fontSize: 12, fontWeight: "700" },
  applyButton: {
    backgroundColor: "#3366E8",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  applyButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  emptyCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    flex: 1,
    marginTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  modalMeta: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#3366E8",
  },
  tabText: { color: "#6B7280", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#3366E8" },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 12,
    minWidth: 140,
    flexGrow: 1,
  },
  metaLabel: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metaValue: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  descCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
  },
  descTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  descBody: { color: "#374151", fontSize: 13, lineHeight: 20 },
  descEmpty: {
    color: "#9CA3AF",
    fontSize: 13,
    fontStyle: "italic",
  },
  // Apply form
  formHeader: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
    borderRadius: 14,
    padding: 14,
  },
  formTitle: { color: "#1D4ED8", fontSize: 15, fontWeight: "800" },
  formSubtitle: { color: "#3366D6", fontSize: 13, marginTop: 2 },
  noQuestionsCard: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  noQuestionsTitle: {
    color: "#1D4ED8",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  noQuestionsText: {
    color: "#3366D6",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  questionLabel: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  requiredAsterix: { color: "#DC2626" },
  textAnswer: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    minHeight: 80,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  radioOptionSelected: {
    borderColor: "#3366E8",
    backgroundColor: "#EEF4FF",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: { borderColor: "#3366E8" },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3366E8",
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxSelected: {
    borderColor: "#3366E8",
    backgroundColor: "#3366E8",
  },
  optionText: { color: "#374151", fontSize: 14, flex: 1 },
  optionTextSelected: { color: "#1D4ED8", fontWeight: "700" },
  submitBtn: {
    backgroundColor: "#3366E8",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
