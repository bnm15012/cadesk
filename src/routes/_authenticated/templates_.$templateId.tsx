import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import {
  getTemplate,
  addTemplateItem,
  updateTemplateItem,
  removeTemplateItem,
  updateTemplate,
  deleteTemplate,
} from "@/lib/template-detail.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, Save, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates_/$templateId")({
  head: () => ({ meta: [{ title: "Template — CA Vault" }] }),
  component: TemplateEditorPage,
});

function TemplateEditorPage() {
  const { templateId: templateIdParam } = Route.useParams();
  const templateId = Number(templateIdParam);
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = hasPerm(user, "templates.manage");
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  // Per-item edit state: itemId → { name, category }
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [itemEditName, setItemEditName] = useState("");
  const [itemEditCategory, setItemEditCategory] = useState("");

  const fetchTemplate = useServerFn(getTemplate);
  const doAddItem = useServerFn(addTemplateItem);
  const doUpdateItem = useServerFn(updateTemplateItem);
  const doRemoveItem = useServerFn(removeTemplateItem);
  const doUpdateTemplate = useServerFn(updateTemplate);
  const doDeleteTemplate = useServerFn(deleteTemplate);

  const { data: templateData, isLoading } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => fetchTemplate({ data: { templateId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["template", templateId] });

  // Seed edit fields when template loads
  useEffect(() => {
    if (templateData?.template) {
      setEditName(templateData.template.name);
      setEditDesc(templateData.template.description ?? "");
    }
  }, [templateData?.template?.name, templateData?.template?.description]);

  const handleSaveTemplate = async () => {
    if (!editName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await doUpdateTemplate({ data: { templateId, patch: { name: editName.trim(), description: editDesc.trim() || null } } });
      invalidate();
      setEditing(false);
      toast.success("Template saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) {
      toast.warning("Enter the item name before adding (e.g. Form 16, PAN copy, Bank statement).");
      return;
    }
    const nextSort = (templateData?.items.at(-1)?.sort_order ?? -1) + 1;
    try {
      await doAddItem({
        data: {
          templateId,
          name,
          category: newCategory.trim() || null,
          sortOrder: nextSort,
        },
      });
      setNewItem("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const handleUpdateItem = async (
    id: number,
    patch: Partial<{ name: string; category: string | null; is_required: boolean; is_repeatable: boolean; sort_order: number }>
  ) => {
    try {
      await doUpdateItem({ data: { itemId: id, patch } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    }
  };

  const handleRemoveItem = async (id: number) => {
    try {
      await doRemoveItem({ data: { itemId: id } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const startEditItem = (it: { id: number; name: string; category: string | null }) => {
    setEditingItem(it.id);
    setItemEditName(it.name);
    setItemEditCategory(it.category ?? "");
  };

  const cancelEditItem = () => {
    setEditingItem(null);
    setItemEditName("");
    setItemEditCategory("");
  };

  const saveEditItem = async (id: number) => {
    if (!itemEditName.trim()) { toast.error("Item name is required"); return; }
    try {
      await handleUpdateItem(id, {
        name: itemEditName.trim(),
        category: itemEditCategory.trim() || null,
      });
      setEditingItem(null);
    } catch {
      // error already toasted in handleUpdateItem
    }
  };

  const handleUpdateTemplate = async (patch: Partial<{ name: string; description: string | null }>) => {
    try {
      await doUpdateTemplate({ data: { templateId, patch } });
      invalidate();
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDeleteTemplate = async () => {
    try {
      await doDeleteTemplate({ data: { templateId } });
      toast.success("Template deleted");
      navigate({ to: "/templates" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  if (isLoading) return <AppShell><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!templateData?.template) return <AppShell><p>Template not found.</p></AppShell>;

  const tpl = templateData.template;

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm">
        {editing ? (
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="font-display text-xl font-semibold"
              placeholder="Template name *"
              autoFocus
            />
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveTemplate} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditName(tpl.name); setEditDesc(tpl.description ?? ""); }}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold">{tpl.name}</h1>
              {tpl.description && <p className="mt-1 text-muted-foreground text-sm">{tpl.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/templates"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
              </Button>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <strong>{tpl.name}</strong> and all its checklist items. Existing document requests are unaffected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 font-medium">Checklist items ({templateData.items.length})</p>
          <ul className="space-y-2">
            {templateData.items.map((it) => (
              <li key={it.id} className="rounded-md border border-border p-3">
                {editingItem === it.id ? (
                  /* ── Edit mode ── */
                  <div className="space-y-2">
                    <Input
                      value={itemEditName}
                      onChange={(e) => setItemEditName(e.target.value)}
                      placeholder="Item name *"
                      autoFocus
                    />
                    <Input
                      value={itemEditCategory}
                      onChange={(e) => setItemEditCategory(e.target.value)}
                      placeholder="Category (optional)"
                      className="text-xs"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => saveEditItem(it.id)}>
                        <Save className="mr-1 h-3 w-3" /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditItem}>
                        <X className="mr-1 h-3 w-3" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{it.name}</p>
                      {it.category && <p className="text-xs text-muted-foreground">{it.category}</p>}
                    </div>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Checkbox checked={it.is_required} onCheckedChange={(v) => handleUpdateItem(it.id, { is_required: !!v })} disabled={!canManage} />
                      Required
                    </label>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Checkbox checked={it.is_repeatable} onCheckedChange={(v) => handleUpdateItem(it.id, { is_repeatable: !!v })} disabled={!canManage} />
                      Multi-file
                    </label>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => startEditItem(it)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveItem(it.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {canManage && (
            <div className="mt-4 space-y-2 rounded-md border border-dashed border-border p-3">
              <Label className="text-xs">Add item</Label>
              <div className="flex flex-wrap gap-2">
                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Item name" className="flex-1" onKeyDown={(e) => e.key === "Enter" && addItem()} />
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category (optional)" className="w-48" />
                <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
