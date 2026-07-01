import { apiUrl } from "@/lib/api";
import {
  APPOINTMENT_PRICES,
  APPOINTMENT_TYPE_DURATIONS,
  APPOINTMENT_TYPE_OPTIONS,
  APPOINTMENT_TYPES,
  OTHER_APPOINTMENT_TYPE_INDEX,
  type AppointmentTypeOption,
} from "@/shared/appointmentTypes";

export type ServiceCatalogItem = AppointmentTypeOption & {
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_SERVICE_OPTIONS = APPOINTMENT_TYPE_OPTIONS.map((option) => ({ ...option }));
let cachedServiceOptions: ServiceCatalogItem[] = DEFAULT_SERVICE_OPTIONS.map((option) => ({ ...option }));
let loadPromise: Promise<ServiceCatalogItem[]> | null = null;

const normalizeServiceName = (value: unknown) =>
  String(value || "").trim().replace(/\s+/g, " ");

const normalizeServiceOption = (option: Partial<ServiceCatalogItem>, fallbackId: number): ServiceCatalogItem => {
  const name = normalizeServiceName(option.label || option.value);
  const id = Number.isInteger(Number(option.id)) ? Number(option.id) : fallbackId;

  return {
    id,
    value: name || `Service ${id}`,
    label: name || `Service ${id}`,
    price: Math.max(0, Number(option.price) || 0),
    duration: Math.max(1, Math.round(Number(option.duration) || 30)),
    isActive: option.isActive !== false,
    createdAt: option.createdAt,
    updatedAt: option.updatedAt,
  };
};

export const applyAppointmentServiceOptions = (options: Partial<ServiceCatalogItem>[] = []) => {
  const normalized = options
    .map((option, index) => normalizeServiceOption(option, index))
    .filter((option) => option.isActive !== false)
    .sort((left, right) => left.id - right.id);

  const nextOptions = normalized.length ? normalized : DEFAULT_SERVICE_OPTIONS;

  APPOINTMENT_TYPES.length = 0;
  Object.keys(APPOINTMENT_PRICES).forEach((key) => delete APPOINTMENT_PRICES[key]);
  Object.keys(APPOINTMENT_TYPE_DURATIONS).forEach((key) => delete APPOINTMENT_TYPE_DURATIONS[key]);

  nextOptions.forEach((option) => {
    APPOINTMENT_TYPES[option.id] = option.label;
    APPOINTMENT_PRICES[option.label] = Number(option.price) || 0;
    APPOINTMENT_TYPE_DURATIONS[option.label] = Number(option.duration) || 30;
  });

  if (!APPOINTMENT_TYPES[OTHER_APPOINTMENT_TYPE_INDEX]) {
    APPOINTMENT_TYPES[OTHER_APPOINTMENT_TYPE_INDEX] = "Other";
    APPOINTMENT_PRICES.Other = APPOINTMENT_PRICES.Other || 0;
    APPOINTMENT_TYPE_DURATIONS.Other = APPOINTMENT_TYPE_DURATIONS.Other || 30;
  }

  cachedServiceOptions = nextOptions.map((option) => ({ ...option }));
  return getCachedAppointmentServiceOptions();
};

export const getCachedAppointmentServiceOptions = () =>
  cachedServiceOptions.map((option) => ({ ...option }));

export const fetchAppointmentServiceOptions = async (force = false) => {
  if (!force && loadPromise) return loadPromise;

  loadPromise = fetch(apiUrl("/api/appointment-types"), { credentials: "include" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
        throw new Error(payload?.message || "Failed to load services");
      }

      return applyAppointmentServiceOptions(payload.data);
    })
    .catch((error) => {
      console.warn("[Services] Falling back to local appointment types:", error);
      return getCachedAppointmentServiceOptions();
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
};

export const getAppointmentServiceId = (serviceName: string) => {
  const normalized = normalizeServiceName(serviceName).toLowerCase();
  const found = cachedServiceOptions.find((option) => option.label.toLowerCase() === normalized);
  return found?.id ?? APPOINTMENT_TYPES.findIndex((name) => String(name || "").toLowerCase() === normalized);
};

applyAppointmentServiceOptions(DEFAULT_SERVICE_OPTIONS);
