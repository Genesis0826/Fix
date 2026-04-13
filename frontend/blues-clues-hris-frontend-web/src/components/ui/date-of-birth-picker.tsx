"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseIso(iso: string): { year: string; month: string; day: string } {
  if (!iso) return { year: "", month: "", day: "" };
  const [y = "", m = "", d = ""] = iso.split("-");
  return { year: y, month: m, day: d };
}

function toIso(year: string, month: string, day: string): string {
  if (!year || !month || !day) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function daysInMonth(year: string, month: string): number {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

interface DateOfBirthPickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  disabled?: boolean;
  id?: string;
}

const SELECT_CLS =
  "h-9 rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring cursor-pointer " +
  "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:pointer-events-none";

export function DateOfBirthPicker({
  value,
  onChange,
  disabled = false,
  id,
}: Readonly<DateOfBirthPickerProps>) {
  // ── Local state holds partial selections until all three are chosen ──────
  const [local, setLocal] = useState(() => parseIso(value));

  // Sync when parent resets or prefills the value
  useEffect(() => {
    setLocal(parseIso(value));
  }, [value]);

  const maxDays = useMemo(
    () => daysInMonth(local.year, local.month),
    [local.year, local.month],
  );

  // Clamp day to valid range for the chosen month/year
  const effectiveDay =
    local.day && Number(local.day) > maxDays
      ? String(maxDays).padStart(2, "0")
      : local.day;

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear - 5; y >= currentYear - 100; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const days = useMemo(() => {
    const arr: number[] = [];
    for (let d = 1; d <= maxDays; d++) arr.push(d);
    return arr;
  }, [maxDays]);

  const set = (part: "year" | "month" | "day", val: string) => {
    const next = { ...local, day: effectiveDay, [part]: val };
    // Re-clamp day after month/year change
    const md = daysInMonth(next.year, next.month);
    if (next.day && Number(next.day) > md) {
      next.day = String(md).padStart(2, "0");
    }
    setLocal(next);
    // Only bubble up when all three parts are filled
    const iso = toIso(next.year, next.month, next.day);
    if (iso) onChange(iso);
  };

  const displayValue =
    local.month && local.day && local.year
      ? `${MONTHS[Number(local.month) - 1]} ${Number(local.day)}, ${local.year}`
      : null;

  if (disabled) {
    return (
      <div className="h-9 flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-50" />
        {displayValue ?? <span className="italic opacity-40">Not set</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {/* Month */}
        <select
          id={id}
          value={local.month}
          onChange={(e) => set("month", e.target.value)}
          className={`${SELECT_CLS} flex-[2]`}
          aria-label="Month"
        >
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              {m}
            </option>
          ))}
        </select>

        {/* Day */}
        <select
          value={effectiveDay}
          onChange={(e) => set("day", e.target.value)}
          className={`${SELECT_CLS} flex-1`}
          aria-label="Day"
        >
          <option value="">Day</option>
          {days.map((d) => (
            <option key={d} value={String(d).padStart(2, "0")}>
              {d}
            </option>
          ))}
        </select>

        {/* Year */}
        <select
          value={local.year}
          onChange={(e) => set("year", e.target.value)}
          className={`${SELECT_CLS} flex-[1.5]`}
          aria-label="Year"
        >
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Formatted confirmation */}
      {displayValue && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {displayValue}
        </p>
      )}
    </div>
  );
}
