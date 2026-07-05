"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppointmentTypeOptions, type AppointmentTypeForm } from "@/hooks/useAppointmentTypeOptions";
import type { ServiceCatalogItem } from "@/lib/appointment-service-catalog";
import { Check, Loader2, MoreHorizontal, Plus, RefreshCw, Save, Search, Stethoscope } from "lucide-react";
import { ALLOWED_BOOKING_DURATIONS, normalizeBookingDuration } from "./sharedBookingLogic";

const emptyForm: AppointmentTypeForm = {
  label: "",
  icon: "🦷",
  price: 0,
  duration: 30,
};

const SERVICE_ICON_OPTIONS = [
  { value: "🦷", label: "Tooth" },
  { value: "✨", label: "Cleaning" },
  { value: "🔍", label: "Checkup" },
  { value: "🔬", label: "Root Canal" },
  { value: "💎", label: "Whitening" },
  { value: "👑", label: "Crown" },
  { value: "😁", label: "Braces" },
  { value: "➕", label: "Other" },
  { value: "🪥", label: "Brush" },
  { value: "🩺", label: "Consult" },
  { value: "💊", label: "Medication" },
  { value: "🛡️", label: "Preventive" },
];

const formatCurrency = (amount?: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getServiceDraftBase = (service: ServiceCatalogItem): ServiceCatalogItem => ({
  ...service,
  duration: normalizeBookingDuration(service.duration),
});

const normalizeServiceNameForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getServiceNameDistance = (first: string, second: string) => {
  const a = normalizeServiceNameForMatch(first);
  const b = normalizeServiceNameForMatch(second);
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
};

const getServiceSimilarityScore = (input: string, serviceName: string) => {
  const normalizedInput = normalizeServiceNameForMatch(input);
  const normalizedService = normalizeServiceNameForMatch(serviceName);
  if (!normalizedInput || !normalizedService) return 0;
  if (normalizedInput === normalizedService) return 1;

  const maxLength = Math.max(normalizedInput.length, normalizedService.length);
  const distanceScore = 1 - getServiceNameDistance(normalizedInput, normalizedService) / maxLength;
  const inputWords = normalizedInput.split(" ").filter(Boolean);
  const serviceWords = new Set(normalizedService.split(" ").filter(Boolean));
  const sharedWords = inputWords.filter((word) => serviceWords.has(word)).length;
  const wordScore = sharedWords / Math.max(1, Math.min(inputWords.length, serviceWords.size));
  const containsScore =
    maxLength >= 6 && (normalizedInput.includes(normalizedService) || normalizedService.includes(normalizedInput))
      ? 0.88
      : 0;

  return Math.max(distanceScore, wordScore, containsScore);
};

const findSimilarService = (input: string, services: ServiceCatalogItem[]) => {
  const normalizedInput = normalizeServiceNameForMatch(input);
  if (!normalizedInput) return null;

  const ranked = services
    .filter((service) => service.isActive !== false)
    .map((service) => ({
      service,
      score: getServiceSimilarityScore(normalizedInput, service.label),
    }))
    .sort((a, b) => b.score - a.score);

  const bestMatch = ranked[0];
  return bestMatch && bestMatch.score >= 0.78 ? bestMatch.service : null;
};

export function ServicesView() {
  const { options, isLoading, refresh, saveService, createService } = useAppointmentTypeOptions(true);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<number, ServiceCatalogItem>>({});
  const [newService, setNewService] = useState<AppointmentTypeForm>(emptyForm);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [similarServicePrompt, setSimilarServicePrompt] = useState<{
    draft: AppointmentTypeForm;
    service: ServiceCatalogItem;
  } | null>(null);

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return options.filter((option) => !query || option.label.toLowerCase().includes(query));
  }, [options, search]);

  const updateDraft = (service: ServiceCatalogItem, updates: Partial<ServiceCatalogItem>) => {
    setDrafts((current) => ({
      ...current,
      [service.id]: {
        ...(current[service.id] || getServiceDraftBase(service)),
        ...updates,
      },
    }));
  };

  const getDraft = (service: ServiceCatalogItem) => drafts[service.id] || getServiceDraftBase(service);

  const hasDraftChanged = (service: ServiceCatalogItem) => {
    const draft = getDraft(service);
    return (
      draft.label !== service.label ||
      String(draft.icon || "") !== String(service.icon || "") ||
      Number(draft.price || 0) !== Number(service.price || 0) ||
      Number(draft.duration || 0) !== Number(service.duration || 0)
    );
  };

  const handleSave = async (service: ServiceCatalogItem) => {
    const draft = getDraft(service);
    if (!draft.label.trim()) {
      toast.error("Service name is required");
      return;
    }

    setSavingId(service.id);
    try {
      await saveService({
        ...draft,
        price: Math.max(0, toNumber(draft.price)),
        duration: normalizeBookingDuration(draft.duration),
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[service.id];
        return next;
      });
      toast.success("Service updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update service");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (skipSimilarityCheck = false, overrideDraft?: AppointmentTypeForm) => {
    const draft = {
      ...(overrideDraft || newService),
      label: (overrideDraft || newService).label.trim(),
      duration: normalizeBookingDuration((overrideDraft || newService).duration),
    };

    if (!draft.label) {
      toast.error("Service name is required");
      return;
    }

    if (!skipSimilarityCheck) {
      const similarService = findSimilarService(draft.label, options);
      if (similarService) {
        setSimilarServicePrompt({ draft, service: similarService });
        return;
      }
    }

    setIsCreating(true);
    try {
      await createService({
        label: draft.label,
        icon: draft.icon || "🦷",
        price: Math.max(0, toNumber(draft.price)),
        duration: normalizeBookingDuration(draft.duration),
      });
      setNewService(emptyForm);
      toast.success("Service created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create service");
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmSimilarServiceCreate = async () => {
    const pendingDraft = similarServicePrompt?.draft;
    setSimilarServicePrompt(null);
    if (pendingDraft) await handleCreate(true, pendingDraft);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">Services</h1>
          <p className="text-sm font-medium text-gray-500">
            Manage treatments, default booking prices, and service durations.
          </p>
        </div>
        <Button variant="outline" onClick={() => refresh(true)} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black">
            <Plus className="h-5 w-5 text-blue-600" />
            New Treatment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(120px,0.35fr)_minmax(160px,0.5fr)_minmax(160px,0.5fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="new-service-name">Treatment Name</Label>
              <Input
                id="new-service-name"
                value={newService.label}
                onChange={(event) => setNewService((current) => ({ ...current, label: event.target.value }))}
                placeholder="e.g. Dental Implant"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-service-icon">Icon</Label>
              <Select
                value={newService.icon || "🦷"}
                onValueChange={(value) => setNewService((current) => ({ ...current, icon: value }))}
              >
                <SelectTrigger id="new-service-icon" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="mr-2 text-base">{option.value}</span>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-service-price">Price</Label>
              <Input
                id="new-service-price"
                type="number"
                min="0"
                value={newService.price}
                onChange={(event) => setNewService((current) => ({ ...current, price: toNumber(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-service-duration">Duration</Label>
              <Select
                value={String(normalizeBookingDuration(newService.duration))}
                onValueChange={(value) => setNewService((current) => ({ ...current, duration: normalizeBookingDuration(value) }))}
              >
                <SelectTrigger id="new-service-duration" className="h-10">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_BOOKING_DURATIONS.map((duration) => (
                    <SelectItem key={duration} value={String(duration)}>
                      {duration} mins
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => handleCreate()} disabled={isCreating} className="gap-2">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <Stethoscope className="h-5 w-5 text-emerald-600" />
              Treatment Catalog
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Saved prices become the booking-modal defaults.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <Table className="table-fixed sm:table-auto">
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="hidden w-[140px] md:table-cell">Icon</TableHead>
                  <TableHead className="w-[130px] sm:w-[180px]">Default Price</TableHead>
                  <TableHead className="hidden w-[160px] sm:table-cell">Duration</TableHead>
                  <TableHead className="hidden w-[120px] lg:table-cell">Status</TableHead>
                  <TableHead className="w-[56px] text-right sm:w-[120px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No services found.
                    </TableCell>
                  </TableRow>
                ) : visibleOptions.map((service) => {
                  const draft = getDraft(service);
                  const changed = hasDraftChanged(service);

                  return (
                    <TableRow key={service.id}>
                      <TableCell>
                        <Input
                          value={draft.label}
                          onChange={(event) => updateDraft(service, { label: event.target.value, value: event.target.value })}
                          disabled={service.label === "Other"}
                          className="font-semibold"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                          <span className="rounded-full bg-gray-100 px-2 py-1">{draft.icon || "Icon"}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-1 sm:hidden">{normalizeBookingDuration(draft.duration)} min</span>
                          <Badge className="border-none bg-emerald-100 text-emerald-700 lg:hidden">
                            Active
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Select
                          value={draft.icon || "🦷"}
                          onValueChange={(value) => updateDraft(service, { icon: value })}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_ICON_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className="mr-2 text-base">{option.value}</span>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={draft.price ?? 0}
                          onChange={(event) => updateDraft(service, { price: toNumber(event.target.value) })}
                          className="h-10"
                        />
                        <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{formatCurrency(draft.price)}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Select
                          value={String(normalizeBookingDuration(draft.duration))}
                          onValueChange={(value) => updateDraft(service, { duration: normalizeBookingDuration(value) })}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            {ALLOWED_BOOKING_DURATIONS.map((duration) => (
                              <SelectItem key={duration} value={String(duration)}>
                                {duration} mins
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge className="border-none bg-emerald-100 text-emerald-700">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={changed ? "default" : "outline"}
                          onClick={() => handleSave(service)}
                          disabled={!changed || savingId === service.id}
                          className="hidden gap-2 sm:inline-flex"
                        >
                          {savingId === service.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : changed ? (
                            <Save className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {changed ? "Save" : "Saved"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl sm:hidden" title="Service actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              disabled={!changed || savingId === service.id}
                              onSelect={() => handleSave(service)}
                            >
                              {savingId === service.id ? "Saving..." : changed ? "Save" : "Saved"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(similarServicePrompt)} onOpenChange={(open) => !open && setSimilarServicePrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Similar service found</AlertDialogTitle>
            <AlertDialogDescription>
              {similarServicePrompt
                ? `"${similarServicePrompt.draft.label}" looks similar to "${similarServicePrompt.service.label}". Are you sure you want to add it as a new service?`
                : "This service looks similar to an existing service. Are you sure you want to add it?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCreating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSimilarServiceCreate} disabled={isCreating}>
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
