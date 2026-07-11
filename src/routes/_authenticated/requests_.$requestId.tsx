import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { logActivity } from "@/lib/activity";
import { getUploadUrl, getDownloadUrl, deleteStorageFile } from "@/lib/storage";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type DocStatus } from "@/components/StatusBadge";
import { ArrowLeft, Upload, Download, Trash2, MessageSquare, Plus, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/requests_/$requestId")({
  head: () => ({ meta: [{ title: "Request — CADesk" }] }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [newItemName, setNewItemName] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const canReview = hasPerm(user, "documents.review");
  const canDelete = hasPerm(user, "documents.delete");
  const canAddItem = hasPerm(user, "documents.request");
  const canUpload = hasPerm(user, "documents.upload") || user?.isClient;

  const { data, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => {
      const [req, items] = await Promise.all([
        supabase
          .from("document_requests")
          .select("*, clients(name, id), financial_years(label)")
          .eq("id", requestId)
          .maybeSingle(),
        supabase
          .from("request_items")
          .select("*, document_files(*)")
          .eq("request_id", requestId)
          .order("sort_order"),
      ]);
      if (req.error) throw req.error;
      return { request: req.data, items: items.data ?? [] };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", activeItemId],
    enabled: !!activeItemId,
    queryFn: async () => {
      const { data } = await supabase
        .from("document_comments")
        .select("*")
        .eq("request_item_id", activeItemId!)
        .order("created_at", { ascending: true });
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const nameMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profs ?? []).forEach((p) => nameMap.set(p.id, p.full_name));
      }
      return rows.map((r) => ({ ...r, authorName: nameMap.get(r.user_id) ?? "User" }));
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["request", requestId] });

  const fetchUploadUrl = useServerFn(getUploadUrl);
  const fetchDownloadUrl = useServerFn(getDownloadUrl);
  const removeStorageFile = useServerFn(deleteStorageFile);

  const addItem = async () => {
    if (!user?.tenantId || !newItemName.trim()) return;
    const nextSort = (data?.items.at(-1)?.sort_order ?? -1) + 1;
    const { error } = await supabase.from("request_items").insert({
      request_id: requestId,
      tenant_id: user.tenantId,
      name: newItemName.trim(),
      sort_order: nextSort,
      is_required: true,
      is_repeatable: false,
      status: "pending" as const,
    });
    if (error) return void toast.error(error.message);
    setNewItemName("");
    invalidate();
  };

  const uploadFile = async (item: { id: string; name: string }, file: File) => {
    if (!user?.tenantId) return;

    // Path: {clientName}/{financialYear}/{documentName}/{timestamp}_{filename}
    // e.g. "Sharma_and_Associates/FY_2024-25/PAN_Card/1720000000000_pan.pdf"
    const slug = (s: string) => s.trim().replace(/[^\w\-]/g, "_").replace(/_+/g, "_");
    const reqData    = data?.request;
    const clientName = slug((reqData?.clients as { name: string } | null)?.name ?? `client_${reqData?.client_id ?? requestId}`);
    const fyLabel    = slug((reqData?.financial_years as { label: string } | null)?.label ?? "unknown_fy");
    const docName    = slug(item.name);
    const fileName   = file.name.replace(/[^\w.\-]/g, "_");
    const storagePath = `${clientName}/${fyLabel}/${docName}/${Date.now()}_${fileName}`;

    toast.loading("Uploading…", { id: "upload" });
    try {
      // 1. Get presigned upload URL from server (R2)
      const { url } = await fetchUploadUrl({
        data: { storagePath, contentType: file.type || "application/octet-stream", contentLength: file.size },
      });

      // 2. Upload directly from browser to R2
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!uploadRes.ok) throw new Error("Upload to storage failed");

      // 3. Save metadata to MySQL via Supabase PostgREST
      const { error: insErr } = await supabase.from("document_files").insert({
        request_item_id: item.id,
        tenant_id: user.tenantId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user.userId,
      });
      if (insErr) throw new Error(insErr.message);

      // 4. Update item status
      await supabase.from("request_items").update({ status: "uploaded" as const }).eq("id", item.id);
      logActivity({ tenantId: user.tenantId, userId: user.userId, action: `Uploaded ${file.name}`, entityType: "request_item", entityId: item.id });
      toast.success("File uploaded", { id: "upload" });
      invalidate();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed", { id: "upload" });
    }
  };

  const downloadFile = async (path: string, name: string) => {
    try {
      const { url } = await fetchDownloadUrl({ data: { storagePath: path, fileName: name } });
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
    } catch (err: any) {
      toast.error(err.message ?? "Download failed");
    }
  };

  const deleteFile = async (fileId: string, path: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      await removeStorageFile({ data: { storagePath: path } });
      await supabase.from("document_files").delete().eq("id", fileId);
      invalidate();
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    }
  };

  const updateStatus = async (itemId: string, status: DocStatus) => {
    if (!user) return;
    const patch: { status: DocStatus; reviewed_by?: string; reviewed_at?: string } = { status };
    if (status === "approved" || status === "rejected" || status === "reupload_required") {
      patch.reviewed_by = user.userId;
      patch.reviewed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("request_items").update(patch).eq("id", itemId);
    if (error) return void toast.error(error.message);
    logActivity({ tenantId: user.tenantId!, userId: user.userId, action: `Marked item as ${status}`, entityType: "request_item", entityId: itemId });
    invalidate();
  };

  const removeItem = async (id: string) => {
    if (!confirm("Delete this item and all its files?")) return;
    await supabase.from("request_items").delete().eq("id", id);
    invalidate();
  };

  const addComment = async (itemId: string, body: string) => {
    if (!user?.tenantId || !body.trim()) return;
    const { error } = await supabase.from("document_comments").insert({
      request_item_id: itemId,
      tenant_id: user.tenantId,
      user_id: user.userId,
      body: body.trim(),
    });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["comments", itemId] });
  };

  const markCompleted = async () => {
    if (!user?.tenantId) return;
    await supabase.from("document_requests").update({ status: "completed" as const }).eq("id", requestId);
    logActivity({ tenantId: user.tenantId, userId: user.userId, action: "Marked request completed", entityType: "request", entityId: requestId });
    invalidate();
  };

  if (isLoading) return <AppShell><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!data?.request) return <AppShell><p>Request not found.</p></AppShell>;

  const req = data.request;
  const approved = data.items.filter((i) => i.status === "approved").length;
  const backLink = user?.isClient && !user.isFirmMember ? "/portal" : "/requests";

  return (
    <AppShell>
      <Link to={backLink} className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{req.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(req.clients as { name: string } | null)?.name} · {(req.financial_years as { label: string } | null)?.label} · {approved}/{data.items.length} approved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={req.status === "completed" ? "default" : req.status === "archived" ? "outline" : "secondary"}>{req.status}</Badge>
          {canReview && req.status === "open" && (
            <Button size="sm" onClick={markCompleted}><CheckCircle2 className="mr-2 h-4 w-4" /> Mark completed</Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {data.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            canReview={canReview}
            canDelete={canDelete}
            canUpload={!!canUpload}
            onUpload={(f) => uploadFile(item, f)}
            onDownload={downloadFile}
            onDeleteFile={deleteFile}
            onRemove={() => removeItem(item.id)}
            onStatus={(s) => updateStatus(item.id, s)}
            onOpenComments={() => setActiveItemId(activeItemId === item.id ? null : item.id)}
            active={activeItemId === item.id}
            comments={activeItemId === item.id ? comments ?? [] : []}
            onAddComment={(b) => addComment(item.id, b)}
          />
        ))}
      </div>

      {canAddItem && (
        <div className="mt-4 flex gap-2">
          <Input placeholder="Add checklist item" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
          <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add</Button>
        </div>
      )}
    </AppShell>
  );
}

