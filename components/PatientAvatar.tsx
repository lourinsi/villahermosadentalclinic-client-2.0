"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

interface PatientAvatarProps {
  src?: string | undefined;
  name?: string | undefined;
  dob?: string | undefined; // ISO date or any parseable date string
  className?: string;
  sizeClass?: string;
}

export default function PatientAvatar({ src, name, dob, className = "", sizeClass = "h-10 w-10" }: PatientAvatarProps) {
  const now = new Date();
  let hasBirthdayThisMonth = false;
  let isExactBirthday = false;

  try {
    const dobStr = dob || undefined;
    if (dobStr) {
      const d = new Date(dobStr);
      if (!isNaN(d.getTime())) {
        hasBirthdayThisMonth = d.getMonth() === now.getMonth();
        isExactBirthday = hasBirthdayThisMonth && d.getDate() === now.getDate();
      }
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

  // Hat size/position tweaks
  const hatClass = isExactBirthday ? "w-8 h-8 -top-2 -right-2" : "w-7 h-7 -top-1 -right-1";

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
            <span className={`absolute z-20 ${hatClass}`} aria-hidden>
              {/* Simple party hat SVG */}
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                <path d="M12 2L5 20H19L12 2Z" fill="#FF6B6B" />
                <circle cx="11.5" cy="8.5" r="0.9" fill="#FFD166" />
                <circle cx="13.5" cy="10.5" r="0.9" fill="#FFD166" />
                <circle cx="10" cy="13" r="0.8" fill="#FFF" />
              </svg>
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
