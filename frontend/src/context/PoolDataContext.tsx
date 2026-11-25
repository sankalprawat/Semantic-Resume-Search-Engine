"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Candidate, TalentPool } from "@/types";
import { fetchCandidates, fetchPools, seedSamplePool } from "@/lib/api";

interface PoolDataContextType {
  pools: TalentPool[];
  activePool: TalentPool | null;
  candidates: Candidate[];
  activeCandidate: Candidate | null;
  isSeedingSample: boolean;
  isInitialLoading: boolean;

  setActivePool: (pool: TalentPool | null) => void;
  setActiveCandidate: (cand: Candidate | null) => void;
  refreshPools: () => Promise<void>;
  refreshCandidates: (poolId: string) => Promise<void>;
  loadSamplePool: () => Promise<void>;
}

const PoolDataContext = createContext<PoolDataContextType | undefined>(undefined);

export function PoolDataProvider({ children }: { children: React.ReactNode }) {
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [activePool, setActivePoolState] = useState<TalentPool | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [isSeedingSample, setIsSeedingSample] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const candidatesAbortRef = useRef<AbortController | null>(null);

  const refreshPools = useCallback(async () => {
    try {
      const data = await fetchPools();
      setPools(data);
      if (data.length > 0) {
        setActivePoolState((prev) => prev ?? data[0]);
      }
    } catch (e) {
      console.error("Error refreshing pools:", e);
    }
  }, []);

  const refreshCandidates = useCallback(async (poolId: string) => {
    if (candidatesAbortRef.current) {
      candidatesAbortRef.current.abort();
    }
    const controller = new AbortController();
    candidatesAbortRef.current = controller;

    try {
      const data = await fetchCandidates(poolId, controller.signal);
      if (controller.signal.aborted) return;
      setCandidates(data);
      if (data.length > 0) {
        setActiveCandidate(data[0]);
      } else {
        setActiveCandidate(null);
      }
    } catch (e: any) {
      if (e?.name === "AbortError" || controller.signal.aborted) return;
      console.error("Error refreshing candidates:", e);
      setCandidates([]);
      setActiveCandidate(null);
    }
  }, []);

  const setActivePool = useCallback(
    (pool: TalentPool | null) => {
      setActivePoolState(pool);
      if (pool) {
        refreshCandidates(pool.id);
      } else {
        if (candidatesAbortRef.current) {
          candidatesAbortRef.current.abort();
          candidatesAbortRef.current = null;
        }
        setCandidates([]);
        setActiveCandidate(null);
      }
    },
    [refreshCandidates]
  );

  const loadSamplePool = useCallback(async () => {
    setIsSeedingSample(true);
    try {
      const samplePool = await seedSamplePool();
      await refreshPools();
      setActivePool(samplePool);
    } catch (e) {
      console.error("Failed to load sample talent pool:", e);
    } finally {
      setIsSeedingSample(false);
    }
  }, [refreshPools, setActivePool]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const poolList = await fetchPools();
        if (!isMounted) return;
        setPools(poolList);
        if (poolList.length > 0) {
          const selected = poolList[0];
          setActivePoolState(selected);
          const cands = await fetchCandidates(selected.id);
          if (!isMounted) return;
          setCandidates(cands);
          if (cands.length > 0) {
            setActiveCandidate(cands[0]);
          }
        }
      } catch (e) {
        console.error("Initial load error:", e);
      } finally {
        if (isMounted) {
          setTimeout(() => {
            if (isMounted) setIsInitialLoading(false);
          }, 550);
        }
      }
    };
    init();
    return () => {
      isMounted = false;
      candidatesAbortRef.current?.abort();
    };
  }, []);

  const value = useMemo(
    () => ({
      pools,
      activePool,
      candidates,
      activeCandidate,
      isSeedingSample,
      isInitialLoading,
      setActivePool,
      setActiveCandidate,
      refreshPools,
      refreshCandidates,
      loadSamplePool,
    }),
    [
      pools,
      activePool,
      candidates,
      activeCandidate,
      isSeedingSample,
      isInitialLoading,
      setActivePool,
      refreshPools,
      refreshCandidates,
      loadSamplePool,
    ]
  );

  return (
    <PoolDataContext.Provider value={value}>
      {children}
    </PoolDataContext.Provider>
  );
}

export function usePoolData() {
  const ctx = useContext(PoolDataContext);
  if (!ctx) {
    throw new Error("usePoolData must be used within a PoolDataProvider");
  }
  return ctx;
}
