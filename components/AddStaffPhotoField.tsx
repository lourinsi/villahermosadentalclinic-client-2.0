"use client";

import { ChangeEvent } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStaffInitials } from "./sharedAddStaffLogic";

interface AddStaffPhotoFieldProps {
  id: string;
  name: string;
  profilePicture: string;
  disabled?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  onFileSelect: (file?: File | null) => void;
  onRemove: () => void;
}

export default function AddStaffPhotoField({
  id,
  name,
  profilePicture,
  disabled = false,
  compact = false,
  readOnly = false,
  onFileSelect,
  onRemove,
}: AddStaffPhotoFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(event.target.files?.[0]);
    event.target.value = "";
  };

  return (
    <div className={compact ? "flex items-center gap-4" : "rounded-lg border bg-gray-50 p-4"}>
      <div className={compact ? "flex items-center gap-4" : "flex items-center gap-4"}>
        <Avatar className={compact ? "h-16 w-16 border bg-white" : "h-20 w-20 border bg-white"}>
          {profilePicture ? (
            <AvatarImage src={profilePicture} alt={name || "Staff photo"} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-blue-100 text-lg font-bold text-blue-700">
            {profilePicture ? <Camera className="h-6 w-6" /> : getStaffInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <Label htmlFor={id} className="text-sm font-semibold text-gray-900">
              Staff Photo
            </Label>
            <p className="text-xs text-muted-foreground">
              {readOnly ? "Staff profile image" : "Upload a square image. It will be optimized before saving."}
            </p>
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Input id={id} type="file" accept="image/*" onChange={handleChange} disabled={disabled} className="sr-only" />
              <Button asChild type="button" variant="outline" size="sm" disabled={disabled}>
                <Label htmlFor={id} className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Label>
              </Button>
              {profilePicture ? (
                <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={disabled}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
