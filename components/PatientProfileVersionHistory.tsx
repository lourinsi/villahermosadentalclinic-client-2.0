"use client";

import React, { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { History, MoreVertical, RotateCcw, Tag, Copy, Sparkles, User as UserIcon, FileText, Activity, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import type { PatientVersionRecord } from "@/lib/patient-types";

interface PatientProfileVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: PatientVersionRecord[];
  selectedVersionId?: string | null;
  onSelectVersion: (version: PatientVersionRecord) => void;
  onRestoreVersion: (version: PatientVersionRecord) => void;
  onRenameVersion: (versionId: string, newName: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTimeOnly = (iso: string) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return iso;
  }
};

const formatDateGroupHeader = (iso: string) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Unknown Date";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Earlier";
  }
};

const getSectionBadge = (section: string) => {
  switch (section) {
    case "chart":
      return { label: "Dental Chart", icon: "🦷", colorClass: "bg-violet-100 text-violet-800 border-violet-200" };
    case "medical":
      return { label: "Medical Info", icon: "⚠️", colorClass: "bg-amber-100 text-amber-800 border-amber-200" };
    case "info":
      return { label: "Contact Info", icon: "👤", colorClass: "bg-blue-100 text-blue-800 border-blue-200" };
    case "questionnaire":
      return { label: "Questionnaire", icon: "📋", colorClass: "bg-indigo-100 text-indigo-800 border-indigo-200" };
    case "consent":
      return { label: "Consent Form", icon: "📄", colorClass: "bg-teal-100 text-teal-800 border-teal-200" };
    default:
      return { label: section, icon: "•", colorClass: "bg-slate-100 text-slate-800 border-slate-200" };
  }
};

export function PatientProfileVersionHistory({
  open,
  onOpenChange,
  versions,
  selectedVersionId,
  onSelectVersion,
  onRestoreVersion,
  onRenameVersion,
}: PatientProfileVersionHistoryProps) {
  const [filterMode, setFilterMode] = useState<"all" | "named">("all");
  const [namingVersion, setNamingVersion] = useState<PatientVersionRecord | null>(null);
  const [versionNameInput, setVersionNameInput] = useState("");

  const filteredVersions = useMemo(() => {
    if (filterMode === "named") {
      return versions.filter((v) => Boolean(v.versionName?.trim()));
    }
    return versions;
  }, [versions, filterMode]);

  // Group versions by Day
  const groupedVersions = useMemo(() => {
    const groups: { dateLabel: string; items: PatientVersionRecord[] }[] = [];
    let currentLabel = "";
    let currentItems: PatientVersionRecord[] = [];

    filteredVersions.forEach((v) => {
      const label = formatDateGroupHeader(v.timestamp);
      if (label !== currentLabel) {
        if (currentItems.length > 0) {
          groups.push({ dateLabel: currentLabel, items: currentItems });
        }
        currentLabel = label;
        currentItems = [v];
      } else {
        currentItems.push(v);
      }
    });

    if (currentItems.length > 0) {
      groups.push({ dateLabel: currentLabel, items: currentItems });
    }

    return groups;
  }, [filteredVersions]);

  const handleOpenNaming = (v: PatientVersionRecord) => {
    setNamingVersion(v);
    setVersionNameInput(v.versionName || "");
  };

  const handleSaveNaming = () => {
    if (!namingVersion) return;
    onRenameVersion(namingVersion.id, versionNameInput.trim());
    toast.success("Version name updated");
    setNamingVersion(null);
  };

  const handleCopyData = (snapshot: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success("Version snapshot JSON copied to clipboard");
    } catch {
      toast.error("Failed to copy snapshot");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-sm flex-col p-0 sm:max-w-md bg-white border-l shadow-2xl z-[70]"
        >
          {/* Header */}
          <SheetHeader className="border-b px-5 py-4 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-100">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-base font-black text-slate-900">Patient Version History</SheetTitle>
                  <SheetDescription className="text-xs font-semibold text-slate-500">
                    {versions.length} {versions.length === 1 ? "version" : "versions"} recorded
                  </SheetDescription>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-xs">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    filterMode === "all"
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All versions ({versions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("named")}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    filterMode === "named"
                      ? "bg-violet-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Named versions ({versions.filter((v) => Boolean(v.versionName?.trim())).length})
                </button>
              </div>
            </div>
          </SheetHeader>

          {/* Timeline List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 sleek-scrollbar">
            {groupedVersions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <History className="h-10 w-10 stroke-1 mb-2 opacity-40" />
                <p className="text-sm font-bold text-slate-700">No versions match your filter</p>
                <p className="text-xs mt-1 text-slate-400">Edits to the patient record will be listed here.</p>
              </div>
            ) : (
              groupedVersions.map((group) => (
                <div key={group.dateLabel} className="space-y-2">
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs py-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      {group.dateLabel}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {group.items.map((version) => {
                      const isCurrent = versions[0]?.id === version.id;
                      const isSelected = selectedVersionId === version.id;

                      return (
                        <div
                          key={version.id}
                          onClick={() => onSelectVersion(version)}
                          className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                            isSelected
                              ? "border-violet-400 bg-violet-50/80 shadow-sm ring-1 ring-violet-300"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Time & Current Pill */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900">
                                {formatTimeOnly(version.timestamp)}
                              </span>

                              {isCurrent && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                  Current version
                                </span>
                              )}

                              {isSelected && !isCurrent && (
                                <span className="inline-flex items-center rounded-full bg-violet-200/80 px-2 py-0.5 text-[10px] font-black text-violet-800">
                                  Viewing snapshot
                                </span>
                              )}
                            </div>

                            {/* Named Label */}
                            {version.versionName && (
                              <div className="flex items-center gap-1 text-xs font-bold text-violet-700">
                                <Tag className="h-3 w-3" />
                                <span>{version.versionName}</span>
                              </div>
                            )}

                            {/* Author */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="h-2 w-2 rounded-full bg-teal-500" />
                              <span className="font-semibold truncate">{version.editorName || "Staff"}</span>
                            </div>

                            {/* Section Pills */}
                            {version.changedSections && version.changedSections.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {version.changedSections.map((sec) => {
                                  const badge = getSectionBadge(sec);
                                  return (
                                    <span
                                      key={sec}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badge.colorClass}`}
                                    >
                                      <span>{badge.icon}</span>
                                      <span>{badge.label}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Summary Text */}
                            {version.summary && (
                              <p className="text-[11px] font-medium text-slate-500 line-clamp-2">
                                {version.summary}
                              </p>
                            )}
                          </div>

                          {/* 3-Dots Action Menu */}
                          <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[80] w-52">
                                <DropdownMenuItem onClick={() => onRestoreVersion(version)}>
                                  <RotateCcw className="h-4 w-4 mr-2 text-violet-600" />
                                  Restore this version
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenNaming(version)}>
                                  <Tag className="h-4 w-4 mr-2" />
                                  {version.versionName ? "Rename version" : "Name this version"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleCopyData(version.snapshot)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy snapshot JSON
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Name Version Dialog */}
      <Dialog open={Boolean(namingVersion)} onOpenChange={(open) => { if (!open) setNamingVersion(null); }}>
        <DialogContent className="max-w-sm z-[90]">
          <DialogHeader>
            <DialogTitle>Name this version</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={versionNameInput}
              onChange={(e) => setVersionNameInput(e.target.value)}
              placeholder="e.g., Initial Consultation, Tooth 18 Extracted..."
              maxLength={60}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNamingVersion(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNaming} className="bg-violet-600 hover:bg-violet-700 text-white font-bold">
              Save Name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
