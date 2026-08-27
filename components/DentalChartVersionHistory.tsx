"use client";

import React, { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Checkbox } from "./ui/checkbox";
import { History, MoreVertical, RotateCcw, Tag, Copy } from "lucide-react";
import { toast } from "sonner";

export interface DentalChartVersion {
  id: string;
  timestamp: string; // ISO 8601 string
  editorName: string;
  versionName?: string;
  summary: string;
  data: string; // Serialized JSON
  isEmpty: boolean;
}

interface DentalChartVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DentalChartVersion[];
  selectedVersionId?: string | null;
  onSelectVersion: (version: DentalChartVersion) => void;
  onRestoreVersion: (version: DentalChartVersion) => void;
  onRenameVersion: (versionId: string, newName: string) => void;
  highlightChanges: boolean;
  onToggleHighlightChanges: (enabled: boolean) => void;
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

export function DentalChartVersionHistory({
  open,
  onOpenChange,
  versions,
  selectedVersionId,
  onSelectVersion,
  onRestoreVersion,
  onRenameVersion,
  highlightChanges,
  onToggleHighlightChanges,
}: DentalChartVersionHistoryProps) {
  const [filterMode, setFilterMode] = useState<"all" | "named">("all");
  const [namingVersion, setNamingVersion] = useState<DentalChartVersion | null>(null);
  const [versionNameInput, setVersionNameInput] = useState("");

  const filteredVersions = useMemo(() => {
    if (filterMode === "named") {
      return versions.filter((v) => Boolean(v.versionName?.trim()));
    }
    return versions;
  }, [versions, filterMode]);

  // Group versions by Day
  const groupedVersions = useMemo(() => {
    const groups: { dateLabel: string; items: DentalChartVersion[] }[] = [];
    let currentLabel = "";
    let currentItems: DentalChartVersion[] = [];

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

  const handleOpenNaming = (v: DentalChartVersion) => {
    setNamingVersion(v);
    setVersionNameInput(v.versionName || "");
  };

  const handleSaveNaming = () => {
    if (!namingVersion) return;
    onRenameVersion(namingVersion.id, versionNameInput.trim());
    toast.success("Version name updated");
    setNamingVersion(null);
  };

  const handleCopyData = (data: string) => {
    navigator.clipboard.writeText(data);
    toast.success("Version JSON copied to clipboard");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-sm flex-col p-0 sm:max-w-md bg-white border-l shadow-2xl z-[70]"
        >
          {/* Header */}
          <SheetHeader className="border-b px-5 py-4 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-slate-900">Version history</SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    {versions.length} {versions.length === 1 ? "version" : "versions"} recorded
                  </SheetDescription>
                </div>
              </div>
            </div>

            {/* Filter */}
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
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <History className="h-10 w-10 stroke-1 mb-2 opacity-50" />
                <p className="text-sm font-semibold">No versions match your filter</p>
                <p className="text-xs mt-1 text-slate-400">Edits to the dental chart will appear here.</p>
              </div>
            ) : (
              groupedVersions.map((group) => (
                <div key={group.dateLabel} className="space-y-2">
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs py-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      {group.dateLabel}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((version) => {
                      const isCurrent = versions[0]?.id === version.id;
                      const isSelected = selectedVersionId === version.id;

                      return (
                        <div
                          key={version.id}
                          onClick={() => onSelectVersion(version)}
                          className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition-all ${
                            isSelected
                              ? "border-violet-400 bg-violet-50/70 shadow-sm ring-1 ring-violet-300"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            {/* Time & Badges */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">
                                {formatTimeOnly(version.timestamp)}
                              </span>

                              {isCurrent && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Current version
                                </span>
                              )}

                              {isSelected && !isCurrent && (
                                <span className="inline-flex items-center rounded-full bg-violet-200/70 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                                  Viewing
                                </span>
                              )}
                            </div>

                            {/* Named label */}
                            {version.versionName && (
                              <div className="flex items-center gap-1 text-xs font-bold text-violet-700">
                                <Tag className="h-3 w-3" />
                                <span>{version.versionName}</span>
                              </div>
                            )}

                            {/* Author */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span className="h-2 w-2 rounded-full bg-teal-500" />
                              <span className="font-medium truncate">{version.editorName || "Dr. Villahermosa"}</span>
                            </div>

                            {/* Summary */}
                            {version.summary && (
                              <p className="text-[11px] text-slate-500 line-clamp-2">
                                {version.summary}
                              </p>
                            )}
                          </div>

                          {/* Action Menu */}
                          <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-slate-700"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-[80] w-48">
                                <DropdownMenuItem onClick={() => onRestoreVersion(version)}>
                                  <RotateCcw className="h-4 w-4 mr-2 text-violet-600" />
                                  Restore this version
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenNaming(version)}>
                                  <Tag className="h-4 w-4 mr-2" />
                                  {version.versionName ? "Rename version" : "Name this version"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleCopyData(version.data)}>
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

          {/* Footer */}
          <div className="border-t bg-slate-50/90 px-5 py-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <Checkbox
                checked={highlightChanges}
                onCheckedChange={(checked) => onToggleHighlightChanges(Boolean(checked))}
                className="data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
              />
              <span>Highlight changes</span>
            </label>
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
              placeholder="e.g., Pre-Op Inspection, Tooth #18 Extracted..."
              maxLength={60}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNamingVersion(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNaming} className="bg-violet-600 hover:bg-violet-700 text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
