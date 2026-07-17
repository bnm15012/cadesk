import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser, hasPerm } from "@/hooks/use-current-user";
import { getUploadUrl, proxyUploadFile, getDownloadUrl, deleteStorageFile } from "@/lib/storage";
import {
  getRequestDetail,
  getComments,
  addRequestItem,
  updateItemStatus,
  removeRequestItem,
  insertDocumentFile,
  deleteDocumentFile,
  markRequestCompleted,
  reopenRequest,
  addComment,
} from "@/lib/request-detail.functions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge, DOC_STATUS_LABELS, type DocStatus } from "@/components/StatusBadge";
import { ArrowLeft, Upload, Download, Trash2, MessageSquare, Plus, CheckCircle2, RotateCcw } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/requests_/$requestId")({
  head: () => ({ meta: [{ title: "Request — CA Vault" }] }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId: requestIdParam } = Route.useParams();
  const requestId = Number(requestIdParam);
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [newItemName, setNewItemName] = useState("");
  const [showItemHint, setShowItemHint] = useState(false);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);

  const canReview = hasPerm(user, "documents.review");
  const canDelete = hasPerm(user, "documents.delete");
  const canAddItem = hasPerm(user, "documents.request");
  const canUpload = hasPerm(user, "documents.upload") || user?.isClient;

  const fetchRequestDetail = useServerFn(getRequestDetail);
  const fetchComments = useServerFn(getComments);
  const doAddItem = useServerFn(addRequestItem);
  const doUpdateStatus = useServerFn(updateItemStatus);
  const doRemoveItem = useServerFn(removeRequestItem);
  const doInsertFile = useServerFn(insertDocumentFile);
  const doDeleteFile = useServerFn(deleteDocumentFile);
  const doMarkCompleted = useServerFn(markRequestCompleted);
  const doReopenRequest = useServerFn(reopenRequest);
  const doAddComment = useServerFn(addComment);
  const fetchUploadUrl = useServerFn(getUploadUrl);
  const doProxyUpload = useServerFn(proxyUploadFile);
  const fetchDownloadUrl = useServerFn(getDownloadUrl);
  const removeStorageFile = useServerFn(deleteStorageFile);

  const { data, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => fetchRequestDetail({ data: { requestId } }),
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", activeItemId],
    enabled: !!activeItemId,
    queryFn: () => fetchComments({ data: { itemId: activeItemId! } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["request", requestId] });

  const addItem = async () => {
    if (!newItemName.trim()) {
      setShowItemHint(true);
      return;
    }
    setShowItemHint(false);
    const nextSort = (data?.items.at(-1)?.sort_order ?? -1) + 1;
    try {
      await doAddItem({
        data: { requestId, name: newItemName.trim(), sortOrder: nextSort },
      });
      setNewItemName("");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const uploadFile = async (item: { id: number; name: string }, file: File) => {
    if (!user?.tenantId) {
      toast.error("Session error — please refresh and try again.");
      return;
    }

    const slug = (s: string) => s.trim().replace(/[^\w\-]/g, "_").replace(/_+/g, "_");
    const reqData = data?.request;
    const firmFolder = `tenant_${user.tenantId}`;
    const clientName = slug(reqData?.clientName ?? `client_${reqData?.client_id ?? requestId}`);
    const fyLabel = slug(reqData?.fyLabel ?? "unknown_fy");
    const docName = slug(item.name);
    const fileName = file.name.replace(/[^\w.\-]/g, "_");
    const storagePath = `${firmFolder}/${clientName}/${fyLabel}/${docName}/${Date.now()}_${fileName}`;
    const contentType = file.type || "application/octet-stream";

    toast.loading("Uploading…", { id: "upload" });
    try {
      // ── Attempt 1: presigned URL (direct browser → R2, fastest) ──────────
      let uploaded = false;
      try {
        const { url } = await fetchUploadUrl({
          data: { storagePath, contentType, contentLength: file.size },
        });
        const res = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (res.ok) {
          uploaded = true;
        } else {
          console.warn("Presigned upload failed:", res.status, res.statusText);
        }
      } catch (e) {
        // Network error (VPN/CORS block etc.) — fall through to proxy
        console.warn("Presigned upload error, falling back to proxy:", e);
      }

      // ── Attempt 2: server proxy (browser → server → R2) ──────────────────
      if (!uploaded) {
        toast.loading("Retrying via server…", { id: "upload" });
        const arrayBuf = await file.arrayBuffer();
        // Use FileReader-style chunked base64 to avoid stack overflow on large files
        const bytes = new Uint8Array(arrayBuf);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        await doProxyUpload({ data: { storagePath, contentType, fileBase64: base64 } });
      }

      await doInsertFile({
        data: {
          requestItemId: item.id,
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || null,
          uploadedBy: user.userId,
        },
      });

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

  const deleteFile = async (fileId: number, path: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      await removeStorageFile({ data: { storagePath: path } });
      await doDeleteFile({ data: { fileId } });
      invalidate();
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    }
  };

  const handleUpdateStatus = async (itemId: number, status: DocStatus) => {
    if (!user) return;
    const isReview = status === "approved" || status === "rejected" || status === "reupload_required";
    try {
      await doUpdateStatus({
        data: {
          itemId,
          status,
          reviewedBy: isReview ? user.userId : undefined,
          reviewedAt: isReview ? new Date().toISOString() : undefined,
        },
      });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const removeItem = async (id: number) => {
    if (!confirm("Delete this item and all its files?")) return;
    try {
      await doRemoveItem({ data: { itemId: id } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleAddComment = async (itemId: number, body: string) => {
    if (!body.trim()) {
      toast.warning("Write a comment before posting.");
      return;
    }
    try {
      await doAddComment({ data: { requestItemId: itemId, body: body.trim() } });
      qc.invalidateQueries({ queryKey: ["comments", itemId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    }
  };

  const markCompleted = async () => {
    try {
      await doMarkCompleted({ data: { requestId } });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark completed");
    }
  };

  const handleReopen = async () => {
    try {
      await doReopenRequest({ data: { requestId } });
      invalidate();
      toast.success("Request reopened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reopen request");
    }
  };

  if (isLoading) return <AppShell><p className="text-muted-foreground">Loading…</p></AppShell>;
  if (!data?.request) return <AppShell><p>Request not found.</p></AppShell>;

  const req = data.request;
  const approved = data.items.filter((i) => i.status === "approved").length;
  const backLink = user?.isClient && !user.isFirmMember ? "/portal" : "/requests";

  return (
    <AppShell>
      {/* Page header banner */}
      <div className="rounded-lg px-6 py-5 mb-6 bg-white border-l-4 border-l-slate-700 border border-border shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">{req.title}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {req.clientName} · {req.fyLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={backLink} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
          <Badge variant="outline" className={
            req.status === "completed" ? "bg-green-50 text-green-700 border-green-200" :
            req.status === "open"      ? "bg-blue-50 text-blue-700 border-blue-200" :
            req.status === "archived"  ? "bg-gray-100 text-gray-600 border-gray-200" :
            "bg-amber-50 text-amber-700 border-amber-200"
          }>{req.status}</Badge>
          {canReview && req.status === "open" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark completed
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark as completed?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark <strong>{req.title}</strong> as completed. You can reopen it later if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={markCompleted}>Mark completed</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canReview && req.status === "completed" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <RotateCcw className="mr-2 h-4 w-4" /> Reopen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reopen this request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will move <strong>{req.title}</strong> back to <strong>open</strong> so documents can be reviewed again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReopen}>Reopen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {data.items.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            index={idx + 1}
            canReview={canReview}
            canDelete={canDelete}
            canUpload={!!canUpload}
            onUpload={(f) => uploadFile(item, f)}
            onDownload={downloadFile}
            onDeleteFile={deleteFile}
            onRemove={() => removeItem(item.id)}
            onStatus={(s) => handleUpdateStatus(item.id, s)}
            onOpenComments={() => setActiveItemId(activeItemId === item.id ? null : item.id)}
            active={activeItemId === item.id}
            comments={activeItemId === item.id ? comments ?? [] : []}
            onAddComment={(b) => handleAddComment(item.id, b)}
          />
        ))}
      </div>

      {canAddItem && (
        <div className="mt-4 space-y-1">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Form 16, PAN copy, Bank statement…"
              value={newItemName}
              onChange={(e) => { setNewItemName(e.target.value); if (e.target.value.trim()) setShowItemHint(false); }}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              className={showItemHint ? "border-amber-400 focus-visible:ring-amber-400" : ""}
            />
            <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add</Button>
          </div>
          {showItemHint && (
            <p className="text-xs text-amber-600">
              Enter the document name you need from the client (e.g. Form 16, PAN copy, Bank statement).
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}

interface RequestItem {
  id: number;
  name: string;
  category: string | null;
  status: DocStatus;
  is_required: boolean;
  is_repeatable: boolean;
  document_files: Array<{ id: number; storage_path: string; file_name: string; file_size: number; created_at: string }>;
}

interface CommentRow {
  id: number;
  body: string;
  created_at: string;
  authorName: string;
}

function ItemRow({
  item, index, canReview, canDelete, canUpload, onUpload, onDownload, onDeleteFile, onRemove, onStatus, onOpenComments, active, comments, onAddComment,
}: {
  item: RequestItem;
  index: number;
  canReview: boolean;
  canDelete: boolean;
  canUpload: boolean;
  onUpload: (f: File) => void;
  onDownload: (p: string, n: string) => void;
  onDeleteFile: (id: number, p: string) => void;
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
    <div className="rounded-lg border border-border bg-white">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* S.No */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">{index}</span>

        {/* Name + category */}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">{item.name}</span>
          {item.category && <span className="ml-1.5 text-xs text-muted-foreground">· {item.category}</span>}
          {!item.is_required && <Badge variant="outline" className="ml-1.5 text-xs">Optional</Badge>}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {canUpload && (item.is_repeatable || item.document_files.length === 0) && (
            <>
              <input ref={fileInput} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-1 h-3 w-3" /> Upload
              </Button>
            </>
          )}
          {canReview ? (
            <Select value={item.status} onValueChange={(v) => onStatus(v as DocStatus)}>
              <SelectTrigger className="h-auto w-auto border-0 p-0 shadow-none focus:ring-0 [&>svg]:ml-1">
                <StatusBadge status={item.status} className="cursor-pointer" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DOC_STATUS_LABELS) as DocStatus[]).map((s) => (
                  <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StatusBadge status={item.status} />
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenComments}><MessageSquare className="h-3.5 w-3.5" /></Button>
          {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
        </div>
      </div>

      {/* Uploaded files — shown only when files exist */}
      {item.document_files.length > 0 && (
        <ul className="border-t border-border px-4 py-2 space-y-1">
          {item.document_files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate flex-1">{f.file_name}</span>
              <span>{(f.file_size / 1024).toFixed(1)} KB</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDownload(f.storage_path, f.file_name)}><Download className="h-3 w-3" /></Button>
              {canDelete && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteFile(f.id, f.storage_path)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
            </li>
          ))}
        </ul>
      )}

      {/* Comments panel — shown only when active */}
      {active && (
        <div className="border-t border-border px-4 py-3">
          <ul className="space-y-1.5 mb-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">{c.authorName}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM, h:mm a")}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
              </li>
            ))}
            {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
          </ul>
          <div className="flex gap-2">
            <Input placeholder="Add a comment…" className="h-8 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { onAddComment(comment); setComment(""); } else if (e.key === "Enter") { onAddComment(comment); } }} />
            <Button size="sm" className="h-8" onClick={() => { if (comment.trim()) { onAddComment(comment); setComment(""); } else { onAddComment(comment); } }}>Post</Button>
          </div>
        </div>
      )}
    </div>
  );
}
