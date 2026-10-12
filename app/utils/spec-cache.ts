import type { Spec } from "@json-render/core";

export type SpecMetadata = {
  workspace: string;
  persona: string;
  view: string;
  issue?: string;
  status?: string;
};
export type SpecHistory = {
  requestId: number;
  at: number;
  kind: "start" | "success" | "error" | "stale" | "cache-hit";
  duration?: number;
  message?: string;
  metadata: SpecMetadata;
  snapshot: Spec | null;
};
export type SpecEntry = {
  identity: string;
  metadata: SpecMetadata;
  latest: Spec | null;
  override: Spec | null;
  history: SpecHistory[];
  loading: boolean;
  error: string | null;
};
const HISTORY_LIMIT = 40;
const cloneSpec = (spec: Spec | null): Spec | null =>
  spec ? (JSON.parse(JSON.stringify(spec)) as Spec) : null;

export function createSpecCache(options: { onChange?: () => void } = {}) {
  const entries = new Map<string, SpecEntry>();
  const latestRequest = new Map<string, number>();
  let requestSequence = 0;
  let currentIdentity: string | null = null;
  const notify = () => options.onChange?.();
  function get(identity: string, metadata: SpecMetadata) {
    let entry = entries.get(identity);
    if (!entry) {
      entry = {
        identity,
        metadata: { ...metadata },
        latest: null,
        override: null,
        history: [],
        loading: false,
        error: null,
      };
      entries.set(identity, entry);
    }
    return entry;
  }
  function record(
    entry: SpecEntry,
    item: Omit<SpecHistory, "at" | "metadata" | "snapshot">,
    metadata = entry.metadata,
    snapshot: Spec | null = entry.latest,
  ) {
    entry.history.push({
      ...item,
      at: Date.now(),
      metadata: { ...metadata },
      snapshot: cloneSpec(snapshot),
    });
    if (entry.history.length > HISTORY_LIMIT)
      entry.history.splice(0, entry.history.length - HISTORY_LIMIT);
  }
  async function load(entry: SpecEntry, fetchSpec: (metadata: SpecMetadata) => Promise<Spec>) {
    const requestId = ++requestSequence;
    const requestMetadata = { ...entry.metadata };
    latestRequest.set(entry.identity, requestId);
    const started = Date.now();
    entry.loading = true;
    entry.error = null;
    record(entry, { requestId, kind: "start" }, requestMetadata);
    notify();
    try {
      const result = await fetchSpec(requestMetadata);
      if (latestRequest.get(entry.identity) !== requestId) {
        record(
          entry,
          { requestId, kind: "stale", duration: Date.now() - started },
          requestMetadata,
          result,
        );
      } else {
        entry.latest = cloneSpec(result);
        entry.error = null;
        record(
          entry,
          { requestId, kind: "success", duration: Date.now() - started },
          requestMetadata,
        );
      }
    } catch (error) {
      if (latestRequest.get(entry.identity) !== requestId) {
        record(
          entry,
          { requestId, kind: "stale", duration: Date.now() - started },
          requestMetadata,
        );
      } else {
        entry.error = error instanceof Error ? error.message : String(error);
        record(
          entry,
          { requestId, kind: "error", duration: Date.now() - started, message: entry.error },
          requestMetadata,
        );
      }
    } finally {
      if (latestRequest.get(entry.identity) === requestId) entry.loading = false;
      notify();
    }
  }
  return {
    entries,
    get,
    get current() {
      return currentIdentity ? (entries.get(currentIdentity) ?? null) : null;
    },
    async select(
      identity: string,
      metadata: SpecMetadata,
      fetchSpec: (metadata: SpecMetadata) => Promise<Spec>,
      force = false,
    ) {
      const previous = entries.get(identity);
      const statusChanged = previous?.metadata.status !== metadata.status && previous !== undefined;
      currentIdentity = identity;
      const entry = get(identity, metadata);
      entry.metadata = { ...metadata };
      if (entry.latest && !force && !statusChanged) {
        record(entry, { requestId: ++requestSequence, kind: "cache-hit" });
        notify();
      } else await load(entry, fetchSpec);
      return entry;
    },
    async refetch(identity: string, fetchSpec: (metadata: SpecMetadata) => Promise<Spec>) {
      const entry = entries.get(identity);
      if (entry) await load(entry, fetchSpec);
    },
    async invalidate(identity: string, fetchSpec: (metadata: SpecMetadata) => Promise<Spec>) {
      const entry = entries.get(identity);
      if (!entry) return;
      entry.latest = null;
      notify();
      await load(entry, fetchSpec);
    },
    reportError(identity: string, message: string) {
      const entry = entries.get(identity);
      if (!entry) return;
      entry.error = message;
      notify();
    },
    apply(identity: string, spec: Spec) {
      const entry = entries.get(identity);
      if (!entry) return false;
      entry.override = cloneSpec(spec);
      notify();
      return true;
    },
    clear(identity: string) {
      const entry = entries.get(identity);
      if (!entry) return;
      entry.override = null;
      notify();
    },
  };
}
export type SpecCache = ReturnType<typeof createSpecCache>;
