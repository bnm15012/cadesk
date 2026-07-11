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
  pending:           "bg-amber-50  text-amber-700  border-amber-200",
  uploaded:          "bg-purple-50 text-purple-700 border-purple-200",
  under_review:      "bg-blue-50   text-blue-700   border-blue-200",
  approved:          "bg-green-50  text-green-700  border-green-200",
  rejected:          "bg-red-50    text-red-700    border-red-200",
  reupload_required: "bg-red-50    text-red-700    border-red-200",
};

export function StatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STYLES[status], className)}>
      {DOC_STATUS_LABELS[status]}
    </Badge>
  );
}
