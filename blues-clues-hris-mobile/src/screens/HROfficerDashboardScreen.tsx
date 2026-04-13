import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { MetricCard } from "../components/MetricCard";
import { Colors } from "../constants/colors";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type Employee = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_id: string;
};

type JobPosting = {
  job_posting_id: string;
  status: "open" | "closed" | "draft";
};

export const HROfficerDashboardScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async (cancelRef?: { cancelled: boolean }) => {
    try {
      const [usersRes, statsRes, jobsRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/users`),
        authFetch(`${API_BASE_URL}/users/stats`),
        authFetch(`${API_BASE_URL}/jobs`),
      ]);

      const usersData = await usersRes.json().catch(() => []);
      const statsData = await statsRes.json().catch(() => ({}));
      const jobsData = await jobsRes.json().catch(() => []);

      if (!cancelRef?.cancelled) {
        setEmployees(Array.isArray(usersData) ? usersData : []);
        setTotalCount(statsData?.total ?? null);
        setJobs(Array.isArray(jobsData) ? jobsData : []);
      }
    } catch {
      if (!cancelRef?.cancelled) {
        setEmployees([]);
        setJobs([]);
      }
    } finally {
      if (!cancelRef?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    const cancelRef = { cancelled: false };
    loadDashboard(cancelRef);
    return () => {
      cancelRef.cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const fullName = [e.first_name, e.last_name].filter(Boolean).join(" ").toLowerCase();
      return fullName.includes(q) || e.email.toLowerCase().includes(q);
    });
  }, [search, employees]);

  const openJobs = jobs.filter((j) => j.status === "open").length;
  const draftJobs = jobs.filter((j) => j.status === "draft").length;

  return (
    <SafeAreaView style={{ backgroundColor: Colors.bgApp }} className="flex-1">
      <StatusBar barStyle="dark-content" />
      <View className="flex-1 flex-row">
        {!isMobile && (
          <Sidebar role="hr" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
        )}

        <View className="flex-1">
          {isMobile ? (
            <MobileRoleMenu role="hr" userName={session.name} email={session.email} activeScreen="Dashboard" navigation={navigation} />
          ) : (
            <Header role="hr" userName={session.name} />
          )}

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            <GradientHero style={{ borderRadius: 16, padding: 0, marginBottom: 16 }}>
            <View className="px-5 py-4">
              <View className="mb-3">
                <Text className="text-white/70 text-[10px] font-bold uppercase tracking-widest">HR Portal</Text>
                <Text className="text-white text-xl font-bold mt-1 leading-7">Welcome back, {session.name.split(" ")[0]}</Text>
                <Text className="text-white/75 text-xs mt-1.5 leading-5">
                  Daily staffing visibility and recruitment shortcuts in one place.
                </Text>
              </View>

              <View className={`mb-3 ${isMobile ? "gap-2" : "flex-row gap-2"}`}>
                <View
                  style={{ backgroundColor: "rgba(255,255,255,0.13)", borderColor: "rgba(255,255,255,0.2)" }}
                  className="rounded-xl border px-3 py-2"
                >
                  <Text className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Team</Text>
                  <Text className="text-white text-sm font-bold mt-0.5">{totalCount ?? "--"} Employees</Text>
                </View>
                <View
                  style={{ backgroundColor: "rgba(255,255,255,0.13)", borderColor: "rgba(255,255,255,0.2)" }}
                  className="rounded-xl border px-3 py-2"
                >
                  <Text className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Open Roles</Text>
                  <Text className="text-white text-sm font-bold mt-0.5">{openJobs} Active</Text>
                </View>
              </View>

              <View className={`${isMobile ? "gap-2" : "flex-row gap-2"}`}>
                <Pressable
                  onPress={() => navigation.navigate("HROfficerRecruitment", { session })}
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.25)" }}
                  className={`${isMobile ? "w-full" : ""} px-3 py-2.5 rounded-lg border items-center`}
                >
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wider">Open Recruitment</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setLoading(true);
                    loadDashboard();
                  }}
                  style={{ backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.25)" }}
                  className={`${isMobile ? "w-full" : ""} px-3 py-2.5 rounded-lg border items-center`}
                >
                  <Text className="text-white text-[11px] font-bold uppercase tracking-wider">Refresh Data</Text>
                </Pressable>
              </View>
            </View>
            </GradientHero>

            <View className={`${isMobile ? "mb-3 gap-3" : "flex-row gap-3 mb-4"}`}>
              <View className="flex-1">
                <MetricCard
                  label="Headcount"
                  value={totalCount === null ? "--" : String(totalCount)}
                  sub="Active employees"
                  trend=""
                />
              </View>
              <View className="flex-1">
                <MetricCard
                  label="Open Jobs"
                  value={String(openJobs)}
                  sub="Accepting applicants"
                  trend=""
                />
              </View>
            </View>

            <View className={`${isMobile ? "mb-3" : "mb-4"}`}>
              <MetricCard
                label="Draft Jobs"
                value={String(draftJobs)}
                sub="Need publishing"
                trend=""
                alert={draftJobs > 0}
              />
            </View>

            {/* Employee Directory */}
            <View style={{ backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 20, padding: 16, marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <View>
                  <Text style={{ color: "#0F172A", fontSize: 17, fontWeight: "800" }}>Employee Directory</Text>
                  <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>All employees in your company</Text>
                </View>
                <View style={{ backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#1D4ED8", fontSize: 11, fontWeight: "800" }}>{employees.length} total</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 14, backgroundColor: "#F8FAFC", paddingHorizontal: 12, marginBottom: 14, height: 44 }}>
                <Text style={{ color: "#94A3B8", marginRight: 8, fontSize: 16 }}>⌕</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search employees..."
                  placeholderTextColor="#94A3B8"
                  style={{ flex: 1, color: "#0F172A", fontSize: 14 }}
                />
              </View>

              {loading ? (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <ActivityIndicator color="#2563EB" />
                  <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 8 }}>Loading employees...</Text>
                </View>
              ) : (
                <>
                  {filtered.map((row) => {
                    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
                    const initials = (row.first_name?.charAt(0) ?? row.email.charAt(0)).toUpperCase();
                    const avatarColors = ["#EFF6FF|#1D4ED8", "#F0FDF4|#16A34A", "#FEF3C7|#B45309", "#F5F3FF|#7C3AED", "#FFF1F2|#BE123C"];
                    const colorPair = avatarColors[(row.email.codePointAt(0) ?? 0) % avatarColors.length].split("|");
                    return (
                      <View key={row.user_id} style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, padding: 12, marginBottom: 8, backgroundColor: "#FFFFFF" }}>
                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colorPair[0], alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                          <Text style={{ color: colorPair[1], fontWeight: "800", fontSize: 15 }}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#0F172A", fontSize: 14, fontWeight: "700" }}>{fullName}</Text>
                          <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{row.email}</Text>
                        </View>
                        <View style={{ backgroundColor: "#DCFCE7", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: "#166534", fontSize: 10, fontWeight: "800" }}>Active</Text>
                        </View>
                      </View>
                    );
                  })}

                  {filtered.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 24 }}>
                      <Text style={{ color: "#94A3B8", fontSize: 13 }}>No employees found.</Text>
                    </View>
                  )}
                </>
              )}

              <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, paddingTop: 6 }}>
                Showing {filtered.length} of {employees.length} employees
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};
