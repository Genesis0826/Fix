import React, { useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { UserSession } from "../services/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
// (backend): Replace with API response types from GET /jobs/{job_id}/candidates/ranked

type RankingMode = "sfia" | "manual";

interface SFIAPillar {
  name: string;
  demand: number;  // 0–100: how much the job requires this skill
  supply: number;  // 0–100: candidate's assessed score for this skill
  weight: number;  // contribution to overall fit score (all weights sum to 1.0)
}

interface RankedCandidate {
  application_id: string;
  first_name: string;
  last_name: string;
  email: string;
  applied_at: string;
  status: string;
  fit_percentage: number;
  sfia_rank: number;
  manual_rank: number;
  pillars: SFIAPillar[];
}

interface JobOption {
  job_posting_id: string;
  title: string;
  department: string;
  total_applicants: number;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────
// (backend): Replace MOCK_JOBS with GET /jobs?status=open
// (backend): Replace generateMockCandidates with GET /jobs/{job_id}/candidates/ranked

const MOCK_JOBS: JobOption[] = [
  { job_posting_id: "j1", title: "Senior Software Engineer", department: "Engineering", total_applicants: 48 },
  { job_posting_id: "j2", title: "Product Manager",          department: "Product",     total_applicants: 35 },
  { job_posting_id: "j3", title: "UX Designer",              department: "Design",      total_applicants: 22 },
];

const SFIA_PILLARS = [
  { name: "Technical Proficiency", weight: 0.3 },
  { name: "Problem Solving",       weight: 0.2 },
  { name: "Communication",         weight: 0.2 },
  { name: "Collaboration",         weight: 0.15 },
  { name: "Leadership",            weight: 0.1 },
  { name: "Adaptability",          weight: 0.05 },
];

const JOB_DEMAND: Record<string, number[]> = {
  j1: [90, 85, 70, 65, 60, 75],
  j2: [60, 80, 85, 75, 80, 70],
  j3: [75, 70, 80, 70, 55, 80],
};

const MOCK_NAMES = [
  ["James", "Rivera"],    ["Sofia", "Chen"],      ["Marcus", "Okafor"],
  ["Elena", "Patel"],     ["Lucas", "Fernandez"], ["Aisha", "Johnson"],
  ["Noah", "Kim"],        ["Priya", "Sharma"],    ["Ethan", "Williams"],
  ["Chloe", "Martinez"],  ["Liam", "Nguyen"],     ["Zara", "Thompson"],
  ["Oliver", "Lee"],      ["Maya", "Anderson"],   ["Kai", "Brown"],
  ["Nadia", "Davis"],     ["Finn", "Wilson"],     ["Layla", "Garcia"],
  ["Mateo", "Taylor"],    ["Jade", "Moore"],      ["Soren", "Jackson"],
  ["Amara", "White"],     ["Dylan", "Harris"],    ["Yuki", "Clark"],
];

const MOCK_STATUSES = [
  "Final Interview", "Final Interview", "Technical", "Technical",
  "Technical", "Screening", "Screening", "Screening", "Screening", "Screening",
  "Submitted", "Submitted", "Submitted", "Submitted", "Submitted",
  "Submitted", "Submitted", "Submitted", "Submitted", "Submitted",
  "Submitted", "Submitted", "Submitted", "Submitted",
];

function generateMockCandidates(jobId: string): RankedCandidate[] {
  const demands = JOB_DEMAND[jobId] ?? [75, 75, 75, 75, 75, 75];
  const seed = jobId.codePointAt(1) ?? 0;

  const candidates = MOCK_NAMES.map(([first, last], i) => {
    const base = 88 - i * 2.2 + (seed % 5);
    const pillars: SFIAPillar[] = SFIA_PILLARS.map((p, pi) => {
      const variance = ((i * 7 + pi * 13 + seed) % 25) - 12;
      const supply = Math.max(30, Math.min(100, Math.round(base + variance)));
      return { name: p.name, demand: demands[pi], supply, weight: p.weight };
    });

    const fit = Math.round(
      pillars.reduce((sum, p) => sum + p.weight * Math.min(p.supply / p.demand, 1) * 100, 0)
    );

    return {
      application_id: `app-${jobId}-${i}`,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@email.com`,
      applied_at: new Date(Date.now() - i * 86_400_000 * 2).toISOString(),
      status: MOCK_STATUSES[i] ?? "Submitted",
      fit_percentage: fit,
      sfia_rank: 0,
      manual_rank: 0,
      pillars,
    };
  });

  const sorted = [...candidates].sort((a, b) => b.fit_percentage - a.fit_percentage);
  return sorted.map((c, i) => ({ ...c, sfia_rank: i + 1, manual_rank: i + 1 }));
}

// ── Style Helpers ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  "Final Interview": { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
  "Technical":       { bg: "#E0E7FF", border: "#C7D2FE", text: "#4338CA" },
  "Screening":       { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  "Submitted":       { bg: "#F1F5F9", border: "#E2E8F0", text: "#64748B" },
  "Hired":           { bg: "#ECFDF3", border: "#A7F3D0", text: "#15803D" },
  "Rejected":        { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
};

function fitColor(pct: number): string {
  if (pct >= 80) return "#16A34A";
  if (pct >= 60) return "#D97706";
  return "#DC2626";
}

function rankBadgeColors(rank: number): { bg: string; border: string; text: string } {
  if (rank === 1) return { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" };
  if (rank === 2) return { bg: "#F1F5F9", border: "#CBD5E1", text: "#475569" };
  if (rank === 3) return { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412" };
  return { bg: "#F8FAFC", border: "#E2E8F0", text: "#64748B" };
}

const AVATAR_COLORS = ["#1E3A8A", "#0F766E", "#6D28D9", "#B45309", "#991B1B", "#065F46"];
function avatarColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Pillar Visualization ──────────────────────────────────────────────────────

function PillarBars({ pillars }: { pillars: SFIAPillar[] }) {
  return (
    <View style={styles.pillarWrap}>
      <Text style={styles.pillarTitle}>Skill Demand vs Supply — SFIA Pillars</Text>

      {pillars.map((p) => {
        const hasGap = p.supply < p.demand;
        return (
          <View key={p.name} style={styles.pillarRow}>
            <View style={styles.pillarLabelRow}>
              <Text style={styles.pillarName}>{p.name}</Text>
              <Text style={[styles.pillarScore, { color: hasGap ? "#DC2626" : "#16A34A" }]}>
                {p.supply} / {p.demand}
              </Text>
            </View>

            {/* Demand bar */}
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Demand</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${p.demand}%`, backgroundColor: "#94A3B8" }]} />
              </View>
              <Text style={styles.barNum}>{p.demand}</Text>
            </View>

            {/* Supply bar */}
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>Supply</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${p.supply}%`, backgroundColor: hasGap ? "#F87171" : "#4ADE80" }]} />
              </View>
              <Text style={styles.barNum}>{p.supply}</Text>
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#94A3B8" }]} />
          <Text style={styles.legendText}>Company Demand</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#4ADE80" }]} />
          <Text style={styles.legendText}>Supply (met)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#F87171" }]} />
          <Text style={styles.legendText}>Supply (gap)</Text>
        </View>
      </View>
    </View>
  );
}

// ── Candidate Card ────────────────────────────────────────────────────────────

function CandidateCard({ candidate, rank }: { candidate: RankedCandidate; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[candidate.status] ?? STATUS_STYLES["Submitted"];
  const rankColors = rankBadgeColors(rank);
  const ac = avatarColor(candidate.first_name);
  const initials = `${candidate.first_name.charAt(0)}${candidate.last_name.charAt(0)}`;

  return (
    <View style={styles.candidateCard}>
      <View style={styles.candidateRow}>

        {/* Rank badge */}
        <View style={[styles.rankBadge, { backgroundColor: rankColors.bg, borderColor: rankColors.border }]}>
          {rank <= 3
            ? <Text style={{ fontSize: 13 }}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</Text>
            : <Text style={[styles.rankText, { color: rankColors.text }]}>#{rank}</Text>}
        </View>

        {/* Avatar */}
        <View style={[styles.candidateAvatar, { backgroundColor: ac }]}>
          <Text style={styles.candidateAvatarText}>{initials}</Text>
        </View>

        {/* Name + email */}
        <View style={styles.candidateInfo}>
          <Text style={styles.candidateName} numberOfLines={1}>
            {candidate.first_name} {candidate.last_name}
          </Text>
          <Text style={styles.candidateEmail} numberOfLines={1}>{candidate.email}</Text>
        </View>

        {/* Fit score */}
        <View style={styles.fitWrap}>
          <Text style={[styles.fitScore, { color: fitColor(candidate.fit_percentage) }]}>
            {candidate.fit_percentage}%
          </Text>
          <Text style={styles.fitLabel}>Fit</Text>
        </View>

        {/* Expand toggle */}
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expandBtn}>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
        </Pressable>
      </View>

      {/* Status badge row */}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{candidate.status}</Text>
        </View>
      </View>

      {/* Expanded pillar view */}
      {expanded && <PillarBars pillars={candidate.pillars} />}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export const HROfficerCandidateEvaluationScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [selectedJob, setSelectedJob] = useState<JobOption>(MOCK_JOBS[0]);
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [mode, setMode] = useState<RankingMode>("sfia");
  const [showAll, setShowAll] = useState(false);
  const [candidates, setCandidates] = useState<RankedCandidate[]>(
    () => generateMockCandidates(MOCK_JOBS[0].job_posting_id)
  );

  const sfiaSorted = [...candidates].sort((a, b) => a.sfia_rank - b.sfia_rank);
  const activeList = mode === "sfia" ? sfiaSorted : candidates;
  const visibleList = showAll ? activeList : activeList.slice(0, 20);

  const top3 = sfiaSorted.slice(0, 3);
  const avgFitTop20 = Math.round(
    sfiaSorted.slice(0, 20).reduce((s, c) => s + c.fit_percentage, 0) / 20
  );

  function handleJobSelect(job: JobOption) {
    setSelectedJob(job);
    setCandidates(generateMockCandidates(job.job_posting_id));
    setJobDropdownOpen(false);
    setShowAll(false);
  }

  function handleSaveManualRank() {
    // (backend): PATCH /jobs/{selectedJob.job_posting_id}/candidates/manual-rank
    // Payload: { rankings: [{ application_id, rank }] }
    console.log("Save manual rank for job:", selectedJob.job_posting_id);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="hr"
            userName={session.name}
            email={session.email}
            activeScreen="CandidateEvaluation"
            navigation={navigation}
          />
        )}

        <View style={styles.main}>
          {isMobile && (
            <MobileRoleMenu
              role="hr"
              userName={session.name}
              email={session.email}
              activeScreen="CandidateEvaluation"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Hero ── */}
            <GradientHero style={styles.heroCard}>
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconWrap}>
                  <Feather name="award" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.heroEyebrow}>HR Recruitment</Text>
              </View>
              <Text style={styles.heroTitle}>Candidate Evaluation</Text>
              <Text style={styles.heroSubtitle}>
                Top candidates ranked by SFIA skill pillars. Switch to Manual to reorder by judgment.
              </Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{avgFitTop20}%</Text>
                  <Text style={styles.heroStatLabel}>Top 20 Avg Fit</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{sfiaSorted.length}</Text>
                  <Text style={styles.heroStatLabel}>Candidates</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: "#34D399" }]}>
                    {sfiaSorted[0]?.fit_percentage ?? 0}%
                  </Text>
                  <Text style={styles.heroStatLabel}>Top Score</Text>
                </View>
              </View>
            </GradientHero>

            {/* ── Job Selector ── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Job Posting</Text>
              <Pressable
                style={styles.jobSelectorBtn}
                onPress={() => setJobDropdownOpen((v) => !v)}
              >
                <Feather name="briefcase" size={15} color="#64748B" style={{ marginRight: 8 }} />
                <Text style={styles.jobSelectorText} numberOfLines={1}>{selectedJob.title}</Text>
                <Feather name="chevron-down" size={15} color="#64748B" />
              </Pressable>

              {jobDropdownOpen && (
                <View style={styles.dropdown}>
                  {MOCK_JOBS.map((job) => (
                    <Pressable
                      key={job.job_posting_id}
                      style={[
                        styles.dropdownItem,
                        job.job_posting_id === selectedJob.job_posting_id && styles.dropdownItemActive,
                      ]}
                      onPress={() => handleJobSelect(job)}
                    >
                      <Text style={styles.dropdownItemTitle}>{job.title}</Text>
                      <Text style={styles.dropdownItemSub}>
                        {job.department} · {job.total_applicants} applicants
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* ── Top 3 Podium ── */}
            <View style={styles.podiumRow}>
              {top3.map((c, i) => (
                <View key={c.application_id} style={styles.podiumCard}>
                  <Text style={styles.podiumMedal}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {c.first_name} {c.last_name}
                  </Text>
                  <Text style={[styles.podiumScore, { color: fitColor(c.fit_percentage) }]}>
                    {c.fit_percentage}%
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Candidate List Card ── */}
            <View style={styles.listCard}>

              {/* Toolbar */}
              <View style={styles.listToolbar}>
                <View>
                  <Text style={styles.listTitle}>
                    {showAll ? `All ${activeList.length} Candidates` : "Top 20 Candidates"}
                  </Text>
                  <Text style={styles.listSubtitle}>
                    {mode === "sfia"
                      ? "Sorted by SFIA pillar fit score"
                      : "Manual mode — tap Save to persist order"}
                  </Text>
                </View>

                {/* Mode toggle */}
                <View style={styles.modeToggle}>
                  <Pressable
                    style={[styles.modeBtn, mode === "sfia" && styles.modeBtnActive]}
                    onPress={() => setMode("sfia")}
                  >
                    <Text style={[styles.modeBtnText, mode === "sfia" && styles.modeBtnTextActive]}>
                      SFIA
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
                    onPress={() => setMode("manual")}
                  >
                    <Text style={[styles.modeBtnText, mode === "manual" && styles.modeBtnTextActive]}>
                      Manual
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Manual mode banner */}
              {mode === "manual" && (
                <View style={styles.manualBanner}>
                  <Feather name="move" size={13} color="#92400E" style={{ marginRight: 6 }} />
                  <Text style={styles.manualBannerText}>
                    Manual mode active. Save order when done.
                  </Text>
                  <Pressable style={styles.saveBtn} onPress={handleSaveManualRank}>
                    <Text style={styles.saveBtnText}>Save Order</Text>
                  </Pressable>
                </View>
              )}

              {/* Candidate list */}
              <View style={styles.candidateList}>
                {visibleList.map((candidate, index) => (
                  <CandidateCard
                    key={candidate.application_id}
                    candidate={candidate}
                    rank={index + 1}
                  />
                ))}
              </View>

              {/* Show all / show top 20 toggle */}
              {activeList.length > 20 && (
                <Pressable
                  style={styles.showAllBtn}
                  onPress={() => setShowAll((v) => !v)}
                >
                  <Text style={styles.showAllText}>
                    {showAll ? "Show Top 20 Only" : `Show All ${activeList.length} Candidates`}
                  </Text>
                  <Feather name={showAll ? "chevron-up" : "chevron-down"} size={14} color="#1E3A8A" />
                </Pressable>
              )}

              {/* Footer count */}
              <View style={styles.listFooter}>
                <Text style={styles.listFooterText}>
                  Showing {visibleList.length} of {activeList.length} candidates
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },

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
  heroEyebrow: {
    color: "rgba(255,255,255,0.7)", fontSize: 11,
    fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2,
  },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 20, marginBottom: 14 },
  heroStatsRow: { flexDirection: "row", gap: 8 },
  heroStat: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
  },
  heroStatValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" },

  // Job selector
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 10, fontWeight: "800", textTransform: "uppercase",
    letterSpacing: 1, color: "#64748B",
  },
  jobSelectorBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  jobSelectorText: { flex: 1, color: "#0F172A", fontSize: 14, fontWeight: "600" },
  dropdown: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 14, overflow: "hidden", marginTop: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemActive: { backgroundColor: "#EFF6FF" },
  dropdownItemTitle: { color: "#0F172A", fontSize: 14, fontWeight: "700" },
  dropdownItemSub: { color: "#64748B", fontSize: 12, marginTop: 2 },

  // Podium
  podiumRow: { flexDirection: "row", gap: 10 },
  podiumCard: {
    flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 16, padding: 12, alignItems: "center", gap: 4,
  },
  podiumMedal: { fontSize: 22 },
  podiumName: { color: "#0F172A", fontSize: 12, fontWeight: "700", textAlign: "center" },
  podiumScore: { fontSize: 16, fontWeight: "800" },

  // List card
  listCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 20, overflow: "hidden",
  },
  listToolbar: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
    backgroundColor: "#FAFBFF",
  },
  listTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  listSubtitle: { color: "#64748B", fontSize: 12, marginTop: 2, maxWidth: 180 },
  modeToggle: {
    flexDirection: "row", backgroundColor: "#F1F5F9",
    borderRadius: 10, padding: 3, gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  modeBtnText: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  modeBtnTextActive: { color: "#1E3A8A" },

  // Manual banner
  manualBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFBEB", borderBottomWidth: 1, borderBottomColor: "#FDE68A",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  manualBannerText: { flex: 1, color: "#92400E", fontSize: 12, fontWeight: "600" },
  saveBtn: {
    backgroundColor: "#1E3A8A", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  // Candidate list
  candidateList: { padding: 12, gap: 10 },
  candidateCard: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 16, padding: 12,
  },
  candidateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankBadge: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  rankText: { fontSize: 11, fontWeight: "800" },
  candidateAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  candidateAvatarText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  candidateInfo: { flex: 1, minWidth: 0 },
  candidateName: { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  candidateEmail: { color: "#64748B", fontSize: 11, marginTop: 1 },
  fitWrap: { alignItems: "flex-end", flexShrink: 0 },
  fitScore: { fontSize: 16, fontWeight: "800", lineHeight: 18 },
  fitLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  statusRow: { flexDirection: "row", marginTop: 8, paddingLeft: 42 },
  statusPill: {
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  // Pillar bars
  pillarWrap: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: "#E2E8F0", gap: 10,
  },
  pillarTitle: {
    fontSize: 10, fontWeight: "800", textTransform: "uppercase",
    letterSpacing: 0.8, color: "#64748B", marginBottom: 2,
  },
  pillarRow: { gap: 3 },
  pillarLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  pillarName: { color: "#0F172A", fontSize: 12, fontWeight: "600" },
  pillarScore: { fontSize: 12, fontWeight: "700" },
  barLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { color: "#94A3B8", fontSize: 10, width: 44, textAlign: "right" },
  barTrack: {
    flex: 1, height: 7, backgroundColor: "#E2E8F0",
    borderRadius: 999, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999 },
  barNum: { color: "#94A3B8", fontSize: 10, width: 22 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#64748B", fontSize: 10 },

  // Show all / footer
  showAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9",
  },
  showAllText: { color: "#1E3A8A", fontSize: 13, fontWeight: "700" },
  listFooter: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#F1F5F9",
    backgroundColor: "#FAFBFF",
  },
  listFooterText: {
    color: "#94A3B8", fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.7,
  },
});