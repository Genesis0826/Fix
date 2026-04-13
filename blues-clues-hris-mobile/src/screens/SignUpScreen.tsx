import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { applicantLogin, applicantRegister, saveSession } from "../services/auth";
import { isValidEmail } from "../lib/utils";

type Mode = "signin" | "signup";

export const SignUpScreen = ({ navigation }: any) => {
  const [mode, setMode]       = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);

  // Sign-in fields
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign-up fields
  const [fullName, setFullName] = useState("");
  const [email2, setEmail2]     = useState("");
  const [pw1, setPw1]           = useState("");
  const [pw2, setPw2]           = useState("");

  const canSignIn = useMemo(
    () => isValidEmail(email) && password.length > 0 && !loading,
    [email, password, loading],
  );

  const canSignUp = useMemo(
    () =>
      fullName.trim().length > 0 &&
      isValidEmail(email2) &&
      pw1.length >= 6 &&
      pw2.length > 0 &&
      pw1 === pw2 &&
      !loading,
    [fullName, email2, pw1, pw2, loading],
  );

  async function onSignIn() {
    setLoading(true);
    const res = await applicantLogin(email.trim(), password, rememberMe);
    setLoading(false);
    if (!res.ok) { Alert.alert("Sign In Failed", res.error); return; }
    saveSession(res.user, rememberMe);
    navigation.replace("ApplicantDashboard", { session: res.user });
  }

  async function onCreateAccount() {
    setLoading(true);
    const regRes = await applicantRegister(fullName.trim(), email2.trim(), pw1);
    if (!regRes.ok) { setLoading(false); Alert.alert("Registration Failed", regRes.error); return; }
    const loginRes = await applicantLogin(email2.trim(), pw1, rememberMe);
    setLoading(false);
    if (!loginRes.ok) {
      Alert.alert(
        "Account Created",
        "Your account was created. Please verify your email then sign in.",
        [{ text: "OK", onPress: () => { setMode("signin"); setEmail(email2.trim()); } }],
      );
      return;
    }
    saveSession(loginRes.user, rememberMe);
    navigation.replace("ApplicantDashboard", { session: loginRes.user });
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
        {/* Gradient Banner */}
        <LinearGradient
          colors={["#0f172a", "#172554", "#134e4a"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.circleTopRight} />
          <View style={styles.circleBottomLeft} />

          <View style={styles.bannerContent}>
            <View style={styles.logoWrap}>
              <Ionicons name="briefcase-outline" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.brandName}>Blue's Clues HRIS</Text>
              <Text style={styles.brandSub}>APPLICANT PORTAL</Text>
            </View>
          </View>

          <Text style={styles.bannerTitle}>
            Start your career{"\n"}
            <Text style={styles.bannerAccent}>journey here.</Text>
          </Text>
          <Text style={styles.bannerDesc}>
            Browse open positions, submit applications, and track your hiring progress.
          </Text>
        </LinearGradient>

        {/* Card */}
        <View style={styles.card}>
          {/* Tab switcher */}
          <View style={styles.tabs}>
            {(["signin", "signup"] as Mode[]).map((m) => (
              <Pressable
                key={m}
                style={[styles.tab, mode === m && styles.tabActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === "signin" ? "Sign In" : "Create Account"}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "signin" ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
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
                    secureTextEntry={!showPw}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    style={[styles.input, styles.passwordInput]}
                  />
                  <Pressable style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
                    <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.row}>
                <Pressable style={styles.checkRow} onPress={() => setRememberMe(v => !v)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.submitBtn, !canSignIn && styles.submitBtnDisabled]}
                disabled={!canSignIn}
                onPress={onSignIn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Sign In →</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Juan dela Cruz"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  value={email2}
                  onChangeText={setEmail2}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={pw1}
                  onChangeText={setPw1}
                  secureTextEntry
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  value={pw2}
                  onChangeText={setPw2}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  style={[styles.input, pw1 && pw2 && pw1 !== pw2 ? styles.inputError : undefined]}
                />
                {pw1 && pw2 && pw1 !== pw2 && (
                  <Text style={styles.fieldError}>Passwords do not match.</Text>
                )}
              </View>

              <Pressable
                style={[styles.submitBtn, !canSignUp && styles.submitBtnDisabled]}
                disabled={!canSignUp}
                onPress={onCreateAccount}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Account →</Text>
                )}
              </Pressable>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>
                  After registration, check your email to verify your account before signing in.
                </Text>
              </View>
            </>
          )}
        </View>

        <Pressable style={styles.backLink} onPress={() => navigation.replace("Login")}>
          <Ionicons name="arrow-back" size={14} color="#64748B" />
          <Text style={styles.backLinkText}>Return to Employee Portal</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#F1F5F9" },
  scroll: { flexGrow: 1 },

  banner: {
    paddingHorizontal: 24,
    paddingTop: 52,
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
  bannerContent: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  logoWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  brandName: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  brandSub:  { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginTop: 1 },
  bannerTitle:  { color: "#FFFFFF", fontSize: 24, fontWeight: "800", lineHeight: 32, marginBottom: 8 },
  bannerAccent: { color: "#34D399" },
  bannerDesc:   { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 19 },

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
    marginBottom: 20,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1, borderRadius: 10, paddingVertical: 10,
    backgroundColor: "transparent", alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  tabText:       { color: "#64748B", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#0F172A" },

  field:  { marginBottom: 14 },
  label:  { color: "#475569", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#CBD5E1", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC",
  },
  inputError:  { borderColor: "#F87171" },
  fieldError:  { color: "#DC2626", fontSize: 12, marginTop: 4 },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 46 },
  eyeBtn: { position: "absolute", right: 14, top: 12 },

  row:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
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
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: "#93A8CC" },
  submitBtnText:     { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    borderRadius: 12, padding: 14, marginTop: 14,
  },
  infoText: { color: "#1D4ED8", fontSize: 12, lineHeight: 18, flex: 1 },

  backLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, gap: 6,
  },
  backLinkText: { color: "#64748B", fontSize: 13, fontWeight: "700" },
});
