"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import {
  ScrollText, Briefcase, ClipboardList, Shield, ShieldAlert,
  Activity, UserCheck, Search, ChevronLeft, ChevronRight,
  RefreshCw, Loader2, ArrowLeft, Building2, Mail, X,
  AlertTriangle, Info, TrendingUp, Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Performer = { first_name: string; last_name: string } | null;

type AuditLog = {
  log_id: string;
  action: string;
  performed_by: string | null;
  performer: Performer;
  target_user_id: string | null;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  ip_address: string | null;
  timestamp: string;
};

const PAGE_SIZE = 25;
const ALL_SEVERITIES = ["INFO", "WARNING", "ERROR", "CRITICAL"] as const;
const ALL_CATEGORIES = ["User", "Job", "Application", "Department", "Role", "Security", "Error", "Onboarding", "Profile", "System"] as const;
type Severity = typeof ALL_SEVERITIES[number];
type Category = typeof ALL_CATEGORIES[number];

// ─── Design tokens ────────────────────────────────────────────────────────────

const SEV = {
  INFO:     { label: "Info",     dot: "bg-slate-400",  text: "text-slate-600",  bg: "bg-slate-50",   border: "border-slate-200", row: "",                        bar: "bg-slate-300",  icon: Info,         leftBorder: "" },
  WARNING:  { label: "Warning",  dot: "bg-amber-400",  text: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200", row: "border-l-4 border-l-amber-400",  bar: "bg-amber-400",  icon: AlertTriangle, leftBorder: "border-l-4 border-l-amber-400" },
  ERROR:    { label: "Error",    dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200", row: "border-l-4 border-l-orange-500", bar: "bg-orange-500", icon: AlertTriangle, leftBorder: "border-l-4 border-l-orange-500" },
  CRITICAL: { label: "Critical", dot: "bg-red-600",    text: "text-red-700",    bg: "bg-red-50",     border: "border-red-200",   row: "border-l-4 border-l-red-600",    bar: "bg-red-500",    icon: ShieldAlert,   leftBorder: "border-l-4 border-l-red-600" },
} as const;

const CAT = {
  User:        { icon: UserCheck,     bg: "bg-emerald-50",  text: "text-emerald-700" },
  Job:         { icon: Briefcase,     bg: "bg-blue-50",     text: "text-blue-700"    },
  Application: { icon: ClipboardList, bg: "bg-violet-50",   text: "text-violet-700"  },
  Department:  { icon: Building2,     bg: "bg-teal-50",     text: "text-teal-700"    },
  Role:        { icon: Shield,        bg: "bg-amber-50",    text: "text-amber-700"   },
  Security:    { icon: ShieldAlert,   bg: "bg-yellow-50",   text: "text-yellow-700"  },
  Error:       { icon: Mail,          bg: "bg-orange-50",   text: "text-orange-700"  },
  Onboarding:  { icon: ClipboardList,  bg: "bg-sky-50",      text: "text-sky-700"     },
  Profile:     { icon: Pencil,         bg: "bg-indigo-50",   text: "text-indigo-700"  },
  System:      { icon: Activity,       bg: "bg-slate-50",    text: "text-slate-600"   },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(action: string, severity: string): Category {
  const l = action.toLowerCase();
  if (severity === "CRITICAL" || severity === "WARNING") return "Security";
  if (severity === "ERROR" || l.includes("email:"))      return "Error";
  if (l.includes("job posting") || l.includes("candidate ranking")) return "Job";
  if (l.includes("application"))  return "Application";
  if (l.includes("department"))   return "Department";
  if (l.includes("role"))         return "Role";
  if (l.includes("user") || l.includes("invite") || l.includes("account")) return "User";
  if (l.includes("onboarding") || l.includes("document_upload") || l.includes("profile_save")) return "Onboarding";
  if (l.includes("profile_change")) return "Profile";
  return "System";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function performer(log: AuditLog) {
  if (log.performer) return `${log.performer.first_name} ${log.performer.last_name}`.trim();
  if (!log.performed_by) return "System";
  return log.performed_by.slice(0, 8).toUpperCase();
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState("");
  const [selSev, setSelSev]   = useState<Severity[]>([]);
  const [selCat, setSelCat]   = useState<Category[]>([]);

  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter   = selSev.length > 0 || selCat.length > 0 || search.trim() !== "";

  const fetchLogs = useCallback(async (pg: number, refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        authFetch(`${API_BASE_URL}/audit/logs?limit=${PAGE_SIZE}&offset=${pg * PAGE_SIZE}`),
        authFetch(`${API_BASE_URL}/audit/logs/count`),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setLogs(Array.isArray(d1) ? d1 : []);
      setTotal(d2?.count ?? 0);
    } catch { toast.error("Failed to load audit logs"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchLogs(page); }, [page, fetchLogs]);
  useEffect(() => { setPage(0); }, [search, selSev, selCat]);

  // Cross-facet counts
  function matchSearch(l: AuditLog) {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = l.performer ? `${l.performer.first_name} ${l.performer.last_name}`.toLowerCase() : "";
    return l.action.toLowerCase().includes(q) || name.includes(q) || (l.performed_by ?? "").toLowerCase().includes(q);
  }

  const sevCounts = Object.fromEntries(ALL_SEVERITIES.map((s) => [s,
    logs.filter((l) => {
      const cat = getCategory(l.action, l.severity ?? "INFO");
      return (l.severity ?? "INFO") === s
        && (selCat.length === 0 || selCat.includes(cat))
        && matchSearch(l);
    }).length,
  ]));

  const catCounts = Object.fromEntries(ALL_CATEGORIES.map((c) => [c,
    logs.filter((l) => {
      const sev = l.severity ?? "INFO";
      return getCategory(l.action, sev) === c
        && (selSev.length === 0 || selSev.includes(sev as Severity))
        && matchSearch(l);
    }).length,
  ]));

  const displayed = logs.filter((l) => {
    const sev = l.severity ?? "INFO";
    const cat = getCategory(l.action, sev);
    if (selSev.length > 0 && !selSev.includes(sev as Severity)) return false;
    if (selCat.length > 0 && !selCat.includes(cat)) return false;
    return matchSearch(l);
  });

  // Hero stats
  const sevTotals = Object.fromEntries(ALL_SEVERITIES.map((s) => [s, logs.filter((l) => (l.severity ?? "INFO") === s).length]));
  const maxSevCount = Math.max(1, ...Object.values(sevTotals));

  const clearAll = () => { setSearch(""); setSelSev([]); setSelCat([]); };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-1 py-1 space-y-5 animate-in fade-in duration-300">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl shadow-md"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #0f3460 75%, #134e4a 100%)" }}>

          {/* Subtle grid overlay */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative z-10 px-8 py-7">
            <div className="flex items-start justify-between gap-8 flex-wrap">

              {/* Left — title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <Link href="/system-admin" className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors duration-150">
                    <ArrowLeft className="h-3 w-3" /> Dashboard
                  </Link>
                  <span className="text-white/20">/</span>
                  <span className="text-[11px] text-white/60 font-medium tracking-wide">Audit Logs</span>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm">
                    <ScrollText className="h-5 w-5 text-white/80" />
                  </div>
                  <h1 className="text-2xl font-semibold text-white tracking-tight">Audit Logs</h1>
                </div>
                <p className="text-sm text-white/50 max-w-lg leading-relaxed">
                  Chronological record of all system actions — user management, job postings, security incidents, and email failures.
                </p>

                {/* Severity distribution bar */}
                {!loading && total > 0 && (
                  <div className="mt-5 flex items-center gap-3">
                    <TrendingUp className="h-3.5 w-3.5 text-white/30 shrink-0" />
                    <div className="flex items-center gap-1 flex-1 max-w-xs">
                      {ALL_SEVERITIES.map((s) => {
                        const w = sevTotals[s] ? Math.max(4, Math.round((sevTotals[s] / maxSevCount) * 100)) : 0;
                        if (!w) return null;
                        return (
                          <button
                            key={s}
                            title={`${SEV[s].label}: ${sevTotals[s]}`}
                            onClick={() => setSelSev((p) => toggle(p, s as Severity))}
                            className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${SEV[s].bar} ${
                              selSev.includes(s as Severity) ? "opacity-100 scale-y-150" : "opacity-50 hover:opacity-80"
                            }`}
                            style={{ width: `${w}%` }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-white/30 tabular-nums">
                      {hasFilter ? `${displayed.length} shown` : `${total.toLocaleString()} total`}
                    </span>
                  </div>
                )}
              </div>

              {/* Right — stat cards */}
              <div className="flex items-stretch gap-2.5 shrink-0 flex-wrap">
                {/* Total */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/6 backdrop-blur-sm px-5 py-4 min-w-[80px] text-center">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40 mb-1">Events</p>
                  <p className="text-3xl font-bold text-white tabular-nums">{loading ? "—" : total.toLocaleString()}</p>
                  <p className="text-[9px] text-white/30 mt-0.5">all time</p>
                </div>

                {/* Severity cards — only non-zero */}
                {(["WARNING", "ERROR", "CRITICAL"] as const).filter((s) => sevTotals[s] > 0).map((s) => {
                  const cfg = SEV[s];
                  const active = selSev.includes(s as Severity);
                  return (
                    <button
                      key={s}
                      onClick={() => setSelSev((p) => toggle(p, s as Severity))}
                      className={`flex flex-col items-center justify-center rounded-xl border px-4 py-4 min-w-[72px] text-center transition-all duration-150 cursor-pointer ${
                        active
                          ? "border-white/40 bg-white/15 ring-2 ring-white/20 scale-[1.02]"
                          : "border-white/10 bg-white/6 hover:bg-white/12 hover:border-white/20"
                      }`}
                    >
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40 mb-1">{cfg.label}</p>
                      <p className="text-3xl font-bold text-white tabular-nums">{sevTotals[s]}</p>
                      {active && <p className="text-[9px] text-white/40 mt-0.5">filtered</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── Filter panel ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Search + controls row */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by action or user…"
                className="h-8 w-full pl-8.5 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => fetchLogs(page, true)}
              disabled={refreshing}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-all duration-150 inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {hasFilter && (
              <button
                onClick={clearAll}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-150 inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <X className="h-3.5 w-3.5" /> Clear all
              </button>
            )}

            <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
              {hasFilter ? (
                <>
                  <span className="font-semibold text-slate-700">{displayed.length}</span>
                  <span>of {logs.length} shown</span>
                </>
              ) : (
                <>
                  <span>Page</span>
                  <span className="font-semibold text-slate-700">{page + 1}</span>
                  <span>of {totalPages}</span>
                </>
              )}
            </div>
          </div>

          {/* Severity chips */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 w-16 shrink-0">Severity</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ALL_SEVERITIES.map((s) => {
                const cfg = SEV[s];
                const count = sevCounts[s] ?? 0;
                const active = selSev.includes(s as Severity);
                const SevIcon = cfg.icon;
                return (
                  <button
                    key={s}
                    onClick={() => setSelSev((p) => toggle(p, s as Severity))}
                    disabled={count === 0 && !active}
                    className={`inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border text-[11px] font-medium transition-all duration-150 cursor-pointer disabled:cursor-default disabled:opacity-35 ${
                      active
                        ? `${cfg.bg} ${cfg.border} ${cfg.text} ring-2 ${cfg.border.replace("border-", "ring-")}`
                        : count > 0
                          ? `bg-white border-slate-200 text-slate-600 hover:${cfg.bg} hover:${cfg.border} hover:${cfg.text}`
                          : "bg-white border-slate-100 text-slate-300"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                    <span className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      active ? "bg-white/50" : "bg-slate-100 text-slate-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {selSev.length > 0 && (
                <button onClick={() => setSelSev([])} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors ml-0.5 cursor-pointer">
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 w-16 shrink-0">Category</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ALL_CATEGORIES.filter((c) => (catCounts[c] ?? 0) > 0 || selCat.includes(c)).map((c) => {
                const cfg = CAT[c];
                const CatIcon = cfg.icon;
                const count = catCounts[c] ?? 0;
                const active = selCat.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => setSelCat((p) => toggle(p, c))}
                    className={`inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border text-[11px] font-medium transition-all duration-150 cursor-pointer ${
                      active
                        ? `${cfg.bg} border-current ${cfg.text} ring-2 ring-current/30`
                        : `bg-white border-slate-200 text-slate-600 hover:${cfg.bg} hover:${cfg.text} hover:border-current/30`
                    }`}
                  >
                    <CatIcon className={`h-3 w-3 shrink-0 ${active ? cfg.text : "text-slate-400"}`} />
                    {c}
                    <span className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      active ? "bg-white/50" : "bg-slate-100 text-slate-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {selCat.length > 0 && (
                <button onClick={() => setSelCat([])} className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors ml-0.5 cursor-pointer">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_130px_110px_140px_112px] gap-0 border-b border-slate-100 bg-slate-50/70">
            {["", "Action", "Category", "Severity", "Performed By", "Time"].map((h, i) => (
              <div key={i} className={`px-4 py-2.5 ${i === 0 ? "w-12" : ""} ${i === 5 ? "text-right" : ""}`}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{h}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              <p className="text-sm text-slate-400">Loading logs…</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
              <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <ScrollText className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-sm font-medium">{hasFilter ? "No logs match your filters" : "No audit logs yet"}</p>
              {hasFilter && (
                <button onClick={clearAll} className="text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div>
              {displayed.map((log, idx) => {
                const sev  = log.severity ?? "INFO";
                const cat  = getCategory(log.action, sev);
                const scfg = SEV[sev];
                const ccfg = CAT[cat];
                const CatIcon = ccfg.icon;
                const SevIcon = scfg.icon;
                return (
                  <div
                    key={log.log_id}
                    className={`grid grid-cols-[auto_1fr_130px_110px_140px_112px] gap-0 items-center border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors duration-100 ${scfg.leftBorder}`}
                  >
                    {/* Type icon */}
                    <div className="px-4 py-3 w-12">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${ccfg.bg}`}>
                        <CatIcon className={`h-3.5 w-3.5 ${ccfg.text}`} />
                      </div>
                    </div>

                    {/* Action */}
                    <div className="px-4 py-3 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug font-medium truncate">{log.action}</p>
                      {log.ip_address && (
                        <span className="mt-0.5 inline-block text-[10px] text-slate-400 font-mono">{log.ip_address}</span>
                      )}
                    </div>

                    {/* Category */}
                    <div className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md ${ccfg.bg} ${ccfg.text}`}>
                        <CatIcon className={`h-3 w-3 ${ccfg.text}`} />
                        {cat}
                      </span>
                    </div>

                    {/* Severity */}
                    <div className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${scfg.bg} ${scfg.border} ${scfg.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${scfg.dot}`} />
                        {scfg.label}
                      </span>
                    </div>

                    {/* Performer */}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">
                            {performer(log).slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 font-medium truncate">{performer(log)}</span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="px-4 py-3 text-right">
                      <p className="text-xs font-medium text-slate-700">{relTime(log.timestamp)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{fmtDate(log.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400">
                Showing <span className="font-medium text-slate-600">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span> of <span className="font-medium text-slate-600">{total.toLocaleString()}</span> entries
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-7 w-7 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        p === page
                          ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      {p + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
