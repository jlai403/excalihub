export type Space = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  updatedAt: string;
  latest_backup: string | null;
  status: string;
};

export type Backup = {
  filename: string;
  hash: string;
  createdAt: string;
};
