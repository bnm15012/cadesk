import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DocStatus =
  | "pending"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected"
  | "reupload_required";

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  pending: "Pending",
  uploaded: "Uploaded",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  reupload_required: "Re-upload Needed",
};

const STYLES: Record<DocStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  uploaded: "bg-secondary text-secondary-foreground",
  under_review: "bg-warning/20 text-warning-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  reupload_required: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[status], className)}>
      {DOC_STATUS_LABELS[status]}
    </Badge>
  );
}
