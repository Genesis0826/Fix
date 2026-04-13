"use client";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Sidebar } from "../components/Sidebar";
import { MobileRoleMenu } from "../components/MobileRoleMenu";
import { Header } from "../components/Header";
import { GradientHero } from "../components/GradientHero";
import { UserSession, authFetch } from "../services/auth";
import { API_BASE_URL } from "../lib/api";

type TemplateItem = {
  item_id: string;
  type: string;
  tab_category: string;
  title: string;
  description?: string;
  is_required: boolean;
};

type OnboardingTemplate = {
  template_id: string;
  name: string;
  department_id: string;
  position_id: string;
  default_deadline_days: number;
  created_at: string;
  template_items: TemplateItem[];
  position_name?: string | null;
  department_name?: string | null;
};

const TYPE_MAP: Record<string, string> = {
  documents: "upload",
  tasks: "task",
  equipment: "equipment",
  hr_forms: "form",
};

const CATEGORIES = ["documents", "tasks", "equipment", "hr_forms"] as const;
type Category = typeof CATEGORIES[number];

export const SystemAdminOnboardingScreen = ({ route, navigation }: any) => {
  const session: UserSession = route.params.session;
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expand/collapse per template
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("documents");

  // Toggle required
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  // Add item modal
  const [addModal, setAddModal] = useState(false);
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null);
  const [addCategory, setAddCategory] = useState<Category>("documents");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = () => {
    setLoading(true);
    authFetch(`${API_BASE_URL}/onboarding/system-admin/templates`)
      .then(res => res.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load templates."))
      .finally(() => setLoading(false));
  };

  const handleToggleRequired = async (templateId: string, itemId: string, current: boolean) => {
    setTogglingItemId(itemId);
    try {
      await authFetch(`${API_BASE_URL}/onboarding/system-admin/template-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_required: !current }),
      });
      setTemplates(prev => prev.map(t => t.template_id !== templateId ? t : {
        ...t,
        template_items: t.template_items.map(i =>
          i.item_id === itemId ? { ...i, is_required: !current } : i
        ),
      }));
    } catch {
      // silently fail — item stays as-is
    } finally {
      setTogglingItemId(null);
    }
  };

  const openAddModal = (templateId: string, category: Category) => {
    setAddingTemplateId(templateId);
    setAddCategory(category);
    setNewTitle("");
    setNewDescription("");
    setNewRequired(false);
    setAddModal(true);
  };

  const handleSaveItem = async () => {
    if (!addingTemplateId || !newTitle.trim()) return;
    setSavingItem(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/onboarding/system-admin/templates/${addingTemplateId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: TYPE_MAP[addCategory],
            tab_category: addCategory,
            title: newTitle.trim(),
            description: newDescription.trim() || undefined,
            is_required: newRequired,
          }),
        }
      );
      const item: TemplateItem = await res.json();
      setTemplates(prev => prev.map(t => t.template_id !== addingTemplateId ? t : {
        ...t,
        template_items: [...t.template_items, item],
      }));
      setAddModal(false);
    } catch {
      // silently fail
    } finally {
      setSavingItem(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {!isMobile && (
          <Sidebar role={session.role as any} activeScreen="SystemAdminOnboarding" navigation={navigation} session={session} />
        )}
        <View style={styles.content}>
          <Header
            title="Onboarding Templates"
            subtitle="Manage onboarding templates and assignments"
            rightElement={
              <MobileRoleMenu
                role={session.role as any}
                userName={session.name}
                email={session.email}
                activeScreen="SystemAdminOnboarding"
                navigation={navigation}
              />
            }
          />

          <GradientHero
            title="Template Management"
            subtitle="Create and manage onboarding templates"
          />

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{templates.length}</Text>
                <Text style={styles.statLabel}>Templates</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>
                  {templates.reduce((acc, t) => acc + (t.template_items?.length ?? 0), 0)}
                </Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
            </View>

            {loading && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1E40AF" />
                <Text style={styles.loadingText}>Loading templates...</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading && !error && templates.length === 0 && (
              <Text style={styles.emptyText}>No templates found.</Text>
            )}

            {templates.map(template => {
              const items = template.template_items || [];
              const isExpanded = expandedId === template.template_id;
              const visibleItems = items.filter(i => i.tab_category === activeCategory);

              return (
                <View key={template.template_id} style={styles.templateCard}>
                  {/* Header row */}
                  <TouchableOpacity
                    onPress={() => setExpandedId(isExpanded ? null : template.template_id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      {template.position_name ?? template.position_id} • {template.department_name ?? template.department_id}
                    </Text>
                    <Text style={styles.templateMeta}>Deadline: {template.default_deadline_days} days</Text>

                    {/* Item count chips */}
                    <View style={styles.itemsSummary}>
                      {CATEGORIES.map(cat => (
                        <View key={cat} style={styles.itemChip}>
                          <Text style={styles.itemChipNum}>{items.filter(i => i.tab_category === cat).length}</Text>
                          <Text style={styles.itemChipLabel}>{cat === "documents" ? "Docs" : cat === "tasks" ? "Tasks" : cat === "equipment" ? "Equip" : "HR"}</Text>
                        </View>
                      ))}
                    </View>

                    <Text style={styles.expandHint}>{isExpanded ? "▲ Collapse" : "▼ Manage items"}</Text>
                  </TouchableOpacity>

                  {/* Expanded section */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      {/* Category tabs */}
                      <View style={styles.catTabs}>
                        {CATEGORIES.map(cat => (
                          <TouchableOpacity
                            key={cat}
                            style={[styles.catTab, activeCategory === cat && styles.catTabActive]}
                            onPress={() => setActiveCategory(cat)}
                          >
                            <Text style={[styles.catTabText, activeCategory === cat && styles.catTabTextActive]}>
                              {cat === "documents" ? "Docs" : cat === "tasks" ? "Tasks" : cat === "equipment" ? "Equip" : "HR Forms"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Items list */}
                      {visibleItems.length === 0 ? (
                        <Text style={styles.emptyCategory}>No {activeCategory} yet</Text>
                      ) : (
                        visibleItems.map(item => (
                          <View key={item.item_id} style={styles.itemRow}>
                            <View style={styles.itemInfo}>
                              <Text style={styles.itemTitle}>{item.title}</Text>
                              {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                            </View>
                            <TouchableOpacity
                              style={[styles.requiredBadge, item.is_required ? styles.requiredOn : styles.requiredOff]}
                              onPress={() => handleToggleRequired(template.template_id, item.item_id, item.is_required)}
                              disabled={togglingItemId === item.item_id}
                            >
                              <Text style={[styles.requiredText, item.is_required ? styles.requiredTextOn : styles.requiredTextOff]}>
                                {togglingItemId === item.item_id ? "..." : item.is_required ? "Required" : "Optional"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}

                      {/* Add item button */}
                      <TouchableOpacity
                        style={styles.addItemBtn}
                        onPress={() => openAddModal(template.template_id, activeCategory)}
                      >
                        <Text style={styles.addItemBtnText}>
                          + Add {activeCategory === "documents" ? "Document" : activeCategory === "tasks" ? "Task" : activeCategory === "equipment" ? "Equipment" : "HR Form"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Add Item Modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Add {addCategory === "documents" ? "Document" : addCategory === "tasks" ? "Task" : addCategory === "equipment" ? "Equipment" : "HR Form"}
            </Text>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter title..."
              value={newTitle}
              onChangeText={setNewTitle}
            />

            {addCategory !== "documents" && (
              <>
                <Text style={styles.fieldLabel}>Description (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter description..."
                  value={newDescription}
                  onChangeText={setNewDescription}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}

            <TouchableOpacity
              style={styles.requiredToggleRow}
              onPress={() => setNewRequired(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, newRequired && styles.checkboxChecked]}>
                {newRequired && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.fieldLabel}>Required</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!newTitle.trim() || savingItem) && styles.saveBtnDisabled]}
                onPress={handleSaveItem}
                disabled={!newTitle.trim() || savingItem}
              >
                <Text style={styles.saveBtnText}>{savingItem ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  inner: { flex: 1, flexDirection: "row" },
  content: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 10, padding: 14, borderLeftWidth: 4, borderLeftColor: "#1E40AF", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statNum: { fontSize: 24, fontWeight: "800", color: "#1E293B" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  centered: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, color: "#64748B" },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: "#B91C1C", fontSize: 14 },
  emptyText: { color: "#64748B", textAlign: "center", paddingVertical: 24 },
  templateCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  templateName: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  templateMeta: { fontSize: 13, color: "#3B82F6", fontWeight: "600", marginBottom: 2 },
  itemsSummary: { flexDirection: "row", gap: 8, marginTop: 10 },
  itemChip: { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 8, padding: 8, alignItems: "center" },
  itemChipNum: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  itemChipLabel: { fontSize: 10, color: "#64748B", marginTop: 1 },
  expandHint: { fontSize: 12, color: "#94A3B8", marginTop: 10, textAlign: "right" },
  expandedSection: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  catTabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
  catTab: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center" },
  catTabActive: { backgroundColor: "#1E40AF" },
  catTabText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  catTabTextActive: { color: "#FFFFFF" },
  emptyCategory: { color: "#94A3B8", fontSize: 13, textAlign: "center", paddingVertical: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F8FAFC", gap: 10 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  itemDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  requiredBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  requiredOn: { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" },
  requiredOff: { backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" },
  requiredText: { fontSize: 11, fontWeight: "600" },
  requiredTextOn: { color: "#1D4ED8" },
  requiredTextOff: { color: "#94A3B8" },
  addItemBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: "#1E40AF", borderStyle: "dashed", alignItems: "center" },
  addItemBtnText: { color: "#1E40AF", fontSize: 13, fontWeight: "600" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 4 },
  textInput: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, fontSize: 14, color: "#1E293B", backgroundColor: "#F8FAFC" },
  textArea: { height: 80, textAlignVertical: "top" },
  requiredToggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  checkmark: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center" },
  cancelBtnText: { color: "#64748B", fontWeight: "600" },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#1E40AF", alignItems: "center" },
  saveBtnDisabled: { backgroundColor: "#94A3B8" },
  saveBtnText: { color: "#FFFFFF", fontWeight: "700" },
});
