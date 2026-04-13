"use client";

import { useEffect, useRef, useState } from "react";
import { getUserInfo, type StoredUser } from "@/lib/authStorage";
import { getApplicantProfile, updateApplicantProfile, uploadApplicantResume, deleteApplicantResume, type ApplicantProfile } from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, CheckCircle2, FileText, Loader2, MapPin, Pencil, Trash2, Upload, User } from "lucide-react";
import { DateOfBirthPicker } from "@/components/ui/date-of-birth-picker";
import { toast } from "sonner";

// ─── Permission Badge ─────────────────────────────────────────────────────────

function PermBadge({ type }: { readonly type: "self" | "system" }) {
  const map = {
    self:   { label: "Self-service",    cls: "bg-green-100 text-green-700 border border-green-200" },
    system: { label: "System-managed",  cls: "bg-gray-100 text-gray-500 border border-gray-200" },
  } as const;
  const { label, cls } = map[type];
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}

function FieldRow({ label, permType, children }: {
  readonly label: string;
  readonly permType: "self" | "system";
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <PermBadge type={permType} />
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Draft = {
  first_name: string;
  middle_name: string;
  last_name: string;
  phone_number: string;
  personal_email: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  civil_status: string;
  complete_address: string;
};

function profileToDraft(p: ApplicantProfile): Draft {
  return {
    first_name:      p.first_name ?? "",
    middle_name:     p.middle_name ?? "",
    last_name:       p.last_name ?? "",
    phone_number:    p.phone_number ?? "",
    personal_email:  p.personal_email ?? "",
    date_of_birth:   p.date_of_birth ?? "",
    place_of_birth:  p.place_of_birth ?? "",
    nationality:     p.nationality ?? "",
    civil_status:    p.civil_status ?? "",
    complete_address: p.complete_address ?? "",
  };
}

export default function ApplicantProfilePage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<ApplicantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Personal section
  const [personalDraft, setPersonalDraft] = useState<Pick<Draft, "first_name" | "middle_name" | "last_name">>({ first_name: "", middle_name: "", last_name: "" });
  const [personalEditing, setPersonalEditing] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);

  // Contact section
  const [contactDraft, setContactDraft] = useState<Omit<Draft, "first_name" | "middle_name" | "last_name">>({ phone_number: "", personal_email: "", date_of_birth: "", place_of_birth: "", nationality: "", civil_status: "", complete_address: "" });
  const [contactEditing, setContactEditing] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  // Resume section
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [resumeUploadedAt, setResumeUploadedAt] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeDeleting, setResumeDeleting] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUser(getUserInfo());
    const photo = localStorage.getItem("applicant_profile_photo");
    if (photo) setProfilePhoto(photo);

    getApplicantProfile()
      .then((p) => {
        setProfile(p);
        const d = profileToDraft(p);
        setPersonalDraft({ first_name: d.first_name, middle_name: d.middle_name, last_name: d.last_name });
        setContactDraft({ phone_number: d.phone_number, personal_email: d.personal_email, date_of_birth: d.date_of_birth, place_of_birth: d.place_of_birth, nationality: d.nationality, civil_status: d.civil_status, complete_address: d.complete_address });
        setResumeUrl(p.resume_url ?? null);
        setResumeName(p.resume_name ?? null);
        setResumeUploadedAt(p.resume_uploaded_at ?? null);
      })
      .catch(() => toast.error("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setProfilePhoto(b64);
      localStorage.setItem("applicant_profile_photo", b64);
      toast.success("Profile photo updated.");
    };
    reader.readAsDataURL(file);
  };

  const handlePersonalSave = async () => {
    if (!personalDraft.first_name.trim()) { toast.error("First name is required."); return; }
    setPersonalSaving(true);
    try {
      const updated = await updateApplicantProfile({ first_name: personalDraft.first_name.trim(), middle_name: personalDraft.middle_name.trim() || null as any, last_name: personalDraft.last_name.trim() });
      setProfile(updated);
      setPersonalEditing(false);
      toast.success("Personal information saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleContactSave = async () => {
    setContactSaving(true);
    try {
      const updated = await updateApplicantProfile({
        phone_number:    contactDraft.phone_number.trim() || null as any,
        personal_email:  contactDraft.personal_email.trim() || null as any,
        date_of_birth:   contactDraft.date_of_birth || null as any,
        place_of_birth:  contactDraft.place_of_birth.trim() || null as any,
        nationality:     contactDraft.nationality.trim() || null as any,
        civil_status:    contactDraft.civil_status || null as any,
        complete_address: contactDraft.complete_address.trim() || null as any,
      });
      setProfile(updated);
      setContactEditing(false);
      toast.success("Contact information saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setContactSaving(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setResumeUploading(true);
    try {
      const result = await uploadApplicantResume(file);
      setResumeUrl(result.resume_url);
      setResumeName(result.resume_name);
      setResumeUploadedAt(result.resume_uploaded_at);
      toast.success("Resume uploaded successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setResumeUploading(false);
    }
  };

  const handleResumeDelete = async () => {
    setResumeDeleting(true);
    try {
      await deleteApplicantResume();
      setResumeUrl(null);
      setResumeName(null);
      setResumeUploadedAt(null);
      toast.success("Resume removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setResumeDeleting(false);
    }
  };

  const displayName = [personalDraft.first_name, personalDraft.middle_name, personalDraft.last_name].filter(Boolean).join(" ") || user?.name || "Applicant";
  const initials = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-0">
      {/* Hero Banner */}
      <div className="rounded-[26px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_52%,#134e4a_100%)] text-white px-8 py-10 mb-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-2">Candidate Portal</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1">My Profile</h1>
        <p className="text-sm text-white/70 max-w-xl">
          Keep your profile up to date so employers can reach you with the right opportunities.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
        <div className="w-full md:w-[280px] md:sticky md:top-6 shrink-0">
          <div className="bg-card border rounded-xl shadow-sm p-5 space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => photoInputRef.current?.click()}>
                <div className="h-24 w-24 rounded-full border-4 border-primary/20 overflow-hidden bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                  {profilePhoto ? <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold tracking-tight">{displayName}</p>
                <span className="inline-flex items-center mt-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2.5 py-0.5 bg-primary text-white">Applicant</span>
              </div>
            </div>
            <div className="border-t border-border" />
            <nav className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-2 mb-2">Sections</p>
              {[{ id: "personal-info", label: "Personal Info", icon: User }, { id: "contact-address", label: "Contact & Address", icon: MapPin }, { id: "resume", label: "Resume", icon: FileText }].map(({ id, label, icon: Icon }) => (
                <a key={id} href={`#${id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 cursor-pointer">
                  <Icon className="h-4 w-4" />{label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* ── Right Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Personal Information */}
          <section id="personal-info" className="bg-card border rounded-xl shadow-sm p-6 space-y-5 scroll-mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Personal Information</h2>
              {personalEditing ? (
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 px-3 text-xs" onClick={handlePersonalSave} disabled={personalSaving}>
                    {personalSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => { setPersonalDraft({ first_name: profile?.first_name ?? "", middle_name: profile?.middle_name ?? "", last_name: profile?.last_name ?? "" }); setPersonalEditing(false); }} disabled={personalSaving}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPersonalEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
              )}
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <FieldRow label="First Name" permType="self">
                <Input value={personalDraft.first_name} onChange={(e) => setPersonalDraft({ ...personalDraft, first_name: e.target.value })} disabled={!personalEditing} placeholder="First name" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
              <FieldRow label="Middle Name" permType="self">
                <Input value={personalDraft.middle_name} onChange={(e) => setPersonalDraft({ ...personalDraft, middle_name: e.target.value })} disabled={!personalEditing} placeholder="Middle name" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
              <FieldRow label="Last Name" permType="self">
                <Input value={personalDraft.last_name} onChange={(e) => setPersonalDraft({ ...personalDraft, last_name: e.target.value })} disabled={!personalEditing} placeholder="Last name" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldRow label="Work Email" permType="system">
                <Input value={user?.email ?? profile?.email ?? ""} disabled className="h-9 bg-muted/40 text-muted-foreground" />
              </FieldRow>
            </div>
          </section>

          {/* Contact & Address */}
          <section id="contact-address" className="bg-card border rounded-xl shadow-sm p-6 space-y-5 scroll-mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Contact & Address</h2>
              {contactEditing ? (
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 px-3 text-xs" onClick={handleContactSave} disabled={contactSaving}>
                    {contactSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => { if (profile) setContactDraft({ phone_number: profile.phone_number ?? "", personal_email: profile.personal_email ?? "", date_of_birth: profile.date_of_birth ?? "", place_of_birth: profile.place_of_birth ?? "", nationality: profile.nationality ?? "", civil_status: profile.civil_status ?? "", complete_address: profile.complete_address ?? "" }); setContactEditing(false); }} disabled={contactSaving}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setContactEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
                </Button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldRow label="Phone Number" permType="self">
                <Input value={contactDraft.phone_number} onChange={(e) => setContactDraft({ ...contactDraft, phone_number: e.target.value })} disabled={!contactEditing} placeholder="+63 900 000 0000" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
              <FieldRow label="Personal Email" permType="self">
                <Input value={contactDraft.personal_email} onChange={(e) => setContactDraft({ ...contactDraft, personal_email: e.target.value })} disabled={!contactEditing} placeholder="personal@email.com" type="email" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
              <FieldRow label="Date of Birth" permType="self">
                <DateOfBirthPicker
                  value={contactDraft.date_of_birth}
                  onChange={(iso) => setContactDraft({ ...contactDraft, date_of_birth: iso })}
                  disabled={!contactEditing}
                />
              </FieldRow>
              <FieldRow label="Place of Birth" permType="self">
                <Input value={contactDraft.place_of_birth} onChange={(e) => setContactDraft({ ...contactDraft, place_of_birth: e.target.value })} disabled={!contactEditing} placeholder="City, Province" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
              <FieldRow label="Nationality" permType="self">
                <Input value={contactDraft.nationality} onChange={(e) => setContactDraft({ ...contactDraft, nationality: e.target.value })} disabled={!contactEditing} placeholder="e.g. Filipino" className="h-9 disabled:bg-muted/40 disabled:text-muted-foreground" />
              </FieldRow>
              <FieldRow label="Civil Status" permType="self">
                {contactEditing ? (
                  <Select value={contactDraft.civil_status} onValueChange={(val) => setContactDraft({ ...contactDraft, civil_status: val })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={contactDraft.civil_status || "—"} disabled className="h-9 bg-muted/40 text-muted-foreground" />
                )}
              </FieldRow>
            </div>
            <FieldRow label="Complete Address" permType="self">
              <Textarea value={contactDraft.complete_address} onChange={(e) => setContactDraft({ ...contactDraft, complete_address: e.target.value })} disabled={!contactEditing} placeholder="Street, Barangay, City, Province, ZIP" className="min-h-[80px] resize-none disabled:bg-muted/40 disabled:text-muted-foreground" />
            </FieldRow>
          </section>

          {/* Resume */}
          <section id="resume" className="bg-card border rounded-xl shadow-sm p-6 space-y-5 scroll-mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Resume</h2>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, DOC, or DOCX — max 5 MB</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => resumeInputRef.current?.click()} disabled={resumeUploading}>
                {resumeUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                {resumeUrl ? "Replace" : "Upload"}
              </Button>
              <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleResumeUpload} />
            </div>

            {resumeUrl ? (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{resumeName}</p>
                  {resumeUploadedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Uploaded {new Date(resumeUploadedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs">View</Button>
                  </a>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleResumeDelete} disabled={resumeDeleting}>
                    {resumeDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => resumeInputRef.current?.click()}
                disabled={resumeUploading}
                className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/20 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-8 w-8" />
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload your resume</p>
                  <p className="text-xs mt-0.5">PDF, DOC, DOCX up to 5MB</p>
                </div>
              </button>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
