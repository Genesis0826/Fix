"use client";

import { useState, useEffect } from "react";
import { saveProfile } from "@/lib/onboardingApi";
import { getApplicantProfile } from "@/lib/authApi";
import { getUserInfo } from "@/lib/authStorage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Plus, Trash2, Clock, Pencil, AlertTriangle } from "lucide-react";
import { DateOfBirthPicker } from "@/components/ui/date-of-birth-picker";
import { ProfileData, EmergencyContact, Remark } from "@/types/onboarding.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DetailedStatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";

interface ProfileSetupProps {
  profile: ProfileData | null;
  sessionId: string;
  remarks: Remark[];
  onUpdate: (profile: ProfileData) => void;
  profileRejected?: boolean;
  profileApproved?: boolean;
  profileConfirmed?: boolean;
}

const emptyContact = (): EmergencyContact => ({
  contact_name: "",
  relationship: "",
  emergency_phone_number: "",
  emergency_email_address: "",
});

function seedContacts(profile: ProfileData | null): EmergencyContact[] {
  if (profile?.emergency_contacts && profile.emergency_contacts.length > 0) {
    return profile.emergency_contacts;
  }
  // Fall back to legacy flat fields if JSONB array is empty
  if (profile?.contact_name) {
    return [{
      contact_name: profile.contact_name,
      relationship: profile.relationship ?? "",
      emergency_phone_number: profile.emergency_phone_number ?? "",
      emergency_email_address: profile.emergency_email_address ?? "",
    }];
  }
  return [emptyContact()];
}

