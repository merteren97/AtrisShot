import type { ShotHistoryEntry } from "@atris-shot/shot-core";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

const HISTORY_KEY = "shot-history-preview";

const readPreviewHistory = (): ShotHistoryEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ShotHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

const writePreviewHistory = (entries: ShotHistoryEntry[]) => {
  if (typeof window !== "undefined") localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
};

export async function loadShotHistory(): Promise<ShotHistoryEntry[]> {
  if (isNativeRuntime()) return nativeRuntime.listShotHistory();
  return readPreviewHistory();
}

export async function addPreviewShot(entry: ShotHistoryEntry, historyLimit = 100): Promise<ShotHistoryEntry[]> {
  const limit = Math.max(10, Math.min(500, historyLimit));
  const next = [entry, ...readPreviewHistory()].slice(0, limit);
  writePreviewHistory(next);
  return next;
}

export async function deleteShotHistoryEntry(id: string): Promise<ShotHistoryEntry[]> {
  if (isNativeRuntime()) return nativeRuntime.deleteShot(id);
  const next = readPreviewHistory().filter((entry) => entry.id !== id);
  writePreviewHistory(next);
  return next;
}

export async function clearShotHistory(): Promise<ShotHistoryEntry[]> {
  if (isNativeRuntime()) return nativeRuntime.clearShotHistory();
  if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
  return [];
}
