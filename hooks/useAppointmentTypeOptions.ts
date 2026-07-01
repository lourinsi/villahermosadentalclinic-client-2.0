import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  applyAppointmentServiceOptions,
  fetchAppointmentServiceOptions,
  getCachedAppointmentServiceOptions,
  type ServiceCatalogItem,
} from "@/lib/appointment-service-catalog";

export type AppointmentTypeForm = {
  label: string;
  price: number;
  duration: number;
};

export function useAppointmentTypeOptions(enabled = true) {
  const [options, setOptions] = useState<ServiceCatalogItem[]>(getCachedAppointmentServiceOptions);
  const [isLoading, setIsLoading] = useState(enabled);

  const refresh = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const loaded = await fetchAppointmentServiceOptions(force);
      setOptions(loaded);
      return loaded;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    let active = true;
    refresh().then((loaded) => {
      if (active) setOptions(loaded);
    });

    const handleCatalogUpdate = () => {
      const cached = getCachedAppointmentServiceOptions();
      setOptions(cached);
    };
    window.addEventListener("villahermosa:services-updated", handleCatalogUpdate);

    return () => {
      active = false;
      window.removeEventListener("villahermosa:services-updated", handleCatalogUpdate);
    };
  }, [enabled, refresh]);

  const saveService = useCallback(async (service: ServiceCatalogItem) => {
    const response = await fetch(apiUrl(`/api/appointment-types/${encodeURIComponent(String(service.id))}`), {
      method: "PUT",
      credentials: "include",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(service),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Failed to update service");
    }

    const loaded = await refresh(true);
    window.dispatchEvent(new CustomEvent("villahermosa:services-updated", { detail: loaded }));
    return payload.data as ServiceCatalogItem;
  }, [refresh]);

  const createService = useCallback(async (form: AppointmentTypeForm) => {
    const response = await fetch(apiUrl("/api/appointment-types"), {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Failed to create service");
    }

    const loaded = await refresh(true);
    window.dispatchEvent(new CustomEvent("villahermosa:services-updated", { detail: loaded }));
    return payload.data as ServiceCatalogItem;
  }, [refresh]);

  return {
    options,
    isLoading,
    refresh,
    saveService,
    createService,
    applyOptions: (nextOptions: ServiceCatalogItem[]) => {
      const applied = applyAppointmentServiceOptions(nextOptions);
      setOptions(applied);
      window.dispatchEvent(new CustomEvent("villahermosa:services-updated", { detail: applied }));
    },
  };
}
