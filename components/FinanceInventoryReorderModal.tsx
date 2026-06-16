"use client";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ReorderForm } from "./financeModalOptions";

type ReorderInventoryItem = {
  id: string;
  item: string;
  quantity: number;
  unit?: string;
  costPerUnit?: number;
  totalValue?: number;
  supplier?: string;
  lastOrdered?: string;
};

type FinanceInventoryReorderModalProps = {
  item: ReorderInventoryItem | null;
  form: ReorderForm;
  isSaving: boolean;
  formatCurrency: (amount?: number) => string;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: ReorderForm) => void;
  onSave: () => void;
};

export function FinanceInventoryReorderModal({
  item,
  form,
  isSaving,
  formatCurrency,
  onOpenChange,
  onFormChange,
  onSave,
}: FinanceInventoryReorderModalProps) {
  const quantityToAdd = Number(form.quantityToAdd) || 0;
  const currentQuantity = Number(item?.quantity) || 0;
  const unitCost = Number(item?.costPerUnit) || 0;
  const newStockLevel = currentQuantity + quantityToAdd;
  const newStockValue = newStockLevel * unitCost;

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-md">
        <div className="border-b bg-gray-50 px-6 py-5">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>Only the quantity changes here. Bills are recorded separately in Expenses.</DialogDescription>
          </DialogHeader>
        </div>

        {item ? (
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-md border bg-white p-4">
              <div className="font-medium text-gray-900">{item.item}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Current stock: {currentQuantity} {item.unit}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock-quantity">Stock Change</Label>
              <Input
                id="stock-quantity"
                type="number"
                value={form.quantityToAdd}
                onChange={(event) => onFormChange({ quantityToAdd: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">Use positive numbers to add stock, negative numbers to reduce stock.</p>
            </div>

            <div className="grid gap-3 rounded-md bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Unit cost</div>
                <div className="font-medium">{formatCurrency(unitCost)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Supplier</div>
                <div className="font-medium">{item.supplier || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last ordered</div>
                <div className="font-medium">{item.lastOrdered || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Stock value after save</div>
                <div className="font-medium">{formatCurrency(newStockValue)}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Expense impact</div>
                <div className="font-medium">None. Record the bill in Expenses if needed.</div>
              </div>
            </div>

            <div className="rounded-md bg-violet-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Stock after save</span>
                <span className="font-bold">
                  {newStockLevel} {item.unit}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Stock Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
