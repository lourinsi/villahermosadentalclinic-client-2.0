"use client";

import { useEffect, useMemo, useState } from "react";
import { History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";
import { FinanceHistoryDialog, type FinanceHistoryLog } from "./FinanceHistoryDialog";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  normalizeFinanceValue,
  type ExpenseForm,
} from "./financeModalOptions";

export type FinanceExpenseModalMode = "create" | "edit";

type ExpenseInventoryItem = {
  id: string;
  item: string;
  quantity: number;
  unit?: string;
  costPerUnit?: number;
  supplier?: string;
};

type FinanceExpenseModalProps = {
  open: boolean;
  mode: FinanceExpenseModalMode;
  form: ExpenseForm;
  isSaving: boolean;
  inventoryItems: ExpenseInventoryItem[];
  vendorOptions: string[];
  canManageStatus?: boolean;
  fieldErrors?: Partial<Record<keyof ExpenseForm, string>>;
  historyLogs?: FinanceHistoryLog[];
  isHistoryLoading?: boolean;
  originalInventoryItemId?: string;
  originalInventoryQuantity?: number;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ExpenseForm) => void;
  onSave: () => void;
};

const NO_VENDOR_VALUE = "__no_vendor__";
const CREATE_NEW_VENDOR_VALUE = "__create_new_vendor__";

const expenseCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatExpenseCurrency = (amount?: number) => expenseCurrencyFormatter.format(Number(amount) || 0);

