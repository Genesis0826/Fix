import { authFetch } from "./authApi";
import { API_BASE_URL } from "./api";

export type RankingMode = "sfia" | "manual";

export interface RankedCandidateSkillBreakdown {
  sfia_skill_id: string;
  skill_name: string;
  demand_level: number;
  supply_level: number;
  points: number;
  matched: boolean;
}

export interface RankedCandidate {
  application_id: string;
  applicant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  applicant_code: string | null;
  status: string;
  applied_at: string;
  sfia_match_percentage: number;
  sfia_rank: number;
  manual_rank_position: number | null;
  effective_rank: number;
  skill_breakdown: RankedCandidateSkillBreakdown[];
}

export interface RankedCandidatesResponse {
  job_posting_id: string;
  title: string;
  ranking_mode: RankingMode;
  total_candidates: number;
  top_count: number;
  required_skill_count: number;
  candidates: RankedCandidate[];
}

export interface CandidateJobOption {
  job_posting_id: string;
  title: string;
  department_id: string | null;
  status: string;
  location: string | null;
  closes_at: string | null;
}

export async function getCandidateJobs(): Promise<CandidateJobOption[]> {
  const res = await authFetch(`${API_BASE_URL}/jobs`);
  const data = await res.json().catch(() => ([]));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to fetch jobs");
  }
  return data as CandidateJobOption[];
}

export async function getRankedCandidates(
  jobPostingId: string,
  mode: RankingMode,
  limit = 100,
): Promise<RankedCandidatesResponse> {
  const res = await authFetch(
    `${API_BASE_URL}/jobs/${jobPostingId}/candidates/ranked?mode=${mode}&limit=${limit}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to fetch ranked candidates");
  }
  return data as RankedCandidatesResponse;
}

export async function saveManualRanking(
  jobPostingId: string,
  rankings: { application_id: string; rank: number }[],
) {
  const res = await authFetch(`${API_BASE_URL}/jobs/${jobPostingId}/candidates/manual-rank`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rankings }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || "Failed to save manual ranking");
  }
  return data as { message: string; job_posting_id: string; updated_count: number };
}
