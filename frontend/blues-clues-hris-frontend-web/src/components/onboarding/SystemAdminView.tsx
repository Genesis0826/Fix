"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Settings,
  FileCheck,
  ListChecks,
  Package,
  Plus,
  Eye,
  Search,
  Building,
  Users,
  ClipboardList,
  LayoutTemplate,
  Save,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import type { OnboardingTemplate, JobPosition, Department } from "@/types/onboarding.types";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { getAllTemplates, createTemplate, getAllPositions, createPosition, getDepartments, addTemplateItem, updateTemplateItem } from "@/lib/onboardingApi";

export default function SystemAdminView() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New template states
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDepartment, setNewTemplateDepartment] = useState("");
  const [newTemplatePosition, setNewTemplatePosition] = useState("");
  const [newTemplateDeadline, setNewTemplateDeadline] = useState("7");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Template item editing states
  const [addItemCategory, setAddItemCategory] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(false);
  const [savingNewItem, setSavingNewItem] = useState(false);
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  // New department/position states
  const [showNewDepartmentDialog, setShowNewDepartmentDialog] = useState(false);
  const [showNewPositionDialog, setShowNewPositionDialog] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [newPositionDepartment, setNewPositionDepartment] = useState("");

  useEffect(() => {
    getAllTemplates().then(setTemplates).catch(console.error);
    getDepartments().then(setDepartments).catch(console.error);
    getAllPositions().then(setPositions).catch(console.error);
  }, []);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateDepartment || !newTemplatePosition) return;

    setCreatingTemplate(true);
    try {
      await createTemplate({
        name: newTemplateName.trim(),
        department_id: newTemplateDepartment,
        position_id: newTemplatePosition,
        default_deadline_days: Number.parseInt(newTemplateDeadline),
        items: [],
      });
      const updated = await getAllTemplates();
      setTemplates(updated);
      setNewTemplateName("");
      setNewTemplateDepartment("");
      setNewTemplatePosition("");
      setNewTemplateDeadline("7");
      setShowNewTemplateDialog(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleCreateDepartment = () => {
    // Department creation is managed at the Supabase level; this dialog is informational only.
    setNewDepartmentName("");
    setShowNewDepartmentDialog(false);
  };

  const handleCreatePosition = async () => {
    if (!newPositionTitle.trim() || !newPositionDepartment) return;
    try {
      await createPosition(newPositionDepartment, newPositionTitle);
      const updated = await getAllPositions();
      setPositions(updated);
    } catch (err) {
      console.error(err);
    }
    setNewPositionTitle("");
    setNewPositionDepartment("");
    setShowNewPositionDialog(false);
  };

  const typeForCategory: Record<string, string> = { documents: 'upload', tasks: 'task', equipment: 'equipment', hr_forms: 'form' };

  const handleAddTemplateItem = async (tab_category: string) => {
    if (!selectedTemplate || !newItemTitle.trim()) return;
    setSavingNewItem(true);
    try {
      const item = await addTemplateItem(selectedTemplate.template_id, {
        type: typeForCategory[tab_category] ?? tab_category,
        tab_category,
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || undefined,
        is_required: newItemRequired,
      });
      const addItem = (t: typeof selectedTemplate) => ({ ...t, template_items: [...t.template_items, item] });
      setSelectedTemplate(prev => prev ? addItem(prev) : prev);
      setTemplates(prev => prev.map(t => t.template_id === selectedTemplate.template_id ? addItem(t) : t));
      setNewItemTitle("");
      setNewItemDescription("");
      setNewItemRequired(false);
      setAddItemCategory(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNewItem(false);
    }
  };

  const handleToggleRequired = async (itemId: string, currentValue: boolean) => {
    if (!selectedTemplate) return;
    setTogglingItemId(itemId);
    try {
      await updateTemplateItem(itemId, { is_required: !currentValue });
      const toggle = (items: typeof selectedTemplate.template_items) =>
        items.map(i => i.item_id === itemId ? { ...i, is_required: !currentValue } : i);
      setSelectedTemplate(prev => prev ? { ...prev, template_items: toggle(prev.template_items) } : prev);
      setTemplates(prev => prev.map(t => t.template_id === selectedTemplate.template_id
        ? { ...t, template_items: toggle(t.template_items) } : t));
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingItemId(null);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.department_name ?? t.department_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.position_name ?? t.position_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="size-8" />
              System Administration
            </h1>
            <p className="text-slate-600">Manage onboarding templates, departments, and system settings</p>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <LayoutTemplate className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
              <p className="text-xs text-slate-500">Onboarding templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departments.length}</div>
              <p className="text-xs text-slate-500">Active departments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positions</CardTitle>
              <ClipboardList className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positions.length}</div>
              <p className="text-xs text-slate-500">Position types</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="size-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {departments.length}
              </div>
              <p className="text-xs text-slate-500">Across all departments</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="templates">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="templates">
                  <LayoutTemplate className="size-4 mr-2" />
                  Onboarding Templates
                </TabsTrigger>
                <TabsTrigger value="departments">
                  <Building className="size-4 mr-2" />
                  Departments
                </TabsTrigger>
                <TabsTrigger value="positions">
                  <ClipboardList className="size-4 mr-2" />
                  Positions
                </TabsTrigger>
              </TabsList>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-4 mt-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setShowNewTemplateDialog(true)}>
                    <Plus className="size-4 mr-2" />
                    New Template
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>HR Forms</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.template_id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>{template.department_name ?? template.department_id}</TableCell>
                        <TableCell>{template.position_name ?? template.position_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "documents").length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "tasks").length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "equipment").length}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.template_items.filter(i => i.tab_category === "hr_forms").length}
                          </Badge>
                        </TableCell>
                        <TableCell>{template.default_deadline_days} days</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <Eye className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTemplates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          No templates found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Departments Tab */}
              <TabsContent value="departments" className="space-y-4 mt-4">
                <div className="flex justify-end">
                  <Button onClick={() => setShowNewDepartmentDialog(true)}>
                    <Plus className="size-4 mr-2" />
                    Add Department
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department Name</TableHead>
                      <TableHead>Company ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.department_id}>
                        <TableCell className="font-medium">{dept.department_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dept.company_id}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Positions Tab */}
              <TabsContent value="positions" className="space-y-4 mt-4">
                <div className="flex justify-end">
                  <Button onClick={() => setShowNewPositionDialog(true)}>
                    <Plus className="size-4 mr-2" />
                    Add Position
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position Title</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => (
                      <TableRow key={pos.position_id}>
                        <TableCell className="font-medium">{pos.position_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pos.department_name ?? pos.department_id}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* View Template Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              View and manage items for this onboarding template
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Tabs defaultValue="documents" onValueChange={() => setAddItemCategory(null)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="documents">
                    <FileCheck className="size-4 mr-2" />
                    Documents ({selectedTemplate.template_items.filter(i => i.tab_category === "documents").length})
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    <ListChecks className="size-4 mr-2" />
                    Tasks ({selectedTemplate.template_items.filter(i => i.tab_category === "tasks").length})
                  </TabsTrigger>
                  <TabsTrigger value="equipment">
                    <Package className="size-4 mr-2" />
                    Equipment ({selectedTemplate.template_items.filter(i => i.tab_category === "equipment").length})
                  </TabsTrigger>
                  <TabsTrigger value="hr_forms">
                    <ClipboardList className="size-4 mr-2" />
                    HR Forms ({selectedTemplate.template_items.filter(i => i.tab_category === "hr_forms").length})
                  </TabsTrigger>
                </TabsList>

                {(["documents", "tasks", "equipment", "hr_forms"] as const).map((cat) => {
                  const labelMap: Record<string, string> = { documents: "Document", tasks: "Task", equipment: "Equipment", hr_forms: "HR Form" };
                  const hasDescription = cat !== "documents";
                  return (
                  <TabsContent key={cat} value={cat} className="mt-4 space-y-3">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setAddItemCategory(cat); setNewItemTitle(""); setNewItemDescription(""); setNewItemRequired(false); }}>
                        <Plus className="size-3 mr-1" />
                        Add {labelMap[cat]}
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          {hasDescription && <TableHead>Description</TableHead>}
                          <TableHead className="w-[120px]">Required</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTemplate.template_items.filter(i => i.tab_category === cat).map((item) => (
                          <TableRow key={item.item_id}>
                            <TableCell className="font-medium">{item.title}</TableCell>
                            {hasDescription && <TableCell className="text-sm text-slate-600">{item.description ?? "—"}</TableCell>}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={item.is_required}
                                  disabled={togglingItemId === item.item_id}
                                  onCheckedChange={() => handleToggleRequired(item.item_id, item.is_required)}
                                />
                                <span className="text-sm text-slate-600">{item.is_required ? "Required" : "Optional"}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {selectedTemplate.template_items.filter(i => i.tab_category === cat).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={hasDescription ? 3 : 2} className="text-center py-4 text-slate-500">
                              No {labelMap[cat].toLowerCase()}s yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    {addItemCategory === cat && (
                      <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                        <p className="text-sm font-medium">New {labelMap[cat]}</p>
                        <div className="space-y-1">
                          <Label>Title *</Label>
                          <Input
                            placeholder="Enter title..."
                            value={newItemTitle}
                            onChange={(e) => setNewItemTitle(e.target.value)}
                          />
                        </div>
                        {hasDescription && (
                          <div className="space-y-1">
                            <Label>Description</Label>
                            <Textarea
                              placeholder="Optional description..."
                              value={newItemDescription}
                              onChange={(e) => setNewItemDescription(e.target.value)}
                              rows={2}
                              className="resize-none"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="new-item-required"
                            checked={newItemRequired}
                            onCheckedChange={(v) => setNewItemRequired(v as boolean)}
                          />
                          <Label htmlFor="new-item-required">Required</Label>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setAddItemCategory(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => handleAddTemplateItem(cat)} disabled={savingNewItem || !newItemTitle.trim()}>
                            <Save className="size-3 mr-1" />
                            {savingNewItem ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          )}

          <div className="px-6 py-4 border-t flex justify-end">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Template Dialog */}
      <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Onboarding Template</DialogTitle>
            <DialogDescription>
              Set up a new template for employee onboarding
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Senior Developer Onboarding"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newTemplateDepartment} onValueChange={setNewTemplateDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.department_id} value={dept.department_id}>
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={newTemplatePosition} onValueChange={setNewTemplatePosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {positions
                    .filter(p => !newTemplateDepartment || p.department_id === newTemplateDepartment)
                    .map((pos) => (
                      <SelectItem key={pos.position_id} value={pos.position_id}>
                        {pos.position_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deadline (days)</Label>
              <Input
                type="number"
                placeholder="7"
                value={newTemplateDeadline}
                onChange={(e) => setNewTemplateDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={creatingTemplate}>
              <Save className="size-4 mr-2" />
              {creatingTemplate ? "Creating..." : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Department Dialog */}
      <Dialog open={showNewDepartmentDialog} onOpenChange={setShowNewDepartmentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>
              Create a new department in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                placeholder="e.g., Human Resources"
                value={newDepartmentName}
                onChange={(e) => setNewDepartmentName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewDepartmentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDepartment}>
              <Plus className="size-4 mr-2" />
              Add Department
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Position Dialog */}
      <Dialog open={showNewPositionDialog} onOpenChange={setShowNewPositionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Position</DialogTitle>
            <DialogDescription>
              Create a new position type in the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Position Title</Label>
              <Input
                placeholder="e.g., Lead Developer"
                value={newPositionTitle}
                onChange={(e) => setNewPositionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newPositionDepartment} onValueChange={setNewPositionDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.department_id} value={dept.department_id}>
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewPositionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePosition}>
              <Plus className="size-4 mr-2" />
              Add Position
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
