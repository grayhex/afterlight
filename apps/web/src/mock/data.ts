// apps/web/src/mock/data.ts
export type Vault = {
  id: string;
  name: string;
  status: 'Active' | 'Triggered' | 'PendingGrace' | 'Released' | 'Closed';
  quorum_threshold: number;
  max_verifiers: number;
  heartbeat_timeout_days: number;
  grace_hours: number;
  is_demo?: boolean;
  updated_at: string;
};

export type Block = {
  id: string;
  vault_id: string;
  type: 'text' | 'file' | 'url';
  title: string;
  tags: string[];
  size?: number;
  is_public?: boolean;
  updated_at: string;
};

export type Verifier = {
  id: string;
  contact: string;
  role_status: 'Invited' | 'Active' | 'Revoked';
  is_primary?: boolean;
};

export type VerificationEvent = {
  id: string;
  vault_id: string;
  state:
    | 'Draft'
    | 'Submitted'
    | 'Confirming'
    | 'Disputed'
    | 'QuorumReached'
    | 'HeartbeatTimeout'
    | 'Grace'
    | 'Finalized';
  quorum_required: number;
  confirms_count: number;
  denies_count: number;
  created_at: string;
};

const now = () => new Date().toISOString();
const uuid = () =>
  '00000000-0000-4000-8000-' +
  Math.random().toString(16).slice(2, 14).padEnd(12, '0');

export const vaults: Vault[] = [
  {
    id: uuid(),
    name: 'Demo Safe',
    status: 'Active',
    quorum_threshold: 3,
    max_verifiers: 5,
    heartbeat_timeout_days: 60,
    grace_hours: 24,
    is_demo: true,
    updated_at: now(),
  },
  {
    id: uuid(),
    name: 'Личный сейф',
    status: 'Active',
    quorum_threshold: 3,
    max_verifiers: 5,
    heartbeat_timeout_days: 60,
    grace_hours: 24,
    updated_at: now(),
  },
];

export const blocks: Block[] = [
  {
    id: uuid(),
    vault_id: vaults[0].id,
    type: 'text',
    title: 'Инструкции по питомцу',
    tags: ['pets', 'care'],
    is_public: false,
    updated_at: now(),
  },
  {
    id: uuid(),
    vault_id: vaults[0].id,
    type: 'url',
    title: 'Контакты экстренных служб',
    tags: ['contacts'],
    updated_at: now(),
  },
  {
    id: uuid(),
    vault_id: vaults[1].id,
    type: 'file',
    title: 'Организация похорон — чеклист.pdf',
    tags: ['funeral'],
    size: 24576,
    updated_at: now(),
  },
];

export const verifiers: Verifier[] = [
  { id: uuid(), contact: 'vera@example.com', role_status: 'Active', is_primary: true },
  { id: uuid(), contact: 'oleg@example.com', role_status: 'Active' },
  { id: uuid(), contact: 'maria@example.com', role_status: 'Invited' },
];

// 👉 Новый экспорт — мок событий верификации
export const events: VerificationEvent[] = [
  {
    id: uuid(),
    vault_id: vaults[0].id,
    state: 'Confirming',
    quorum_required: 3,
    confirms_count: 2,
    denies_count: 0,
    created_at: now(),
  },
  {
    id: uuid(),
    vault_id: vaults[0].id,
    state: 'Disputed',
    quorum_required: 3,
    confirms_count: 2,
    denies_count: 2,
    created_at: now(),
  },
  {
    id: uuid(),
    vault_id: vaults[1].id,
    state: 'Finalized',
    quorum_required: 3,
    confirms_count: 3,
    denies_count: 0,
    created_at: now(),
  },
];
