export const vaults = [
  { id: "v1", status: "Active", is_demo: true, updated_at: "2025-08-01T12:00:00Z" },
  { id: "v2", status: "Active", is_demo: false, updated_at: "2025-07-12T12:00:00Z" },
];

export const verifiers = [
  { id: "vr1", contact: "anna@example.com", role_status: "Active", is_primary: true },
  { id: "vr2", contact: "pavel@example.com", role_status: "Invited", is_primary: false },
  { id: "vr3", contact: "ira@example.com", role_status: "Active", is_primary: false },
];

export const blocks = [
  { id: "b1", vault_id: "v1", type: "text", tags: ["дом", "контакты"], is_public: false, updated_at: "2025-08-05T10:00:00Z" },
  { id: "b2", vault_id: "v1", type: "file", tags: ["питомцы"], is_public: false, updated_at: "2025-08-03T10:00:00Z" },
  { id: "b3", vault_id: "v1", type: "url", tags: ["похороны"], is_public: true, updated_at: "2025-08-02T10:00:00Z" }
];

export const events = [
  { id: "e1", vault_id: "v1", state: "Confirming", confirms: 2, denies: 0, quorum_required: 3, created_at: "2025-08-10T09:00:00Z" }
];
