import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { EmployeeDashboardScreen } from "../screens/EmployeeDashboardScreen";
import { EmployeeOnboardingScreen } from "../screens/EmployeeOnboardingScreen";
import { HROfficerDashboardScreen } from "../screens/HROfficerDashboardScreen";
import { HROfficerOnboardingScreen } from "../screens/HROfficerOnboardingScreen";
import { HROfficerRecruitmentScreen } from "../screens/HROfficerRecruitmentScreen";
import { HROfficerTimekeepingScreen } from "../screens/HROfficerTimekeepingScreen";
import { ManagerDashboardScreen } from "../screens/ManagerDashboardScreen";
import { ManagerTeamScreen } from "../screens/ManagerTeamScreen";
import { ManagerTimekeepingScreen } from "../screens/ManagerTimekeepingScreen";
import { ApplicantDashboardScreen } from "../screens/ApplicantDashboardScreen";
import { ApplicantJobsScreen } from "../screens/ApplicantJobsScreen";
import { ApplicantApplicationsScreen } from "../screens/ApplicantApplicationsScreen";
import { ApplicantResumeUploadScreen } from "../screens/ApplicantResumeUploadScreen";
import { SystemAdminDashboardScreen } from "../screens/SystemAdminDashboardScreen";
import { SystemAdminOnboardingScreen } from "../screens/SystemAdminOnboardingScreen";
import { SystemAdminUsersScreen } from "../screens/SystemAdminUsersScreen";
import { SystemAdminBillingScreen } from "../screens/SystemAdminBillingScreen";
import { SystemAdminAuditLogsScreen } from "../screens/SystemAdminAuditLogsScreen";
import { EmployeeTimekeepingScreen } from "../screens/EmployeeTimekeepingScreen";

type SessionParam = { session: { name: string; role: string; email: string } };

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;

  // Employee
  EmployeeDashboard: SessionParam;
  EmployeeOnboarding: SessionParam;
  EmployeeTimekeeping: SessionParam;

  // Manager
  ManagerDashboard: SessionParam;
  ManagerTeam: SessionParam;
  ManagerTimekeeping: SessionParam;

  // HR Officer
  HROfficerDashboard: SessionParam;
  HROfficerOnboarding: SessionParam;
  HROfficerRecruitment: SessionParam;
  HROfficerTimekeeping: SessionParam;

  // Applicant
  ApplicantDashboard: SessionParam;
  ApplicantJobs: SessionParam;
  ApplicantApplications: SessionParam;
  ApplicantResumeUpload: SessionParam;

  // System Admin / Admin
  SystemAdminDashboard: SessionParam;
  SystemAdminOnboarding: SessionParam;
  SystemAdminUsers: SessionParam;
  SystemAdminBilling: SessionParam;
  SystemAdminAuditLogs: SessionParam;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        id="root-stack"
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* Employee */}
        <Stack.Screen name="EmployeeDashboard" component={EmployeeDashboardScreen} />
        <Stack.Screen name="EmployeeOnboarding" component={EmployeeOnboardingScreen} />
        <Stack.Screen name="EmployeeTimekeeping" component={EmployeeTimekeepingScreen} />

        {/* Manager */}
        <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
        <Stack.Screen name="ManagerTeam" component={ManagerTeamScreen} />
        <Stack.Screen name="ManagerTimekeeping" component={ManagerTimekeepingScreen} />

        {/* HR Officer */}
        <Stack.Screen name="HROfficerDashboard" component={HROfficerDashboardScreen} />
        <Stack.Screen name="HROfficerOnboarding" component={HROfficerOnboardingScreen} />
        <Stack.Screen name="HROfficerRecruitment" component={HROfficerRecruitmentScreen} />
        <Stack.Screen name="HROfficerTimekeeping" component={HROfficerTimekeepingScreen} />

        {/* Applicant */}
        <Stack.Screen name="ApplicantDashboard" component={ApplicantDashboardScreen} />
        <Stack.Screen name="ApplicantJobs" component={ApplicantJobsScreen} />
        <Stack.Screen name="ApplicantApplications" component={ApplicantApplicationsScreen} />
        <Stack.Screen name="ApplicantResumeUpload" component={ApplicantResumeUploadScreen} />

        {/* System Admin */}
        <Stack.Screen name="SystemAdminDashboard" component={SystemAdminDashboardScreen} />
        <Stack.Screen name="SystemAdminOnboarding" component={SystemAdminOnboardingScreen} />
        <Stack.Screen name="SystemAdminUsers" component={SystemAdminUsersScreen} />
        <Stack.Screen name="SystemAdminBilling" component={SystemAdminBillingScreen} />
        <Stack.Screen name="SystemAdminAuditLogs" component={SystemAdminAuditLogsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
