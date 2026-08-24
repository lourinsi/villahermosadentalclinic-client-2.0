import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Calendar as CalendarPicker } from "./ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Eraser, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Trash2, MoreVertical, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { parseBackendDateToLocal, formatDateToYYYYMMDD, formatWordyDate } from "../lib/utils";
import ConfirmDialog from "./ConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────
type ToothSection = "top" | "bottom" | "left" | "right" | "center";
type ToothColor = "none" | "blue" | "red";
type ToothState = Record<ToothSection, ToothColor>;

interface ChartRecord {
  date: string;
  data: string; // JSON stringified
  isEmpty: boolean;
}

// ─── PDA FDI Tooth Number Arrays ─────────────────────────────────────────────
// Arrays ordered outer-to-inner (away from midline → toward midline)
const U_R_PERM = [18, 17, 16, 15, 14, 13, 12, 11]; // Upper right permanent
const U_L_PERM = [21, 22, 23, 24, 25, 26, 27, 28]; // Upper left permanent
const L_R_PERM = [48, 47, 46, 45, 44, 43, 42, 41]; // Lower right permanent
const L_L_PERM = [31, 32, 33, 34, 35, 36, 37, 38]; // Lower left permanent
const U_R_PRIM = [55, 54, 53, 52, 51]; // Upper right primary
const U_L_PRIM = [61, 62, 63, 64, 65]; // Upper left primary
const L_R_PRIM = [85, 84, 83, 82, 81]; // Lower right primary
const L_L_PRIM = [71, 72, 73, 74, 75]; // Lower left primary

// ─── Data Serialization ───────────────────────────────────────────────────────
// Status box keys: "_s{toothNumber}"  — for primary teeth top/bottom
// Condition box keys: "_c{toothNumber}" — for permanent teeth between sections
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

