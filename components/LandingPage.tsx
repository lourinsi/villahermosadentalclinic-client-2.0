"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Stethoscope,
  ArrowRight,
  Heart,
  Clock,
  Shield,
  Calendar,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import BookingModalWrapper from "@/components/BookingModalWrapper";
import { usePublicBookingCache } from "@/components/PublicBookingPanels";

export default function LandingPage() {
  const router = useRouter();
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const { refresh: refreshPublicBookings } = usePublicBookingCache();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header onBookAppointment={() => setIsBookingModalOpen(true)} />

      <section
        id="home"
        className="bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-16 md:px-8 lg:py-20"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
              <Heart className="h-4 w-4 text-red-500" />
              Friendly care for brighter, healthier smiles
            </div>
            <h1 className="mb-6 max-w-3xl text-4xl font-black leading-tight text-gray-950 md:text-6xl">
              Book trusted dental care without the back-and-forth
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-8 text-gray-600">
              Choose a dentist, check real availability, and reserve your visit
              online. New and returning patients can start from here.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => setIsBookingModalOpen(true)}
                size="lg"
                className="h-12 rounded-full bg-primary px-8 text-base font-bold hover:bg-primary/90"
              >
                Book Appointment <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => router.push("/doctors")}
                variant="outline"
                size="lg"
                className="h-12 rounded-full border-blue-200 px-8 text-base font-bold text-blue-700 hover:bg-blue-50"
              >
                <Stethoscope className="mr-2 h-5 w-5" />
                Find a Dentist
              </Button>
              <Button
                onClick={() => router.push("/calendar")}
                variant="ghost"
                size="lg"
                className="h-12 rounded-full px-6 text-base font-semibold text-gray-700 hover:bg-white"
              >
                <Calendar className="mr-2 h-5 w-5" />
                View Calendar
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-gray-500">
              <button
                type="button"
                data-tour-id="landing-login"
                onClick={() => router.push("/login")}
                className="hover:text-primary"
              >
                Patient login
              </button>
              <button
                type="button"
                onClick={() => router.push("/doctor/login")}
                className="hover:text-primary"
              >
                Doctor portal
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/login")}
                className="hover:text-primary"
              >
                Admin portal
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-xl shadow-blue-100/70">
            <div className="rounded-[1.5rem] bg-blue-600 p-6 text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
                Today at Villahermosa
              </p>
              <h2 className="mt-2 text-3xl font-black">Care made simple</h2>
              <p className="mt-3 text-blue-50">
                Public booking keeps your reserved visits available from the
                calendar and cart on this device.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                {
                  icon: Stethoscope,
                  title: "Pick your doctor",
                  text: "Browse the team and open each dentist's schedule.",
                },
                {
                  icon: Clock,
                  title: "Reserve a time",
                  text: "Choose from open appointment slots in the calendar.",
                },
                {
                  icon: Calendar,
                  title: "Review your visits",
                  text: "Return to your calendar or cart from the header.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-950">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-600">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="bg-white px-4 py-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-bold text-gray-900">
            Why Choose Us
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="border border-gray-200 shadow-lg transition-shadow hover:shadow-xl">
              <CardHeader className="text-center">
                <Heart className="mx-auto mb-4 h-12 w-12 text-red-500" />
                <CardTitle>Patient Care</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-600">
                  We prioritize your comfort and health with personalized
                  treatment plans tailored to your specific needs.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-lg transition-shadow hover:shadow-xl">
              <CardHeader className="text-center">
                <Clock className="mx-auto mb-4 h-12 w-12 text-blue-500" />
                <CardTitle>Easy Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-600">
                  Schedule appointments online with our convenient booking
                  system. Flexible hours to fit your lifestyle.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-lg transition-shadow hover:shadow-xl">
              <CardHeader className="text-center">
                <Shield className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <CardTitle>Advanced Technology</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-600">
                  We use state-of-the-art dental equipment and techniques to
                  provide the highest quality care.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="services" className="bg-gray-50 px-4 py-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-bold text-gray-900">
            Our Services
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              "General Dentistry",
              "Cosmetic Dentistry",
              "Orthodontics",
              "Implants",
              "Root Canal Therapy",
              "Teeth Whitening",
              "Periodontal Care",
              "Emergency Care",
            ].map((service, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow transition-shadow hover:shadow-lg"
              >
                <h3 className="mb-2 font-semibold text-gray-900">{service}</h3>
                <p className="text-sm text-gray-600">
                  Professional care for your dental health
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-20 text-white md:px-8"
      >
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-bold">Ready to Smile Again?</h2>
          <p className="mb-8 text-lg opacity-90">
            Schedule your appointment today and experience excellent dental care
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              onClick={() => setIsBookingModalOpen(true)}
              size="lg"
              className="bg-white px-8 py-6 text-lg font-semibold text-blue-600 hover:bg-gray-100"
            >
              <Calendar className="mr-2 h-5 w-5" />
              Book Now
            </Button>
          </div>
        </div>
      </section>

      {isBookingModalOpen && (
        <BookingModalWrapper
          open={isBookingModalOpen}
          onOpenChange={setIsBookingModalOpen}
          title="Book Your Appointment"
          bookingMode="public"
          onBooked={() => refreshPublicBookings()}
        />
      )}

      <Footer />
    </div>
  );
}
