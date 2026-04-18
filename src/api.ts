import type { AppState } from "./types";

export async function fetchState(): Promise<AppState> {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  return res.json() as Promise<AppState>;
}

export async function saveState(state: AppState): Promise<void> {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}
