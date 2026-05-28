"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LandingPage from "@/components/LandingPage";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'patient') {
        router.push('/patient/dashboard');
      } else if (user.role === 'doctor') {
        router.push('/doctor/dashboard');
      } else if (user.role === 'admin') {
        router.push('/admin/dashboard');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return <LandingPage />;
}
