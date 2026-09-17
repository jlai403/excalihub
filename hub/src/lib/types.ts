export type Space = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  updatedAt: string;
  latest_backup: string | null;
  status: string;
};

export type BackupTier = 'daily' | 'weekly' | 'monthly';

export type Backup = {
  filename: string;
  hash: string;
  createdAt: string;
  tier: BackupTier | null;
};

export type GitConfig = {
  repoUrl: string;
  webUrl: string | null;
  connected: boolean;
  connectedAt: string | null;
};
