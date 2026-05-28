"use client";

import { apiUrl } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { Staff } from "../lib/staff-types";

export interface DoctorOption {
  id: string;
  name: string;
  role: string;
  specialization?: string;
  email?: string;
  profilePicture?: string;
  // legacy/alternate field used across the app
  profilePictureUrl?: string;
  bio?: string;
}

const STAFF_API = apiUrl("/api/staff?limit=100");
const PUBLIC_DOCTORS_API = apiUrl("/api/staff/public-doctors");
const DOCTOR_CACHE_TTL_MS = 5 * 60 * 1000;

const doctorCache = new Map<string, { data: DoctorOption[]; fetchedAt: number }>();
const doctorRequests = new Map<string, Promise<DoctorOption[]>>();

function getCachedDoctors(cacheKey: string) {
  const cached = doctorCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > DOCTOR_CACHE_TTL_MS) {
    doctorCache.delete(cacheKey);
    return null;
  }
  return cached.data;
}

export function useDoctors(
  refreshKey?: number,
  options?: { publicBooking?: boolean; enabled?: boolean }
) {
  const publicBooking = Boolean(options?.publicBooking);
  const enabled = options?.enabled ?? true;
  const baseCacheKey = publicBooking ? "public-doctors" : "staff-doctors";
  const initialDoctors = getCachedDoctors(baseCacheKey);

  const [doctors, setDoctors] = useState<DoctorOption[]>(() => initialDoctors || []);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(enabled && !initialDoctors);

  const loadDoctors = useCallback(async (force = false) => {
    if (!enabled && !force) {
      setIsLoadingDoctors(false);
      return [];
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
    const cacheKey = `${baseCacheKey}:${token || "cookie"}`;
    const cached = force ? null : getCachedDoctors(cacheKey) || getCachedDoctors(baseCacheKey);

    if (cached) {
      setDoctors(cached);
      setIsLoadingDoctors(false);
      return cached;
    }

    try {
      setIsLoadingDoctors(true);

      let request = doctorRequests.get(cacheKey);
      if (!request) {
        request = fetchDoctors(publicBooking, token).finally(() => {
          doctorRequests.delete(cacheKey);
        });
        doctorRequests.set(cacheKey, request);
      }

      const nextDoctors = await request;
      doctorCache.set(cacheKey, { data: nextDoctors, fetchedAt: Date.now() });
      doctorCache.set(baseCacheKey, { data: nextDoctors, fetchedAt: Date.now() });
      setDoctors(nextDoctors);
      return nextDoctors;
    } catch (error) {
      console.error("[useDoctors] Failed to load doctors:", error);
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        console.error("[useDoctors] Network error - backend server may not be running at", STAFF_API);
      }
      setDoctors([]);
      return [];
    } finally {
      setIsLoadingDoctors(false);
    }
  }, [baseCacheKey, enabled, publicBooking]);

  useEffect(() => {
    if (!enabled) {
      setIsLoadingDoctors(false);
      return;
    }

    loadDoctors(refreshKey !== undefined);
  }, [enabled, loadDoctors, refreshKey]);

  return { doctors, isLoadingDoctors, reloadDoctors: () => loadDoctors(true) };
}

async function fetchDoctors(publicBooking: boolean, token: string | null) {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(publicBooking ? PUBLIC_DOCTORS_API : STAFF_API, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !publicBooking) {
      const publicResponse = await fetch(PUBLIC_DOCTORS_API);
      if (publicResponse.ok) {
        const publicResult = await publicResponse.json();
        if (publicResult?.success && Array.isArray(publicResult.data)) {
          return mapDoctorOptions(publicResult.data);
        }
      }
      return [];
    }

    console.error("[useDoctors] Fetch failed with status:", response.status, response.statusText);
    return [];
  }

  const result = await response.json();
  return result?.success && Array.isArray(result.data) ? mapDoctorOptions(result.data) : [];
}

function isDoctorStaff(staff: Partial<Staff>) {
  const role = String(staff.role || "").toLowerCase();
  const specialization = String(staff.specialization || "").toLowerCase();
  return role.includes("doctor") || role.includes("dentist") || specialization.includes("doctor") || specialization.includes("dentist");
}

function getStaffProfilePicture(staff: Partial<Staff>) {
  return typeof staff.profilePicture === "string" ? staff.profilePicture.trim() || undefined : undefined;
}

function mapDoctorOptions(staffMembers: Partial<Staff>[]): DoctorOption[] {
  return staffMembers
    .filter(isDoctorStaff)
    .map((staff) => ({
      id: String(staff.id ?? staff.email ?? staff.name),
      name: staff.name || "Doctor",
      role: staff.role || "Dentist",
      specialization: staff.specialization,
      email: staff.email,
      profilePicture: getStaffProfilePicture(staff),
      profilePictureUrl: getStaffProfilePicture(staff),
      bio: staff.bio,
    }));
}
