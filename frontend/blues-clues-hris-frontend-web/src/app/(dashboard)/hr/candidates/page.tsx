"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Star,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  type CandidateJobOption,
  type RankedCandidate,
  type RankedCandidateSkillBreakdown,
  type RankingMode,
  getCandidateJobs,
  getRankedCandidates,
  saveManualRanking,
} from "@/lib/candidateApi";

type JobWithCount = CandidateJobOption & { total_candidates?: number };

const STATUS_STYLES: Record<string, string> = {
  "Final Interview": "bg-purple-100 text-purple-700 border-purple-200",
  "Technical": "bg-blue-100 text-blue-700 border-blue-200",
  "Screening": "bg-amber-100 text-amber-700 border-amber-200",
  "Submitted": "bg-gray-100 text-gray-600 border-gray-200",
  "Hired": "bg-green-100 text-green-700 border-green-200",
  "Rejected": "bg-red-100 text-red-700 border-red-200",
  submitted: "bg-gray-100 text-gray-600 border-gray-200",
  screening: "bg-amber-100 text-amber-700 border-amber-200",
  technical: "bg-blue-100 text-blue-700 border-blue-200",
};

function fitTextColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-amber-600";
  return "text-red-500";
}

function rankBadgeStyle(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-700 border border-amber-300";
  if (rank === 2) return "bg-slate-100 text-slate-600 border border-slate-300";
  if (rank === 3) return "bg-orange-50 text-orange-600 border border-orange-200";
  return "bg-muted text-muted-foreground border border-border";
}

function rankStarClass(rank: number) {
  if (rank === 1) return "fill-amber-500 text-amber-500";
  if (rank === 2) return "fill-slate-400 text-slate-400";
  return "fill-orange-400 text-orange-400";
}

function podiumBg(i: number) {
  if (i === 0) return "bg-amber-100";
  if (i === 1) return "bg-slate-100";
  return "bg-orange-50";
}

function podiumIconColor(i: number) {
  if (i === 0) return "text-amber-600";
  if (i === 1) return "text-slate-500";
  return "text-orange-500";
}

