"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Candidate, TalentPool } from "@/types";
import { fetchCandidates, fetchPools, seedSamplePool } from "@/lib/api";

export interface PoolDataContextType {
  pools: TalentPool[];
  activePool: TalentPool | null;
  candidates: Candidate[];
  activeCandidate: Candidate | null;
  isSeedingSample: boolean;

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

  const refreshPools = async () => {
    try {
      const data = await fetchPools();
      setPools(data);
      if (data.length > 0 && !activePool) {
        setActivePoolState(data[0]);
      }
    } catch (e) {
      console.error("Error refreshing pools:", e);
    }
  };

  const refreshCandidates = async (poolId: string) => {
    try {
      const data = await fetchCandidates(poolId);
      setCandidates(data);
      if (data.length > 0) {
        setActiveCandidate(data[0]);
      } else {
        setActiveCandidate(null);
      }
    } catch (e) {
      console.error("Error refreshing candidates:", e);
      setCandidates([]);
      setActiveCandidate(null);
    }
  };

  const loadSamplePool = async () => {
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
  };

  const setActivePool = (pool: TalentPool | null) => {
    setActivePoolState(pool);
    if (pool) {
      refreshCandidates(pool.id);
    } else {
      setCandidates([]);
      setActiveCandidate(null);
    }
  };

  useEffect(() => {
    refreshPools();
  }, []);

  useEffect(() => {
    if (activePool) {
      refreshCandidates(activePool.id);
    }
  }, [activePool?.id]);

  return (
    <PoolDataContext.Provider
      value={{
        pools,
        activePool,
        candidates,
        activeCandidate,
        isSeedingSample,
        setActivePool,
        setActiveCandidate,
        refreshPools,
        refreshCandidates,
        loadSamplePool,
      }}
    >
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