interface RequestItem {
  id: string;
  name: string;
  category: string | null;
  status: DocStatus;
  is_required: boolean;
  is_repeatable: boolean;
  document_files: Array<{ id: string; storage_path: string; file_name: string; file_size: number; created_at: string }>;
}

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  authorName: string;
}

function ItemRow({
  item, canReview, canDelete, canUpload, onUpload, onDownload, onDeleteFile, onRemove, onStatus, onOpenComments, active, comments, onAddComment,
}: {
  item: RequestItem;
  canReview: boolean;
  canDelete: boolean;
  canUpload: boolean;
  onUpload: (f: File) => void;
  onDownload: (p: string, n: string) => void;
  onDeleteFile: (id: string, p: string) => void;
  onRemove: () => void;
  onStatus: (s: DocStatus) => void;
  onOpenComments: () => void;
  active: boolean;
  comments: CommentRow[];
  onAddComment: (b: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [comment, setComment] = useState("");

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.name}</p>
              {item.category && <span className="text-xs text-muted-foreground">· {item.category}</span>}
              {!item.is_required && <Badge variant="outline" className="text-xs">Optional</Badge>}
              <StatusBadge status={item.status} />
            </div>
            {item.document_files.length > 0 && (
              <ul className="mt-3 space-y-1">
                {item.document_files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <span className="truncate">{f.file_name}</span>
                    <span className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(1)} KB</span>
                    <Button variant="ghost" size="icon" onClick={() => onDownload(f.storage_path, f.file_name)}><Download className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" onClick={() => onDeleteFile(f.id, f.storage_path)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canUpload && (item.is_repeatable || item.document_files.length === 0) && (
              <>
                <input ref={fileInput} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Upload
                </Button>
              </>
            )}
            {canReview && (
              <Select value={item.status} onValueChange={(v) => onStatus(v as DocStatus)}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="reupload_required">Re-upload Needed</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="icon" onClick={onOpenComments}><MessageSquare className="h-4 w-4" /></Button>
            {canDelete && <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </div>
        </div>

        {active && (
          <div className="mt-4 border-t border-border pt-4">
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md bg-muted p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.authorName}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM, h:mm a")}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
              {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onAddComment(comment); setComment(""); } }} />
              <Button size="sm" onClick={() => { onAddComment(comment); setComment(""); }}>Post</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
