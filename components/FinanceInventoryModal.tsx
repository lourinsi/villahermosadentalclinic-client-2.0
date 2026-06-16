"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { INVENTORY_UNIT_OPTIONS, normalizeFinanceValue, type InventoryForm } from "./financeModalOptions";

export type FinanceInventoryModalMode = "create" | "edit";

type InventoryLookupItem = {
  id?: string;
  item?: string;
  supplier?: string;
};

type FinanceInventoryModalProps = {
  open: boolean;
  mode: FinanceInventoryModalMode;
  form: InventoryForm;
  isSaving: boolean;
  inventoryItems?: InventoryLookupItem[];
  currentItemId?: string;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: InventoryForm) => void;
  onSave: () => void;
};

const CREATE_NEW_SUPPLIER_VALUE = "__create_new_supplier__";

const normalizeInventoryName = (value?: string) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularizeToken = (token: string) => {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
};

const normalizedNameKey = (value?: string) =>
  normalizeInventoryName(value)
    .split(" ")
    .filter(Boolean)
    .map(singularizeToken)
    .join(" ");

const compactNameKey = (value?: string) => normalizedNameKey(value).replace(/\s/g, "");

const getEditDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

const getNameMatchScore = (input: string, candidate: string) => {
  const normalizedInput = normalizedNameKey(input);
  const normalizedCandidate = normalizedNameKey(candidate);
  const compactInput = compactNameKey(input);
  const compactCandidate = compactNameKey(candidate);

  if (!compactInput || compactInput.length < 4 || !compactCandidate) return 0;
  if (compactInput === compactCandidate) return 1;

  const inputTokens = normalizedInput.split(" ").filter(Boolean);
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  if (inputTokens.length >= 2) {
    const candidateTokenSet = new Set(candidateTokens);
    const overlap = inputTokens.filter((token) => candidateTokenSet.has(token)).length;
    const tokenScore = overlap / Math.max(inputTokens.length, candidateTokens.length);
    if (tokenScore >= 0.85) return tokenScore;
  }

  if (Math.min(compactInput.length, compactCandidate.length) >= 6) {
    const editDistance = getEditDistance(compactInput, compactCandidate);
    return 1 - editDistance / Math.max(compactInput.length, compactCandidate.length);
  }

  return 0;
};

export function FinanceInventoryModal({
  open,
  mode,
  form,
  isSaving,
  inventoryItems = [],
  currentItemId,
  formatCurrency,
  onOpenChange,
  onFormChange,
  onSave,
}: FinanceInventoryModalProps) {
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const updateForm = (updates: Partial<InventoryForm>) => onFormChange({ ...form, ...updates });

  useEffect(() => {
    if (!open) {
      setIsCreatingSupplier(false);
    }
  }, [open]);

  const existingItemMatch = useMemo(() => {
    if (form.item.trim().length < 4) return null;

    const matches = inventoryItems
      .filter((inventoryItem) => inventoryItem.id !== currentItemId && inventoryItem.item?.trim())
      .map((inventoryItem) => ({
        item: inventoryItem,
        score: getNameMatchScore(form.item, inventoryItem.item || ""),
      }))
      .filter(({ score }) => score >= 0.86)
      .sort((left, right) => right.score - left.score);

    return matches[0]?.item || null;
  }, [currentItemId, form.item, inventoryItems]);

  const supplierOptions = useMemo(() => {
    const suppliers = new Map<string, string>();
    inventoryItems.forEach((inventoryItem) => {
      const supplier = inventoryItem.supplier?.trim();
      if (!supplier) return;

      const key = normalizeFinanceValue(supplier);
      if (!suppliers.has(key)) {
        suppliers.set(key, supplier);
      }
    });

    return Array.from(suppliers.values()).sort((left, right) => left.localeCompare(right));
  }, [inventoryItems]);

  const visibleSupplierOptions = useMemo(() => {
    const selectedSupplier = form.supplier.trim();
    if (!selectedSupplier || isCreatingSupplier) return supplierOptions;

    const selectedSupplierKey = normalizeFinanceValue(selectedSupplier);
    const selectedSupplierExists = supplierOptions.some(
      (supplier) => normalizeFinanceValue(supplier) === selectedSupplierKey
    );

    return selectedSupplierExists ? supplierOptions : [selectedSupplier, ...supplierOptions];
  }, [form.supplier, isCreatingSupplier, supplierOptions]);

  const handleSupplierChange = (supplier: string) => {
    if (supplier === CREATE_NEW_SUPPLIER_VALUE) {
      setIsCreatingSupplier(true);
      updateForm({ supplier: "" });
      return;
    }

    setIsCreatingSupplier(false);
    updateForm({ supplier });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Edit Stock Item" : "New Stock Item"}</DialogTitle>
            <DialogDescription>Create or update the item record. Use Add Stock when buying more units.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="inventory-name">Item Name</Label>
            <Tooltip open={Boolean(existingItemMatch)}>
              <TooltipTrigger asChild>
                <Input
                  id="inventory-name"
                  placeholder="e.g., Nitrile gloves"
                  value={form.item}
                  className={existingItemMatch ? "border-amber-400 focus-visible:ring-amber-500" : undefined}
                  onChange={(event) => updateForm({ item: event.target.value })}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={8} className="max-w-[320px]">
                Did you mean {existingItemMatch?.item}? It already exists in your inventory.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-quantity">Quantity</Label>
            <Input id="inventory-quantity" type="number" min="0" value={form.quantity} onChange={(event) => updateForm({ quantity: Number(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-unit">Unit</Label>
            <Select value={form.unit} onValueChange={(unit) => updateForm({ unit })}>
              <SelectTrigger id="inventory-unit">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-cost">Unit Cost (PHP)</Label>
            <Input id="inventory-cost" type="number" min="0" value={form.costPerUnit} onChange={(event) => updateForm({ costPerUnit: Number(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Stock Value</Label>
            <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 font-medium">
              {formatCurrency((Number(form.quantity) || 0) * (Number(form.costPerUnit) || 0))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-supplier">Supplier</Label>
            <Select
              value={isCreatingSupplier ? CREATE_NEW_SUPPLIER_VALUE : form.supplier}
              onValueChange={handleSupplierChange}
            >
              <SelectTrigger id="inventory-supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {visibleSupplierOptions.map((supplier) => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier}
                  </SelectItem>
                ))}
                {visibleSupplierOptions.length > 0 ? <SelectSeparator /> : null}
                <SelectItem value={CREATE_NEW_SUPPLIER_VALUE}>Create new supplier</SelectItem>
              </SelectContent>
            </Select>
            {isCreatingSupplier ? (
              <div className="flex gap-2">
                <Input
                  id="inventory-supplier-new"
                  autoFocus
                  placeholder="Supplier name"
                  value={form.supplier}
                  onChange={(event) => updateForm({ supplier: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  title="Cancel new supplier"
                  onClick={() => {
                    setIsCreatingSupplier(false);
                    updateForm({ supplier: "" });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory-last-ordered">Last Ordered</Label>
            <Input id="inventory-last-ordered" type="date" value={form.lastOrdered} onChange={(event) => updateForm({ lastOrdered: event.target.value })} />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Stock Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
