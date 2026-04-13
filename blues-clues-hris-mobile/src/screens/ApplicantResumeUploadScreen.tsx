import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

// Requires: expo install expo-document-picker
import * as DocumentPicker from "expo-document-picker";

type ResumeInfo = {
  resume_url: string | null;
  resume_name: string | null;
  resume_uploaded_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const ApplicantResumeUploadScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params?.session ?? {
    name: "Applicant",
    email: "",
    role: "applicant",
  };

  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [resume, setResume] = useState<ResumeInfo>({
    resume_url: null,
    resume_name: null,
    resume_uploaded_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE_URL}/applicants/me`)
      .then(res => res.json())
      .then(data => {
        setResume({
          resume_url: data.resume_url ?? null,
          resume_name: data.resume_name ?? null,
          resume_uploaded_at: data.resume_uploaded_at ?? null,
        });
      })
      .catch(() => {
        /* silently ignore — show empty state */
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const formData = new FormData();
      formData.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as any);
      const res = await authFetch(`${API_BASE_URL}/applicants/me/resume`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Upload failed", (err as any)?.message || "Please try again.");
        return;
      }
      const data = await res.json();
      setResume({
        resume_url: data.resume_url,
        resume_name: data.resume_name,
        resume_uploaded_at: data.resume_uploaded_at,
      });
    } catch {
      Alert.alert("Error", "Could not pick a file. Please try again.");
    }
  };

  const handleViewResume = () => {
    if (resume.resume_url) {
      Linking.openURL(resume.resume_url).catch(() =>
        Alert.alert("Error", "Could not open the resume link."),
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove Resume",
      "Are you sure you want to remove your resume?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await authFetch(`${API_BASE_URL}/applicants/me/resume`, { method: "DELETE" });
              setResume({ resume_url: null, resume_name: null, resume_uploaded_at: null });
            } catch {
              Alert.alert("Error", "Failed to remove resume. Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const hasResume = !!resume.resume_url;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar
            role="applicant"
            activeScreen="ApplicantResumeUpload"
            navigation={navigation}
            session={session}
          />
        )}
        <View style={styles.content}>
          <Header
            title="My Resume"
            subtitle="Upload and manage your resume"
            rightElement={
              <MobileRoleMenu
                role={session.role as any}
                userName={session.name}
                email={session.email}
                activeScreen="ApplicantResumeUpload"
                navigation={navigation}
              />
            }
          />

          <GradientHero
            title={`Resume, ${session.name.split(" ")[0]}`}
            subtitle="Keep your resume updated so employers can find you."
          />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading resume info...</Text>
              </View>
            ) : (
              <>
                {/* Status Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Resume Status</Text>

                  {hasResume ? (
                    <>
                      <View style={styles.fileRow}>
                        <View style={styles.fileIcon}>
                          <Text style={styles.fileIconText}>📄</Text>
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={2}>
                            {resume.resume_name}
                          </Text>
                          <Text style={styles.fileDate}>
                            Uploaded {formatDate(resume.resume_uploaded_at)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pillRow}>
                        <View style={styles.pillActive}>
                          <Text style={styles.pillActiveText}>Resume on file</Text>
                        </View>
                      </View>

                      <View style={styles.actionRow}>
                        <Pressable style={styles.viewBtn} onPress={handleViewResume}>
                          <Text style={styles.viewBtnText}>View Resume</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.deleteBtn, deleting && styles.disabledBtn]}
                          onPress={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? (
                            <ActivityIndicator size="small" color="#B91C1C" />
                          ) : (
                            <Text style={styles.deleteBtnText}>Remove</Text>
                          )}
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.emptyResume}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyTitle}>No resume uploaded yet</Text>
                        <Text style={styles.emptyText}>
                          Upload your resume so employers can review your qualifications when you apply.
                        </Text>
                      </View>

                      <View style={styles.pillRow}>
                        <View style={styles.pillPending}>
                          <Text style={styles.pillPendingText}>No File Selected</Text>
                        </View>
                      </View>
                    </>
                  )}

                  <View style={styles.divider} />

                  <Text style={styles.helperTitle}>Accepted formats</Text>
                  <Text style={styles.helperText}>PDF (recommended), DOC, DOCX — max 5 MB</Text>

                  <Pressable style={styles.primaryButton} onPress={handleChooseFile}>
                    <Text style={styles.primaryButtonText}>
                      {hasResume ? "Replace Resume" : "Choose Resume File"}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.backButton}
                  onPress={() => navigation.replace("ApplicantDashboard", { session })}
                >
                  <Text style={styles.backButtonText}>Back to Dashboard</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 28 },
  centered: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: "#0F172A", fontSize: 17, fontWeight: "800", marginBottom: 12 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  fileIcon: {
    width: 48,
    height: 48,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fileIconText: { fontSize: 22 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  fileDate: { fontSize: 12, color: "#64748B", marginTop: 2 },
  pillRow: { marginBottom: 14 },
  pillActive: {
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillActiveText: { color: "#15803D", fontSize: 12, fontWeight: "800" },
  pillPending: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillPendingText: { color: "#C2410C", fontSize: 12, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  viewBtn: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  viewBtnText: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  deleteBtnText: { color: "#B91C1C", fontSize: 14, fontWeight: "700" },
  disabledBtn: { opacity: 0.5 },
  emptyResume: { alignItems: "center", paddingVertical: 16, marginBottom: 8 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginBottom: 6 },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 19 },
  divider: { height: 1, backgroundColor: "#EEF2F7", marginVertical: 14 },
  helperTitle: { fontSize: 13, fontWeight: "800", color: "#334155", marginBottom: 4 },
  helperText: { fontSize: 13, color: "#64748B", lineHeight: 19, marginBottom: 14 },
  primaryButton: {
    backgroundColor: "#1D4ED8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  backButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DBE4F0",
    paddingVertical: 14,
    alignItems: "center",
  },
  backButtonText: { color: "#1D4ED8", fontSize: 14, fontWeight: "800" },
});
