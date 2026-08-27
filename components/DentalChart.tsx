"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Eraser, RotateCcw, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────
type ToothSection = "top" | "bottom" | "left" | "right" | "center";
type ToothColor = "none" | "blue" | "red";
type ToothState = Record<ToothSection, ToothColor>;

// ─── PDA FDI Tooth Number Arrays ─────────────────────────────────────────────
const U_R_PERM = [18, 17, 16, 15, 14, 13, 12, 11]; // Upper right permanent
const U_L_PERM = [21, 22, 23, 24, 25, 26, 27, 28]; // Upper left permanent
const L_R_PERM = [48, 47, 46, 45, 44, 43, 42, 41]; // Lower right permanent
const L_L_PERM = [31, 32, 33, 34, 35, 36, 37, 38]; // Lower left permanent
const U_R_PRIM = [55, 54, 53, 52, 51]; // Upper right primary
const U_L_PRIM = [61, 62, 63, 64, 65]; // Upper left primary
const L_R_PRIM = [85, 84, 83, 82, 81]; // Lower right primary
const L_L_PRIM = [71, 72, 73, 74, 75]; // Lower left primary

// ─── Keys & Helpers ───────────────────────────────────────────────────────────
const statusKey = (n: number) => `_s${n}`;
const condKey = (n: number) => `_c${n}`;

const parseData = (jsonStr: string) => {
  try {
    const raw: Record<string, any> = JSON.parse(jsonStr || "{}");
    const teeth: Record<number, ToothState> = {};
    const extras: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) {
        if (typeof v === "string") extras[k] = v;
      } else {
        const n = Number(k);
        if (!isNaN(n) && n > 0 && typeof v === "object" && v !== null) {
          teeth[n] = v as ToothState;
        }
      }
    }
    return { teeth, extras };
  } catch {
    return { teeth: {} as Record<number, ToothState>, extras: {} as Record<string, string> };
  }
};

const serializeData = (
  teeth: Record<number, ToothState>,
  extras: Record<string, string>
): string => JSON.stringify({ ...teeth, ...extras });

const isDataEmpty = (
  teeth: Record<number, ToothState>,
  extras: Record<string, string>
): boolean => {
  for (const t of Object.values(teeth)) {
    if ((Object.values(t) as ToothColor[]).some((c) => c !== "none")) return false;
  }
  if (Object.values(extras).some((v) => v.trim() !== "")) return false;
  return true;
};

