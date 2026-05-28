"use client";

import { Check, Trash2 } from "lucide-react";
import {
  DropdownMenuItem,
} from "./ui/dropdown-menu";

interface Props {
  showMarkAll?: boolean;
  onMarkAllAsRead?: () => void;
  onDeleteAll?: () => void;
  className?: string;
  renderMode?: "radix" | "inline";
}

export default function NotificationsMenuContent({ showMarkAll = true, onMarkAllAsRead, onDeleteAll, className, renderMode = "radix" }: Props) {
  if (renderMode === "inline") {
    return (
      <div className={`bg-white rounded-md border p-1 shadow-md ${className || ""}`}>
        {showMarkAll && (
          <button onClick={() => onMarkAllAsRead?.()} className="flex items-center gap-2 px-3 py-2 text-gray-800 hover:bg-gray-100 rounded">
            <Check className="h-4 w-4 text-gray-600" />
            <span className="text-sm">Mark all as read</span>
          </button>
        )}
        <button onClick={() => onDeleteAll?.()} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded">
          <Trash2 className="h-4 w-4 text-red-600" />
          <span className="text-sm">Clear all notifications</span>
        </button>
      </div>
    );
  }

  // radix mode - render DropdownMenuItem components for use inside DropdownMenu
  return (
    <>
      {showMarkAll && (
        <DropdownMenuItem onClick={() => onMarkAllAsRead?.()} className="text-gray-800">
          <Check className="h-4 w-4 mr-2 text-gray-600" />
          <span className="text-sm">Mark all as read</span>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => onDeleteAll?.()} className="text-red-600 focus:text-red-600">
        <Trash2 className="h-4 w-4 mr-2 text-red-600" />
        <span className="text-sm">Clear all notifications</span>
      </DropdownMenuItem>
    </>
  );
}
