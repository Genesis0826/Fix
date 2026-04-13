"use client";

import { type ElementType, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getLifecyclePermissions,
  saveLifecyclePermissions,
  type LifecycleModule,
  type PermissionKey,
} from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  UserPlus,
  Users,
  DollarSign,
  TrendingUp,
  LogOut,
  Eye,
  Plus,
  PencilLine,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const MODULE_ICONS: Record<string, ElementType> = {
  recruitment: UserPlus,
  onboarding: Users,
  compensation: DollarSign,
  performance: TrendingUp,
  offboarding: LogOut,
};

const PERMISSION_META: Array<{
  key: PermissionKey;
  label: string;
  short: string;
  icon: ElementType;
}> = [
  { key: "read", label: "Read", short: "R", icon: Eye },
  { key: "create", label: "Create", short: "C", icon: Plus },
  { key: "update", label: "Update", short: "U", icon: PencilLine },
  { key: "delete", label: "Delete", short: "D", icon: Trash2 },
];

function PermissionToggle({
  label,
  short,
  active,
  Icon,
  onToggle,
}: {
  readonly label: string;
  readonly short: string;
  readonly active: boolean;
  readonly Icon: ElementType;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
      aria-pressed={active}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
    </button>
  );
}

function RolePermissionRow({
  roleName,
  permissions,
  onToggle,
}: {
  readonly roleName: string;
  readonly permissions: Record<PermissionKey, boolean>;
  readonly onToggle: (permission: PermissionKey, value: boolean) => void;
}) {
  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-border bg-background/80 px-4 py-4 lg:grid lg:grid-cols-[minmax(200px,2fr)_repeat(4,minmax(96px,1fr))] lg:items-center lg:gap-3">
      <div className="mb-3 flex items-center justify-between gap-3 lg:mb-0">
        <div>
          <p className="font-semibold text-foreground">{roleName}</p>
          <p className="text-xs text-muted-foreground">{enabledCount}/4 permissions enabled</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:contents">
        {PERMISSION_META.map(({ key, label, short, icon: Icon }) => (
          <PermissionToggle
            key={`${roleName}-${key}`}
            label={label}
            short={short}
            Icon={Icon}
            active={permissions[key]}
            onToggle={() => onToggle(key, !permissions[key])}
          />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  onToggle,
}: {
  readonly module: LifecycleModule;
  readonly onToggle: (
    roleName: string,
    permission: PermissionKey,
    value: boolean,
  ) => void;
}) {
  const Icon = MODULE_ICONS[module.module_id] ?? Shield;
  const rolesWithAnyAccess = module.roles.filter((role) =>
    Object.values(role.permissions).some(Boolean),
  ).length;
  const grantedPermissions = module.roles.reduce(
    (total, role) =>
      total + Object.values(role.permissions).filter(Boolean).length,
    0,
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{module.name}</h2>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {rolesWithAnyAccess}/{module.roles.length} roles active
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Granted Permissions
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">{grantedPermissions}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="hidden lg:grid lg:grid-cols-[minmax(200px,2fr)_repeat(4,minmax(96px,1fr))] lg:gap-3 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Role</span>
          {PERMISSION_META.map(({ key, label }) => (
            <span key={`${module.module_id}-${key}`} className="text-center">
              {label}
            </span>
          ))}
        </div>

        {module.roles.map((role) => (
          <RolePermissionRow
            key={`${module.module_id}-${role.role_name}`}
            roleName={role.role_name}
            permissions={role.permissions}
            onToggle={(permission, value) =>
              onToggle(role.role_name, permission, value)
            }
          />
        ))}
      </div>
    </section>
  );
}

export default function GlobalSettingsPage() {
  const router = useRouter();
  const [modules, setModules] = useState<LifecycleModule[]>([]);
  const [original, setOriginal] = useState<LifecycleModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const roleNames = useMemo(
    () =>
      Array.from(
        new Set(modules.flatMap((module) => module.roles.map((role) => role.role_name))),
      ),
    [modules],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLifecyclePermissions();
      setModules(data);
      setOriginal(structuredClone(data));
      setIsDirty(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const destination = anchor.href;
      if (!destination) return;

      const current = new URL(globalThis.location.href);
      const next = new URL(destination, globalThis.location.href);
      if (current.href === next.href) return;

      event.preventDefault();
      setPendingHref(next.pathname + next.search + next.hash);
      setShowLeaveDialog(true);
    };

    globalThis.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      globalThis.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  const updateRole = (
    roleName: string,
    permission: PermissionKey,
    value: boolean,
  ) => (role: { role_name: string; permissions: Record<PermissionKey, boolean> }) => {
    if (role.role_name === roleName) {
      return { ...role, permissions: { ...role.permissions, [permission]: value } };
    }
    return role;
  };

  const handleToggle = (
    moduleId: string,
    roleName: string,
    permission: PermissionKey,
    value: boolean,
  ) => {
    setModules((current) => {
      const updated = current.map((module) => {
        if (module.module_id === moduleId) {
          return { ...module, roles: module.roles.map(updateRole(roleName, permission, value)) };
        }
        return module;
      });

      setIsDirty(JSON.stringify(updated) !== JSON.stringify(original));
      return updated;
    });
  };

  const handleReset = () => {
    setModules(structuredClone(original));
    setIsDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLifecyclePermissions(
        modules.map((module) => ({
          module_id: module.module_id,
          roles: module.roles,
        })),
      );
      const snapshot = structuredClone(modules);
      setOriginal(snapshot);
      setModules(snapshot);
      setIsDirty(false);
      toast.success("Role permissions saved successfully.");
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to save permissions.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveWithoutSaving = () => {
    if (!pendingHref) return;
    const destination = pendingHref;
    setShowLeaveDialog(false);
    setPendingHref(null);
    router.push(destination);
  };

  const handleSaveAndContinue = async () => {
    if (!pendingHref) return;
    const destination = pendingHref;
    const didSave = await handleSave();
    if (!didSave) return;
    setShowLeaveDialog(false);
    setPendingHref(null);
    router.push(destination);
  };

  return (
    <>
      <div className="max-w-7xl space-y-6">
        {/* Welcome card */}
        <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
          <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">System Administration</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">HRIS Role Settings</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/75">
                Configure lifecycle module access per role. Each toggle controls read, create, update, and delete permissions.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={handleReset}
                disabled={!isDirty || saving}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button
                className="gap-1.5 bg-white text-slate-900 hover:bg-white/90"
                onClick={handleSave}
                disabled={!isDirty || saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                HRIS Roles In Scope
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every unique HRIS role in <span className="font-mono">role</span> is included here, excluding Admin and System Admin.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Total Roles
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{roleNames.length}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {roleNames.map((roleName) => (
              <span
                key={roleName}
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground"
              >
                {roleName}
              </span>
            ))}
          </div>
        </section>

        {isDirty && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />{" "}
            <span>You have unsaved permission changes.</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Loading role settings...
          </div>
        ) : (
          <div className="space-y-5">
            {modules.map((module) => (
              <ModuleCard
                key={module.module_id}
                module={module}
                onToggle={(roleName, permission, value) =>
                  handleToggle(module.module_id, roleName, permission, value)
                }
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={showLeaveDialog}
        onOpenChange={(open) => {
          setShowLeaveDialog(open);
          if (!open) {
            setPendingHref(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in HRIS Role Settings. Save your changes before leaving this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Stay Here</AlertDialogCancel>
            <Button variant="outline" onClick={handleLeaveWithoutSaving} disabled={saving}>
              Leave Without Saving
            </Button>
            <Button onClick={handleSaveAndContinue} disabled={saving}>
              {saving ? "Saving..." : "Save and Continue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
