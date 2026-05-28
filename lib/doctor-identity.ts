export type DoctorIdentity = {
  id?: string | null;
  name?: string | null;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  specialization?: string | null;
  bio?: string | null;
  profilePicture?: string | null;
  profilePictureUrl?: string | null;
};

export const normalizeDoctorIdentity = (value: unknown): string =>
  String(value ?? "")
    .replace(/^Dr\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const resolveDoctorText = (doctor: unknown): string => {
  if (!doctor) return "";
  if (typeof doctor === "string") return doctor;
  if (typeof doctor === "object") {
    const value = doctor as Record<string, any>;
    return value.name || value.fullName || value.username || value.id || "";
  }
  return String(doctor);
};

const normalizeIdentifier = (value: unknown): string =>
  normalizeDoctorIdentity(resolveDoctorText(value).replace(/[_-]+/g, " "));

const getStaffIdKey = (id: unknown): string => {
  const tokens = normalizeIdentifier(id)
    .split(/\s+/)
    .filter((token) => token && token !== "seed" && token !== "staff");
  return tokens.join(" ");
};

const doctorValueKeys = (value: unknown): string[] => {
  const raw = typeof value === "object" && value !== null
    ? [
        (value as DoctorIdentity).id,
        (value as DoctorIdentity).name,
        (value as DoctorIdentity).fullName,
        (value as DoctorIdentity).username,
        (value as DoctorIdentity).email,
      ]
    : [value];

  return Array.from(new Set(raw.map((item) => normalizeIdentifier(item)).filter(Boolean)));
};

const doctorStaffKeys = (doctor: DoctorIdentity): string[] =>
  Array.from(
    new Set(
      [
        normalizeIdentifier(doctor.id),
        getStaffIdKey(doctor.id),
        normalizeIdentifier(doctor.name),
        normalizeIdentifier(doctor.fullName),
        normalizeIdentifier(doctor.username),
        normalizeIdentifier(doctor.email),
        normalizeIdentifier(String(doctor.email || "").split("@")[0]),
      ].filter(Boolean)
    )
  );

const keysMatch = (queryKey: string, doctorKey: string): boolean => {
  if (!queryKey || !doctorKey) return false;
  if (queryKey === doctorKey) return true;
  if (doctorKey.length >= 5 && queryKey.includes(doctorKey)) return true;
  if (queryKey.length >= 5 && doctorKey.includes(queryKey)) return true;
  return false;
};

export const findDoctorForValue = (
  doctors: DoctorIdentity[] = [],
  value: unknown
): DoctorIdentity | undefined => {
  const rawValue = resolveDoctorText(value).trim();
  const queryKeys = doctorValueKeys(value);
  if (!rawValue && queryKeys.length === 0) return undefined;

  return (
    doctors.find((doctor) => String(doctor.id ?? "") === rawValue) ||
    doctors.find((doctor) =>
      queryKeys.some((queryKey) => doctorStaffKeys(doctor).some((doctorKey) => queryKey === doctorKey))
    ) ||
    doctors.find((doctor) =>
      queryKeys.some((queryKey) => doctorStaffKeys(doctor).some((doctorKey) => keysMatch(queryKey, doctorKey)))
    )
  );
};

export const findDoctorForSnapshot = (
  doctors: DoctorIdentity[] = [],
  snapshot: Record<string, any> | null | undefined
): DoctorIdentity | undefined =>
  findDoctorForValue(
    doctors,
    snapshot?.doctorId || snapshot?.doctorName || snapshot?.doctor
  );

export const getResolvedDoctorName = (
  doctors: DoctorIdentity[] = [],
  value: unknown
): string => {
  const doctor = findDoctorForValue(doctors, value);
  return String(doctor?.name || resolveDoctorText(value) || "").trim();
};

export const formatDoctorDisplayName = (value: unknown): string => {
  const name = resolveDoctorText(value).trim();
  if (!name) return "";
  return /^Dr\.?\s+/i.test(name) ? name : `Dr. ${name}`;
};
