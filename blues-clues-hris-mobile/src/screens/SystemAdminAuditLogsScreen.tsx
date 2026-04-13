import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// Matches actual admin_audit_logs table schema
type AuditLog = {
  log_id: string;
  action: string;
  performed_by: string;
  target_user_id: string | null;
  timestamp: string;
};

const ACTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CREATE: { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" },
  UPDATE: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  DELETE: { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" },
  LOGIN:  { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" },
  LOGOUT: { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" },
  RESEND: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  STATUS_CHANGE: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
};

function getActionStyle(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) =>
    action?.toUpperCase().includes(k)
  );
  return key ? ACTION_COLORS[key] : { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function timeAgo(ts: string): string {
  const date = new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function SystemAdminAuditLogsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Admin", email: "", role: "system_admin" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const ACTION_FILTERS = ["ALL", "LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "RESEND"];

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/audit/logs?limit=200`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.message ?? `Server error ${res.status}`;
        setApiError(typeof msg === "string" ? msg : JSON.stringify(msg));
        setLogs([]);
        return;
      }
      const rows: AuditLog[] = Array.isArray(data) ? data : (data?.logs ?? []);
      setLogs(rows);
    } catch (e: any) {
      setApiError(e?.message ?? "Network error");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = logs.filter((log) => {
    if (actionFilter !== "ALL" && !log.action?.toUpperCase().includes(actionFilter)) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      log.action?.toLowerCase().includes(q) ||
      log.performed_by?.toLowerCase().includes(q) ||
      log.target_user_id?.toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role={session.role}
            userName={session.name}
            email={session.email}
            activeScreen="AuditLogs"
            navigation={navigation}
          />
        )}

        <View style={styles.main}>
          {isMobile && (
            <MobileRoleMenu
              role={session.role}
              userName={session.name}
              email={session.email}
              activeScreen="AuditLogs"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <GradientHero style={styles.hero}>
              <Text style={styles.heroEyebrow}>System Admin</Text>
              <Text style={styles.heroTitle}>Audit Logs</Text>
              <Text style={styles.heroSub}>
                Track all system activity, user actions, and configuration changes.
              </Text>
            </GradientHero>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{logs.length}</Text>
                <Text style={styles.statLabel}>Total Events</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: "#166534" }]}>
                  {logs.filter((l) => l.action?.toUpperCase().includes("LOGIN")).length}
                </Text>
                <Text style={styles.statLabel}>Logins</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: "#1D4ED8" }]}>
                  {logs.filter((l) => l.action?.toUpperCase().includes("UPDATE") || l.action?.toUpperCase().includes("CREATE")).length}
                </Text>
                <Text style={styles.statLabel}>Changes</Text>
              </View>
            </View>

            {/* Action Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {ACTION_FILTERS.map((f) => {
                const active = actionFilter === f;
                const s = f === "ALL" ? null : getActionStyle(f);
                const chipStyleFallback = active ? styles.filterChipActiveDefault : undefined;
                const chipStyle = (active && s)
                  ? { backgroundColor: s.bg, borderColor: s.border }
                  : chipStyleFallback;
                const textStyleFallback = active ? styles.filterChipTextActiveDefault : undefined;
                const textStyle = (active && s)
                  ? { color: s.text }
                  : textStyleFallback;
                return (
                  <Pressable
                    key={f}
                    onPress={() => { setActionFilter(f); setPage(1); }}
                    style={[styles.filterChip, chipStyle]}
                  >
                    <Text style={[styles.filterChipText, textStyle]}>
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Search + Refresh */}
            <View style={styles.toolBar}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  value={search}
                  onChangeText={(t) => { setSearch(t); setPage(1); }}
                  placeholder="Search action, entity, user..."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
              <Pressable style={styles.refreshBtn} onPress={loadLogs} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#1E3A8A" />
                ) : (
                  <Feather name="refresh-cw" size={16} color="#1E3A8A" />
                )}
              </Pressable>
            </View>

            {/* Logs */}
            {loading && logs.length === 0 && (
              <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 32 }} />
            )}
            {!loading && !!apiError && (
              <View style={styles.errorCard}>
                <Feather name="alert-triangle" size={28} color="#DC2626" />
                <Text style={styles.errorTitle}>Failed to load audit logs</Text>
                <Text style={styles.errorText}>{apiError}</Text>
                <Pressable style={styles.retryBtn} onPress={loadLogs}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            )}
            {!loading && !apiError && filtered.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="file-text" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No audit logs found</Text>
                <Text style={styles.emptyText}>
                  {search ? "Try a different search term." : "No system events have been recorded yet."}
                </Text>
              </View>
            )}
            {!loading && !apiError && filtered.length > 0 && (
              <>
                <Text style={styles.resultCount}>
                  Showing {paginated.length} of {filtered.length} events
                </Text>
                {paginated.map((log) => (
                  <AuditLogCard key={log.log_id} log={log} />
                ))}
                {hasMore && (
                  <Pressable style={styles.loadMoreBtn} onPress={() => setPage((p) => p + 1)}>
                    <Text style={styles.loadMoreText}>Load More</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuditLogCard({ log }: { readonly log: AuditLog }) {
  const s = getActionStyle(log.action);
  const shortId = log.log_id ? log.log_id.slice(0, 8).toUpperCase() : "—";
  return (
    <View style={styles.logCard}>
      <View style={styles.logTop}>
        <View style={[styles.actionBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
          <Text style={[styles.actionText, { color: s.text }]}>{log.action}</Text>
        </View>
        <Text style={styles.timeAgo}>{timeAgo(log.timestamp)}</Text>
      </View>

      <View style={styles.logMeta}>
        {!!log.performed_by && (
          <View style={styles.metaRow}>
            <Feather name="user" size={12} color="#94A3B8" />
            <Text style={styles.metaText}>By: {log.performed_by.slice(0, 8)}…</Text>
          </View>
        )}
        {!!log.target_user_id && (
          <View style={styles.metaRow}>
            <Feather name="target" size={12} color="#94A3B8" />
            <Text style={styles.metaText}>Target: {log.target_user_id.slice(0, 8)}…</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Feather name="hash" size={12} color="#94A3B8" />
          <Text style={styles.metaText}>#{shortId}</Text>
        </View>
      </View>

      <Text style={styles.timestamp}>{formatTimestamp(log.timestamp)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  // Hero
  hero: {
    borderRadius: 20,
    padding: 20,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 19 },

  // Stats
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    alignItems: "center",
  },
  statValue: { color: "#0F172A", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#64748B", fontSize: 11, fontWeight: "700", marginTop: 2 },

  // Filter chips
  filterRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  filterChip: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
  },
  filterChipActiveDefault: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  filterChipText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterChipTextActiveDefault: {
    color: "#1E3A8A",
  },

  // Toolbar
  toolBar: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 14 },
  refreshBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // Result count
  resultCount: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },

  // Error
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  errorTitle: { color: "#991B1B", fontSize: 15, fontWeight: "800" },
  errorText: { color: "#DC2626", fontSize: 12, textAlign: "center", lineHeight: 18 },
  retryBtn: {
    marginTop: 4,
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  // Empty
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  emptyText: { color: "#64748B", fontSize: 13, textAlign: "center" },

  // Log card
  logCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  logTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  timeAgo: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },

  logMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: "#64748B", fontSize: 12, fontWeight: "600" },

  details: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timestamp: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },

  // Load more
  loadMoreBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  loadMoreText: { color: "#1E3A8A", fontSize: 14, fontWeight: "700" },
});
