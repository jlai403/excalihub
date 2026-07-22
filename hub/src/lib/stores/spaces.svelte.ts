import type { Space } from "$lib/types";

let spaces = $state<Space[]>([]);

export function getSpaces(): Space[] {
  return spaces;
}

export async function loadSpaces(): Promise<void> {
  const data = await fetch("/api/spaces").then((r) => r.json());
  spaces = data.filter((s: Space) => s.status === "active");
}

export function addSpace(space: Space): void {
  if (!spaces.some((s) => s.id === space.id)) {
    spaces = [...spaces, space];
  }
}

export function removeSpace(id: string): void {
  spaces = spaces.filter((s) => s.id !== id);
}

export async function archiveSpace(id: string): Promise<void> {
  await fetch(`/api/spaces/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "archived" }),
  });
  removeSpace(id);
}
