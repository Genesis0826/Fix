import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type AuditLog = {
  log_id: string;
  action: string;
  entity?: string;
  performed_by_name?: string;
  timestamp: string;
};

function timeAgo(ts: string): string {
  const date = new Date(ts.includes("Z") || ts.includes("+") ? ts : ts + "Z");
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type Stats = { total: number; active: number; pending: number; inactive: number };

export function SystemAdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Admin", email: "", role: "system_admin" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, auditRes] = await Promise.all([
          authFetch(`${API_BASE_URL}/users/stats`),
          authFetch(`${API_BASE_URL}/audit/logs?limit=5`),
        ]);
        const statsData = await statsRes.json().catch(() => ({}));
        const auditData = await auditRes.json().catch(() => []);
        if (!cancelled) {
          setStats(statsData);
          setAuditLogs(Array.isArray(auditData) ? auditData : (auditData?.logs ?? []));
        }
      } catch {
        // leave null — fall back to dashes
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const summaryCards = [
    { id: "1", label: "Total Users",         value: stats ? String(stats.total)    : "—", helper: "Across all departments"      },
    { id: "2", label: "Active Accounts",     value: stats ? String(stats.active)   : "—", helper: "Currently active staff"       },
    { id: "3", label: "Pending Activations", value: stats ? String(stats.pending)  : "—", helper: "Awaiting invite acceptance"   },
    { id: "4", label: "Inactive Accounts",   value: stats ? String(stats.inactive) : "—", helper: "Deactivated or not onboarded" },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="system_admin"
            userName={session.name}
            email={session.email}
            activeScreen="Dashboard"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="system_admin"
              userName={session.name}
              email={session.email}
              activeScreen="Dashboard"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero style={styles.heroCard}>
              <Text style={[styles.eyebrow, { color: "rgba(255,255,255,0.65)" }]}>System Admin</Text>
              <Text style={[styles.title, { color: "#FFFFFF" }]}>Admin Dashboard</Text>
              <Text style={[styles.subtitle, { color: "rgba(255,255,255,0.75)" }]}>
                Manage user access, invite links, audit logs, and subscription operations.
              </Text>
            </GradientHero>

            <View style={styles.summaryRow}>
              {loadingStats ? (
                <ActivityIndicator style={{ margin: 16 }} color="#2563EB" />
              ) : (
                summaryCards.map((card) => (
                  <View key={card.id} style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>{card.label}</Text>
                    <Text style={styles.summaryValue}>{card.value}</Text>
                    <Text style={styles.summaryHelper}>{card.helper}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Pressable
                  onPress={() => navigation.navigate("SystemAdminAuditLogs", { session })}
                >
                  <Text style={styles.sectionLink}>View All →</Text>
                </Pressable>
              </View>

              {auditLogs.length === 0 ? (
                <Text style={styles.activityEmpty}>
                  {loadingStats ? "Loading..." : "No recent activity."}
                </Text>
              ) : (
                auditLogs.map((log, index) => (
                  <View
                    key={log.log_id}
                    style={[
                      styles.activityRow,
                      index !== auditLogs.length - 1 && styles.activityDivider,
                    ]}
                  >
                    <View style={styles.activityDot} />
                    <View style={styles.activityTextWrap}>
                      <Text style={styles.activityTitle}>{log.action}</Text>
                      <Text style={styles.activitySubtitle}>
                        {[log.entity, log.performed_by_name].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text style={styles.activityTime}>{timeAgo(log.timestamp)}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              <View style={styles.quickActionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.quickActionCard, pressed && { opacity: 0.75 }]}
                  onPress={() => navigation.navigate("SystemAdminUsers", { session })}
                >
                  <Text style={styles.quickActionTitle}>Users →</Text>
                  <Text style={styles.quickActionText}>
                    Create accounts, assign roles, and review pending users.
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.quickActionCard, pressed && { opacity: 0.75 }]}
                  onPress={() => navigation.navigate("SystemAdminAuditLogs", { session })}
                >
                  <Text style={styles.quickActionTitle}>Audit Logs →</Text>
                  <Text style={styles.quickActionText}>
                    Review all system events and user activity history.
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.quickActionCard, pressed && { opacity: 0.75 }]}
                  onPress={() => navigation.navigate("SystemAdminBilling", { session })}
                >
                  <Text style={styles.quickActionTitle}>Billing →</Text>
                  <Text style={styles.quickActionText}>
                    Review plan details, seat usage, and subscription status.
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#64748B",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 10,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
    minWidth: "45%",
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  summaryHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionLink: {
    color: "#1E3A8A",
    fontSize: 13,
    fontWeight: "700",
  },
  activityEmpty: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 8,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
    marginTop: 6,
    marginRight: 12,
  },
  activityTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  activityTime: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 1,
  },
  quickActionsRow: {
    flexDirection: "column",
    gap: 10,
  },
  quickActionCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    minWidth: 220,
    flexGrow: 1,
    marginRight: 12,
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
});