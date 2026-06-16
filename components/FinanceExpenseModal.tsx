"use client";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
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
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ExpenseForm) => void;
  onSave: () => void;
};

export function FinanceExpenseModal({
  open,
  mode,
  form,
  isSaving,
  inventoryItems,
  formatCurrency,
  onOpenChange,
  onFormChange,
  onSave,
}: FinanceExpenseModalProps) {
  const updateForm = (updates: Partial<ExpenseForm>) => onFormChange({ ...form, ...updates });
  const selectedInventoryItem = inventoryItems.find((item) => item.id === form.inventoryItemId);
  const linkedQuantity = Number(form.inventoryQuantity) || 0;
  const linkedStockValue = selectedInventoryItem ? linkedQuantity * (Number(selectedInventoryItem.costPerUnit) || 0) : 0;

  const selectInventoryItem = (value: string) => {
    if (value === "none") {
      updateForm({ inventoryItemId: "", inventoryQuantity: 0 });
      return;
    }

    const item = inventoryItems.find((inventoryItem) => inventoryItem.id === value);
    if (!item) return;

    const quantity = Number(form.inventoryQuantity) > 0 ? Number(form.inventoryQuantity) : 1;
    const estimatedAmount = quantity * (Number(item.costPerUnit) || 0);
    updateForm({
      inventoryItemId: item.id,
      inventoryQuantity: quantity,
      category: form.category || "supplies",
      description: form.description || `Stock purchase: ${item.item}`,
      vendor: form.vendor || item.supplier || "",
      amount: Number(form.amount) > 0 ? form.amount : estimatedAmount,
    });
  };

  const updateInventoryQuantity = (quantity: number) => {
    updateForm({
      inventoryQuantity: quantity,
      amount: selectedInventoryItem && quantity > 0
        ? quantity * (Number(selectedInventoryItem.costPerUnit) || 0)
        : form.amount,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Edit Expense" : "Add Manual Expense"}</DialogTitle>
            <DialogDescription>
              Record the bill here. Link stock only when this expense should also increase Inventory.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-category">Category</Label>
            <Select value={form.category} onValueChange={(value) => updateForm({ category: value })}>
              <SelectTrigger id="expense-category">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={form.date} onChange={(event) => updateForm({ date: event.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="e.g., Crown prep lab fee"
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount (PHP)</Label>
            <Input id="expense-amount" type="number" min="0" value={form.amount} onChange={(event) => updateForm({ amount: Number(event.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-vendor">Vendor/Supplier</Label>
            <Input
              id="expense-vendor"
              placeholder="e.g., Ormoc Dental Lab"
              value={form.vendor}
              onChange={(event) => updateForm({ vendor: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-payment-method">Paid With</Label>
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
            <Select value={form.status} onValueChange={(value) => updateForm({ status: value })}>
              <SelectTrigger id="expense-status">
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
          </div>
          <div className="flex items-center gap-3 rounded-md border bg-gray-50 p-3 sm:col-span-2">
            <Checkbox
              id="expense-recurring"
              checked={form.recurring}
              onCheckedChange={(checked) => updateForm({ recurring: checked === true })}
            />
            <Label htmlFor="expense-recurring" className="cursor-pointer">
              This is a recurring monthly expense
            </Label>
          </div>
          {mode === "create" ? (
            <div className="space-y-4 rounded-md border bg-gray-50 p-4 sm:col-span-2">
              <div>
                <div className="font-medium text-gray-900">Link to Inventory</div>
                <p className="text-sm text-muted-foreground">
                  Optional. Use this when the bill is for stock you want to add to Inventory.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-stock-item">Stock Item</Label>
                  <Select value={form.inventoryItemId || "none"} onValueChange={selectInventoryItem}>
                    <SelectTrigger id="expense-stock-item">
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
                  <Label htmlFor="expense-stock-quantity">Quantity Added</Label>
                  <Input
                    id="expense-stock-quantity"
                    type="number"
                    min="0"
                    disabled={!selectedInventoryItem}
                    value={form.inventoryQuantity}
                    onChange={(event) => updateInventoryQuantity(Number(event.target.value))}
                  />
                </div>
              </div>
              {selectedInventoryItem ? (
                <div className="grid gap-3 rounded-md bg-white p-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">Current stock</div>
                    <div className="font-medium">
                      {selectedInventoryItem.quantity} {selectedInventoryItem.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">After save</div>
                    <div className="font-medium">
                      {Number(selectedInventoryItem.quantity) + linkedQuantity} {selectedInventoryItem.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Stock value added</div>
                    <div className="font-medium">{formatCurrency(linkedStockValue)}</div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
  );
}
