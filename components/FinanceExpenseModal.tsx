"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletCards, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";
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
  originalInventoryItemId?: string;
  originalInventoryQuantity?: number;
  onCreateInventoryItem?: () => void;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ExpenseForm) => void;
  onSave: () => void;
};

const NO_VENDOR_VALUE = "__no_vendor__";
const CREATE_NEW_VENDOR_VALUE = "__create_new_vendor__";
const CREATE_NEW_INVENTORY_VALUE = "__create_new_inventory__";

const expenseCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const formatExpenseCurrency = (amount?: number) => expenseCurrencyFormatter.format(Number(amount) || 0);

const singularizeUnit = (unit?: string) => {
  const value = String(unit || "unit").trim();
  if (!value) return "unit";
  const normalizedValue = value.toLowerCase();
  const knownUnits: Record<string, string> = {
    boxes: "box",
    pcs: "pc",
    packs: "pack",
    units: "unit",
  };
  if (knownUnits[normalizedValue]) return knownUnits[normalizedValue];
  if (value.toLowerCase().endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (normalizedValue.endsWith("s") && value.length > 3) return value.slice(0, -1);
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
  originalInventoryItemId = "",
  originalInventoryQuantity = 0,
  onCreateInventoryItem,
  onOpenChange,
  onFormChange,
  onSave,
}: FinanceExpenseModalProps) {
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const updateForm = (updates: Partial<ExpenseForm>) => onFormChange({ ...form, ...updates });
  const errorClassName = "border-red-500 bg-red-50 focus:ring-red-500 focus-visible:ring-red-500";
  const isCreateMode = mode === "create";
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
  const enteredPrice = Number(form.price) || 0;
  const impliedUnitCost = linkedQuantity > 0 ? enteredPrice / linkedQuantity : 0;
  const linkedUnitLabel = singularizeUnit(selectedInventoryItem?.unit);
  const stockAmount = (item: ExpenseInventoryItem | undefined, quantity: number) =>
    item ? Math.max(0, quantity) * (Number(item.costPerUnit) || 0) : 0;
  const isSameAmount = (left: number, right: number) => Math.abs((Number(left) || 0) - (Number(right) || 0)) < 0.01;
  const shouldUseStockAmountDefault = () => {
    if (mode !== "create") return false;
    if (Number(form.price) <= 0) return true;
    if (!selectedInventoryItem) return false;
    return isSameAmount(Number(form.price), stockAmount(selectedInventoryItem, linkedQuantity));
  };

  useEffect(() => {
    if (!open) {
      setIsCreatingVendor(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isCreateMode) return;

    const createModeDefaults: Partial<ExpenseForm> = {};
    if (form.vendor) createModeDefaults.vendor = "";
    if (form.inventoryItemId) createModeDefaults.inventoryItemId = "";
    if (Number(form.inventoryQuantity) !== 0) createModeDefaults.inventoryQuantity = 0;

    if (Object.keys(createModeDefaults).length > 0) {
      onFormChange({ ...form, ...createModeDefaults });
    }
  }, [form, isCreateMode, onFormChange, open]);

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
    if (value === CREATE_NEW_INVENTORY_VALUE) {
      onCreateInventoryItem?.();
      return;
    }

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
      ...(shouldDefaultAmount && { price: stockAmount(item, quantity) }),
    });
  };

  const updateInventoryQuantity = (quantity: number) => {
    const shouldDefaultAmount = shouldUseStockAmountDefault();
    updateForm({
      inventoryQuantity: quantity,
      ...(shouldDefaultAmount && { price: stockAmount(selectedInventoryItem, quantity) }),
    });
  };

  const updatePrice = (price: number) => updateForm({ price });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[92vh] sm:w-full sm:max-w-2xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-2xl sm:border sm:border-slate-200"
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 text-left shadow-sm sm:px-6 sm:py-5">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-black tracking-tight text-slate-950">
                    {isCreateMode ? "Add Manual Expense" : "Edit Expense"}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm font-medium leading-5 text-slate-500">
                    {isCreateMode
                      ? "Record the full bill and the amount paid today."
                      : "Update expense details, stock links, vendors, and payment status."}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close expense modal"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expense-category" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Category
                </Label>
                <Select value={form.category} onValueChange={(value) => updateForm({ category: value })}>
                  <SelectTrigger
                    id="expense-category"
                    className={cn("h-11 border-slate-200 bg-white", fieldErrors.category && errorClassName)}
                    aria-invalid={Boolean(fieldErrors.category)}
                  >
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
                <Label htmlFor="expense-date" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Expense Date
                </Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={form.date}
                  className={cn("h-11 border-slate-200 bg-white", fieldErrors.date && errorClassName)}
                  aria-invalid={Boolean(fieldErrors.date)}
                  onChange={(event) => updateForm({ date: event.target.value })}
                />
                {renderFieldError("date")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-payment-date" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Payment Date
                </Label>
                <Input
                  id="expense-payment-date"
                  type="date"
                  value={form.paymentDate}
                  className={cn("h-11 border-slate-200 bg-white", fieldErrors.paymentDate && errorClassName)}
                  aria-invalid={Boolean(fieldErrors.paymentDate)}
                  onChange={(event) => updateForm({ paymentDate: event.target.value })}
                />
                <p className="text-xs text-slate-500">Used when a payment is recorded.</p>
                {renderFieldError("paymentDate")}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="expense-description" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Description
                </Label>
                <Input
                  id="expense-description"
                  placeholder="e.g., Crown prep lab fee"
                  value={form.description}
                  className={cn("h-11 border-slate-200 bg-white", fieldErrors.description && errorClassName)}
                  aria-invalid={Boolean(fieldErrors.description)}
                  onChange={(event) => updateForm({ description: event.target.value })}
                />
                {renderFieldError("description")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-price" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Total Price ({"\u20b1"})
                </Label>
                <Input
                  id="expense-price"
                  type="number"
                  min="0"
                  value={form.price}
                  className={cn("h-11 border-slate-200 bg-white", fieldErrors.price && errorClassName)}
                  aria-invalid={Boolean(fieldErrors.price)}
                  onChange={(event) => updatePrice(Number(event.target.value))}
                />
                <p className="text-xs text-slate-500">Full cost of the item or expense.</p>
                {renderFieldError("price")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-amount" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {isCreateMode ? "Payment Made Now" : "Total Paid to Date"} ({"\u20b1"})
                </Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="0"
                  value={form.amount}
                  className={cn("h-11 border-slate-200 bg-white", fieldErrors.amount && errorClassName)}
                  aria-invalid={Boolean(fieldErrors.amount)}
                  onChange={(event) => updateForm({ amount: Number(event.target.value) })}
                />
                <p className="text-xs text-slate-500">{isCreateMode ? "Leave at zero when no payment is made yet." : "Payments made after creation are added through the Pay action."}</p>
                {renderFieldError("amount")}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-payment-method" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Payment Method
                </Label>
                <Select value={form.paymentMethod} onValueChange={(value) => updateForm({ paymentMethod: value })}>
                  <SelectTrigger
                    id="expense-payment-method"
                    className={cn("h-11 border-slate-200 bg-white", fieldErrors.paymentMethod && errorClassName)}
                    aria-invalid={Boolean(fieldErrors.paymentMethod)}
                  >
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
                {renderFieldError("paymentMethod")}
              </div>

              {!isCreateMode ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="expense-vendor" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Vendor/Supplier
                    </Label>
                    <Select
                      value={isCreatingVendor ? CREATE_NEW_VENDOR_VALUE : form.vendor.trim() || NO_VENDOR_VALUE}
                      onValueChange={handleVendorChange}
                    >
                      <SelectTrigger id="expense-vendor" className="h-11 border-slate-200 bg-white">
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
                          className="h-11 border-slate-200 bg-white"
                          onChange={(event) => updateForm({ vendor: event.target.value })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 flex-shrink-0 rounded-full text-slate-500 hover:bg-slate-100"
                          title="Cancel new vendor"
                          aria-label="Cancel new vendor"
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
                    <Label htmlFor="expense-status" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Payment Status
                    </Label>
                    {!canManageStatus ? (
                      <div
                        id="expense-status"
                        className={cn(
                          "flex h-11 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800",
                          fieldErrors.status && "border-red-500 bg-red-50 text-red-700"
                        )}
                        aria-invalid={Boolean(fieldErrors.status)}
                      >
                        {form.status ? form.status.charAt(0).toUpperCase() + form.status.slice(1) : "Pending"}
                      </div>
                    ) : (
                      <Select value={form.status} onValueChange={(value) => updateForm({ status: value })}>
                        <SelectTrigger
                          id="expense-status"
                          className={cn("h-11 border-slate-200 bg-white", fieldErrors.status && errorClassName)}
                          aria-invalid={Boolean(fieldErrors.status)}
                        >
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

                  <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                    <div>
                      <div className="font-semibold text-slate-950">Link to Inventory</div>
                      <p className="mt-1 text-sm text-slate-500">
                        Saved links preload here. Changing the stock item or quantity adjusts Inventory by the difference.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="expense-stock-item" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Stock Item
                        </Label>
                        <Select value={form.inventoryItemId || "none"} onValueChange={selectInventoryItem}>
                          <SelectTrigger
                            id="expense-stock-item"
                            className={cn("h-11 border-slate-200 bg-white", fieldErrors.inventoryItemId && errorClassName)}
                            aria-invalid={Boolean(fieldErrors.inventoryItemId)}
                          >
                            <SelectValue placeholder="No stock item" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No stock item</SelectItem>
                            {inventoryItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.item}
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                            <SelectItem value={CREATE_NEW_INVENTORY_VALUE}>Create new inventory item</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expense-stock-quantity" className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Linked Quantity
                        </Label>
                        <Input
                          id="expense-stock-quantity"
                          type="number"
                          min="0"
                          disabled={!selectedInventoryItem}
                          value={form.inventoryQuantity}
                          className={cn("h-11 border-slate-200 bg-white", fieldErrors.inventoryQuantity && errorClassName)}
                          aria-invalid={Boolean(fieldErrors.inventoryQuantity)}
                          onChange={(event) => updateInventoryQuantity(Number(event.target.value))}
                        />
                        {renderFieldError("inventoryQuantity")}
                      </div>
                    </div>
                    {selectedInventoryItem ? (
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-slate-500">Current stock</div>
                            <div className="font-semibold text-slate-950">
                              {selectedInventoryItem.quantity} {selectedInventoryItem.unit}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500">After save</div>
                            <div className="font-semibold text-slate-950">
                              {Number(selectedInventoryItem.quantity) + stockQuantityChange} {selectedInventoryItem.unit}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                          <div className="font-semibold text-slate-950">Purchase math</div>
                          <p className="mt-1 text-slate-600">
                            {formatExpenseCurrency(enteredPrice)} total for {linkedQuantity || 0}{" "}
                            {selectedInventoryItem.unit || "units"}
                            {linkedQuantity > 0
                              ? ` means ${formatExpenseCurrency(impliedUnitCost)} per ${linkedUnitLabel}.`
                              : "."}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Inventory only adds the quantity. The bill total and amount paid are recorded separately.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </>
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 !grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.06)] sm:!flex sm:justify-end sm:px-6 sm:pb-4 sm:shadow-none">
            <Button variant="outline" className="h-11 w-full rounded-xl font-semibold sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="h-11 w-full rounded-xl bg-violet-600 font-bold text-white shadow-sm shadow-violet-100 hover:bg-violet-700 sm:w-auto"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : isCreateMode ? "Add Expense" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
