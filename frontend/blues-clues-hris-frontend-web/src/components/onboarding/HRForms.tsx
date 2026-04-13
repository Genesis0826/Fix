import { useState } from "react";
import { confirmTask } from "@/lib/onboardingApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { HRFormItem, Remark } from "@/types/onboarding.types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DetailedStatusBadge } from "./shared/StatusBadge";
import { RemarksSection } from "./shared/RemarksSection";

interface HRFormsProps {
  forms: HRFormItem[];
  remarks: Remark[];
  onUpdate: (forms: HRFormItem[]) => void;
}

interface FormField {
  label: string;
  type: string;
  required: boolean;
}

function getFormFields(form: HRFormItem): FormField[] {
  if (!form.rich_content) return [];
  try {
    return JSON.parse(form.rich_content);
  } catch {
    return [];
  }
}

export function HRForms({ forms, remarks, onUpdate }: Readonly<HRFormsProps>) {
  const [expandedForm, setExpandedForm] = useState<string | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, Record<string, any>>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const handleInputChange = (formId: string, field: string, value: any) => {
    setFormDataState(prev => ({
      ...prev,
      [formId]: {
        ...prev[formId],
        [field]: value,
      },
    }));
  };

  const handleSubmitForm = async (form: HRFormItem) => {
    const formData = formDataState[form.onboarding_item_id] || {};
    const fields = getFormFields(form);

    const missingFields = fields.filter(
      field => field.required && !formData[field.label]
    );

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.map(f => f.label).join(", ")}`);
      return;
    }

    setSubmitting(prev => ({ ...prev, [form.onboarding_item_id]: true }));
    try {
      await confirmTask(form.onboarding_item_id);
      const updatedForms = forms.map(f => {
        if (f.onboarding_item_id === form.onboarding_item_id) {
          return {
            ...f,
            status: "confirmed" as const,
          };
        }
        return f;
      });
      onUpdate(updatedForms);
      setExpandedForm(null);
      alert(`${form.title} submitted successfully!`);
    } catch {
      alert("Failed to submit form. Please try again.");
    } finally {
      setSubmitting(prev => ({ ...prev, [form.onboarding_item_id]: false }));
    }
  };

  const renderFormField = (form: HRFormItem, field: FormField) => {
    const value = formDataState[form.onboarding_item_id]?.[field.label] || "";
    const isDisabled = form.status !== "pending" && form.status !== "rejected";

    if (field.type === "select") {
      return (
        <select
          value={value}
          onChange={(e) => handleInputChange(form.onboarding_item_id, field.label, e.target.value)}
          disabled={isDisabled}
          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
          required={field.required}
        >
          <option value="">Select...</option>
          {field.label === "Account Type" && (
            <>
              <option value="Savings">Savings</option>
              <option value="Checking">Checking</option>
            </>
          )}
          {field.label === "Civil Status" && (
            <>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
            </>
          )}
          {field.label === "Tax Status" && (
            <>
              <option value="S">S – Single</option>
              <option value="S1">S1 – Single, 1 dependent</option>
              <option value="S2">S2 – Single, 2 dependents</option>
              <option value="S3">S3 – Single, 3 dependents</option>
              <option value="S4">S4 – Single, 4+ dependents</option>
              <option value="ME">ME – Married Employee</option>
              <option value="ME1">ME1 – Married, 1 dependent</option>
              <option value="ME2">ME2 – Married, 2 dependents</option>
              <option value="ME3">ME3 – Married, 3 dependents</option>
              <option value="ME4">ME4 – Married, 4+ dependents</option>
              <option value="HF">HF – Head of Family</option>
              <option value="Z">Z – Zero Exemption</option>
            </>
          )}
        </select>
      );
    }
    return (
      <Input
        type={field.type}
        value={value}
        onChange={(e) => handleInputChange(form.onboarding_item_id, field.label, e.target.value)}
        disabled={isDisabled}
        required={field.required}
      />
    );
  };

  const formsRemarks = remarks.filter(r => r.tab_tag === "Forms");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">HR Forms &amp; Processes</h3>
        <p className="text-sm text-gray-600">Complete all required HR forms</p>
      </div>

      <ScrollArea className="h-137.5 pr-4">
        <div className="space-y-4">
          {forms.map((form) => {
            const fields = getFormFields(form);
            const formRemarks = remarks.filter(r => r.tab_tag === "Forms");
            return (
              <Card key={form.onboarding_item_id} className={form.is_required ? "border-l-4 border-l-red-500" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="size-4" />
                        {form.title}
                        {form.is_required && <span className="text-red-500 text-sm">*</span>}
                      </CardTitle>
                      {form.description && (
                        <CardDescription className="text-sm mt-1">{form.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <DetailedStatusBadge status={form.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedForm(expandedForm === form.onboarding_item_id ? null : form.onboarding_item_id)}
                      >
                        {expandedForm === form.onboarding_item_id ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expandedForm === form.onboarding_item_id && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {form.status === "rejected" && formRemarks.length > 0 && (
                      <Alert className="bg-red-50 border-red-200">
                        <XCircle className="size-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          <strong>Rejected:</strong> {formRemarks.at(-1)!.remark_text}
                        </AlertDescription>
                      </Alert>
                    )}

                    {fields.length > 0 && (
                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <div key={field.label} className="space-y-2">
                            <Label htmlFor={`${form.onboarding_item_id}-${field.label}`}>
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            {renderFormField(form, field)}
                          </div>
                        ))}
                      </div>
                    )}

                    {fields.length === 0 && form.description && (
                      <p className="text-sm text-gray-600">{form.description}</p>
                    )}

                    {(form.status === "pending" || form.status === "rejected") && (
                      <Button
                        onClick={() => handleSubmitForm(form)}
                        className="w-full"
                        disabled={submitting[form.onboarding_item_id]}
                      >
                        <CheckCircle className="size-4 mr-2" />
                        {submitting[form.onboarding_item_id]
                          ? "Submitting..."
                          : form.status === "rejected" ? "Resubmit Form" : "Submit Form"}
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <RemarksSection remarks={formsRemarks} />
    </div>
  );
}
