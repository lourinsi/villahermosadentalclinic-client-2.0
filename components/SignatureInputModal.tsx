"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Eraser, Image as ImageIcon, Loader2, PenLine, Save, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SIGNATURE_CANVAS_WIDTH = 960;
const SIGNATURE_CANVAS_HEIGHT = 360;

type SignatureInputModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string;
  onSave: (signatureImage: string) => void;
  title?: string;
  description?: string;
  signatureLabel?: string;
  allowUpload?: boolean;
  disabled?: boolean;
};

const clearSignatureCanvas = (canvas: HTMLCanvasElement | null) => {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
};

const hasSignaturePixels = (canvas: HTMLCanvasElement | null) => {
  if (!canvas) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return imageData.some((value, index) => index % 4 === 3 && value > 0);
};

const getCanvasPoint = (canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
};

const drawImageToCanvas = (canvas: HTMLCanvasElement | null, source: string, onComplete?: (success: boolean) => void) => {
  if (!canvas || !source) {
    onComplete?.(false);
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    onComplete?.(false);
    return;
  }

  const image = new Image();
  image.onload = () => {
    clearSignatureCanvas(canvas);

    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;

    context.drawImage(image, x, y, width, height);
    onComplete?.(true);
  };
  image.onerror = () => onComplete?.(false);
  image.src = source;
};

export default function SignatureInputModal({
  open,
  onOpenChange,
  value = "",
  onSave,
  title = "Signature",
  description = "Add a signature for this consent form.",
  signatureLabel = "Signature",
  allowUpload = true,
  disabled = false,
}: SignatureInputModalProps) {
  const uploadInputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState("");

  const syncExistingSignature = useCallback(() => {
    const canvas = canvasRef.current;
    clearSignatureCanvas(canvas);
    setError("");

    if (!value) {
      setHasSignature(false);
      return;
    }

    drawImageToCanvas(canvas, value, (success) => {
      setHasSignature(success);
      if (!success) setError("Could not load the saved signature.");
    });
  }, [value]);

  useEffect(() => {
    if (!open) return;
    syncExistingSignature();
  }, [open, syncExistingSignature]);

  const handleFile = (file?: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setError("Could not read the uploaded file.");
        return;
      }

      drawImageToCanvas(canvasRef.current, result, (success) => {
        setHasSignature(success);
        setError(success ? "" : "Could not load the uploaded image.");
      });
    };
    reader.onerror = () => setError("Could not read the uploaded file.");
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    clearSignatureCanvas(canvasRef.current);
    setHasSignature(false);
    setError("");
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const signatureImage = hasSignaturePixels(canvas) ? canvas?.toDataURL("image/png") || "" : "";
    onSave(signatureImage);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !disabled && onOpenChange(nextOpen)}>
      <DialogContent
        showCloseButton={false}
        className="!fixed !bottom-0 !left-0 !top-auto !flex max-h-[92dvh] w-full max-w-full !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[1.5rem] border-none bg-white p-0 shadow-2xl data-[state=open]:slide-in-from-bottom-8 sm:!bottom-auto sm:!left-[50%] sm:!top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(48rem,calc(100vw-2rem))] sm:max-w-3xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-2xl sm:border"
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3 text-left shadow-sm sm:px-6">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <PenLine className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-slate-950">{title}</DialogTitle>
                <DialogDescription className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  {description}
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              disabled={disabled}
              className="h-10 w-10 shrink-0 rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Close signature dialog"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-5 py-5 sm:px-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-black uppercase tracking-widest text-slate-500">{signatureLabel}</Label>
              <div
                className={`relative rounded-2xl border-2 border-dashed bg-white p-3 shadow-sm transition-colors ${
                  isDragActive ? "border-violet-400 bg-violet-50/40" : "border-slate-200"
                }`}
                onDragOver={(event) => {
                  if (!allowUpload || disabled) return;
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(event) => {
                  if (!allowUpload || disabled) return;
                  event.preventDefault();
                  setIsDragActive(false);
                  handleFile(event.dataTransfer.files?.[0]);
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={SIGNATURE_CANVAS_WIDTH}
                  height={SIGNATURE_CANVAS_HEIGHT}
                  className="h-56 w-full cursor-crosshair rounded-xl border border-slate-200 bg-white sm:h-64"
                  style={{ touchAction: "none" }}
                  onPointerDown={(event) => {
                    if (disabled) return;
                    const canvas = event.currentTarget;
                    const context = canvas.getContext("2d");
                    if (!context) return;

                    canvas.setPointerCapture(event.pointerId);
                    const point = getCanvasPoint(canvas, event);
                    context.lineCap = "round";
                    context.lineJoin = "round";
                    context.lineWidth = 4;
                    context.strokeStyle = "#0f172a";
                    context.beginPath();
                    context.moveTo(point.x, point.y);
                    drawingRef.current = true;
                    setHasSignature(true);
                    setError("");
                  }}
                  onPointerMove={(event) => {
                    if (disabled || !drawingRef.current) return;
                    const canvas = event.currentTarget;
                    const context = canvas.getContext("2d");
                    if (!context) return;

                    const point = getCanvasPoint(canvas, event);
                    context.lineTo(point.x, point.y);
                    context.stroke();
                    setHasSignature(true);
                  }}
                  onPointerUp={(event) => {
                    drawingRef.current = false;
                    try {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    } catch {}
                  }}
                  onPointerCancel={() => {
                    drawingRef.current = false;
                  }}
                />
                {!hasSignature ? (
                  <div className="pointer-events-none absolute inset-x-6 top-1/2 flex -translate-y-1/2 items-center justify-center text-sm font-bold text-slate-300">
                    Sign here
                  </div>
                ) : null}
              </div>
              {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            </div>

            {allowUpload ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={uploadInputId}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={disabled}
                  onChange={(event) => {
                    handleFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-xl font-bold"
                  disabled={disabled}
                  asChild
                >
                  <label htmlFor={uploadInputId} className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Signature
                  </label>
                </Button>
                <div className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-500">
                  <ImageIcon className="mr-2 h-4 w-4 text-slate-400" />
                  Drag and drop image
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="!grid shrink-0 grid-cols-3 gap-2.5 border-t border-slate-100 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={disabled || !hasSignature}
            className="h-11 rounded-full text-sm font-bold"
          >
            <Eraser className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled}
            className="h-11 rounded-full text-sm font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={disabled}
            className="h-11 rounded-full bg-violet-600 text-sm font-black text-white shadow-lg shadow-violet-100 hover:bg-violet-700"
          >
            {disabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
