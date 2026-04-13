/**
 * Design token colors — mirrors web globals.css CSS variables
 * All hardcoded hex values in the app should reference these instead.
 * When backend/design updates brand colors, change here only.
 */

export const Colors = {
  // Primary (Blue's Clues brand blue)
  primary:         "#2563eb",  // bg-primary, buttons, active states
  primaryLight:    "#eff6ff",  // bg-primary/10, light backgrounds
  primaryBorder:   "#bfdbfe",  // border-primary/20
  primaryDisabled: "#93c5fd",  // disabled button state

  // Sidebar — matches web globals.css --sidebar: #1e3a8a
  sidebarBg:       "#1e3a8a",  // sidebar background
  sidebarActive:   "#2563eb",  // active menu item

  // Neutral / Text
  textPrimary:     "#111827",  // headings, strong text
  textSecondary:   "#374151",  // labels
  textMuted:       "#6b7280",  // subtitles, descriptions
  textPlaceholder: "#9ca3af",  // input placeholders, dim labels

  // Backgrounds
  bgApp:           "#F1F5F9",  // screen background (slate-100 — matches web)
  bgCard:          "#ffffff",  // card/surface background
  bgMuted:         "#f9fafb",  // muted surface (table headers, inputs)
  bgSubtle:        "#f3f4f6",  // subtle surface (cancel buttons, tags)

  // Borders
  border:          "#e5e7eb",  // default border
  borderMuted:     "#d1d5db",  // lighter border (inactive step circles)

  // Status
  success:         "#22c55e",  // green-500
  successLight:    "#f0fdf4",  // green-50
  successText:     "#16a34a",  // green-600

  warning:         "#f59e0b",  // amber-500
  warningLight:    "#fffbeb",  // amber-50
  warningBorder:   "#fde68a",  // amber-100
  warningText:     "#d97706",  // amber-600

  danger:          "#dc2626",  // red-600
  dangerLight:     "#fef2f2",  // red-50
  dangerText:      "#b91c1c",  // red-700

  // Dark (used in applicant portal sign-in button — intentional contrast)
  dark:            "#111827",
} as const;