// ─── Calendar Styles ──────────────────────────────────────────────────────────
const chartDatePickerClassNames = {
  root: "relative p-0",
  months: "flex flex-col",
  month: "w-full space-y-3",
  month_caption: "flex h-10 items-center justify-center",
  caption_label: "flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm",
  dropdowns: "flex items-center justify-center gap-2",
  dropdown_root: "relative inline-flex",
  dropdown: "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0",
  nav: "pointer-events-none absolute left-0 right-0 top-1 flex items-center justify-between",
  button_previous: "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-violet-50 hover:text-violet-700",
  button_next: "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-violet-50 hover:text-violet-700",
  chevron: "h-4 w-4",
  month_grid: "w-full border-collapse",
  weekdays: "grid grid-cols-7",
  weekday: "flex h-8 w-9 items-center justify-center text-[11px] font-black uppercase tracking-wide text-slate-400",
  week: "grid grid-cols-7",
  day: "h-9 w-9 p-0 text-center",
  day_button: "inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
  selected: "bg-violet-600 text-white shadow-md shadow-violet-200 hover:bg-violet-600 hover:text-white focus:bg-violet-600 focus:text-white",
  today: "bg-slate-100 text-slate-900",
  outside: "text-slate-300 opacity-60",
  disabled: "text-slate-300 opacity-40",
  hidden: "invisible",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface DentalChartProps {
  records: ChartRecord[];
  onSaveRecords: (records: ChartRecord[]) => void;
  /** Kept for API compatibility — no longer used for conditional rendering */
  patientDateOfBirth?: string | Date | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DentalChart({ records, onSaveRecords }: DentalChartProps) {
  const isChartEmpty = useCallback(
    (teeth: Record<number, ToothState>, extras: Record<string, string>): boolean =>
      isDataEmpty(teeth, extras),
    []
  );

  const [localRecords, setLocalRecords] = useState<ChartRecord[]>([]);

  useEffect(() => {
    if (records.length === 0) {
      setLocalRecords([{ date: formatDateToYYYYMMDD(new Date()), data: "{}", isEmpty: true }]);
    } else {
      setLocalRecords(
        records.map((r) => {
          const { teeth, extras } = parseData(r.data);
          return { ...r, isEmpty: r.isEmpty ?? isChartEmpty(teeth, extras) };
        })
      );
    }
  }, [records, isChartEmpty]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (localRecords.length > 0 && currentIndex >= localRecords.length) {
      setCurrentIndex(localRecords.length - 1);
    }
  }, [localRecords.length, currentIndex]);

  const [selectedColor, setSelectedColor] = useState<ToothColor>("blue");
  const [teethState, setTeethState] = useState<Record<number, ToothState>>({});
  const [extrasState, setExtrasState] = useState<Record<string, string>>({});
  const [originalTeethState, setOriginalTeethState] = useState<Record<number, ToothState>>({});
  const [originalExtrasState, setOriginalExtrasState] = useState<Record<string, string>>({});
  const [currentDate, setCurrentDate] = useState("");
  const [isConfirmDeleteChartOpen, setIsConfirmDeleteChartOpen] = useState(false);
  const [isConfirmDeleteEmptyChartsOpen, setIsConfirmDeleteEmptyChartsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Load state from current record
  useEffect(() => {
    const rec = localRecords[currentIndex];
    if (rec) {
      try {
        const { teeth, extras } = parseData(rec.data);
        setTeethState(teeth);
        setOriginalTeethState(teeth);
        setExtrasState(extras);
        setOriginalExtrasState(extras);
        setCurrentDate(rec.date);
      } catch {
        setTeethState({});
        setOriginalTeethState({});
        setExtrasState({});
        setOriginalExtrasState({});
        setCurrentDate(formatDateToYYYYMMDD(new Date()));
      }
    } else {
      setTeethState({});
      setOriginalTeethState({});
      setExtrasState({});
      setOriginalExtrasState({});
      setCurrentDate(formatDateToYYYYMMDD(new Date()));
    }
  }, [currentIndex, localRecords]);

  // Auto-save on change
  useEffect(() => {
    const teethChanged = JSON.stringify(teethState) !== JSON.stringify(originalTeethState);
    const extrasChanged = JSON.stringify(extrasState) !== JSON.stringify(originalExtrasState);
    if (!teethChanged && !extrasChanged) return;

    const updatedRecords = [...localRecords];
    const rec = updatedRecords[currentIndex];
    if (!rec) return;

    updatedRecords[currentIndex] = {
      ...rec,
      data: serializeData(teethState, extrasState),
      isEmpty: isChartEmpty(teethState, extrasState),
    };
    onSaveRecords(updatedRecords);
  }, [teethState, extrasState, currentIndex, localRecords, onSaveRecords, originalTeethState, originalExtrasState, isChartEmpty]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const getToothState = (n: number): ToothState =>
    teethState[n] || { top: "none", bottom: "none", left: "none", right: "none", center: "none" };

  const handleSectionClick = (n: number, section: ToothSection) => {
    setTeethState((prev) => {
      const curr = getToothState(n);
      const newColor =
        selectedColor === "none"
          ? "none"
          : curr[section] === selectedColor
          ? "none"
          : selectedColor;
      return { ...prev, [n]: { ...curr, [section]: newColor } };
    });
  };

  const handleExtraChange = (key: string, value: string) => {
    setExtrasState((prev) => ({ ...prev, [key]: value.slice(0, 3).toUpperCase() }));
  };

  const getExtra = (key: string) => extrasState[key] ?? "";

  const handleClear = () => {
    setConfirmAction(() => () => {
      setTeethState({});
      setExtrasState({});
    });
    setIsConfirmOpen(true);
  };

  const handleCreateNew = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let newChartDate = new Date(today);

    const sortedRecords = [...localRecords].sort(
      (a, b) =>
        parseBackendDateToLocal(a.date).getTime() - parseBackendDateToLocal(b.date).getTime()
    );

    const latestFutureRecordDate = sortedRecords.reduce<Date | null>((latest, r) => {
      const d = parseBackendDateToLocal(r.date);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() >= today.getTime() && (!latest || d.getTime() > latest.getTime())) return d;
      return latest;
    }, null);

    if (latestFutureRecordDate) {
      newChartDate = new Date(latestFutureRecordDate);
      newChartDate.setDate(newChartDate.getDate() + 1);
    }

    const newRecord: ChartRecord = {
      date: formatDateToYYYYMMDD(newChartDate),
      data: "{}",
      isEmpty: true,
    };
    const updated = [...localRecords, newRecord];
    onSaveRecords(updated);
    setCurrentIndex(updated.length - 1);
    toast.info("New dental chart record created for " + formatWordyDate(newChartDate));
  };

  const handleDeleteChart = () => {
    if (localRecords.length === 1 && records.length === 0) {
      toast.info("This is a temporary chart and cannot be deleted yet.");
      return;
    }
    setIsConfirmDeleteChartOpen(true);
  };

  const confirmDeleteChart = () => {
    const updated = localRecords.filter((_, i) => i !== currentIndex);
    if (updated.length === 0) {
      const temp: ChartRecord = { date: formatDateToYYYYMMDD(new Date()), data: "{}", isEmpty: true };
      setLocalRecords([temp]);
      setCurrentIndex(0);
      onSaveRecords([]);
      toast.info("Last chart deleted. A new temporary chart has been created.");
    } else {
      onSaveRecords(updated);
      setCurrentIndex(Math.min(currentIndex, updated.length - 1));
      toast.success("Dental chart record deleted.");
    }
    setIsConfirmDeleteChartOpen(false);
  };

  const handleDeleteEmptyCharts = () => {
    if (
      localRecords.length === 0 ||
      (localRecords.length === 1 && localRecords[0].data === "{}" && records.length === 0)
    ) {
      toast.info("No charts to clean up.");
      return;
    }
    setIsConfirmDeleteEmptyChartsOpen(true);
  };

  const confirmDeleteEmptyCharts = () => {
    const cleaned = localRecords.filter((r) => !r.isEmpty);
    if (cleaned.length === 0) {
      const temp: ChartRecord = { date: formatDateToYYYYMMDD(new Date()), data: "{}", isEmpty: true };
      setLocalRecords([temp]);
      setCurrentIndex(0);
      onSaveRecords([]);
      toast.info("All charts were empty. A new temporary chart has been created.");
    } else if (cleaned.length === localRecords.length) {
      toast.info("No empty charts found to delete.");
      setIsConfirmDeleteEmptyChartsOpen(false);
      return;
    } else {
      onSaveRecords(cleaned);
      if (currentIndex >= cleaned.length) setCurrentIndex(cleaned.length - 1);
      toast.success(`${localRecords.length - cleaned.length} empty charts deleted.`);
    }
    setIsConfirmDeleteEmptyChartsOpen(false);
  };

  const handleChartDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const updated = [...localRecords];
    const rec = updated[currentIndex];
    if (!rec) return;
    const nextDate = formatDateToYYYYMMDD(date);
    if (rec.date === nextDate) { setIsDatePickerOpen(false); return; }
    updated[currentIndex] = { ...rec, date: nextDate };
    setCurrentDate(nextDate);
    setLocalRecords(updated);
    onSaveRecords(updated);
    setIsDatePickerOpen(false);
  };

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < localRecords.length - 1;
  const selectedChartDate = currentDate ? parseBackendDateToLocal(currentDate) : new Date();

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-600">Color:</span>
              <div className="flex gap-2">
                <Button
                  variant={selectedColor === "blue" ? "brand" : "outline"}
                  size="sm"
                  onClick={() => setSelectedColor("blue")}
                  className={selectedColor === "blue" ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-600" : ""}
                >
                  Blue
                </Button>
                <Button
                  variant={selectedColor === "red" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setSelectedColor("red")}
                  className={selectedColor === "red" ? "bg-red-500 hover:bg-red-600 text-white border-red-600" : ""}
                >
                  Red
                </Button>
                <Button
                  variant={selectedColor === "none" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setSelectedColor("none")}
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  Eraser
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                <span>Cavity / Decay</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                <span>Treatment Required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border border-slate-300 bg-white" />
                <span>Condition Code Box</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDA Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">PDA Dental Chart Diagram</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900" title="Chart options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />New Chart
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClear}>
                  <RotateCcw className="h-4 w-4 mr-2" />Clear
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDeleteEmptyCharts} disabled={records.length === 0} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />Delete Empty Charts
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteChart} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />Delete Current Chart
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto pb-2">
            <PdaChartDiagram
              teethState={teethState}
              onSectionClick={handleSectionClick}
              onExtraChange={handleExtraChange}
              getExtra={getExtra}
            />
          </div>

          {/* Pagination */}
          <div className="flex justify-center mt-6">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={() => setCurrentIndex(0)} disabled={!canGoPrevious}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={() => setCurrentIndex((p) => p - 1)} disabled={!canGoPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" className="h-8 min-w-[150px] justify-center gap-2 px-4 text-sm font-medium text-gray-600 hover:bg-violet-50 hover:text-violet-700">
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                    {formatWordyDate(selectedChartDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[60] w-[318px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-200/80 ring-1 ring-slate-100" align="center" side="top" sideOffset={10}>
                  <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Chart Date</div>
                    <div className="mt-0.5 text-sm font-bold text-slate-900">{formatWordyDate(selectedChartDate)}</div>
                  </div>
                  <div className="p-4">
                    <CalendarPicker
                      mode="single"
                      selected={selectedChartDate}
                      defaultMonth={selectedChartDate}
                      onSelect={handleChartDateSelect}
                      captionLayout="dropdown"
                      startMonth={new Date(1900, 0)}
                      endMonth={new Date(2100, 11)}
                      className="rounded-none border-0"
                      classNames={chartDatePickerClassNames}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={() => setCurrentIndex((p) => p + 1)} disabled={!canGoNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" onClick={() => setCurrentIndex(localRecords.length - 1)} disabled={!canGoNext}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); setIsConfirmOpen(open); }}
        title="Confirm"
        message="Are you sure?"
        loading={confirmLoading}
        onConfirm={async () => {
          if (confirmAction) {
            try { setConfirmLoading(true); await confirmAction(); }
            finally { setConfirmLoading(false); setConfirmAction(null); }
          }
        }}
        confirmLabel="Yes"
        cancelLabel="No"
      />
      <Dialog open={isConfirmDeleteChartOpen} onOpenChange={setIsConfirmDeleteChartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Chart Deletion</DialogTitle></DialogHeader>
          <div className="py-4"><p className="text-sm text-muted-foreground">Are you sure you want to delete this dental chart record? This action cannot be undone.</p></div>
          <DialogFooter className="sm:justify-center">
            <Button variant="outline" onClick={() => setIsConfirmDeleteChartOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteChart}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isConfirmDeleteEmptyChartsOpen} onOpenChange={setIsConfirmDeleteEmptyChartsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Delete Empty Charts</DialogTitle></DialogHeader>
          <div className="py-4"><p className="text-sm text-muted-foreground">Are you sure you want to delete all empty dental chart records? This action cannot be undone.</p></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDeleteEmptyChartsOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteEmptyCharts}>Delete All Empty Charts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PDA Chart Layout ─────────────────────────────────────────────────────────
interface PdaChartDiagramProps {
  teethState: Record<number, ToothState>;
  onSectionClick: (n: number, section: ToothSection) => void;
  onExtraChange: (key: string, value: string) => void;
  getExtra: (key: string) => string;
}

// Layout constants
const TOOTH_W = 42;        // px per tooth column (permanent & primary share same width)
const PERM_COUNT = 8;      // permanent teeth per side
const PRIM_COUNT = 5;      // primary teeth per side
const PERM_SIDE_W = PERM_COUNT * TOOTH_W;  // 336px per arch half
const MID_W = 32;          // midline column width
const LABEL_W = 80;        // vertical section label area
const SIDE_W = 52;         // RIGHT / LEFT label width

function PdaChartDiagram({ teethState, onSectionClick, onExtraChange, getExtra }: PdaChartDiagramProps) {
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
      {/* Right arch — justify-end so primary teeth align to midline */}
      <div className="flex items-end justify-end" style={{ width: PERM_SIDE_W }}>
        {right.map((n) => (
          <ToothDiagram
            key={n}
            toothNumber={n}
            state={getToothState(n)}
            onSectionClick={onSectionClick}
            size={size}
          />
        ))}
      </div>
      {/* Midline */}
      <div className="flex justify-center" style={{ width: MID_W }}>
        <div className="w-px bg-slate-500" style={{ height: size === "small" ? 32 : 42 }} />
      </div>
      {/* Left arch — justify-start so primary teeth align to midline */}
      <div className="flex items-end justify-start" style={{ width: PERM_SIDE_W }}>
        {left.map((n) => (
          <ToothDiagram
            key={n}
            toothNumber={n}
            state={getToothState(n)}
            onSectionClick={onSectionClick}
            size={size}
          />
        ))}
      </div>
    </div>
  );

  // Renders one row of tooth numbers
  const NumberRow = ({
    right,
    left,
  }: {
    right: number[];
    left: number[];
  }) => (
    <div className="flex items-center">
      <div className="flex items-center justify-end" style={{ width: PERM_SIDE_W }}>
        {right.map((n) => (
          <div key={n} className="flex items-center justify-center text-[10px] font-bold text-slate-500" style={{ width: TOOTH_W }}>
            {n}
          </div>
        ))}
      </div>
      <div style={{ width: MID_W }} />
      <div className="flex items-center justify-start" style={{ width: PERM_SIDE_W }}>
        {left.map((n) => (
          <div key={n} className="flex items-center justify-center text-[10px] font-bold text-slate-500" style={{ width: TOOTH_W }}>
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
              value={getExtra(keyFn(n))}
              onChange={(e) => onExtraChange(keyFn(n), e.target.value)}
              className="h-5 w-7 rounded border border-slate-300 bg-white text-center text-[10px] font-black uppercase text-slate-700 outline-none transition-colors focus:border-violet-400 focus:ring-1 focus:ring-violet-300 hover:border-slate-400"
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
              value={getExtra(keyFn(n))}
              onChange={(e) => onExtraChange(keyFn(n), e.target.value)}
              className="h-5 w-7 rounded border border-slate-300 bg-white text-center text-[10px] font-black uppercase text-slate-700 outline-none transition-colors focus:border-violet-400 focus:ring-1 focus:ring-violet-300 hover:border-slate-400"
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
}

function ToothDiagram({ toothNumber, state, onSectionClick, size = "normal" }: ToothDiagramProps) {
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
      <svg width={circleSize} height={circleSize} className="cursor-pointer">
        <circle cx={c} cy={c} r={outerRadius} fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
        {(Object.entries(paths) as [Exclude<ToothSection, "center">, string][]).map(([section, path]) => (
          <path
            key={section}
            d={path}
            fill={getColor(state[section])}
            stroke="#cbd5e1"
            strokeWidth="0.8"
            className="transition-opacity hover:opacity-70"
            onClick={() => onSectionClick(toothNumber, section)}
            style={{ cursor: "pointer" }}
          />
        ))}
        <circle
          cx={c}
          cy={c}
          r={innerRadius}
          fill={getColor(state.center)}
          stroke="#cbd5e1"
          strokeWidth="0.8"
          className="transition-opacity hover:opacity-70"
          onClick={() => onSectionClick(toothNumber, "center")}
          style={{ cursor: "pointer" }}
        />
      </svg>
    </div>
  );
}