// ─── Props ────────────────────────────────────────────────────────────────────
export interface DentalChartProps {
  records?: any[];
  onSaveRecords?: (records: any[]) => void;
  patientDateOfBirth?: string | Date | null;
  isReadOnly?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DentalChart({
  records = [],
  onSaveRecords,
  isReadOnly = false,
}: DentalChartProps) {
  // Read active data from records[0] (or fallback)
  const currentRawData = useMemo(() => {
    if (Array.isArray(records) && records.length > 0) {
      return records[0]?.data || "{}";
    }
    if (typeof records === "string") return records;
    return "{}";
  }, [records]);

  const [teethState, setTeethState] = useState<Record<number, ToothState>>({});
  const [extrasState, setExtrasState] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState<ToothColor>("blue");
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Sync state with incoming records
  useEffect(() => {
    const { teeth, extras } = parseData(currentRawData);
    setTeethState(teeth);
    setExtrasState(extras);
  }, [currentRawData]);

  // Dispatch updates to parent
  const emitChanges = (newTeeth: Record<number, ToothState>, newExtras: Record<string, string>) => {
    if (isReadOnly) return;
    const serialized = serializeData(newTeeth, newExtras);
    const isEmpty = isDataEmpty(newTeeth, newExtras);
    const newRecord = {
      date: new Date().toISOString().split("T")[0],
      data: serialized,
      isEmpty,
    };
    onSaveRecords?.([newRecord]);
  };

  // Section click
  const handleSectionClick = (n: number, section: ToothSection) => {
    if (isReadOnly) return;

    const curr = teethState[n] || { top: "none", bottom: "none", left: "none", right: "none", center: "none" };
    const newColor =
      selectedColor === "none"
        ? "none"
        : curr[section] === selectedColor
        ? "none"
        : selectedColor;
    const updated = { ...teethState, [n]: { ...curr, [section]: newColor } };
    setTeethState(updated);
    emitChanges(updated, extrasState);
  };

  // Status / condition code change
  const handleExtraChange = (key: string, value: string) => {
    if (isReadOnly) return;

    const updated = { ...extrasState, [key]: value.slice(0, 3).toUpperCase() };
    setExtrasState(updated);
    emitChanges(teethState, updated);
  };

  const getExtra = (key: string) => extrasState[key] ?? "";

  const handleClear = () => {
    if (isReadOnly) return;
    setIsConfirmClearOpen(true);
  };

  const confirmClear = () => {
    setTeethState({});
    setExtrasState({});
    emitChanges({}, {});
    setIsConfirmClearOpen(false);
    toast.info("Dental chart cleared");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Color Palette */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-700">Select Color:</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedColor === "blue" && !isReadOnly ? "brand" : "outline"}
                  size="sm"
                  disabled={isReadOnly}
                  onClick={() => setSelectedColor("blue")}
                  className={
                    selectedColor === "blue" && !isReadOnly
                      ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-600 font-bold"
                      : "font-semibold"
                  }
                >
                  Blue
                </Button>
                <Button
                  type="button"
                  variant={selectedColor === "red" && !isReadOnly ? "destructive" : "outline"}
                  size="sm"
                  disabled={isReadOnly}
                  onClick={() => setSelectedColor("red")}
                  className={
                    selectedColor === "red" && !isReadOnly
                      ? "bg-red-500 hover:bg-red-600 text-white border-red-600 font-bold"
                      : "font-semibold"
                  }
                >
                  Red
                </Button>
                <Button
                  type="button"
                  variant={selectedColor === "none" && !isReadOnly ? "secondary" : "outline"}
                  size="sm"
                  disabled={isReadOnly}
                  onClick={() => setSelectedColor("none")}
                  className="font-semibold"
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  Eraser
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-blue-500 shadow-xs" />
                <span>Cavity / Decay</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-red-500 shadow-xs" />
                <span>Treatment Required</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDA Dental Chart Diagram Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-black">PDA Dental Chart Diagram</CardTitle>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                {isReadOnly ? "Read-only preview mode" : "Universal 4-arch PDA clinical chart"}
              </p>
            </div>

            {!isReadOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900" title="Options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleClear} className="text-red-600 font-semibold">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear Chart
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto pb-4">
            <div className="mx-auto" style={{ minWidth: 760 }}>
              <PdaChartDiagram
                teethState={teethState}
                onSectionClick={handleSectionClick}
                onExtraChange={handleExtraChange}
                getExtra={getExtra}
                isReadOnly={isReadOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Clear Dialog */}
      <ConfirmDialog
        open={isConfirmClearOpen}
        onOpenChange={setIsConfirmClearOpen}
        title="Clear Dental Chart"
        message="Are you sure you want to clear all markings and condition codes on the current dental chart?"
        onConfirm={confirmClear}
        confirmLabel="Clear Chart"
        cancelLabel="Cancel"
      />
    </div>
  );
}

// ─── PDA Chart Layout ─────────────────────────────────────────────────────────
interface PdaChartDiagramProps {
  teethState: Record<number, ToothState>;
  onSectionClick: (n: number, section: ToothSection) => void;
  onExtraChange: (key: string, value: string) => void;
  getExtra: (key: string) => string;
  isReadOnly?: boolean;
}

// Layout constants
const TOOTH_W = 42;
const PERM_COUNT = 8;
const PERM_SIDE_W = PERM_COUNT * TOOTH_W; // 336px per arch half
const MID_W = 32;
const LABEL_W = 80;
const SIDE_W = 52;

function PdaChartDiagram({
  teethState,
  onSectionClick,
  onExtraChange,
  getExtra,
  isReadOnly = false,
}: PdaChartDiagramProps) {
  const getToothState = (n: number): ToothState =>
    teethState[n] || { top: "none", bottom: "none", left: "none", right: "none", center: "none" };

  // Renders one row of tooth diagrams
  const ToothRow = ({
    right,
    left,
    size,
  }: {
    right: number[];
    left: number[];
    size: "normal" | "small";
  }) => (
    <div className="flex items-center">
      {/* Right arch */}
      <div className="flex items-end justify-end" style={{ width: PERM_SIDE_W }}>
        {right.map((n) => (
          <ToothDiagram
            key={n}
            toothNumber={n}
            state={getToothState(n)}
            onSectionClick={onSectionClick}
            size={size}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>
      {/* Midline */}
      <div className="flex justify-center" style={{ width: MID_W }}>
        <div className="w-px bg-slate-400" style={{ height: size === "small" ? 32 : 42 }} />
      </div>
      {/* Left arch */}
      <div className="flex items-end justify-start" style={{ width: PERM_SIDE_W }}>
        {left.map((n) => (
          <ToothDiagram
            key={n}
            toothNumber={n}
            state={getToothState(n)}
            onSectionClick={onSectionClick}
            size={size}
            isReadOnly={isReadOnly}
          />
        ))}
      </div>
    </div>
  );

  // Renders one row of tooth numbers
  const NumberRow = ({ right, left }: { right: number[]; left: number[] }) => (
    <div className="flex items-center">
      <div className="flex items-center justify-end" style={{ width: PERM_SIDE_W }}>
        {right.map((n) => (
          <div
            key={n}
            className="flex items-center justify-center text-[10px] font-bold text-slate-500"
            style={{ width: TOOTH_W }}
          >
            {n}
          </div>
        ))}
      </div>
      <div style={{ width: MID_W }} />
      <div className="flex items-center justify-start" style={{ width: PERM_SIDE_W }}>
        {left.map((n) => (
          <div
            key={n}
            className="flex items-center justify-center text-[10px] font-bold text-slate-500"
            style={{ width: TOOTH_W }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );

  // Renders one row of annotation (condition/status) boxes
  const BoxRow = ({
    right,
    left,
    keyFn,
  }: {
    right: number[];
    left: number[];
    keyFn: (n: number) => string;
  }) => (
    <div className="flex items-center">
      <div className="flex items-center justify-end" style={{ width: PERM_SIDE_W }}>
        {right.map((n) => (
          <div key={n} className="flex items-center justify-center" style={{ width: TOOTH_W }}>
            <input
              type="text"
              maxLength={3}
              disabled={isReadOnly}
              value={getExtra(keyFn(n))}
              onChange={(e) => onExtraChange(keyFn(n), e.target.value)}
              className={`h-5 w-7 rounded border text-center text-[10px] font-black uppercase outline-none transition-colors ${
                isReadOnly
                  ? "border-slate-200 bg-slate-50 text-slate-600 cursor-default"
                  : "border-slate-300 bg-white text-slate-700 focus:border-violet-400 focus:ring-1 focus:ring-violet-300 hover:border-slate-400"
              }`}
            />
          </div>
        ))}
      </div>
      <div style={{ width: MID_W }} />
      <div className="flex items-center justify-start" style={{ width: PERM_SIDE_W }}>
        {left.map((n) => (
          <div key={n} className="flex items-center justify-center" style={{ width: TOOTH_W }}>
            <input
              type="text"
              maxLength={3}
              disabled={isReadOnly}
              value={getExtra(keyFn(n))}
              onChange={(e) => onExtraChange(keyFn(n), e.target.value)}
              className={`h-5 w-7 rounded border text-center text-[10px] font-black uppercase outline-none transition-colors ${
                isReadOnly
                  ? "border-slate-200 bg-slate-50 text-slate-600 cursor-default"
                  : "border-slate-300 bg-white text-slate-700 focus:border-violet-400 focus:ring-1 focus:ring-violet-300 hover:border-slate-400"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  // Wrapper row: [section label] | [side label] | [chart content] | [side label]
  const ChartRow = ({
    sectionLabel,
    sideLabel,
    children,
    height,
  }: {
    sectionLabel?: string;
    sideLabel?: "RIGHT" | "STATUS";
    children: React.ReactNode;
    height?: number;
  }) => (
    <div className="flex items-center" style={height ? { height } : {}}>
      {/* Vertical section label */}
      <div className="flex items-center justify-center" style={{ width: LABEL_W, height: "100%" }}>
        {sectionLabel && (
          <span
            className="text-[9px] font-black uppercase tracking-widest text-slate-400 select-none whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {sectionLabel}
          </span>
        )}
      </div>
      {/* RIGHT / STATUS label */}
      <div className="flex items-center justify-end pr-1" style={{ width: SIDE_W }}>
        {sideLabel && (
          <span className="text-[9px] font-black uppercase text-slate-400 select-none">{sideLabel}</span>
        )}
      </div>
      {/* Chart body */}
      {children}
      {/* LEFT label */}
      <div className="flex items-center pl-1" style={{ width: SIDE_W }}>
        {sideLabel && (
          <span className="text-[9px] font-black uppercase text-slate-400 select-none">
            {sideLabel === "RIGHT" ? "LEFT" : sideLabel}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto select-none" style={{ width: PERM_SIDE_W * 2 + MID_W + LABEL_W + SIDE_W * 2 }}>
      {/* ══════════════════ UPPER SECTION ══════════════════ */}

      {/* STATUS row — upper primary */}
      <ChartRow sectionLabel="STATUS" sideLabel="RIGHT" height={26}>
        <BoxRow right={U_R_PRIM} left={U_L_PRIM} keyFn={statusKey} />
      </ChartRow>

      {/* Spacer */}
      <div style={{ height: 4 }} />

      {/* Primary upper: number labels */}
      <ChartRow>
        <NumberRow right={U_R_PRIM} left={U_L_PRIM} />
      </ChartRow>

      {/* Primary upper: tooth diagrams — TEMPORARY TEETH */}
      <ChartRow sectionLabel="TEMPORARY TEETH">
        <ToothRow right={U_R_PRIM} left={U_L_PRIM} size="small" />
      </ChartRow>

      {/* Condition boxes — permanent upper (between temporary and permanent) */}
      <ChartRow>
        <BoxRow right={U_R_PERM} left={U_L_PERM} keyFn={condKey} />
      </ChartRow>

      {/* Spacer */}
      <div style={{ height: 4 }} />

      {/* Permanent upper: number labels */}
      <ChartRow>
        <NumberRow right={U_R_PERM} left={U_L_PERM} />
      </ChartRow>

      {/* Permanent upper: tooth diagrams — PERMANENT TEETH */}
      <ChartRow sectionLabel="PERMANENT TEETH">
        <ToothRow right={U_R_PERM} left={U_L_PERM} size="normal" />
      </ChartRow>

      {/* ══════════════════ OCCLUSAL MIDLINE ══════════════════ */}
      <div className="flex items-center my-2">
        <div style={{ width: LABEL_W + SIDE_W }} />
        <div className="h-0.5 rounded-full bg-slate-800" style={{ width: PERM_SIDE_W * 2 + MID_W }} />
        <div style={{ width: SIDE_W }} />
      </div>

      {/* ══════════════════ LOWER SECTION ══════════════════ */}

      {/* Permanent lower: tooth diagrams — PERMANENT TEETH */}
      <ChartRow sectionLabel="PERMANENT TEETH">
        <ToothRow right={L_R_PERM} left={L_L_PERM} size="normal" />
      </ChartRow>

      {/* Permanent lower: number labels */}
      <ChartRow>
        <NumberRow right={L_R_PERM} left={L_L_PERM} />
      </ChartRow>

      {/* Spacer */}
      <div style={{ height: 4 }} />

      {/* Condition boxes — permanent lower */}
      <ChartRow>
        <BoxRow right={L_R_PERM} left={L_L_PERM} keyFn={condKey} />
      </ChartRow>

      {/* Primary lower: tooth diagrams — TEMPORARY TEETH */}
      <ChartRow sectionLabel="TEMPORARY TEETH">
        <ToothRow right={L_R_PRIM} left={L_L_PRIM} size="small" />
      </ChartRow>

      {/* Primary lower: number labels */}
      <ChartRow>
        <NumberRow right={L_R_PRIM} left={L_L_PRIM} />
      </ChartRow>

      {/* Spacer */}
      <div style={{ height: 4 }} />

      {/* STATUS row — lower primary */}
      <ChartRow sectionLabel="STATUS" sideLabel="RIGHT" height={26}>
        <BoxRow right={L_R_PRIM} left={L_L_PRIM} keyFn={statusKey} />
      </ChartRow>

      {/* ══════════════════ CONDITION CODE LEGEND ══════════════════ */}
      <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Condition Code Legend
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-0.5">
          {[
            ["P", "Present (Sound)"],
            ["C", "Carious"],
            ["F", "Filled"],
            ["M", "Missing"],
            ["X", "Extracted"],
            ["I", "Impacted"],
            ["U", "Unerupted"],
            ["R", "Root Fragment"],
            ["S", "Supernumerary"],
            ["Ab", "Abscess"],
          ].map(([code, label]) => (
            <span key={code} className="text-[11px] text-slate-500">
              <span className="font-black text-slate-700">{code}</span> – {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tooth Diagram SVG ────────────────────────────────────────────────────────
interface ToothDiagramProps {
  toothNumber: number;
  state: ToothState;
  onSectionClick: (toothNumber: number, section: ToothSection) => void;
  size?: "normal" | "small";
  isReadOnly?: boolean;
}

function ToothDiagram({
  toothNumber,
  state,
  onSectionClick,
  size = "normal",
  isReadOnly = false,
}: ToothDiagramProps) {
  const isSmall = size === "small";
  const circleSize = isSmall ? 34 : 40;
  const center = circleSize / 2;
  const outerRadius = center - 1.5;
  const innerRadius = outerRadius * 0.38;

  const getColor = (color: ToothColor) => {
    if (color === "blue") return "#3b82f6";
    if (color === "red") return "#ef4444";
    return "#ffffff";
  };

  const c = center;
  const r = outerRadius;
  const d = r * 0.707;

  const paths: Record<Exclude<ToothSection, "center">, string> = {
    top:    `M ${c} ${c} L ${c - d} ${c - d} A ${r} ${r} 0 0 1 ${c + d} ${c - d} Z`,
    right:  `M ${c} ${c} L ${c + d} ${c - d} A ${r} ${r} 0 0 1 ${c + d} ${c + d} Z`,
    bottom: `M ${c} ${c} L ${c + d} ${c + d} A ${r} ${r} 0 0 1 ${c - d} ${c + d} Z`,
    left:   `M ${c} ${c} L ${c - d} ${c + d} A ${r} ${r} 0 0 1 ${c - d} ${c - d} Z`,
  };

  return (
    <div className="flex flex-col items-center justify-end" style={{ width: TOOTH_W }}>
      <svg
        width={circleSize}
        height={circleSize}
        className={isReadOnly ? "cursor-default" : "cursor-pointer"}
      >
        <circle cx={c} cy={c} r={outerRadius} fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
        {(Object.entries(paths) as [Exclude<ToothSection, "center">, string][]).map(([section, path]) => (
          <path
            key={section}
            d={path}
            fill={getColor(state[section])}
            stroke="#cbd5e1"
            strokeWidth="0.8"
            className={isReadOnly ? "" : "transition-opacity hover:opacity-70"}
            onClick={() => !isReadOnly && onSectionClick(toothNumber, section)}
            style={{ cursor: isReadOnly ? "default" : "pointer" }}
          />
        ))}
        <circle
          cx={c}
          cy={c}
          r={innerRadius}
          fill={getColor(state.center)}
          stroke="#cbd5e1"
          strokeWidth="0.8"
          className={isReadOnly ? "" : "transition-opacity hover:opacity-70"}
          onClick={() => !isReadOnly && onSectionClick(toothNumber, "center")}
          style={{ cursor: isReadOnly ? "default" : "pointer" }}
        />
      </svg>
    </div>
  );
}
