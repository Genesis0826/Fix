import { useState, useEffect } from "react";
import { submitForReview } from "@/lib/onboardingApi";
import { Clock, AlertCircle, CheckCircle, XCircle, User as UserIcon, FileText, ClipboardList, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DocumentUpload } from "./DocumentUpload";
import { TaskChecklist } from "./TaskChecklist";
import { EquipmentRequest } from "./EquipmentRequest";
import { ProfileSetup } from "./ProfileSetup";
import { HRForms } from "./HRForms";
import { OnboardingSession, DocumentItem, TaskItem, EquipmentItem, HRFormItem, ProfileData, OnboardingItemBase } from "@/types/onboarding.types";

interface OnboardingProcessProps {
  session: OnboardingSession;
  onUpdateSession: (session: OnboardingSession) => void;
  onComplete: () => void;
  userRole?: "employee" | "hr" | "admin";
}

export function OnboardingProcess({
  session,
  onUpdateSession,
  onComplete,
  userRole = "employee",
}: Readonly<OnboardingProcessProps>) {
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [submittingForReview, setSubmittingForReview] = useState(false);

  const isEmployee = userRole === "employee";
  const documents = session.documents || [];
  const tasks = session.tasks || [];
  const equipment = session.equipment || [];
  const hrForms = session.hr_forms || [];
  const profileItems: OnboardingItemBase[] = session.profile_items || [];
  const welcomeItems: OnboardingItemBase[] = session.welcome || [];
  const displayTasks = isEmployee
    ? tasks.filter(t => t.type !== "video")
    : tasks;

  useEffect(() => {
    const today = new Date();
    const deadline = new Date(session.deadline_date);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysRemaining(diffDays);
  }, [session.deadline_date]);

  const allItems = [...documents, ...displayTasks, ...equipment, ...hrForms, ...profileItems];
  const requiredItems = allItems.filter(i => i.is_required);
  const completedItems = requiredItems.filter(i => ['approved', 'confirmed', 'issued'].includes(i.status));
  const progress = requiredItems.length > 0
    ? Math.round((completedItems.length / requiredItems.length) * 100)
    : 0;

  const handleUpdateDocuments = (docs: DocumentItem[]) => {
    onUpdateSession({ ...session, documents: docs });
  };

  const handleUpdateTasks = (tasks: TaskItem[]) => {
    onUpdateSession({ ...session, tasks: tasks });
  };

  const handleUpdateEquipment = (equipment: EquipmentItem[]) => {
    onUpdateSession({ ...session, equipment: equipment });
  };

  const handleUpdateHRForms = (forms: HRFormItem[]) => {
    onUpdateSession({ ...session, hr_forms: forms });
  };

  const handleUpdateProfile = (profile: ProfileData) => {
    onUpdateSession({
      ...session,
      profile: profile,
      profile_items: session.profile_items.map(item => ({ ...item, status: 'confirmed' as const })),
    });
  };

  const handleSubmitForReview = async () => {
    if (progress < 100) {
      alert("Please complete all required items before submitting for review");
      return;
    }

    setSubmittingForReview(true);
    try {
      await submitForReview(session.session_id);
      onUpdateSession({
        ...session,
        status: "for-review",
      });
      alert("Your onboarding has been submitted for final review!");
      onComplete();
    } catch {
      alert("Failed to submit for review. Please try again.");
    } finally {
      setSubmittingForReview(false);
    }
  };

  const getDeadlineAlert = () => {
    if (daysRemaining <= 0) {
      return (
        <Alert className="border-red-500 bg-red-50">
          <AlertCircle className="size-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Overdue!</strong> Your onboarding deadline has passed.
          </AlertDescription>
        </Alert>
      );
    } else if (daysRemaining <= 3) {
      return (
        <Alert className="border-orange-500 bg-orange-50">
          <AlertCircle className="size-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Urgent!</strong> Only {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining until your deadline.
          </AlertDescription>
        </Alert>
      );
    } else if (daysRemaining <= 7) {
      return (
        <Alert className="border-yellow-500 bg-yellow-50">
          <Clock className="size-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {daysRemaining} days remaining. Please complete all items soon.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  const approvedCount = [
    ...documents.filter(d => d.status === "approved"),
    ...displayTasks.filter(t => t.status === "approved" || t.status === "confirmed"),
    ...equipment.filter(e => e.status === "approved" || e.status === "issued"),
    ...hrForms.filter(f => f.status === "approved"),
    ...profileItems.filter(p => p.status === "approved"),
  ].length;

  const underReviewCount = [
    ...documents.filter(d => d.status === "for-review"),
    ...displayTasks.filter(t => t.status === "for-review"),
    ...equipment.filter(e => e.status === "for-review"),
    ...hrForms.filter(f => f.status === "for-review" || f.status === "confirmed"),
    ...profileItems.filter(p => p.status === "confirmed"),
  ].length;

  const remainingCount = [
    ...profileItems.filter(p => p.status === "pending" || p.status === "rejected"),
    ...documents.filter(d => d.status === "pending" || d.status === "rejected"),
    ...displayTasks.filter(t => t.status === "pending" || t.status === "rejected"),
    ...equipment.filter(e => e.status === "pending" || e.status === "rejected"),
    ...hrForms.filter(f => f.status === "pending" || f.status === "rejected"),
  ].length;


  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl mb-4">Employee Onboarding</h1>
          <div className="flex gap-4">
            <div className="border rounded-lg p-4 flex-1">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Role</p>
              <p className="font-semibold text-slate-800 whitespace-nowrap">
                {session.assigned_position} • {session.assigned_department}
              </p>
            </div>
            <div className="border rounded-lg p-4 flex-1">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">Deadline</p>
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-slate-500" />
                <p className="font-semibold text-slate-800">
                  {new Date(session.deadline_date).toLocaleDateString('en-US')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Deadline Alert */}
        {getDeadlineAlert()}

        {/* Rejected Items Alert */}
        {(() => {
          const rejectedItems = [
            ...profileItems.filter(i => i.status === "rejected").map(i => ({ ...i, tab: "Profile" })),
            ...documents.filter(i => i.status === "rejected").map(i => ({ ...i, tab: "Documents" })),
            ...hrForms.filter(i => i.status === "rejected").map(i => ({ ...i, tab: "HR Forms" })),
            ...displayTasks.filter(i => i.status === "rejected").map(i => ({ ...i, tab: "Tasks" })),
            ...equipment.filter(i => i.status === "rejected").map(i => ({ ...i, tab: "Equipment" })),
          ];
          if (rejectedItems.length === 0) return null;
          return (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="size-4 text-red-600 shrink-0" />
              <AlertDescription className="text-red-800">
                <p className="font-semibold mb-1">Action required — {rejectedItems.length} item{rejectedItems.length > 1 ? "s" : ""} need{rejectedItems.length === 1 ? "s" : ""} your attention:</p>
                <ul className="list-disc list-inside space-y-0.5 text-sm">
                  {rejectedItems.map(i => (
                    <li key={i.onboarding_item_id}>
                      <span className="font-medium">{i.title}</span>
                      <span className="text-red-600 ml-1">({i.tab})</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm">Check the remarks in each section, correct the information, and resubmit.</p>
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* Progress Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Overall Progress</CardTitle>
              <Badge variant={progress === 100 ? "default" : "secondary"}>{progress}% Complete</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle className="size-4 text-green-600" />
                <span>{approvedCount} approved</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-orange-600" />
                <span>{underReviewCount} under review</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-slate-600" />
                <span>{remainingCount} remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Onboarding Content */}
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Checklist</CardTitle>
            <CardDescription>Complete all required sections below</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <UserIcon className="size-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="forms" className="flex items-center gap-2">
                  <ClipboardList className="size-4" />
                  HR Forms
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex items-center gap-2">
                  <CheckCircle className="size-4" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="equipment" className="flex items-center gap-2">
                  <Monitor className="size-4" />
                  Equipment
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <ProfileSetup
                  profile={session.profile}
                  sessionId={session.session_id}
                  remarks={session.remarks}
                  onUpdate={handleUpdateProfile}
                  profileRejected={session.profile_items?.some(i => i.status === "rejected")}
                  profileApproved={session.profile_items?.some(i => i.status === "approved")}
                  profileConfirmed={session.profile_items?.some(i => i.status === "confirmed")}
                />
              </TabsContent>

              <TabsContent value="documents">
                <DocumentUpload
                  documents={documents}
                  remarks={session.remarks.filter(r => r.tab_tag === "Documents")}
                  onUpdate={handleUpdateDocuments}
                />
              </TabsContent>

              <TabsContent value="forms">
                <HRForms
                  forms={hrForms}
                  remarks={session.remarks.filter(r => r.tab_tag === "Forms")}
                  onUpdate={handleUpdateHRForms}
                />
              </TabsContent>

              <TabsContent value="tasks">
                <TaskChecklist
                  tasks={displayTasks}
                  remarks={session.remarks.filter(r => r.tab_tag === "Tasks")}
                  onUpdateTasks={handleUpdateTasks}
                />
              </TabsContent>

              <TabsContent value="equipment">
                <EquipmentRequest
                  equipment={equipment}
                  remarks={session.remarks.filter(r => r.tab_tag === "Equipment")}
                  onUpdateEquipment={handleUpdateEquipment}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {progress === 100 && session.status !== "for-review" && session.status !== "approved" && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-900">Ready to Submit</h3>
                  <p className="text-sm text-green-700">You've completed all requirements. Submit for final review.</p>
                </div>
                <Button onClick={handleSubmitForReview} className="bg-green-600 hover:bg-green-700" disabled={submittingForReview}>
                  <CheckCircle className="size-4 mr-2" />
                  {submittingForReview ? "Submitting..." : "Submit for Final Review"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
