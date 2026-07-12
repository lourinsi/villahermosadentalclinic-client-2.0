"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, CircleDollarSign, ClipboardList, CreditCard, WalletCards, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  normalizeFinanceValue,
  PAYMENT_METHOD_OPTIONS,
  type ExpenseForm,
} from "./financeModalOptions";

export type FinanceExpenseModalMode = "create" | "edit";

export type InitialExpensePayment = {
  amount: number;
  paymentDate: string;
  method: string;
  transactionId: string;
  notes: string;
};

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
  totalPaid?: number;
  balance?: number;
  initialPayment?: InitialExpensePayment;
  onCreateInventoryItem?: () => void;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ExpenseForm) => void;
  onInitialPaymentChange?: (payment: InitialExpensePayment) => void;
  onSave: () => void;
  onSaveAndAddPayment?: () => void;
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
  totalPaid: savedTotalPaid = 0,
  balance: savedBalance,
  initialPayment = { amount: 0, paymentDate: "", method: "cash", transactionId: "", notes: "" },
  onCreateInventoryItem,
  onOpenChange,
  onFormChange,
  onInitialPaymentChange,
  onSave,
  onSaveAndAddPayment,
}: FinanceExpenseModalProps) {
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(mode === "edit");
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
      setShowOptionalDetails(mode === "edit");
    }
  }, [open, mode]);

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
  const totalPrice = Math.max(0, Number(form.price) || 0);
  const totalPaid = isCreateMode ? 0 : Math.max(0, Number(savedTotalPaid) || 0);
  const balance = isCreateMode ? totalPrice : Number(savedBalance ?? (totalPrice - totalPaid)) || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="!fixed !bottom-0 !left-0 !top-auto !flex h-auto max-h-[88dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.75rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(58rem,calc(100vw-2rem))] sm:max-w-4xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.75rem] sm:border sm:border-slate-200"
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 text-left shadow-sm sm:px-7 sm:py-5">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-black tracking-tight text-slate-950">
                    {isCreateMode ? "Add New Expense" : "Edit Expense"}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm font-medium leading-5 text-slate-500">
                    {isCreateMode
                      ? "Record the bill and purchase details. You can add an optional first payment below."
                      : "Update the bill details. Existing payments are managed from the expense ledger."}
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

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 custom-scrollbar sm:px-7 sm:py-7">
            <div className="mx-auto max-w-3xl space-y-6">
              {!isCreateMode ? <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{isCreateMode ? "New expense" : "Editing this expense"}</p>
                      <p className="truncate text-xl font-black tracking-tight text-slate-950">{form.description || "Expense description"}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-500">{form.vendor || "No vendor recorded"}{form.category ? ` · ${form.category}` : ""}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 text-left sm:min-w-44">
                    <p className="flex items-center gap-1.5 text-xs font-black text-blue-600"><CalendarDays className="h-3.5 w-3.5" /> Expense date</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{form.date || "Select a date"}</p>
                  </div>
                </div>
              </section> : null}

              {!isCreateMode ? <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-xl font-black tracking-tight text-slate-950">Bill Summary</h3>
                <dl className="mt-4 divide-y divide-slate-100">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="flex items-center gap-3 text-sm font-bold text-slate-500"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><ClipboardList className="h-5 w-5" /></span>Total Price</dt>
                    <dd className="text-xl font-black text-slate-950">{formatExpenseCurrency(totalPrice)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="flex items-center gap-3 text-sm font-bold text-slate-500"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><CreditCard className="h-5 w-5" /></span>Total Paid</dt>
                    <dd className="text-xl font-black text-emerald-600">{formatExpenseCurrency(totalPaid)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-3">
                    <dt className="flex items-center gap-3 text-sm font-bold text-slate-500"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CircleDollarSign className="h-5 w-5" /></span>Current Balance Due</dt>
                    <dd className={`text-xl font-black ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatExpenseCurrency(balance)}</dd>
                  </div>
                </dl>
              </section> : null}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5"><h3 className="text-xl font-black tracking-tight text-slate-950">Expense Details</h3><p className="mt-1 text-sm font-medium text-slate-500">Enter the bill details. Payments have their own dated ledger records.</p></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
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
                  className={cn("h-14 rounded-2xl border-slate-200 bg-white px-4 text-base font-bold shadow-sm focus-visible:ring-blue-500", fieldErrors.date && errorClassName)}
                  aria-invalid={Boolean(fieldErrors.date)}
                  onChange={(event) => updateForm({ date: event.target.value })}
                />
                {renderFieldError("date")}
              </div>

              <div className="space-y-2">
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
                <div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-700">{"\u20b1"}</span><Input id="expense-price" type="number" min="0" value={form.price} className={cn("h-16 rounded-2xl border-slate-200 bg-white pl-9 text-2xl font-black shadow-sm focus-visible:ring-blue-500", fieldErrors.price && errorClassName)} aria-invalid={Boolean(fieldErrors.price)} onChange={(event) => updatePrice(Number(event.target.value))} /></div>
                <p className="text-xs text-slate-500">Full cost of the item or expense.</p>
                {renderFieldError("price")}
              </div>

              {!isCreateMode || showOptionalDetails ? <>
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

                  {!isCreateMode ? <div className="space-y-2">
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
                  </div> : null}

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
                </> : <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails(true)}
                    className="flex w-full items-center justify-between rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span><span className="block text-sm font-black text-blue-800">Add vendor or inventory details</span><span className="mt-0.5 block text-xs font-semibold text-blue-700/70">Optional now — you can also configure these later when editing.</span></span>
                    <ChevronDown className="h-5 w-5 text-blue-600" />
                  </button>
                </div>}
            </div>
              </section>
              {isCreateMode ? <section className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/35 p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black tracking-tight text-slate-950">Initial Payment <span className="text-sm font-bold text-slate-400">(optional)</span></h3><p className="mt-1 text-sm font-medium text-slate-500">Create the bill and its first dated payment together. Leave the amount at zero to add payments later.</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-100">Payment ledger</span></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="expense-initial-payment" className="text-xs font-bold uppercase tracking-wide text-slate-500">Amount Paid Now (₱)</Label><Input id="expense-initial-payment" type="number" min="0" value={initialPayment.amount || ""} placeholder="0" className="h-12 rounded-xl border-emerald-100 bg-white text-lg font-black" onChange={(event) => onInitialPaymentChange?.({ ...initialPayment, amount: Math.max(0, Number(event.target.value) || 0) })} /></div><div className="space-y-2"><Label htmlFor="expense-initial-payment-date" className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment Date</Label><Input id="expense-initial-payment-date" type="date" value={initialPayment.paymentDate} className="h-12 rounded-xl border-emerald-100 bg-white font-bold" disabled={initialPayment.amount <= 0} onChange={(event) => onInitialPaymentChange?.({ ...initialPayment, paymentDate: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="expense-initial-payment-method" className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment Method</Label><Select value={initialPayment.method} disabled={initialPayment.amount <= 0} onValueChange={(method) => onInitialPaymentChange?.({ ...initialPayment, method })}><SelectTrigger id="expense-initial-payment-method" className="h-12 rounded-xl border-emerald-100 bg-white"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHOD_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="expense-initial-payment-reference" className="text-xs font-bold uppercase tracking-wide text-slate-500">Reference ID <span className="normal-case">(optional)</span></Label><Input id="expense-initial-payment-reference" value={initialPayment.transactionId} disabled={initialPayment.amount <= 0} placeholder="Receipt or transfer ID" className="h-12 rounded-xl border-emerald-100 bg-white" onChange={(event) => onInitialPaymentChange?.({ ...initialPayment, transactionId: event.target.value })} /></div></div>
                <div className="mt-4 space-y-2"><Label htmlFor="expense-initial-payment-notes" className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment Notes <span className="normal-case">(optional)</span></Label><Textarea id="expense-initial-payment-notes" value={initialPayment.notes} disabled={initialPayment.amount <= 0} placeholder="Optional payment details" className="min-h-20 rounded-xl border-emerald-100 bg-white" onChange={(event) => onInitialPaymentChange?.({ ...initialPayment, notes: event.target.value })} /></div>
              </section> : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 !flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:!flex-row sm:justify-end sm:px-7 sm:pb-5">
            <Button variant="outline" className="h-12 w-full rounded-full font-bold sm:w-auto sm:min-w-36" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {isCreateMode && onSaveAndAddPayment ? (
              <Button
                variant="outline"
                className="h-12 w-full rounded-full border-blue-200 font-black text-blue-700 hover:bg-blue-50 sm:w-auto sm:min-w-48"
                onClick={onSaveAndAddPayment}
                disabled={isSaving}
              >
                Save &amp; Add Payment
              </Button>
            ) : null}
            <Button
              className="h-12 w-full rounded-full bg-blue-600 font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700 sm:w-auto sm:min-w-48"
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
