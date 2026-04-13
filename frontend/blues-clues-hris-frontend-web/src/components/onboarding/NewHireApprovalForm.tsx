"use client";

import { useEffect, useState, useCallback } from "react";
import { getMyOnboarding, saveOnboarding, submitOnboarding, type OnboardingSubmission } from "@/lib/authApi";
import { authFetch } from "@/lib/authApi";
import { API_BASE_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Clock, Loader2, AlertCircle, ChevronRight, ChevronLeft, Send } from "lucide-react";

type Department = { department_id: string; department_name: string };
type FormState = {
  first_name: string; last_name: string; phone: string; address: string;
  date_of_birth: string; nationality: string; civil_status: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  emergency_contact_relationship: string; preferred_username: string;
  department_id: string; start_date: string;
};
const CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated", "Divorced"];
const STEPS = ["Personal Info", "Emergency Contact", "Account Setup"];

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;
}

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 flex-1">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${i < current ? "bg-emerald-500 border-emerald-500 text-white" : i === current ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground"}`}>
            {i < current ? <CheckCircle className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`text-xs font-semibold hidden sm:block ${i === current ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
          {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < current ? "bg-emerald-400" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

export function NewHireApprovalForm() {
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState<Partial<Record<keyof FormState, string>>>({});
  const [forceEdit, setForceEdit] = useState(false);
  const [form, setForm] = useState<FormState>({
    first_name: "", last_name: "", phone: "", address: "",
    date_of_birth: "", nationality: "", civil_status: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    emergency_contact_relationship: "", preferred_username: "",
    department_id: "", start_date: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sub, depts] = await Promise.all([
        getMyOnboarding(),
        authFetch(`${API_BASE_URL}/users/departments`).then(r => r.json()).catch(() => []),
      ]);
      setDepartments(depts as Department[]);
      if (sub) {
        setSubmission(sub);
        setForm({
          first_name: sub.first_name ?? "", last_name: sub.last_name ?? "",
          phone: sub.phone ?? "", address: sub.address ?? "",
          date_of_birth: sub.date_of_birth ?? "", nationality: sub.nationality ?? "",
          civil_status: sub.civil_status ?? "",
          emergency_contact_name: sub.emergency_contact_name ?? "",
          emergency_contact_phone: sub.emergency_contact_phone ?? "",
          emergency_contact_relationship: sub.emergency_contact_relationship ?? "",
          preferred_username: sub.preferred_username ?? "",
          department_id: sub.department_id ?? "", start_date: sub.start_date ?? "",
        });
      }
    } catch { /* parent already handles no-record */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sf = (k: keyof FormState, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrs(p => ({ ...p, [k]: undefined }));
  };

  const autosave = async () => {
    if (!submission || submission.status === "submitted" || submission.status === "approved") return;
    try { setSaving(true); await saveOnboarding(form); } catch { } finally { setSaving(false); }
  };

  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (step === 0) {
      if (!form.first_name.trim()) e.first_name = "Required";
      if (!form.last_name.trim()) e.last_name = "Required";
      if (!form.phone.trim()) e.phone = "Required";
      if (!form.address.trim()) e.address = "Required";
      if (!form.date_of_birth) e.date_of_birth = "Required";
      if (!form.nationality.trim()) e.nationality = "Required";
      if (!form.civil_status) e.civil_status = "Required";
    } else if (step === 1) {
      if (!form.emergency_contact_name.trim()) e.emergency_contact_name = "Required";
      if (!form.emergency_contact_phone.trim()) e.emergency_contact_phone = "Required";
      if (!form.emergency_contact_relationship.trim()) e.emergency_contact_relationship = "Required";
    } else if (step === 2) {
      if (!form.preferred_username.trim()) e.preferred_username = "Required";
      if (form.preferred_username.length < 4) e.preferred_username = "At least 4 characters";
      if (/\s/.test(form.preferred_username)) e.preferred_username = "No spaces allowed";
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => { if (!validate()) return; await autosave(); setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true); setSubmitError(null);
    try {
      await saveOnboarding(form);
      const updated = await submitOnboarding();
      setSubmission(updated); setForceEdit(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading your onboarding form…</span>
    </div>
  );

  if (!submission) return null;

  if (submission.status === "approved") return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center"><div className="rounded-full bg-emerald-100 p-6"><CheckCircle className="h-14 w-14 text-emerald-500" /></div></div>
        <h2 className="text-2xl font-bold">You&apos;re Approved!</h2>
        <p className="text-muted-foreground">Your onboarding has been approved. Check your email for an invite link to set your employee account password.</p>
      </div>
    </div>
  );

  if (submission.status === "submitted" && !forceEdit) return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center"><div className="rounded-full bg-orange-100 p-6"><Clock className="h-14 w-14 text-orange-500 animate-pulse" /></div></div>
        <h2 className="text-2xl font-bold">Waiting for HR Review</h2>
        <p className="text-muted-foreground">Your information has been submitted. HR will review it and send you an email once your employee account is ready.</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left text-sm text-blue-800 space-y-1">
          <p className="font-semibold mb-2">What happens next?</p>
          <p>1. HR reviews your submitted information</p>
          <p>2. HR approves and assigns your role</p>
          <p>3. You receive an invite email to set your password</p>
          <p>4. You log in to the employee portal</p>
        </div>
      </div>
    </div>
  );

  if (submission.status === "rejected" && !forceEdit) return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center"><div className="rounded-full bg-red-100 p-6"><AlertCircle className="h-14 w-14 text-red-500" /></div></div>
        <h2 className="text-2xl font-bold">Changes Requested</h2>
        {submission.hr_notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-sm text-amber-800">
            <p className="font-semibold mb-1">HR Feedback:</p><p>{submission.hr_notes}</p>
          </div>
        )}
        <Button onClick={() => { setForceEdit(true); setStep(0); }} className="w-full">Edit &amp; Resubmit</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Hire Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Fill in your details so HR can create your employee account.{saving && <span className="ml-2 italic">Saving…</span>}</p>
      </div>
      <StepBar current={step} />
      {submitError && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{submitError}</div>}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{STEPS[step]}</CardTitle>
          <CardDescription className="text-xs">
            {step === 0 && "Basic personal information that will appear on your employee record."}
            {step === 1 && "Contact person to reach in case of emergency."}
            {step === 2 && "Set your preferred username for your employee account login."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>First Name <span className="text-red-500">*</span></Label><Input value={form.first_name} onChange={e => sf("first_name", e.target.value)} placeholder="Juan" /><Err msg={errs.first_name} /></div>
              <div className="space-y-1.5"><Label>Last Name <span className="text-red-500">*</span></Label><Input value={form.last_name} onChange={e => sf("last_name", e.target.value)} placeholder="dela Cruz" /><Err msg={errs.last_name} /></div>
            </div>
            <div className="space-y-1.5"><Label>Phone Number <span className="text-red-500">*</span></Label><Input value={form.phone} onChange={e => sf("phone", e.target.value)} placeholder="+63 9XX XXX XXXX" /><Err msg={errs.phone} /></div>
            <div className="space-y-1.5"><Label>Complete Address <span className="text-red-500">*</span></Label><Input value={form.address} onChange={e => sf("address", e.target.value)} placeholder="Street, Barangay, City, Province" /><Err msg={errs.address} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Date of Birth <span className="text-red-500">*</span></Label><Input type="date" value={form.date_of_birth} onChange={e => sf("date_of_birth", e.target.value)} max={new Date().toISOString().split("T")[0]} /><Err msg={errs.date_of_birth} /></div>
              <div className="space-y-1.5"><Label>Nationality <span className="text-red-500">*</span></Label><Input value={form.nationality} onChange={e => sf("nationality", e.target.value)} placeholder="Filipino" /><Err msg={errs.nationality} /></div>
            </div>
            <div className="space-y-1.5"><Label>Civil Status <span className="text-red-500">*</span></Label>
              <Select value={form.civil_status} onValueChange={v => sf("civil_status", v)}><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{CIVIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              <Err msg={errs.civil_status} /></div>
          </>}
          {step === 1 && <>
            <div className="space-y-1.5"><Label>Contact Name <span className="text-red-500">*</span></Label><Input value={form.emergency_contact_name} onChange={e => sf("emergency_contact_name", e.target.value)} placeholder="Full name" /><Err msg={errs.emergency_contact_name} /></div>
            <div className="space-y-1.5"><Label>Contact Phone <span className="text-red-500">*</span></Label><Input value={form.emergency_contact_phone} onChange={e => sf("emergency_contact_phone", e.target.value)} placeholder="+63 9XX XXX XXXX" /><Err msg={errs.emergency_contact_phone} /></div>
            <div className="space-y-1.5"><Label>Relationship <span className="text-red-500">*</span></Label><Input value={form.emergency_contact_relationship} onChange={e => sf("emergency_contact_relationship", e.target.value)} placeholder="e.g. Spouse, Parent, Sibling" /><Err msg={errs.emergency_contact_relationship} /></div>
          </>}
          {step === 2 && <>
            <div className="space-y-1.5">
              <Label>Preferred Username <span className="text-red-500">*</span></Label>
              <Input value={form.preferred_username} onChange={e => sf("preferred_username", e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="juan.delacruz" autoCapitalize="none" autoCorrect="off" />
              <p className="text-xs text-muted-foreground">This will be your login username. Lowercase letters, numbers, dots, underscores only.</p>
              <Err msg={errs.preferred_username} />
            </div>
            {departments.length > 0 && <div className="space-y-1.5"><Label>Department (optional)</Label>
              <Select value={form.department_id} onValueChange={v => sf("department_id", v)}><SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d.department_id} value={d.department_id}>{d.department_name}</SelectItem>)}</SelectContent></Select>
            </div>}
            <div className="space-y-1.5"><Label>Preferred Start Date (optional)</Label><Input type="date" value={form.start_date} onChange={e => sf("start_date", e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm mt-2">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-3">Review your details</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <span className="text-muted-foreground">Name</span><span className="font-medium">{form.first_name} {form.last_name}</span>
                <span className="text-muted-foreground">Phone</span><span className="font-medium">{form.phone || "—"}</span>
                <span className="text-muted-foreground">Address</span><span className="font-medium truncate">{form.address || "—"}</span>
                <span className="text-muted-foreground">Emergency Contact</span><span className="font-medium">{form.emergency_contact_name || "—"}</span>
              </div>
            </div>
          </>}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={back} disabled={step === 0 || submitting}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
        {step < STEPS.length - 1
          ? <Button onClick={next} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          : <Button onClick={submit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}Submit for Review</Button>}
      </div>
    </div>
  );
}
