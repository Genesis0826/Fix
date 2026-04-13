"use client";

import { useEffect, useState } from "react";
import { getUserInfo } from "@/lib/authStorage";
import { useWelcomeToast } from "@/lib/useWelcomeToast";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Settings, LayoutDashboard } from "lucide-react";

export default function AdminDashboardPage() {
  const user = getUserInfo();
  const adminName = user?.name || "Admin";
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useWelcomeToast(adminName, "Admin Portal");

  useEffect(() => {
    authFetch(`${API_BASE_URL}/users/stats`)
      .then((response) => response.json())
      .then((data) => setTotalUsers(data?.total ?? null))
      .catch(() => setFetchError(true));
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="relative bg-[#7c3aed] overflow-hidden rounded-xl p-8 text-white shadow-sm h-48 flex flex-col justify-center">
        <div className="absolute top-0 right-10 w-48 h-48 bg-white/10 rounded-full -translate-y-1/4 translate-x-1/4" />
        <div className="absolute bottom-0 right-32 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold mb-3">Welcome, {adminName}!</h1>
          <p className="text-white/80 text-sm leading-relaxed">
            You are logged in as an Administrator. Manage users and company-level settings from here.
          </p>
        </div>
      </div>

      {fetchError && (
        <p className="text-sm text-destructive text-center py-2">
          Failed to load dashboard data. Please refresh or contact support.
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold text-gray-900">Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Company-level admin tools are available from this dashboard.</p>
          </CardContent>
        </Card>

        <Card className="border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold text-gray-900">Users</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{totalUsers === null ? "—" : totalUsers}</p>
            <p className="text-sm text-gray-500">Total users in your company</p>
          </CardContent>
        </Card>

        <Card className="border-gray-100 shadow-sm rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Settings className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold text-gray-900">Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Additional company admin settings can be added here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