const singularizeUnit = (unit?: string) => {
  const value = String(unit || "unit").trim();
  if (!value) return "unit";
  if (value.toLowerCase().endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.toLowerCase().endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
};

export function FinanceExpenseModal({
  open,
  mode,
  form,
  isSaving,
  inventoryItems,
  vendorOptions,
  canManageStatus = true,
  fieldErrors = {},
  historyLogs = [],
  isHistoryLoading = false,
  originalInventoryItemId = "",
  originalInventoryQuantity = 0,
  onOpenChange,
  onFormChange,
  onSave,
}: FinanceExpenseModalProps) {
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const updateForm = (updates: Partial<ExpenseForm>) => onFormChange({ ...form, ...updates });
  const errorClassName = "border-red-500 bg-red-50 focus:ring-red-500 focus-visible:ring-red-500";
  const renderFieldError = (field: keyof ExpenseForm) =>
    fieldErrors[field] ? <p className="text-xs font-medium text-red-600">{fieldErrors[field]}</p> : null;
  const selectedInventoryItem = inventoryItems.find((item) => item.id === form.inventoryItemId);
  const linkedQuantity = Number(form.inventoryQuantity) || 0;
  const savedInventoryItemId = String(originalInventoryItemId || "").trim();
  const savedInventoryQuantity = Number(originalInventoryQuantity) || 0;
  const stockQuantityChange = selectedInventoryItem
    ? mode === "edit" && selectedInventoryItem.id === savedInventoryItemId
      ? linkedQuantity - savedInventoryQuantity
      : linkedQuantity
    : 0;
  const enteredAmount = Number(form.amount) || 0;
  const impliedUnitCost = linkedQuantity > 0 ? enteredAmount / linkedQuantity : 0;
  const linkedUnitLabel = singularizeUnit(selectedInventoryItem?.unit);
  const stockAmount = (item: ExpenseInventoryItem | undefined, quantity: number) =>
    item ? Math.max(0, quantity) * (Number(item.costPerUnit) || 0) : 0;
  const isSameAmount = (left: number, right: number) => Math.abs((Number(left) || 0) - (Number(right) || 0)) < 0.01;
  const shouldUseStockAmountDefault = () => {
    if (mode !== "create") return false;
    if (Number(form.amount) <= 0) return true;
    if (!selectedInventoryItem) return false;
    return isSameAmount(Number(form.amount), stockAmount(selectedInventoryItem, linkedQuantity));
  };

  useEffect(() => {
    if (!open) {
      setIsCreatingVendor(false);
      setIsHistoryDialogOpen(false);
    }
  }, [open]);

  const allVendorOptions = useMemo(() => {
    const vendors = new Map<string, string>();
    [...vendorOptions, ...inventoryItems.map((item) => item.supplier || "")]
      .map((vendor) => vendor.trim())
      .filter(Boolean)
      .forEach((vendor) => {
        const key = normalizeFinanceValue(vendor);
        if (!vendors.has(key)) {
          vendors.set(key, vendor);
        }
      });

    return Array.from(vendors.values()).sort((left, right) => left.localeCompare(right));
  }, [inventoryItems, vendorOptions]);

  const visibleVendorOptions = useMemo(() => {
    const selectedVendor = form.vendor.trim();
    if (!selectedVendor || isCreatingVendor) return allVendorOptions;

    const selectedVendorKey = normalizeFinanceValue(selectedVendor);
    const selectedVendorExists = allVendorOptions.some(
      (vendor) => normalizeFinanceValue(vendor) === selectedVendorKey
    );

    return selectedVendorExists ? allVendorOptions : [selectedVendor, ...allVendorOptions];
  }, [allVendorOptions, form.vendor, isCreatingVendor]);

  const handleVendorChange = (vendor: string) => {
    if (vendor === CREATE_NEW_VENDOR_VALUE) {
      setIsCreatingVendor(true);
      updateForm({ vendor: "" });
      return;
    }

    setIsCreatingVendor(false);
    updateForm({ vendor: vendor === NO_VENDOR_VALUE ? "" : vendor });
  };

  const selectInventoryItem = (value: string) => {
    if (value === "none") {
      updateForm({ inventoryItemId: "", inventoryQuantity: 0 });
      return;
    }

    const item = inventoryItems.find((inventoryItem) => inventoryItem.id === value);
    if (!item) return;

    const quantity = Number(form.inventoryQuantity) > 0 ? Number(form.inventoryQuantity) : 1;
    const shouldDefaultAmount = shouldUseStockAmountDefault();
    updateForm({
      inventoryItemId: item.id,
      inventoryQuantity: quantity,
      category: form.category || "supplies",
      description: form.description || `Stock purchase: ${item.item}`,
      vendor: form.vendor || item.supplier || "",
      ...(shouldDefaultAmount && { amount: stockAmount(item, quantity) }),
    });
  };

  const updateInventoryQuantity = (quantity: number) => {
    const shouldDefaultAmount = shouldUseStockAmountDefault();
    updateForm({
      inventoryQuantity: quantity,
      ...(shouldDefaultAmount && { amount: stockAmount(selectedInventoryItem, quantity) }),
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
          <div className="border-b bg-gray-50 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <DialogHeader>
                <DialogTitle>{mode === "edit" ? "Edit Expense" : "Add Manual Expense"}</DialogTitle>
                <DialogDescription>
                  Record the bill here. Link stock only when this expense should also increase Inventory.
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setIsHistoryDialogOpen(true)}
                title="View expense history"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          </div>

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select value={form.category} onValueChange={(value) => updateForm({ category: value })}>
              <SelectTrigger id="expense-category" className={fieldErrors.category ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.category)}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {renderFieldError("category")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              value={form.date}
              className={fieldErrors.date ? errorClassName : undefined}
              aria-invalid={Boolean(fieldErrors.date)}
              onChange={(event) => updateForm({ date: event.target.value })}
            />
            {renderFieldError("date")}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="e.g., Crown prep lab fee"
              value={form.description}
              className={fieldErrors.description ? errorClassName : undefined}
              aria-invalid={Boolean(fieldErrors.description)}
              onChange={(event) => updateForm({ description: event.target.value })}
            />
            {renderFieldError("description")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (PHP)</Label>
            <Input
              id="expense-amount"
              type="number"
              min="0"
              value={form.amount}
              className={fieldErrors.amount ? errorClassName : undefined}
              aria-invalid={Boolean(fieldErrors.amount)}
              onChange={(event) => updateForm({ amount: Number(event.target.value) })}
            />
            {renderFieldError("amount")}
            {mode === "create" && selectedInventoryItem ? (
              <p className="text-xs text-muted-foreground">
                This is the total receipt amount for all units, not the per-unit price.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-vendor">Vendor/Supplier</Label>
            <Select
              value={isCreatingVendor ? CREATE_NEW_VENDOR_VALUE : form.vendor.trim() || NO_VENDOR_VALUE}
              onValueChange={handleVendorChange}
            >
              <SelectTrigger id="expense-vendor">
                <SelectValue placeholder="Select vendor/supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VENDOR_VALUE}>No vendor/supplier</SelectItem>
                {visibleVendorOptions.length > 0 ? <SelectSeparator /> : null}
                {visibleVendorOptions.map((vendor) => (
                  <SelectItem key={vendor} value={vendor}>
                    {vendor}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={CREATE_NEW_VENDOR_VALUE}>Create new vendor/supplier</SelectItem>
              </SelectContent>
            </Select>
            {isCreatingVendor ? (
              <div className="flex gap-2">
                <Input
                  id="expense-vendor-new"
                  autoFocus
                  placeholder="Vendor or supplier name"
                  value={form.vendor}
                  onChange={(event) => updateForm({ vendor: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 flex-shrink-0"
                  title="Cancel new vendor"
                  onClick={() => {
                    setIsCreatingVendor(false);
                    updateForm({ vendor: "" });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-payment-method">{mode === "edit" ? "Payment Method" : "Planned Payment Method"}</Label>
            <Select value={form.paymentMethod} onValueChange={(value) => updateForm({ paymentMethod: value })}>
              <SelectTrigger id="expense-payment-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-status">Payment Status</Label>
            {!canManageStatus ? (
              <div
                id="expense-status"
                className={cn(
                  "flex h-10 items-center rounded-md border bg-yellow-50 px-3 text-sm font-medium text-yellow-800",
                  fieldErrors.status && "border-red-500 bg-red-50 text-red-700"
                )}
                aria-invalid={Boolean(fieldErrors.status)}
              >
                {form.status ? form.status.charAt(0).toUpperCase() + form.status.slice(1) : "Pending"}
              </div>
            ) : (
              <Select value={form.status} onValueChange={(value) => updateForm({ status: value })}>
                <SelectTrigger id="expense-status" className={fieldErrors.status ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.status)}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {renderFieldError("status")}
          </div>
          <div className="space-y-4 rounded-md border bg-gray-50 p-4 sm:col-span-2">
            <div>
              <div className="font-medium text-gray-900">Link to Inventory</div>
              <p className="text-sm text-muted-foreground">
                {mode === "edit"
                  ? "Saved links preload here. Changing the stock item or quantity adjusts Inventory by the difference."
                  : "Optional. Choose a stock item only when saving this expense should add quantity to Inventory now."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expense-stock-item">Stock Item</Label>
                <Select value={form.inventoryItemId || "none"} onValueChange={selectInventoryItem}>
                  <SelectTrigger id="expense-stock-item" className={fieldErrors.inventoryItemId ? errorClassName : undefined} aria-invalid={Boolean(fieldErrors.inventoryItemId)}>
                    <SelectValue placeholder="No stock item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No stock item</SelectItem>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense-stock-quantity">{mode === "edit" ? "Linked Quantity" : "Quantity to Add Now"}</Label>
                <Input
                  id="expense-stock-quantity"
                  type="number"
                  min="0"
                  disabled={!selectedInventoryItem}
                  value={form.inventoryQuantity}
                  className={fieldErrors.inventoryQuantity ? errorClassName : undefined}
                  aria-invalid={Boolean(fieldErrors.inventoryQuantity)}
                  onChange={(event) => updateInventoryQuantity(Number(event.target.value))}
                />
                {renderFieldError("inventoryQuantity")}
              </div>
            </div>
            {selectedInventoryItem ? (
              <div className="space-y-3 rounded-md bg-white p-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Current stock</div>
                    <div className="font-medium">
                      {selectedInventoryItem.quantity} {selectedInventoryItem.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">After save</div>
                    <div className="font-medium">
                      {Number(selectedInventoryItem.quantity) + stockQuantityChange} {selectedInventoryItem.unit}
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-violet-100 bg-violet-50 px-3 py-2">
                  <div className="font-medium text-gray-900">Purchase math</div>
                  <p className="mt-1 text-muted-foreground">
                    {formatExpenseCurrency(enteredAmount)} total for {linkedQuantity || 0} {selectedInventoryItem.unit || "units"}
                    {linkedQuantity > 0
                      ? ` means ${formatExpenseCurrency(impliedUnitCost)} per ${linkedUnitLabel}.`
                      : "."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inventory only adds the quantity. Expenses records the actual total you paid.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Manual Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <FinanceHistoryDialog
        open={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        entityType="expense"
        title="Expense History"
        description={`Recent expense changes${form.description ? ` for ${form.description}` : ""}`}
        logs={historyLogs}
        isLoading={isHistoryLoading}
      />
    </>
  );
}
