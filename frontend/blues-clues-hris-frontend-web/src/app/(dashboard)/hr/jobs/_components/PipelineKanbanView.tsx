"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar, Mail, GripVertical, Eye,
  FileText, Search, Mic, Cpu, Trophy, CheckCircle2, XCircle,
  AlertTriangle, Rows3, AlignJustify,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineApplication {
  application_id: string;
  applicant_id: string;
  status: string;
  applied_at: string;
  applicant_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    applicant_code: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const KANBAN_STAGES = [
  { value: "submitted",           label: "Applied",        icon: FileText,    headerText: "text-blue-700",   badge: "bg-blue-100 text-blue-700 border-blue-200",       bar: "bg-blue-500"   },
  { value: "screening",           label: "Screening",      icon: Search,      headerText: "text-amber-700",  badge: "bg-amber-100 text-amber-700 border-amber-200",    bar: "bg-amber-400"  },
  { value: "first_interview",     label: "1st Interview",  icon: Mic,         headerText: "text-purple-700", badge: "bg-purple-100 text-purple-700 border-purple-200", bar: "bg-purple-500" },
  { value: "technical_interview", label: "Technical",      icon: Cpu,         headerText: "text-indigo-700", badge: "bg-indigo-100 text-indigo-700 border-indigo-200", bar: "bg-indigo-500" },
  { value: "final_interview",     label: "Final Interview",icon: Trophy,      headerText: "text-violet-700", badge: "bg-violet-100 text-violet-700 border-violet-200", bar: "bg-violet-500" },
  { value: "hired",               label: "Hired",          icon: CheckCircle2,headerText: "text-green-700",  badge: "bg-green-100 text-green-700 border-green-200",    bar: "bg-green-500"  },
  { value: "rejected",            label: "Rejected",       icon: XCircle,     headerText: "text-red-600",    badge: "bg-red-100 text-red-700 border-red-200",          bar: "bg-red-400"    },
] as const;

const HIGH_COUNT_THRESHOLD = 20;
const INTERVIEW_STAGES = ["first_interview", "technical_interview", "final_interview"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 3 * 24 * 60 * 60 * 1000;
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function KanbanCard({
  app,
  onView,
  compact,
}: Readonly<{
  app: PipelineApplication;
  onView: (id: string) => void;
  compact: boolean;
}>) {
  const { first_name = 'Unknown', last_name = 'Applicant', email = '', applicant_code = null } = app.applicant_profile ?? {};
  const newApp = isNew(app.applied_at);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.application_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-white border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-2 px-2.5 py-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none"
            tabIndex={-1}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="h-7 w-7 rounded-full bg-[linear-gradient(135deg,#1e3a8a,#2563eb)] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
            {getInitials(first_name, last_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground truncate leading-tight">{first_name} {last_name}</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{applicant_code}</p>
          </div>
          {newApp && (
            <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[8px] font-bold uppercase">
              New
            </span>
          )}
          <button
            onClick={() => onView(app.application_id)}
            className="shrink-0 h-6 w-6 rounded-md border border-border flex items-center justify-center hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all"
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="p-3.5 space-y-3">
        {/* Top row */}
        <div className="flex items-start gap-2.5">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 touch-none"
            tabIndex={-1}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,#1e3a8a,#2563eb)] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            {getInitials(first_name, last_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground truncate leading-tight">{first_name} {last_name}</p>
              {newApp && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-bold uppercase tracking-wide">
                  New
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{applicant_code}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="pl-13 space-y-1">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{email}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">{fmtDate(app.applied_at)}</span>
          </div>
        </div>

        {/* View button */}
        <div className="pl-13">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-[11px] gap-1 font-semibold w-full hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all"
            onClick={() => onView(app.application_id)}
          >
            <Eye className="h-3 w-3" /> View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Ghost overlay card ───────────────────────────────────────────────────────

function GhostCard({ app }: Readonly<{ app: PipelineApplication }>) {
  const { first_name = 'Unknown', last_name = 'Applicant', applicant_code = null } = app.applicant_profile ?? {};
  return (
    <div className="bg-white border border-primary/30 rounded-xl shadow-2xl rotate-2 scale-105 w-60 p-3.5 opacity-95">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,#1e3a8a,#2563eb)] flex items-center justify-center text-white text-xs font-bold shrink-0">
          {getInitials(first_name, last_name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{first_name} {last_name}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{applicant_code}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable Column ─────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  apps,
  onView,
  compact,
}: Readonly<{
  stage: typeof KANBAN_STAGES[number];
  apps: PipelineApplication[];
  onView: (id: string) => void;
  compact: boolean;
}>) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  const Icon = stage.icon;
  const isHighCount = apps.length >= HIGH_COUNT_THRESHOLD;

  return (
    <div className={`flex flex-col rounded-xl border transition-colors duration-150 ${
      isOver ? "border-primary/40 bg-primary/5" : "border-border bg-card"
    } ${compact ? "min-w-55 max-w-55" : "min-w-65 max-w-65"}`}>

      {/* Column header */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${stage.headerText}`} />
            <span className={`text-sm font-bold ${stage.headerText}`}>{stage.label}</span>
          </div>
          {/* High-count warning */}
          {isHighCount && (
            <span
              title={`${apps.length} applicants — consider switching to List view for easier navigation`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[9px] font-bold cursor-help"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {apps.length}
            </span>
          )}
        </div>

        {/* Count row */}
        <div className="flex items-baseline gap-2 mb-2.5">
          <span className="text-2xl font-bold text-foreground leading-none">{apps.length}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">total</span>
          {isHighCount && (
            <span className="text-[9px] text-amber-600 font-semibold ml-auto">Use List view ↗</span>
          )}
        </div>

        {/* Accent bar */}
        <div className={`h-1 w-full rounded-full ${stage.bar} mb-3`} />
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        data-column-scroll
        className={`flex-1 overflow-y-auto px-3 pb-3 min-h-30 max-h-[calc(100vh-380px)] transition-colors rounded-b-xl ${
          compact ? "space-y-1.5" : "space-y-2.5"
        } ${isOver ? "bg-primary/5" : ""}`}
      >
        <SortableContext
          items={apps.map((a) => a.application_id)}
          strategy={verticalListSortingStrategy}
        >
          {apps.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed transition-colors ${
              isOver ? "border-primary/40" : "border-border/60"
            }`}>
              <Icon className="h-6 w-6 text-muted-foreground/25 mb-1.5" />
              <p className="text-[11px] text-muted-foreground/50 font-medium">Drop here</p>
            </div>
          ) : (
            apps.map((app) => (
              <KanbanCard key={app.application_id} app={app} onView={onView} compact={compact} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

export function PipelineKanbanView({
  apps,
  onStatusChange,
  onViewDetail,
  onScheduleNeeded,
}: Readonly<{
  apps: PipelineApplication[];
  onStatusChange: (appId: string, newStatus: string) => Promise<void>;
  onViewDetail: (appId: string) => void;
  onScheduleNeeded?: (appId: string, stage: string) => void;
}>) {
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [compact, setCompact]     = useState(false);
  const scrollRef                  = useRef<HTMLDivElement>(null);

  // ── Mouse wheel → horizontal scroll ──────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Only hijack purely-vertical scrolls (not when columns are scrolling)
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      // Don't intercept if the user is scrolling inside a column card list
      const target = e.target as HTMLElement;
      const insideColumn = target.closest("[data-column-scroll]");
      if (insideColumn) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY * 1.2;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = Object.fromEntries(
    KANBAN_STAGES.map((s) => [s.value, apps.filter((a) => a.status === s.value)])
  );

  const activeApp = activeId ? apps.find((a) => a.application_id === activeId) : null;

  const findStageForApp = useCallback(
    (appId: string) => apps.find((a) => a.application_id === appId)?.status ?? null,
    [apps]
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const draggedId    = active.id as string;
    const overId       = over.id as string;
    const currentStage = findStageForApp(draggedId);
    const targetStage  = KANBAN_STAGES.find((s) => s.value === overId)?.value
                        ?? findStageForApp(overId);

    if (!targetStage || targetStage === currentStage) return;

    await onStatusChange(draggedId, targetStage);

    // If moved to an interview stage, prompt HR to schedule
    if (INTERVIEW_STAGES.includes(targetStage) && onScheduleNeeded) {
      onScheduleNeeded(draggedId, targetStage);
    }
  };

  // Auto-enable compact when any column has 20+ cards
  const hasHighCount = KANBAN_STAGES.some((s) => (grouped[s.value]?.length ?? 0) >= HIGH_COUNT_THRESHOLD);

  return (
    <div className="space-y-3">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Scroll horizontally or use mouse wheel to navigate columns
        </p>
        <div className="flex items-center gap-1.5">
          {hasHighCount && (
            <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1 mr-2">
              <AlertTriangle className="h-3 w-3" /> High volume — try List view
            </span>
          )}
          {/* Compact toggle */}
          <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setCompact(false)}
              title="Detailed cards"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                compact ? "text-muted-foreground hover:text-foreground" : "bg-card text-foreground shadow-sm border border-border"
              }`}
            >
              <AlignJustify className="h-3 w-3" /> Detailed
            </button>
            <button
              onClick={() => setCompact(true)}
              title="Compact cards"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                compact ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rows3 className="h-3 w-3" /> Compact
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div ref={scrollRef} className="overflow-x-auto pb-4 cursor-default">
          <div className="flex gap-4 justify-start xl:justify-center" style={{ minWidth: "max-content" }}>
            {KANBAN_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.value}
                stage={stage}
                apps={grouped[stage.value] ?? []}
                onView={onViewDetail}
                compact={compact}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeApp ? <GhostCard app={activeApp} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
