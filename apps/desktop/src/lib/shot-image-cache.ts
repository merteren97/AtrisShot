import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

const MAX_CACHED_IMAGES = 24;
const MAX_CACHED_DATA_URL_CHARS = 12_000_000;
const MAX_CACHED_TOTAL_CHARS = 48_000_000;
const MAX_CONCURRENT_READS = 2;

type ReadTask = {
  key: string;
  path: string;
  priority: "high" | "normal";
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
};

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const queue: ReadTask[] = [];
let activeReads = 0;
let cachedChars = 0;

function cacheKey(path: string, revision?: number) {
  return `${path}\u0000${revision ?? 0}`;
}

function remember(key: string, value: string) {
  const previous = cache.get(key);
  if (previous) cachedChars -= previous.length;
  cache.delete(key);
  cache.set(key, value);
  cachedChars += value.length;
  while (cache.size > MAX_CACHED_IMAGES || cachedChars > MAX_CACHED_TOTAL_CHARS) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    const oldestValue = cache.get(oldest);
    if (oldestValue) cachedChars -= oldestValue.length;
    cache.delete(oldest);
  }
}

function pump() {
  while (activeReads < MAX_CONCURRENT_READS && queue.length > 0) {
    const task = queue.shift();
    if (!task) return;
    activeReads += 1;
    void nativeRuntime.readShotDataUrl(task.path)
      .then((value) => {
        if (value && value.length <= MAX_CACHED_DATA_URL_CHARS) remember(task.key, value);
        task.resolve(value);
      })
      .catch(task.reject)
      .finally(() => {
        activeReads -= 1;
        pending.delete(task.key);
        pump();
      });
  }
}

export function getShotImageDataUrl(
  path?: string | null,
  revision?: number,
  priority: "high" | "normal" = "normal",
) {
  if (!path || !isNativeRuntime()) return Promise.resolve("");
  const key = cacheKey(path, revision);
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached);
  }
  const current = pending.get(key);
  if (current) return current;
  const promise = new Promise<string>((resolve, reject) => {
    const task = { key, path, priority, resolve, reject } satisfies ReadTask;
    if (priority === "high") queue.unshift(task);
    else queue.push(task);
    pump();
  });
  pending.set(key, promise);
  return promise;
}

export function clearShotImageCache() {
  cache.clear();
  cachedChars = 0;
}
