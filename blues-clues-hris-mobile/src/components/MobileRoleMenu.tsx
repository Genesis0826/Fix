import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import { clearSession, UserRole } from "../services/auth";
import { MENU_CONFIG, ROLE_LABELS } from "../constants/config";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 320);

type Props = {
  readonly role: UserRole;
  readonly userName: string;
  readonly email?: string;
  readonly activeScreen: string;
  readonly navigation: any;
};

export function MobileRoleMenu({
  role,
  userName,
  email = "",
  activeScreen,
  navigation,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const session = { name: userName, role, email };

  const openDrawer = () => {
    slideAnim.setValue(DRAWER_WIDTH);
    backdropAnim.setValue(0);
    setVisible(true);
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    }, 8);
  };

  const closeDrawer = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      callback?.();
    });
  };

  const SCREEN_MAP: Partial<Record<UserRole, Record<string, string>>> = {
    system_admin: { Dashboard: "SystemAdminDashboard", Users: "SystemAdminUsers", Billing: "SystemAdminBilling", AuditLogs: "SystemAdminAuditLogs" },
    admin:        { Dashboard: "SystemAdminDashboard", Users: "SystemAdminUsers", Billing: "SystemAdminBilling", AuditLogs: "SystemAdminAuditLogs" },
    manager:      { Dashboard: "ManagerDashboard", Timekeeping: "ManagerTimekeeping", Team: "ManagerTeam" },
    hr:           { Dashboard: "HROfficerDashboard", Timekeeping: "HROfficerTimekeeping", Recruitment: "HROfficerRecruitment" },
    employee:     { Dashboard: "EmployeeDashboard", Timekeeping: "EmployeeTimekeeping" },
    applicant:    { Dashboard: "ApplicantDashboard", Jobs: "ApplicantJobs", Applications: "ApplicantApplications", Resume: "ApplicantResumeUpload" },
  };

  const switchTo = (target: string) => {
    closeDrawer(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: target, params: { session } }],
        })
      );
    });
  };

  const goToScreen = (screenName: string) => {
    if (screenName === activeScreen) {
      closeDrawer();
      return;
    }
    const target = SCREEN_MAP[role]?.[screenName];
    if (target) {
      switchTo(target);
      return;
    }
    closeDrawer();
  };

  async function confirmLogout() {
    await clearSession();
    setShowLogout(false);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  const renderIcon = (name: string, isActive: boolean) => {
    const color = isActive ? "#FFFFFF" : "#64748B";
    switch (name) {
      case "Dashboard":
        return <MaterialCommunityIcons name="view-grid-outline" size={18} color={color} />;
      case "Users":
        return <Feather name="users" size={17} color={color} />;
      case "Billing":
        return <Ionicons name="card-outline" size={17} color={color} />;
      case "Timekeeping":
        return <MaterialCommunityIcons name="clock-time-four-outline" size={18} color={color} />;
      case "Jobs":
        return <Feather name="briefcase" size={17} color={color} />;
      case "Applications":
      case "Documents":
        return <Ionicons name="document-text-outline" size={17} color={color} />;
      case "Recruitment":
      case "Team":
        return <Feather name="users" size={17} color={color} />;
      case "AuditLogs":
        return <Ionicons name="shield-checkmark-outline" size={17} color={color} />;
      case "Onboarding":
        return <Ionicons name="clipboard-outline" size={17} color={color} />;
      case "Compensation":
        return <Ionicons name="wallet-outline" size={17} color={color} />;
      case "Performance":
        return <Ionicons name="bar-chart-outline" size={17} color={color} />;
      case "Approvals":
        return <Ionicons name="checkmark-done-outline" size={17} color={color} />;
      case "Profile":
        return <Ionicons name="person-outline" size={17} color={color} />;
      default:
        return <Feather name="circle" size={16} color={color} />;
    }
  };

  const menu = MENU_CONFIG[role] ?? [];
  const activeItem = menu.find((item) => item.name === activeScreen)?.label || "Menu";
  const initials = userName
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.portalLabel}>{ROLE_LABELS[role] ?? "Portal"}</Text>
          <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
        </View>
        <Pressable style={styles.menuButton} onPress={openDrawer}>
          <Ionicons name="menu" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.activeBar}>
        <Text style={styles.activeBarText}>{activeItem}</Text>
      </View>

      {/* ── Side Drawer ────────────────────────────────────────────────────── */}
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <View style={styles.drawerContainer} pointerEvents="box-none">
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={() => closeDrawer()}>
            <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
          </TouchableWithoutFeedback>

          {/* Sliding panel */}
          <Animated.View
            style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
          >
            {/* Drawer header — blue section */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHeaderRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.drawerHeaderInfo}>
                  <Text style={styles.drawerName} numberOfLines={1}>{userName}</Text>
                  <Text style={styles.drawerRoleLabel}>{ROLE_LABELS[role] ?? "Portal"}</Text>
                  {email ? (
                    <Text style={styles.drawerEmail} numberOfLines={1}>{email}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable style={styles.drawerCloseBtn} onPress={() => closeDrawer()}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>

            {/* Menu items */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.menuList}
              bounces={false}
            >
              <Text style={styles.sectionLabel}>Navigation</Text>

              {menu.map((item) => {
                const isActive = item.name === activeScreen;
                return (
                  <Pressable
                    key={item.name}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => goToScreen(item.name)}
                    android_ripple={{ color: "rgba(30,58,138,0.08)" }}
                  >
                    <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                      {renderIcon(item.name, isActive)}
                    </View>
                    <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <View style={styles.activeIndicator} />
                    )}
                  </Pressable>
                );
              })}

              <View style={styles.divider} />

              <Pressable
                style={styles.logoutRow}
                onPress={() => closeDrawer(() => setShowLogout(true))}
                android_ripple={{ color: "rgba(220,38,38,0.08)" }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                </View>
                <Text style={styles.logoutText}>Sign Out</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Logout confirmation modal ──────────────────────────────────────── */}
      <Modal transparent visible={showLogout} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTop}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="log-out-outline" size={24} color="#DC2626" />
              </View>
              <View style={styles.modalTextWrap}>
                <Text style={styles.modalTitle}>Sign Out?</Text>
                <Text style={styles.modalDesc}>
                  Your session will end immediately. Any unsaved progress will be lost.
                </Text>
              </View>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowLogout(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.logoutBtn} onPress={confirmLogout}>
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Top header ──────────────────────────────────────────────────────────
  header: {
    backgroundColor: "#1e3a8a",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  portalLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  activeBarText: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Drawer ──────────────────────────────────────────────────────────────
  drawerContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  drawer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },

  // Drawer header (blue)
  drawerHeader: {
    backgroundColor: "#1e3a8a",
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 18,
  },
  drawerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  drawerHeaderInfo: {
    flex: 1,
  },
  drawerName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  drawerRoleLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  drawerEmail: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "500",
  },
  drawerCloseBtn: {
    position: "absolute",
    top: 52,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Menu items
  menuList: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 20,
  },
  sectionLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 2,
  },
  menuItem: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: "#EFF6FF",
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconWrapActive: {
    backgroundColor: "#1e3a8a",
  },
  menuText: {
    flex: 1,
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  menuTextActive: {
    color: "#1e3a8a",
    fontWeight: "800",
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1e3a8a",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
    marginHorizontal: 4,
  },
  logoutRow: {
    minHeight: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Logout modal ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  modalTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  modalTextWrap: {
    flex: 1,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  modalDesc: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 22,
    gap: 10,
  },
  cancelBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
  },
  cancelBtnText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  logoutBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
