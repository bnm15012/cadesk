import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates_/$templateId")({
  head: () => ({ meta: [{ title: "Template — CADesk" }] }),
  component: TemplateEditorPage,
});

function TemplateEditorPage() {
  const { templateId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = hasPerm(user, "templates.manage");
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const { data: template, isLoading } = useQuery({
    queryKey: ["template", templateId],
    queryFn: async () => {
      const [tpl, items] = await Promise.all([
        supabase.from("document_templates").select("*").eq("id", templateId).maybeSingle(),
        supabase.from("template_items").select("*").eq("template_id", templateId).order("sort_order"),
      ]);
      if (tpl.error) throw tpl.error;
      return { template: tpl.data, items: items.data ?? [] };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["template", templateId] });

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    const nextSort = (template?.items.at(-1)?.sort_order ?? -1) + 1;
    const { error } = await supabase.from("template_items").insert({
      template_id: templateId,
      name,
      category: newCategory.trim() || null,
      sort_order: nextSort,
      is_required: true,
      is_repeatable: false,
    });
    if (error) return void toast.error(error.message);
    setNewItem("");
    invalidate();
  };

  const updateItem = async (id: string, patch: Partial<{ name: string; category: string | null; is_required: boolean; is_repeatable: boolean; sort_order: number }>) => {
    const { error } = await supabase.from("template_items").update(patch).eq("id", id);
    if (error) return void toast.error(error.message);
    invalidate();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("template_items").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    invalidate();
  };

  const updateTemplate = async (patch: Partial<{ name: string; description: string | null }>) => {
    const { error } = await supabase.from("document_templates").update(patch).eq("id", templateId);
    if (error) return void toast.error(error.message);
    invalidate();
    toast.success("Saved");
  };

  const deleteTemplate = async () => {
    if (!confirm("Delete this template? Existing requests are unaffected.")) return;
    const { error } = await supabase.from("document_templates").delete().eq("id", templateId);
    if (error) return void toast.error(error.message);
    toast.success("Template deleted");
    navigate({ to: "/templates" });
  };

  if (isLoading) return <AppShell><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!template?.template) return <AppShell><p>Template not found.</p></AppShell>;

  return (
    <AppShell>
      <Link to="/templates" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Templates
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Input
            defaultValue={template.template.name}
            onBlur={(e) => e.target.value !== template.template!.name && updateTemplate({ name: e.target.value })}
            disabled={!canManage}
            className="font-display text-2xl font-semibold"
          />
          <Input
            defaultValue={template.template.description ?? ""}
            placeholder="Description"
            onBlur={(e) => updateTemplate({ description: e.target.value || null })}
            disabled={!canManage}
          />
        </div>
        {canManage && (
          <Button variant="outline" onClick={deleteTemplate} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 font-medium">Checklist items ({template.items.length})</p>
          <ul className="space-y-2">
            {template.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <Input
                    defaultValue={it.name}
                    onBlur={(e) => e.target.value !== it.name && updateItem(it.id, { name: e.target.value })}
                    disabled={!canManage}
                  />
                  <Input
                    defaultValue={it.category ?? ""}
                    placeholder="Category (optional)"
                    onBlur={(e) => updateItem(it.id, { category: e.target.value || null })}
                    disabled={!canManage}
                    className="text-xs"
                  />
                </div>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox checked={it.is_required} onCheckedChange={(v) => updateItem(it.id, { is_required: !!v })} disabled={!canManage} />
                  Required
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox checked={it.is_repeatable} onCheckedChange={(v) => updateItem(it.id, { is_repeatable: !!v })} disabled={!canManage} />
                  Multi-file
                </label>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
