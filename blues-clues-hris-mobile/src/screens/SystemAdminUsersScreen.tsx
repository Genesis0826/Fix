import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";
import { authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type UserItem = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  username: string;
  email: string;
  role: string;
  department: string;
  startDate: string;
  status: "Pending" | "Active" | "Locked" | "Inactive";
};

function mapStatus(raw: string): UserItem["status"] {
  switch (raw?.toLowerCase()) {
    case "active":   return "Active";
    case "pending":  return "Pending";
    case "locked":   return "Locked";
    default:         return "Inactive";
  }
}

const STATUS_STYLES: Record<UserItem["status"], { bg: string; border: string; text: string }> = {
  Active:   { bg: "#DCFCE7", border: "#BBF7D0", text: "#166534" },
  Pending:  { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  Locked:   { bg: "#FEE2E2", border: "#FECACA", text: "#B91C1C" },
  Inactive: { bg: "#E5E7EB", border: "#D1D5DB", text: "#374151" },
};

export function SystemAdminUsersScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Admin", email: "", role: "system_admin" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // userId being acted on

  const fetchUsers = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/users`);
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) {
        setAllUsers(
          data.map((u: any) => ({
            id: u.user_id ?? u.id ?? String(Math.random()),
            firstName: u.first_name ?? "",
            lastName: u.last_name ?? "",
            employeeId: u.employee_id ?? u.username ?? "—",
            username: u.username ?? "—",
            email: u.email ?? "",
            role: u.role_name ?? u.role ?? "—",
            department: u.department_name ?? u.department ?? "—",
            startDate: u.created_at
              ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—",
            status: mapStatus(u.status ?? u.account_status ?? "inactive"),
          })),
        );
      }
    } catch {
      // leave empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const users = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return allUsers;
    return allUsers.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(keyword) ||
        u.email.toLowerCase().includes(keyword) ||
        u.role.toLowerCase().includes(keyword) ||
        u.department.toLowerCase().includes(keyword) ||
        u.employeeId.toLowerCase().includes(keyword),
    );
  }, [search, allUsers]);

  async function executeLockToggle(user: UserItem, isLocked: boolean) {
    setActionLoading(user.id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ account_status: isLocked ? "active" : "locked" }),
      });
      if (res.ok) {
        const newStatus = isLocked ? "Active" : "Locked";
        setAllUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: newStatus } : u));
      } else {
        Alert.alert("Error", "Failed to update account status.");
      }
    } catch {
      Alert.alert("Error", "Network error. Try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLockToggle(user: UserItem) {
    const isLocked = user.status === "Locked";
    const action = isLocked ? "unlock" : "lock";
    Alert.alert(
      isLocked ? "Unlock Account" : "Lock Account",
      `Are you sure you want to ${action} ${user.firstName} ${user.lastName}'s account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isLocked ? "Unlock" : "Lock",
          style: isLocked ? "default" : "destructive",
          onPress: () => executeLockToggle(user, isLocked),
        },
      ],
    );
  }

  async function executeReactivate(user: UserItem) {
    setActionLoading(user.id);
    try {
      const res = await authFetch(`${API_BASE_URL}/users/${user.id}/reactivate`, {
        method: "PATCH",
      });
      if (res.ok) {
        setAllUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: "Active" } : u));
      } else {
        Alert.alert("Error", "Failed to reactivate account.");
      }
    } catch {
      Alert.alert("Error", "Network error. Try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate(user: UserItem) {
    Alert.alert(
      "Reactivate Account",
      `Reactivate ${user.firstName} ${user.lastName}'s account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reactivate",
          onPress: () => executeReactivate(user),
        },
      ],
    );
  }

  async function handleResendInvite(user: UserItem) {
    Alert.alert(
      "Resend Invite",
      `Resend activation email to ${user.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setActionLoading(user.id);
            try {
              const res = await authFetch(`${API_BASE_URL}/users/${user.id}/resend-invite`, {
                method: "PATCH",
              });
              if (res.ok) {
                Alert.alert("Sent", `Invite email sent to ${user.email}.`);
              } else {
                const data = await res.json().catch(() => ({}));
                Alert.alert("Error", data?.message || "Failed to resend invite.");
              }
            } catch {
              Alert.alert("Error", "Network error. Try again.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar role="system_admin" userName={session.name} email={session.email} activeScreen="Users" navigation={navigation} />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu role="system_admin" userName={session.name} email={session.email} activeScreen="Users" navigation={navigation} />
          )}

          <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <GradientHero style={styles.heroCard}>
              <Text style={[styles.eyebrow, { color: "rgba(255,255,255,0.75)" }]}>System Admin</Text>
              <Text style={[styles.title, { color: "#FFFFFF" }]}>User Management</Text>
              <Text style={[styles.subtitle, { color: "rgba(255,255,255,0.78)" }]}>
                Create accounts, assign HR module access, manage invite links, and control activation status.
              </Text>
            </GradientHero>

            {/* Users Table */}
            <View style={styles.tableCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <Text style={styles.sectionTitle}>Users</Text>
                <Pressable
                  style={{ backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                  onPress={() => { setLoading(true); fetchUsers(); }}
                >
                  <Text style={{ color: "#1D4ED8", fontSize: 12, fontWeight: "700" }}>↻ Refresh</Text>
                </Pressable>
              </View>

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#64748B" style={styles.searchIcon} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name, email, role..."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
              </View>

              {loading && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <ActivityIndicator color="#2563EB" />
                  <Text style={{ color: "#94A3B8", marginTop: 10, fontSize: 13 }}>Loading users...</Text>
                </View>
              )}
              {!loading && users.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                    {allUsers.length === 0 ? "No users found." : "No results for your search."}
                  </Text>
                </View>
              )}

              {!loading &&
                users.map((user) => {
                  const ss = STATUS_STYLES[user.status];
                  const isActing = actionLoading === user.id;
                  return (
                    <View key={user.id} style={styles.userCard}>
                      <View style={styles.userTop}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                          <Text style={{ color: "#1D4ED8", fontWeight: "800", fontSize: 15 }}>
                            {(user.firstName.charAt(0) || user.email.charAt(0)).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
                          <Text style={styles.userMeta}>{user.role} · {user.department}</Text>
                          <Text style={[styles.userMeta, { color: "#94A3B8" }]}>{user.email}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <View style={{ backgroundColor: ss.bg, borderColor: ss.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <Text style={{ color: ss.text, fontSize: 11, fontWeight: "800" }}>{user.status}</Text>
                          </View>
                          <Text style={{ color: "#94A3B8", fontSize: 10, marginTop: 4 }}>{user.startDate}</Text>
                        </View>
                      </View>

                      {isActing ? (
                        <ActivityIndicator color="#2563EB" style={{ marginTop: 8 }} />
                      ) : (
                        <View style={styles.userBottom}>
                          {(user.status === "Active" || user.status === "Locked") && (
                            <Pressable
                              style={[styles.smallButton, user.status === "Locked" && { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" }]}
                              onPress={() => handleLockToggle(user)}
                            >
                              <Text style={[styles.smallButtonText, user.status === "Locked" && { color: "#166534" }]}>
                                {user.status === "Locked" ? "Unlock" : "Lock"}
                              </Text>
                            </Pressable>
                          )}
                          {(user.status === "Inactive" || user.status === "Locked") && (
                            <Pressable style={styles.smallButton} onPress={() => handleReactivate(user)}>
                              <Text style={styles.smallButtonText}>Reactivate</Text>
                            </Pressable>
                          )}
                          {user.status === "Pending" && (
                            <Pressable style={styles.smallButton} onPress={() => handleResendInvite(user)}>
                              <Text style={styles.smallButtonText}>Resend Invite</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}

              {!loading && (
                <View style={{ paddingTop: 8 }}>
                  <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 }}>
                    Showing {users.length} of {allUsers.length} users
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default SystemAdminUsersScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  layout: { flex: 1, flexDirection: "row", backgroundColor: "#F1F5F9" },
  mainContent: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  content: { padding: 16, paddingBottom: 28 },
  heroCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 20, padding: 20, marginBottom: 16,
  },
  eyebrow: { fontSize: 12, fontWeight: "800", color: "#2563EB", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 22, color: "#64748B" },
  tableCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 20, padding: 18,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  searchBox: {
    height: 46, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 14,
    backgroundColor: "#F8FAFC", flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, marginBottom: 14,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#0F172A", fontSize: 14 },
  userCard: {
    borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, padding: 14,
    backgroundColor: "#FFFFFF", marginBottom: 12,
  },
  userTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  userInfo: { flex: 1, paddingRight: 8 },
  userName: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 3 },
  userMeta: { fontSize: 12, lineHeight: 18, color: "#64748B" },
  userBottom: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  smallButton: {
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginRight: 8, marginBottom: 6,
  },
  smallButtonText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
});
