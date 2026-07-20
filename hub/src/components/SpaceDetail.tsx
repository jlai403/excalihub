import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArchiveIcon, Trash2Icon } from "lucide-react";

type Space = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  status: string;
  latest_backup: string | null;
};

type Backup = {
  filename: string;
  hash: string;
  createdAt: string;
};

const BASE_DOMAIN = typeof window !== "undefined"
  ? window.location.hostname.split(".").slice(-2).join(".")
  : "example.com";

export function SpaceDetail({ spaceId }: { spaceId: string }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/spaces/${spaceId}`).then((r) => r.json()),
      fetch(`/api/spaces/${spaceId}/backups`).then((r) => r.json()),
    ])
      .then(([spaceData, backupData]) => {
        if (!spaceData.id) {
          window.location.href = "/";
          return;
        }
        setSpace(spaceData);
        setBackups(backupData);
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/";
      });
  }, [spaceId]);

  async function handleArchive() {
    setActionLoading(true);
    await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    window.location.href = "/";
  }

  async function handleDelete() {
    setActionLoading(true);
    await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
    window.location.href = "/";
  }

  async function handleUnarchive() {
    setActionLoading(true);
    await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    window.location.href = "/";
  }

  if (loading || !space) {
    return <p className="text-muted-foreground">Loading space...</p>;
  }

  const isArchived = space.status === "archived";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{space.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <a
              href={`http://${space.subdomain}.${BASE_DOMAIN}`}
              className="text-primary hover:underline"
            >
              {space.subdomain}.{BASE_DOMAIN}
            </a>
          </p>
          {isArchived && (
            <Badge variant="secondary" className="mt-2">
              Archived
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {isArchived ? (
            <Button variant="outline" onClick={handleUnarchive} disabled={actionLoading}>
              Unarchive
            </Button>
          ) : (
            <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArchiveIcon className="size-4" />
                  Archive
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive this space?</DialogTitle>
                  <DialogDescription>
                    The space will still be accessible via its URL but won't appear in the hub.
                    You can unarchive it later.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setArchiveOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleArchive} disabled={actionLoading}>
                    Archive
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this space?</DialogTitle>
                <DialogDescription>
                  This will permanently delete the space and all its backups. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No backups yet. Backups are created automatically when you edit the whiteboard.
            </p>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {new Date(backup.createdAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {backup.hash.slice(0, 8)}...
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/backups/${backup.filename}`}>Download</a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; Back to dashboard
      </a>
    </div>
  );
}
