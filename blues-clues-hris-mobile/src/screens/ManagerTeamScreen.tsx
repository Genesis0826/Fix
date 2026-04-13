import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Modal,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type TeamMember = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id?: string;
  department?: string;
  account_status?: string;
  start_date?: string;
  employee_id?: string;
};

function getInitials(first?: string | null, last?: string | null): string {
  return [(first ?? "")[0], (last ?? "")[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getStatusStyle(status?: string) {
  switch (status?.toLowerCase()) {
    case "active": return { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" };
    case "pending": return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" };
    case "inactive": return { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
    case "locked": return { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" };
    default: return { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };
  }
}

const AVATAR_COLORS = [
  "#1E3A8A", "#0F766E", "#7C3AED", "#B45309", "#BE185D",
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (userId.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ManagerTeamScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Manager", email: "", role: "manager" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<TeamMember | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/users`);
      const data = await res.json().catch(() => []);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || name.includes(q) || m.email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || m.account_status?.toLowerCase() === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [members, search, statusFilter]);

  const statuses = ["all", "active", "pending", "inactive", "locked"];

  const activeCount = members.filter((m) => m.account_status?.toLowerCase() === "active").length;
  const pendingCount = members.filter((m) => m.account_status?.toLowerCase() === "pending").length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="manager"
            userName={session.name}
            email={session.email}
            activeScreen="Team"
            navigation={navigation}
          />
        )}
        <View style={styles.main}>
          {isMobile && (
            <MobileRoleMenu
              role="manager"
              userName={session.name}
              email={session.email}
              activeScreen="Team"
              navigation={navigation}
            />
          )}

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <GradientHero style={styles.hero}>
              <Text style={styles.heroEyebrow}>Manager Portal</Text>
              <Text style={styles.heroTitle}>Team Overview</Text>
              <Text style={styles.heroSub}>Manage and monitor your direct reports and team members.</Text>
            </GradientHero>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatBox label="Total" value={String(members.length)} />
              <StatBox label="Active" value={String(activeCount)} color="#166534" />
              <StatBox label="Pending" value={String(pendingCount)} color="#92400E" />
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or email..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            {/* Status filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {statuses.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                  onPress={() => setStatusFilter(s)}
                >
                  <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {loading && (
              <ActivityIndicator size="large" color="#1E3A8A" style={{ marginTop: 32 }} />
            )}
            {!loading && filtered.length === 0 && (
              <View style={styles.emptyCard}>
                <Feather name="users" size={32} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No team members found</Text>
                <Text style={styles.emptyText}>Try adjusting your search or filter.</Text>
              </View>
            )}
            {!loading && filtered.length > 0 && (
              filtered.map((member) => (
                <MemberCard
                  key={member.user_id}
                  member={member}
                  onPress={() => setSelected(member)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.bigAvatar, { backgroundColor: avatarColor(selected.user_id) }]}>
                    <Text style={styles.bigAvatarText}>
                      {getInitials(selected.first_name, selected.last_name)}
                    </Text>
                  </View>
                  <Pressable style={styles.closeBtn} onPress={() => setSelected(null)}>
                    <Ionicons name="close" size={20} color="#0F172A" />
                  </Pressable>
                </View>
                <Text style={styles.detailName}>
                  {[selected.first_name, selected.last_name].filter(Boolean).join(" ") || "—"}
                </Text>
                <Text style={styles.detailEmail}>{selected.email}</Text>

                {(() => {
                  const s = getStatusStyle(selected.account_status);
                  return (
                    <View style={[styles.detailBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
                      <Text style={[styles.detailBadgeText, { color: s.text }]}>
                        {selected.account_status ?? "Unknown"}
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.detailGrid}>
                  <DetailItem icon="credit-card" label="Employee ID" value={selected.employee_id ?? "—"} />
                  <DetailItem icon="briefcase" label="Department" value={selected.department ?? "—"} />
                  <DetailItem icon="calendar" label="Start Date" value={formatDate(selected.start_date)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color = "#0F172A" }: { readonly label: string; readonly value: string; readonly color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MemberCard({ member, onPress }: { readonly member: TeamMember; readonly onPress: () => void }) {
  const initials = getInitials(member.first_name, member.last_name);
  const color = avatarColor(member.user_id);
  const s = getStatusStyle(member.account_status);
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || "—";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{name}</Text>
          <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
          {!!member.department && (
            <Text style={styles.memberDept}>{member.department}</Text>
          )}
        </View>
        <View style={[styles.statusPill, { backgroundColor: s.bg, borderColor: s.border }]}>
          <Text style={[styles.statusText, { color: s.text }]}>
            {member.account_status ?? "—"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function DetailItem({ icon, label, value }: { readonly icon: any; readonly label: string; readonly value: string }) {
  return (
    <View style={styles.detailItem}>
      <Feather name={icon} size={13} color="#64748B" />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row" },
  main: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  hero: { borderRadius: 20, padding: 20 },
  heroEyebrow: {
    color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "800",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 6,
  },
  heroTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginBottom: 6 },
  heroSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 19 },

  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14,
    borderWidth: 1, borderColor: "#E2E8F0", padding: 12, alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#64748B", fontSize: 11, fontWeight: "700", marginTop: 2 },

  searchWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 14 },

  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FFFFFF",
  },
  filterChipActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  filterText: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#1E3A8A", fontWeight: "800" },

  emptyCard: {
    backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1,
    borderColor: "#E2E8F0", padding: 32, alignItems: "center", gap: 8,
  },
  emptyTitle: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  emptyText: { color: "#64748B", fontSize: 13, textAlign: "center" },

  card: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 16, padding: 14,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  memberName: { color: "#0F172A", fontSize: 15, fontWeight: "700" },
  memberEmail: { color: "#64748B", fontSize: 12, fontWeight: "500", marginTop: 2 },
  memberDept: { color: "#94A3B8", fontSize: 11, fontWeight: "600", marginTop: 2 },
  statusPill: {
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: "800" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  bigAvatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  bigAvatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  detailName: { color: "#0F172A", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  detailEmail: { color: "#64748B", fontSize: 14, fontWeight: "500", marginBottom: 12 },
  detailBadge: {
    alignSelf: "flex-start", borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  detailBadgeText: { fontSize: 12, fontWeight: "800" },
  detailGrid: { gap: 10 },
  detailItem: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#F8FAFC",
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0",
  },
  detailLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  detailValue: { color: "#0F172A", fontSize: 14, fontWeight: "700", marginTop: 2 },
});
