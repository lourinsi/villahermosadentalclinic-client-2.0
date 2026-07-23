export const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

export function formatTimeTo12h(time24: string): string {
  if (!time24 || typeof time24 !== "string") return "";
  const trimmed = time24.trim();
  if (/am|pm/i.test(trimmed)) return trimmed;
  const parts = trimmed.split(":");
  if (parts.length < 2) return trimmed;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function getServiceType(time24: string): "ONLINE" | "FACE-TO-FACE" {
  if (!time24) return "FACE-TO-FACE";
  const [hours] = time24.split(":").map(Number);
  // Example logic: Morning is Face-to-Face, Afternoon is Online
  return hours < 13 ? "FACE-TO-FACE" : "ONLINE";
}
