import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { login, saveSession } from "../services/auth";

export const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.length > 0 && !loading,
    [email, password, loading],
  );

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const res = await login(email.trim(), password, rememberMe);
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    if (res.user.role === "applicant") {
      setError("Applicants must sign in via the Applicant Portal.");
      return;
    }

    saveSession(res.user, rememberMe);

    switch (res.user.role) {
      case "employee":     navigation.replace("EmployeeDashboard",    { session: res.user }); break;
      case "hr":           navigation.replace("HROfficerDashboard",   { session: res.user }); break;
      case "manager":      navigation.replace("ManagerDashboard",     { session: res.user }); break;
      case "system_admin":
      case "admin":        navigation.replace("SystemAdminDashboard", { session: res.user }); break;
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Header Banner */}
        <LinearGradient
          colors={["#0f172a", "#172554", "#134e4a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          {/* Decorative circles */}
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          <View style={styles.bannerContent}>
            <View style={styles.logoWrap}>
              <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName}>Blue's Clues HRIS</Text>
              <Text style={styles.brandSub}>INTERNAL STAFF PORTAL</Text>
            </View>
          </View>

          <Text style={styles.bannerTitle}>
            Your workspace,{"\n"}
            <Text style={styles.bannerAccent}>always accessible.</Text>
          </Text>
          <Text style={styles.bannerDesc}>
            Timekeeping, HR tools, and team management — everything in one secure platform.
          </Text>
        </LinearGradient>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSub}>Enter your credentials to access the portal</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email / Username</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Enter email or username"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                style={[styles.input, styles.passwordInput]}
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748B"
                />
              </Pressable>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.row}>
            <Pressable style={styles.checkRow} onPress={() => setRememberMe(v => !v)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Remember Me</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Sign In →</Text>
            )}
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.outlineBtn}
            onPress={() => navigation.navigate("SignUp")}
          >
            <Text style={styles.outlineBtnText}>Go to Applicant Portal →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { flexGrow: 1 },

  // Banner
  banner: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
    overflow: "hidden",
    position: "relative",
  },
  circleTopRight: {
    position: "absolute", top: -60, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  circleBottomLeft: {
    position: "absolute", bottom: -40, left: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  bannerContent: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  logoWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  brandTextWrap: {},
  brandName: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  brandSub:  { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginTop: 1 },
  bannerTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 34, marginBottom: 8 },
  bannerAccent: { color: "#34D399" },
  bannerDesc: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 19 },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
  },
  cardTitle: { color: "#0F172A", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  cardSub:   { color: "#64748B", fontSize: 13, marginBottom: 20 },

  field:  { marginBottom: 14 },
  label:  { color: "#475569", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC",
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 46 },
  eyeBtn: { position: "absolute", right: 14, top: 12 },

  errorBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "600", flex: 1 },

  row:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  checkRow:   { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    borderColor: "#CBD5E1", backgroundColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  checkMark:    { color: "#fff", fontSize: 11, fontWeight: "800" },
  rememberText: { color: "#475569", fontSize: 13, marginLeft: 8 },
  forgotText:   { color: "#1e3a8a", fontSize: 13, fontWeight: "700" },

  submitBtn: {
    borderRadius: 12, paddingVertical: 14,
    backgroundColor: "#1e3a8a",
    alignItems: "center", flexDirection: "row", justifyContent: "center",
  },
  submitBtnDisabled: { backgroundColor: "#93A8CC" },
  submitBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 16 },

  outlineBtn: {
    borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12,
    paddingVertical: 13, alignItems: "center",
  },
  outlineBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },
});
