import { useCallback, useMemo, useState } from "react";
import type { CollectionManifestMeta } from "../types";
import {
  listBuiltinCollections,
  refreshCollectionsFromDir,
} from "../services/tauriApi";

type UseCollectionsResult = {
  collections: CollectionManifestMeta[];
  selectedPaths: string[];
  selectedCount: number;
  dedupSelectedCount: number;
  loading: boolean;
  refreshDir: string;
  setRefreshDir: (value: string) => void;
  loadCollections: () => Promise<void>;
  refreshFromDir: () => Promise<void>;
  togglePath: (path: string) => void;
  selectAll: () => void;
  clearAll: () => void;
};

export function useCollections(
  onLog: (line: string) => void,
): UseCollectionsResult {
  const [collections, setCollections] = useState<CollectionManifestMeta[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshDir, setRefreshDir] = useState("");

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBuiltinCollections();
      setCollections(result);
      const available = new Set(result.map((x) => x.path));
      setSelectedPaths((prev) => prev.filter((p) => available.has(p)));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshFromDir = useCallback(async () => {
    const dir = refreshDir.trim();
    if (!dir) {
      onLog("请先填写 refresh 目录路径");
      return;
    }

    setLoading(true);
    try {
      await refreshCollectionsFromDir(dir);
      await loadCollections();
      onLog(`已刷新 collections: ${dir}`);
    } finally {
      setLoading(false);
    }
  }, [loadCollections, onLog, refreshDir]);

  const togglePath = useCallback((path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  }, []);

  const selectAll = useCallback(
    () => setSelectedPaths(collections.map((c) => c.path)),
    [collections],
  );
  const clearAll = useCallback(() => setSelectedPaths([]), []);

  const dedupSelectedCount = useMemo(() => {
    const set = new Set<string>();
    for (const item of collections) {
      if (selectedPaths.includes(item.path)) {
        set.add(item.path);
      }
    }
    return set.size;
  }, [collections, selectedPaths]);

  return {
    collections,
    selectedPaths,
    selectedCount: selectedPaths.length,
    dedupSelectedCount,
    loading,
    refreshDir,
    setRefreshDir,
    loadCollections,
    refreshFromDir,
    togglePath,
    selectAll,
    clearAll,
  };
}
