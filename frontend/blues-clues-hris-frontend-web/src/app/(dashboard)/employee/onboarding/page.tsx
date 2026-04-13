"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Employees complete onboarding as applicants before their account is created.
// This route is kept for backward compatibility but redirects to the dashboard.
export default function EmployeeOnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/employee");
  }, [router]);
  return null;
}