function normalizeStatus(status: string) {
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatJobMeta(job: JobWithCount) {
  const parts = [job.location, job.status ? normalizeStatus(job.status) : null];
  if (typeof job.total_candidates === "number") {
    parts.push(`${job.total_candidates} candidates`);
  }
  return parts.filter(Boolean).join(" · ");
}

function FitVisualization({
  skills,
}: Readonly<{ skills: RankedCandidateSkillBreakdown[] }>) {
  return (
    <div className="mt-4 space-y-3.5 border-t border-border pt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Demand vs Supply Skill Match
      </p>

      {skills.map((skill) => {
        const hasGap = skill.supply_level < skill.demand_level;
        const demandWidth = Math.max(skill.demand_level * 20, 8);
        const supplyWidth = Math.max(skill.supply_level * 20, 0);

        return (
          <div key={`${skill.sfia_skill_id}-${skill.skill_name}`}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{skill.skill_name}</span>
              <span className={`text-xs font-bold ${hasGap ? "text-red-500" : "text-green-600"}`}>
                {skill.supply_level} / {skill.demand_level}
              </span>
            </div>

            <div className="mb-0.5 flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">Demand</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-slate-400" style={{ width: `${demandWidth}%` }} />
              </div>
              <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{skill.demand_level}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">Supply</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${hasGap ? "bg-red-400" : "bg-green-500"}`}
                  style={{ width: `${supplyWidth}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{skill.supply_level}</span>
            </div>

            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Relevance points: {skill.points}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function CandidateCard({
  candidate,
  rank,
  mode,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Readonly<{
  candidate: RankedCandidate;
  rank: number;
  mode: RankingMode;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  const normalizedStatus = normalizeStatus(candidate.status);
  const statusStyle =
    STATUS_STYLES[normalizedStatus] ??
    STATUS_STYLES[candidate.status] ??
    "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div
      draggable={mode === "manual"}
      onDragStart={mode === "manual" ? onDragStart : undefined}
      onDragOver={mode === "manual" ? onDragOver : undefined}
      onDrop={mode === "manual" ? onDrop : undefined}
      onDragEnd={mode === "manual" ? onDragEnd : undefined}
      className={[
        "select-none rounded-xl border bg-card p-4 transition-all",
        isDragOver ? "scale-[1.01] border-primary border-dashed bg-primary/5" : "border-border/70",
        isDragging ? "opacity-40" : "opacity-100",
        mode === "manual" ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankBadgeStyle(rank)}`}>
          {rank <= 3 ? <Star className={`h-3.5 w-3.5 ${rankStarClass(rank)}`} /> : `#${rank}`}
        </div>

        {mode === "manual" && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />}

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/10 text-xs font-bold text-primary">
          {candidate.first_name.charAt(0)}
          {candidate.last_name.charAt(0)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none text-foreground">
            {candidate.first_name} {candidate.last_name}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{candidate.email}</p>
        </div>

        <span className={`hidden shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase sm:inline-flex ${statusStyle}`}>
          {normalizedStatus}
        </span>

        <div className="shrink-0 text-right">
          <p className={`text-lg font-bold leading-none ${fitTextColor(candidate.sfia_match_percentage)}`}>
            {candidate.sfia_match_percentage}%
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Fit Score</p>
        </div>

        <button
          onClick={() => setExpanded((value) => !value)}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && <FitVisualization skills={candidate.skill_breakdown} />}
    </div>
  );
}

export default function CandidateEvaluationPage() {
  const [jobs, setJobs] = useState<JobWithCount[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [mode, setMode] = useState<RankingMode>("sfia");
  const [showAll, setShowAll] = useState(false);
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.job_posting_id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      try {
        setLoadingJobs(true);
        setError(null);
        const data = await getCandidateJobs();
        if (cancelled) return;
        setJobs(data);
        setSelectedJobId((current) => current || data[0]?.job_posting_id || "");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    }

    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      setCandidates([]);
      return;
    }

    let cancelled = false;

    async function loadCandidates() {
      try {
        setLoadingCandidates(true);
        setError(null);
        const response = await getRankedCandidates(selectedJobId, mode, 100);
        if (cancelled) return;
        setCandidates(response.candidates);
        setJobs((current) =>
          current.map((job) =>
            job.job_posting_id === selectedJobId
              ? { ...job, total_candidates: response.total_candidates }
              : job,
          ),
        );
      } catch (err) {
        if (cancelled) return;
        setCandidates([]);
        setError(err instanceof Error ? err.message : "Failed to load candidates");
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    }

    void loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId, mode]);

  const visibleList = showAll ? candidates : candidates.slice(0, 20);
  const top3 = candidates.slice(0, 3);
  const avgFitTop20 =
    candidates.length > 0
      ? Math.round(
          candidates
            .slice(0, Math.min(20, candidates.length))
            .reduce((sum, candidate) => sum + candidate.sfia_match_percentage, 0) /
            Math.min(20, candidates.length),
        )
      : 0;

  function handleDrop(toIndex: number) {
    if (mode !== "manual" || dragIndex === null || dragIndex === toIndex) return;

    setCandidates((current) => {
      const reordered = [...current];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(toIndex, 0, moved);

      return reordered.map((candidate, index) => ({
        ...candidate,
        manual_rank_position: index + 1,
        effective_rank: index + 1,
      }));
    });
    setDragIndex(null);
    setDragOverIndex(null);
  }

  async function handleSaveManualRank() {
    if (!selectedJobId || mode !== "manual" || candidates.length === 0) return;

    try {
      setSaving(true);
      setError(null);
      await saveManualRanking(
        selectedJobId,
        candidates.map((candidate, index) => ({
          application_id: candidate.application_id,
          rank: index + 1,
        })),
      );
      const response = await getRankedCandidates(selectedJobId, "manual", 100);
      setCandidates(response.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual ranking");
    } finally {
      setSaving(false);
    }
  }

  if (loadingJobs) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading candidate dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">HR Recruitment</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Candidate Evaluation Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Top candidates ranked by SFIA skill fit. Switch to Manual to review and override the order.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Top 20 Avg Fit</p>
            <p className="mt-1 text-lg font-bold">{avgFitTop20}%</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="relative shrink-0">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Job Posting</p>
          <button
            onClick={() => setJobDropdownOpen((value) => !value)}
            className="flex min-w-[260px] items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/50"
          >
            <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left">{selectedJob?.title ?? "Select a job posting"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          {jobDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-card py-1 shadow-lg">
              {jobs.map((job) => (
                <button
                  key={job.job_posting_id}
                  onClick={() => {
                    setSelectedJobId(job.job_posting_id);
                    setJobDropdownOpen(false);
                    setShowAll(false);
                  }}
                  className={`flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                    job.job_posting_id === selectedJobId ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{job.title}</span>
                  <span className="text-[11px] text-muted-foreground">{formatJobMeta(job)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {top3.map((candidate, index) => (
            <Card key={candidate.application_id} className="border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${podiumBg(index)}`}>
                  <Trophy className={`h-3.5 w-3.5 ${podiumIconColor(index)}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-none text-foreground">
                    {candidate.first_name} {candidate.last_name}
                  </p>
                  <p className={`mt-0.5 text-sm font-bold ${fitTextColor(candidate.sfia_match_percentage)}`}>
                    {candidate.sfia_match_percentage}% fit
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col items-start justify-between gap-3 border-b border-border bg-[linear-gradient(155deg,rgba(37,99,235,0.07),rgba(15,23,42,0.00))] p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold tracking-tight">
              {showAll ? `All ${candidates.length} Candidates` : "Top 20 Candidates"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {mode === "sfia"
                ? "Sorted by SFIA relevance score"
                : "Manual mode active — drag cards to reorder, then save"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {candidates.length > 20 && (
              <button
                onClick={() => setShowAll((value) => !value)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {showAll ? "Show Top 20 only" : `Show all ${candidates.length}`}
              </button>
            )}

            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setMode("sfia")}
                className={[
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                  mode === "sfia" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                SFIA Ranking
              </button>
              <button
                onClick={() => setMode("manual")}
                className={[
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                  mode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Users className="h-3.5 w-3.5" />
                Manual Ranking
              </button>
            </div>

            {mode === "manual" && (
              <Button size="sm" className="h-8" onClick={handleSaveManualRank} disabled={saving || loadingCandidates}>
                {saving ? "Saving..." : "Save Order"}
              </Button>
            )}
          </div>
        </div>

        {mode === "manual" && (
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-xs font-medium text-amber-700">
            <GripVertical className="h-3.5 w-3.5 shrink-0" />
            Drag-and-drop is active. Reorder candidates then click <strong className="font-bold">Save Order</strong> to persist.
          </div>
        )}

        <div className="space-y-3 p-5">
          {loadingCandidates ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm font-medium text-muted-foreground">
              <Loader2 className="mr-3 h-4 w-4 animate-spin" />
              Loading ranked candidates...
            </div>
          ) : visibleList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No candidate ranking data available for this job yet.
            </div>
          ) : (
            visibleList.map((candidate, index) => (
              <CandidateCard
                key={candidate.application_id}
                candidate={candidate}
                rank={index + 1}
                mode={mode}
                isDragging={dragIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverIndex(index);
                }}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
              />
            ))
          )}
        </div>

        <div className="border-t border-border bg-muted/20 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {visibleList.length > 0 ? `Showing ${visibleList.length} of ${candidates.length} candidates` : "No candidates found"}
          </p>
        </div>
      </div>
    </div>
  );
}
