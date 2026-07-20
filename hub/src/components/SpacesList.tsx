import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

export function SpacesList() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spaces")
      .then((res) => res.json())
      .then((data) => {
        setSpaces(data.filter((s: Space) => s.status === "active"));
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load spaces");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading spaces...</p>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (spaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="mb-4 text-muted-foreground">No spaces yet</p>
          <Button asChild>
            <a href="/spaces/new">Create your first space</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {spaces.map((space) => (
        <Card key={space.id}>
          <CardHeader>
            <CardTitle>
              <a href={`/space?id=${space.id}`} className="hover:underline">
                {space.name}
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {space.subdomain}.{BASE_DOMAIN}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              Created: {new Date(space.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
