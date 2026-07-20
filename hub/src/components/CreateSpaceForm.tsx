import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE_DOMAIN = typeof window !== "undefined"
  ? window.location.hostname.split(".").slice(-2).join(".")
  : "example.com";

export function CreateSpaceForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create space");
      }
    } catch {
      alert("Failed to create space");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Space Name</Label>
            <Input
              id="name"
              placeholder="e.g., my-project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will create a space at:{" "}
              <span className="text-primary">{slug || "your-name"}.{BASE_DOMAIN}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.href = "/"}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
