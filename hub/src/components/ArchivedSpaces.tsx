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
import { ArchiveRestoreIcon, Trash2Icon } from "lucide-react";

type Space = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: string;
  status: string;
};

const BASE_DOMAIN = typeof window !== "undefined"
  ? window.location.hostname.split(".").slice(-2).join(".")
  : "example.com";

export function ArchivedSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setId] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spaces")
      .then((res) => res.json())
      .then((data) => {
        setSpaces(data.filter((s: Space) => s.status === "archived"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleUnarchive(id: string) {
    setId(true);
    await fetch(`/api/spaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    setSpaces((prev) => prev.filter((s) => s.id !== id));
    setId(false);
  }

  async function handleDelete(id: string) {
    setId(true);
    await fetch(`/api/spaces/${id}`, { method: "DELETE" });
    setSpaces((prev) => prev.filter((s) => s.id !== id));
    setDeleteTarget(null);
    setId(false);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading archived spaces...</p>;
  }

  if (spaces.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-4">Archived Spaces</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No archived spaces</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Archived Spaces</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.map((space) => (
          <Card key={space.id}>
            <CardHeader>
              <CardTitle>{space.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {space.subdomain}.{BASE_DOMAIN}
              </p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Created: {new Date(space.createdAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnarchive(space.id)}
                  disabled={actionLoading}
                >
                  <ArchiveRestoreIcon className="size-4" />
                  Unarchive
                </Button>

                <Dialog open={deleteTarget === space.id} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2Icon className="size-4" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Permanently delete "{space.name}"?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete the space and all its backups.
                        This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(space.id)}
                        disabled={actionLoading}
                      >
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
