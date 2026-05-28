"use client";

import { apiUrl } from "@/lib/api";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { useRegistrationModal } from "@/hooks/useRegistrationModal";

export function RegistrationModal() {
  const { isRegistrationModalOpen, closeRegistrationModal } =
    useRegistrationModal();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(apiUrl("/api/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Registration successful! You can now log in with your credentials and default password.");
        closeRegistrationModal();
        setFormData({
          name: "",
          email: "",
          phone: "",
        });
      } else {
        toast.error(result.message || "Failed to register");
      }
    } catch (error) {
      console.error("Error registering patient:", error);
      toast.error(
        "Error connecting to server. Make sure the backend is running on port 3001."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isRegistrationModalOpen} onOpenChange={closeRegistrationModal}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register for an Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              variant="cancel"
              type="button"
              onClick={closeRegistrationModal}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant="brand" type="submit" disabled={isLoading}>
              {isLoading ? "Registering..." : "Register"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