export function ProfileSetup({ profile, sessionId, remarks, onUpdate, profileRejected = false, profileApproved = false, profileConfirmed = false }: Readonly<ProfileSetupProps>) {
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    middle_name: profile?.middle_name || "",
    email_address: profile?.email_address || "",
    phone_number: profile?.phone_number || "",
    complete_address: profile?.complete_address || "",
    date_of_birth: profile?.date_of_birth || "",
    place_of_birth: profile?.place_of_birth || "",
    nationality: profile?.nationality || "",
    civil_status: profile?.civil_status || "",
  });
  const [contacts, setContacts] = useState<EmergencyContact[]>(seedContacts(profile));

  // Auto-fill from applicant_profile if session profile fields are empty
  useEffect(() => {
    if (getUserInfo()?.role !== "applicant") return;
    getApplicantProfile().then((ap) => {
      setFormData((prev) => ({
        first_name:       prev.first_name       || ap.first_name       || "",
        last_name:        prev.last_name        || ap.last_name        || "",
        middle_name:      prev.middle_name      || ap.middle_name      || "",
        email_address:    prev.email_address    || ap.personal_email   || "",
        phone_number:     prev.phone_number     || ap.phone_number     || "",
        complete_address: prev.complete_address || ap.complete_address || "",
        date_of_birth:    prev.date_of_birth    || ap.date_of_birth    || "",
        place_of_birth:   prev.place_of_birth   || ap.place_of_birth   || "",
        nationality:      prev.nationality      || ap.nationality      || "",
        civil_status:     prev.civil_status     || ap.civil_status     || "",
      }));
    }).catch(() => {});
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (index: number, field: keyof EmergencyContact, value: string) => {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addContact = () => setContacts(prev => [...prev, emptyContact()]);

  const removeContact = (index: number) => {
    if (contacts.length === 1) return; // keep at least one
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email_address || !formData.phone_number) {
      alert("Please fill in all required personal information fields.");
      return;
    }
    const invalid = contacts.some(c => !c.contact_name || !c.relationship || !c.emergency_phone_number);
    if (invalid) {
      alert("Please fill in name, relationship, and phone number for every emergency contact.");
      return;
    }

    setSaving(true);
    try {
      // Strip empty optional fields — @IsOptional() only skips undefined, not ""
      const payload: Record<string, any> = { ...formData };
      for (const key of ["complete_address", "date_of_birth", "place_of_birth", "nationality", "civil_status", "middle_name"]) {
        if (!payload[key]) delete payload[key];
      }
      // Clean optional fields inside each emergency contact
      payload.emergency_contacts = contacts.map((c) => {
        const cleaned: Record<string, any> = { ...c };
        if (!cleaned.emergency_email_address?.trim()) delete cleaned.emergency_email_address;
        return cleaned;
      });
      const result = await saveProfile(sessionId, payload as any);
      onUpdate(result);
      setIsEditing(false);
      alert("Profile submitted successfully! HR will review your updated information.");
    } catch (err: any) {
      alert(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const profileStatus = profile?.status || "pending";
  const isLocked = !profileRejected && profileStatus !== "pending" && profileStatus !== "rejected" && !isEditing;
  const profileRemarks = remarks.filter(r => r.tab_tag === "Profile");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Create Your Profile</h3>
          <p className="text-sm text-gray-600">Complete your profile information</p>
        </div>
        <DetailedStatusBadge status={profileStatus} pendingLabel="Incomplete" />
      </div>

      {/* ── APPROVED state ── */}
      {profileApproved && !isEditing && (
        <Alert className="bg-emerald-50 border-emerald-200">
          <CheckCircle className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-emerald-800 text-sm flex items-start justify-between gap-3">
            <span>Your profile has been <strong>approved</strong> by HR.</span>
            <button
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3" />Edit profile
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── APPROVED + editing warning ── */}
      {profileApproved && isEditing && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-amber-800 text-sm">
            <p className="font-semibold">Re-approval required</p>
            <p className="mt-0.5">Saving changes will send your profile back to HR for review. Only your profile details are affected — your documents, forms, and tasks remain unchanged.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* ── CONFIRMED (under review) state ── */}
      {!profileApproved && profileConfirmed && !profileRejected && !isEditing && (
        <Alert className="bg-blue-50 border-blue-200">
          <Clock className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-blue-800 text-sm flex items-start justify-between gap-3">
            <span>Submitted and <strong>awaiting HR review</strong>. You'll be notified once reviewed.</span>
            <button
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2 cursor-pointer whitespace-nowrap"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3" />Edit
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── CONFIRMED + editing warning ── */}
      {!profileApproved && profileConfirmed && !profileRejected && isEditing && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertTriangle className="size-4 text-blue-600 shrink-0 mt-0.5" />
          <AlertDescription className="text-blue-800 text-sm">
            Saving will resubmit your profile for HR review. Only your profile details are affected — other onboarding sections are unchanged.
          </AlertDescription>
        </Alert>
      )}

      {/* ── REJECTED state ── */}
      {(profileRejected || profileStatus === "rejected") && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertDescription className="text-amber-800 font-medium text-sm">
            HR has requested changes. Please review the note below, correct the information, and save again.
          </AlertDescription>
        </Alert>
      )}

      {profileStatus === "rejected" && profileRemarks.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="size-4 text-red-600 shrink-0" />
          <AlertDescription className="text-red-800">
            <strong>HR note:</strong> {profileRemarks.at(-1)!.remark_text}
          </AlertDescription>
        </Alert>
      )}

      <ScrollArea className="h-125 pr-4">
        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>Enter your complete personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    disabled={isLocked}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => handleInputChange("middle_name", e.target.value)}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    disabled={isLocked}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email_address">Personal Email *</Label>
                  <Input
                    id="email_address"
                    type="email"
                    value={formData.email_address}
                    onChange={(e) => handleInputChange("email_address", e.target.value)}
                    disabled={isLocked}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number *</Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange("phone_number", e.target.value)}
                    disabled={isLocked}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="complete_address">Complete Address *</Label>
                <Input
                  id="complete_address"
                  value={formData.complete_address}
                  onChange={(e) => handleInputChange("complete_address", e.target.value)}
                  disabled={isLocked}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <DateOfBirthPicker
                    id="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={(iso) => handleInputChange("date_of_birth", iso)}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="place_of_birth">Place of Birth</Label>
                  <Input
                    id="place_of_birth"
                    value={formData.place_of_birth}
                    onChange={(e) => handleInputChange("place_of_birth", e.target.value)}
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => handleInputChange("nationality", e.target.value)}
                    disabled={isLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="civil_status">Civil Status</Label>
                  <select
                    id="civil_status"
                    value={formData.civil_status}
                    onChange={(e) => handleInputChange("civil_status", e.target.value)}
                    disabled={isLocked}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contacts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Emergency Contacts</CardTitle>
                  <CardDescription>Add one or more emergency contacts</CardDescription>
                </div>
                {!isLocked && (
                  <Button type="button" variant="outline" size="sm" onClick={addContact}>
                    <Plus className="size-4 mr-1" />
                    Add Contact
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {contacts.map((contact, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Contact {index + 1}</span>
                    {!isLocked && contacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContact(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`contact_name_${index}`}>Name *</Label>
                      <Input
                        id={`contact_name_${index}`}
                        value={contact.contact_name}
                        onChange={(e) => handleContactChange(index, "contact_name", e.target.value)}
                        disabled={isLocked}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`relationship_${index}`}>Relationship *</Label>
                      <Input
                        id={`relationship_${index}`}
                        value={contact.relationship}
                        onChange={(e) => handleContactChange(index, "relationship", e.target.value)}
                        disabled={isLocked}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`emergency_phone_${index}`}>Phone Number *</Label>
                      <Input
                        id={`emergency_phone_${index}`}
                        type="tel"
                        value={contact.emergency_phone_number}
                        onChange={(e) => handleContactChange(index, "emergency_phone_number", e.target.value)}
                        disabled={isLocked}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`emergency_email_${index}`}>Email Address</Label>
                      <Input
                        id={`emergency_email_${index}`}
                        type="email"
                        value={contact.emergency_email_address ?? ""}
                        onChange={(e) => handleContactChange(index, "emergency_email_address", e.target.value)}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {!isLocked && (
            <div className="flex gap-3">
              {isEditing && (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              )}
              <Button onClick={handleSubmit} className="flex-1" disabled={saving}>
                <CheckCircle className="size-4 mr-2" />
                {saving ? "Saving..." : isEditing ? "Save & Resubmit" : "Submit Profile"}
              </Button>
            </div>
          )}

          <RemarksSection remarks={profileRemarks} />
        </div>
      </ScrollArea>
    </div>
  );
}
