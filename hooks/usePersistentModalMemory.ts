"use client";

import { useCallback, useEffect, useRef } from "react";

const MODAL_MEMORY_PREFIX = "villahermosa:modal-memory:v1";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type StoredModalMemory<T> = {
  value: T;
  expiresAt: number;
};

const getModalMemoryStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const toSafeKeyPart = (part: unknown) =>
  encodeURIComponent(String(part ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 120));

export const buildModalMemoryKey = (...parts: unknown[]) =>
  [MODAL_MEMORY_PREFIX, ...parts.map(toSafeKeyPart)].join(":");

export function readModalMemory<T>(key: string): T | null {
  const storage = getModalMemoryStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const stored = JSON.parse(raw) as StoredModalMemory<T>;
    if (!stored || typeof stored !== "object") return null;

    if (Number(stored.expiresAt) <= Date.now()) {
      storage.removeItem(key);
      return null;
    }

    return stored.value;
  } catch {
    return null;
  }
}

export function writeModalMemory<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  const storage = getModalMemoryStorage();
  if (!storage) return;

  try {
    const stored: StoredModalMemory<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    storage.setItem(key, JSON.stringify(stored));
  } catch {
    // Ignore storage quota/private-mode failures; modal state still works in memory.
  }
}

export function clearModalMemory(key: string) {
  const storage = getModalMemoryStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // no-op
  }
}

export function usePersistentModalMemory<T>({
  key,
  open,
  value,
  restore,
  enabled = true,
  ttlMs = DEFAULT_TTL_MS,
  isPaused,
}: {
  key: string;
  open: boolean;
  value: T;
  restore: (value: T) => void;
  enabled?: boolean;
  ttlMs?: number;
  isPaused?: () => boolean;
}) {
  const restoringRef = useRef(false);

  useEffect(() => {
    if (!open || !enabled || isPaused?.()) return;

    const saved = readModalMemory<T>(key);
    if (!saved) return;

    restoringRef.current = true;
    restore(saved);

    const timeout = window.setTimeout(() => {
      restoringRef.current = false;
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [enabled, isPaused, key, open, restore]);

  useEffect(() => {
    if (!open || !enabled || restoringRef.current || isPaused?.()) return;
    writeModalMemory(key, value, ttlMs);
  }, [enabled, isPaused, key, open, ttlMs, value]);

  return useCallback(() => clearModalMemory(key), [key]);
}
