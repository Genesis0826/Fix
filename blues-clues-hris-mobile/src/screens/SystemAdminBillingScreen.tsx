import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  useWindowDimensions,
  Alert,
  Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { GradientHero } from "../components/GradientHero";

const PLAN_CARDS = [
  {
    id: "1",
    label: "Current Plan",
    value: "Enterprise",
    helper: "Annual billing cycle",
  },
  {
    id: "2",
    label: "Active Seats",
    value: "148",
    helper: "12 seats remaining",
  },
  {
    id: "3",
    label: "Monthly Cost",
    value: "$4,860",
    helper: "Estimated current usage",
  },
  {
    id: "4",
    label: "Renewal Date",
    value: "Apr 30",
    helper: "2026 subscription renewal",
  },
];

const BILLING_HISTORY = [
  {
    id: "1",
    title: "Enterprise Plan Renewal",
    subtitle: "Paid via corporate card ending in 4821",
    amount: "$4,800",
    date: "Mar 01, 2026",
  },
  {
    id: "2",
    title: "Additional Seat Purchase",
    subtitle: "10 user seats added",
    amount: "$320",
    date: "Feb 18, 2026",
  },
  {
    id: "3",
    title: "Usage Adjustment",
    subtitle: "Quarterly reconciliation",
    amount: "$210",
    date: "Jan 29, 2026",
  },
];

export function SystemAdminBillingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const session = route.params?.session ?? { name: "Admin", email: "", role: "system_admin" };
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layout}>
        {!isMobile && (
          <Sidebar
            role="system_admin"
            userName={session.name}
            email={session.email}
            activeScreen="Billing"
            navigation={navigation}
          />
        )}

        <View style={styles.mainContent}>
          {isMobile && (
            <MobileRoleMenu
              role="system_admin"
              userName={session.name}
              email={session.email}
              activeScreen="Billing"
              navigation={navigation}
            />
          )}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <GradientHero style={styles.heroCard}>
              <Text style={[styles.eyebrow, { color: "rgba(255,255,255,0.75)" }]}>System Admin</Text>
              <Text style={[styles.title, { color: "#FFFFFF" }]}>Billing & Subscription</Text>
              <Text style={[styles.subtitle, { color: "rgba(255,255,255,0.78)" }]}>
                Review subscription plan details, seats, renewal information,
                and recent billing activity.
              </Text>
            </GradientHero>

            <View style={styles.summaryRow}>
              {PLAN_CARDS.map((card) => (
                <View key={card.id} style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>{card.label}</Text>
                  <Text style={styles.summaryValue}>{card.value}</Text>
                  <Text style={styles.summaryHelper}>{card.helper}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Plan Actions</Text>

              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7 }]}
                  onPress={() => Alert.alert("Manage Seats", "Contact your account manager to adjust your license count.")}
                >
                  <Text style={styles.actionTitle}>Manage Seats →</Text>
                  <Text style={styles.actionText}>
                    Adjust license count based on current staffing.
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7 }]}
                  onPress={() => Alert.alert("Update Payment", "Contact billing support to update your payment method.")}
                >
                  <Text style={styles.actionTitle}>Update Payment →</Text>
                  <Text style={styles.actionText}>
                    Review billing method and subscription settings.
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7 }]}
                  onPress={() => Alert.alert("Download Invoice", "Invoice download will be available in the next update.")}
                >
                  <Text style={styles.actionTitle}>Download Invoice →</Text>
                  <Text style={styles.actionText}>
                    Access billing statements and recent invoices.
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Billing History</Text>

              {BILLING_HISTORY.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyRow,
                    index !== BILLING_HISTORY.length - 1 &&
                      styles.historyDivider,
                  ]}
                >
                  <View style={styles.historyTextWrap}>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historySubtitle}>{item.subtitle}</Text>
                    <Text style={styles.historyDate}>{item.date}</Text>
                  </View>

                  <Text style={styles.historyAmount}>{item.amount}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default SystemAdminBillingScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  layout: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
  },
  mainContent: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#64748B",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    minWidth: 160,
    flexGrow: 1,
    marginRight: 12,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  summaryHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: "#94A3B8",
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  actionCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    minWidth: 220,
    flexGrow: 1,
    marginRight: 12,
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  historyDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  historyTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  historySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
});