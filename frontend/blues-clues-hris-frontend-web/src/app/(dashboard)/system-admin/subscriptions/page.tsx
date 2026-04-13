"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  getSubscriptions,
  getPlans,
  getBillingStats,
  updateSubscription,
  type Subscription,
  type PlanConfig,
  type BillingStats,
  type PlanTier,
  type SubscriptionStatus,
} from "@/lib/adminApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString()}`;
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  trial: "bg-blue-100 text-blue-700 border-blue-200",
  expired: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const PLAN_COLORS: Record<PlanTier, string> = {
  Starter: "bg-gray-100 text-gray-600 border-gray-200",
  Professional: "bg-purple-100 text-purple-700 border-purple-200",
  Enterprise: "bg-amber-100 text-amber-700 border-amber-200",
};

function PlanCard({
  plan,
  current,
  onSelect,
  loading,
}: {
  readonly plan: PlanConfig;
  readonly current: boolean;
  readonly onSelect: () => void;
  readonly loading: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border-2 p-5 flex flex-col gap-3 transition-all ${
        current ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {current && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-full uppercase tracking-wide">
          Current
        </span>
      )}
      <div>
        <h3 className="font-bold">{plan.plan}</h3>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold">{formatCurrency(plan.price)}</span>
          <span className="text-xs text-muted-foreground">/mo</span>
        </div>
        <p className="text-xs text-muted-foreground">Up to {plan.seats} seats</p>
      </div>
      <ul className="space-y-1.5 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-foreground">
            <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        variant={current ? "outline" : "default"}
        className="w-full mt-1"
        size="sm"
        disabled={current || loading}
        onClick={onSelect}
      >
        {current ? "Current Plan" : `Switch to ${plan.plan}`}
      </Button>
    </div>
  );
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subs, nextPlans, nextStats] = await Promise.all([
        getSubscriptions(),
        getPlans(),
        getBillingStats(),
      ]);
      setSubscriptions(subs);
      setPlans(nextPlans);
      setStats(nextStats);
    } catch {
      toast.error("Failed to load subscription data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePlanSwitch = async (subscription: Subscription, newPlan: PlanTier) => {
    setPlanLoading(true);
    try {
      await updateSubscription(subscription.subscription_id, { plan: newPlan });
      const planConfig = plans.find((plan) => plan.plan === newPlan);
      setSubscriptions((current) =>
        current.map((item) =>
          item.subscription_id === subscription.subscription_id
            ? { ...item, plan: newPlan, amount: planConfig?.price ?? item.amount }
            : item,
        ),
      );
      toast.success("Subscription plan updated.");
      setExpandedSub(null);
    } catch {
      toast.error("Failed to update plan.");
    } finally {
      setPlanLoading(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground text-sm">Loading subscriptions...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Welcome card */}
      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] px-6 py-7 text-white shadow-sm md:px-7 md:py-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_60%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">System Administration</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Subscriptions &amp; Billing</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Manage tenant subscriptions, monitor billing metrics, and configure plan tiers.
            </p>
          </div>
          {stats && (
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Monthly MRR</p>
              <p className="mt-1 text-lg font-bold">${stats.total_mrr.toLocaleString()}</p>
            </div>
          )}
        </div>
      </section>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: DollarSign,
              label: "Total MRR",
              value: formatCurrency(stats.total_mrr),
              sub: "Monthly recurring",
              cls: "bg-green-100 text-green-600",
            },
            {
              icon: TrendingUp,
              label: "Active",
              value: String(stats.active_subscriptions),
              sub: "Active subscriptions",
              cls: "bg-primary/10 text-primary",
            },
            {
              icon: Clock,
              label: "Trials",
              value: String(stats.trial_accounts),
              sub: "Trial accounts",
              cls: "bg-blue-100 text-blue-600",
            },
            {
              icon: AlertTriangle,
              label: "Expiring Soon",
              value: String(stats.expiring_soon),
              sub: "Renewals within 7d",
              cls: "bg-amber-100 text-amber-600",
            },
          ].map(({ icon: Icon, label, value, sub, cls }) => (
            <Card key={label} className="border-border shadow-sm">
              <CardContent className="p-5">
                <div className={`p-2 rounded-lg w-fit mb-3 ${cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-bold text-base">Subscription Management</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Overview of all active and trial subscriptions</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-8">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground bg-muted/30 border-b border-border uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3">Tenant</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Next Renewal</th>
                <th className="px-6 py-3">Seats</th>
                <th className="px-6 py-3">MRR</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscriptions.map((subscription) => {
                const days = daysUntil(subscription.next_renewal);
                const renewingSoon = subscription.status === "active" && days <= 7 && days > 0;
                const isExpanded = expandedSub === subscription.subscription_id;

                return (
                  <Fragment key={subscription.subscription_id}>
                    <tr className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/10 shrink-0">
                            {subscription.company_name.charAt(0)}
                          </div>
                          <span className="font-semibold text-foreground">{subscription.company_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${PLAN_COLORS[subscription.plan]}`}
                        >
                          {subscription.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">{formatCurrency(subscription.amount)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${STATUS_STYLES[subscription.status]}`}
                        >
                          {subscription.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-foreground">{formatDate(subscription.next_renewal)}</span>
                          {renewingSoon && (
                            <span className="text-[10px] text-amber-600 font-semibold">
                              {days === 1 ? "Tomorrow" : `In ${days} days`}
                            </span>
                          )}
                          {subscription.status === "expired" && (
                            <span className="text-[10px] text-red-500 font-semibold">Expired</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">
                            {subscription.seats_used} / {subscription.seats_limit}
                          </span>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                subscription.seats_used / subscription.seats_limit > 0.9 ? "bg-red-500" : "bg-primary"
                              }`}
                              style={{
                                width: `${Math.min(100, (subscription.seats_used / subscription.seats_limit) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {subscription.mrr > 0 ? formatCurrency(subscription.mrr) : <span className="text-muted-foreground">$0</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => setExpandedSub(isExpanded ? null : subscription.subscription_id)}
                        >
                          <Settings className="h-3.5 w-3.5" /> Manage
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </Button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-6 py-6 bg-muted/10 border-t border-dashed border-border">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                            Switch Plan — {subscription.company_name}
                          </p>
                          <div className="grid md:grid-cols-3 gap-4">
                            {plans.map((plan) => (
                              <PlanCard
                                key={plan.plan}
                                plan={plan}
                                current={plan.plan === subscription.plan}
                                loading={planLoading}
                                onSelect={() => handlePlanSwitch(subscription, plan.plan)}
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-base">Subscription Plans & Pricing</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manage plan tiers and adjust access levels</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Configure Plans
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <PlanCard key={plan.plan} plan={plan} current={false} loading={false} onSelect={() => {}} />
          ))}
        </div>
      </div>
    </div>
  );
}
