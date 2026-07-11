// Dynamic permission catalogue. Custom roles can be granted any subset.
// CA Admins implicitly hold every permission.

export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  group: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "Clients",
    permissions: [
      { key: "clients.view", label: "View clients" },
      { key: "clients.add", label: "Add clients" },
      { key: "clients.edit", label: "Edit clients" },
      { key: "clients.delete", label: "Delete clients" },
      { key: "clients.assign", label: "Assign clients to team" },
    ],
  },
  {
    group: "Documents",
    permissions: [
      { key: "documents.request", label: "Create document requests" },
      { key: "documents.upload", label: "Upload documents" },
      { key: "documents.download", label: "Download documents" },
      { key: "documents.review", label: "Review & approve documents" },
      { key: "documents.delete", label: "Delete documents" },
    ],
  },
  {
    group: "Team",
    permissions: [
      { key: "users.view", label: "View team members" },
      { key: "users.add", label: "Add team members" },
      { key: "users.edit", label: "Edit team members & roles" },
      { key: "users.delete", label: "Remove team members" },
    ],
  },
  {
    group: "Templates & Settings",
    permissions: [
      { key: "templates.manage", label: "Manage document templates" },
      { key: "settings.view", label: "View firm settings" },
      { key: "settings.edit", label: "Edit firm settings, roles & financial years" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);
