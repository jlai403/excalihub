export type Space = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  status: string;
};

export type Backup = {
  filename: string;
  hash: string;
  createdAt: string;
};
