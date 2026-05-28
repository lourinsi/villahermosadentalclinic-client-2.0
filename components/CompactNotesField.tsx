"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CompactNotesFieldProps {
  id?: string;
  label?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
  onChange: (value: string) => void;
}

export function CompactNotesField({
  id,
  label,
  value,
  placeholder = "Add notes...",
  disabled,
  className,
  labelClassName,
  textareaClassName,
  onChange,
}: CompactNotesFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preview = value.trim();

  useEffect(() => {
    if (!isExpanded) return;
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setIsExpanded(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isExpanded]);

  return (
    <div
      ref={rootRef}
      className={cn("space-y-2", className)}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          const activeElement = document.activeElement;
          if (activeElement instanceof Node && rootRef.current?.contains(activeElement)) return;
          setIsExpanded(false);
        });
      }}
    >
      {label && (
        <Label htmlFor={id} className={cn("text-sm font-bold text-gray-700", labelClassName)}>
          {label}
        </Label>
      )}

      {isExpanded ? (
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={cn(
            "min-h-[120px] resize-none rounded-lg border-gray-200 focus:border-blue-500 focus:ring-blue-500",
            textareaClassName,
          )}
        />
      ) : (
        <button
          id={id}
          type="button"
          aria-expanded={isExpanded}
          disabled={disabled}
          onClick={() => setIsExpanded(true)}
          className={cn(
            "flex h-10 w-full items-end border-b border-gray-200 bg-transparent pb-2 text-left text-sm transition-colors hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <span className={cn("block w-full truncate", preview ? "font-semibold text-gray-900" : "font-medium text-gray-400")}>
            {preview || placeholder}
          </span>
        </button>
      )}
    </div>
  );
}
