"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Cake, PartyPopper } from "lucide-react";

interface PatientAvatarProps {
  src?: string | undefined;
  name?: string | undefined;
  dob?: string | undefined; // ISO date or any parseable date string
  birthdayReferenceDate?: string | Date | undefined;
  className?: string;
  sizeClass?: string;
}

const parseDateOnly = (value?: string | Date) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const valueStr = String(value);
  const datePart = valueStr.split("T")[0];
  const parts = datePart.split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  const parsed = new Date(valueStr);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export default function PatientAvatar({ src, name, dob, birthdayReferenceDate, className = "", sizeClass = "h-10 w-10" }: PatientAvatarProps) {
  const referenceDate = parseDateOnly(birthdayReferenceDate) || new Date();
  let hasBirthdayThisMonth = false;
  let isExactBirthday = false;

  try {
    const birthDate = parseDateOnly(dob);
    if (birthDate) {
      hasBirthdayThisMonth = birthDate.getMonth() === referenceDate.getMonth();
      isExactBirthday = hasBirthdayThisMonth && birthDate.getDate() === referenceDate.getDate();
    }
  } catch (e) {
    hasBirthdayThisMonth = false;
    isExactBirthday = false;
  }

  const initials = (() => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  })();

  // Birthday badge: small corner badge
  const hatClass = "w-4 h-4 -top-1 -right-1";

  return (
    <div className={`relative inline-block ${className}`}>
      <Avatar className={`${sizeClass} overflow-hidden`}>
        {src ? (
          <AvatarImage src={src} alt={name || "patient"} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-gray-50 text-center">
            <div className="text-sm font-bold">{initials}</div>
          </AvatarFallback>
        )}
      </Avatar>

      {hasBirthdayThisMonth && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`absolute z-20 ${hatClass} flex items-center justify-center`} aria-hidden>
              <span className={`rounded-full flex items-center justify-center w-full h-full drop-shadow-md ${isExactBirthday ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                {isExactBirthday ? (
                  <PartyPopper className="w-2.5 h-2.5" />
                ) : (
                  <Cake className="w-2.5 h-2.5" />
                )}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-center">
            {isExactBirthday ? "Happy Birthday!" : "Birthday month!"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
