"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPublicCareers, type PublicCareersPage } from "@/lib/authApi";
import { Briefcase, MapPin, Clock, DollarSign, Loader2, Building2 } from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function CareersPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const [data, setData] = useState<PublicCareersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getPublicCareers(slug)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 text-center px-4">
        <Building2 className="h-12 w-12 text-muted-foreground/30" />
        <h1 className="text-xl font-bold text-foreground">Company Not Found</h1>
        <p className="text-sm text-muted-foreground">
          The careers page you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-primary text-primary-foreground py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-foreground/10 mb-4">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">{data.company_name}</h1>
          <p className="mt-2 text-primary-foreground/70 text-sm">
            {data.jobs.length === 0
              ? "No open positions at the moment."
              : `${data.jobs.length} open position${data.jobs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Job listings */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {data.jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Briefcase className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Check back later for new openings.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.jobs.map((job) => (
              <div
                key={job.job_posting_id}
                className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-foreground">{job.title}</h2>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {job.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />{job.location}
                        </span>
                      )}
                      {job.employment_type && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />{job.employment_type}
                        </span>
                      )}
                      {job.salary_range && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3 w-3 shrink-0" />{job.salary_range}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{job.description}</p>

                    <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/70">
                      <span>Posted {formatDate(job.posted_at)}</span>
                      {job.closes_at && <span>· Closes {formatDate(job.closes_at)}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/applicant/login?company=${encodeURIComponent(data.company_id)}`)}
                    className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 hover:bg-primary/90 transition-colors"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
