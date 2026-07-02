import { AppointmentModalProvider } from "@/hooks/useAppointmentModal";
import { PaymentModalProvider } from "@/hooks/usePaymentModal";
import { AuthProvider } from "@/hooks/useAuth";
import { BookingModalModeProvider } from "@/hooks/useBookingModalMode";
import { AdminViewModeProvider } from "@/hooks/useAdminViewMode";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ScheduleAppointmentModal } from "@/components/ScheduleAppointmentModal";
import { AddPatientModal } from "@/components/AddPatientModal";
import { PaymentModal } from "@/components/PaymentModal";
import { EditPaymentModal } from "@/components/EditPaymentModal";
import { PatientPaymentModal } from "@/components/PatientPaymentModal";
import { GlobalBookingModalWrapper } from "@/components/GlobalBookingModalWrapper";
import { UserTour } from "@/components/UserTour";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Villahermosa Dental Clinic",
  description: "Professional dental clinic management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <AdminViewModeProvider>
            <BookingModalModeProvider>
              <AppointmentModalProvider>
                <PaymentModalProvider>
                  {children}
                  <Toaster />
                  <ScheduleAppointmentModal />
                  <AddPatientModal />
                  <GlobalBookingModalWrapper />
                  <PaymentModal />
                  <EditPaymentModal />
                  <PatientPaymentModal />
                  <UserTour />
                </PaymentModalProvider>
              </AppointmentModalProvider>
            </BookingModalModeProvider>
          </AdminViewModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
