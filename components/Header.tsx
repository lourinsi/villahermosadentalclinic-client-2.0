"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Phone,
  ShoppingCart,
  Smartphone,
  Star,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBookingModalMode } from "@/hooks/useBookingModalMode";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  PUBLIC_BOOKING_CACHE_EVENT,
  getCachedPublicBookingAppointments,
} from "@/lib/publicBookingCache";
import { isCartAppointmentStatus } from "@/lib/appointment-status";

interface HeaderProps {
  onBookAppointment?: () => void;
}

export function Header({
  onBookAppointment,
}: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const { mode, toggleMode } = useBookingModalMode();
  const router = useRouter();
  const [publicCartCount, setPublicCartCount] = useState(0);

  useEffect(() => {
    const refreshPublicCartCount = () => {
      setPublicCartCount(
        getCachedPublicBookingAppointments().filter(
          (appointment) => isCartAppointmentStatus(appointment.status)
        ).length
      );
    };

    refreshPublicCartCount();
    window.addEventListener(PUBLIC_BOOKING_CACHE_EVENT, refreshPublicCartCount);
    window.addEventListener("storage", refreshPublicCartCount);

    return () => {
      window.removeEventListener(PUBLIC_BOOKING_CACHE_EVENT, refreshPublicCartCount);
      window.removeEventListener("storage", refreshPublicCartCount);
    };
  }, []);

  const handleDashboard = () => {
    if (user?.role === "admin") router.push("/admin/dashboard");
    else if (user?.role === "doctor") router.push("/doctor/dashboard");
    else router.push("/patient/dashboard");
  };

  const handleBookAppointment = () => {
    if (onBookAppointment) {
      onBookAppointment();
      return;
    }

    router.push("/doctors");
  };

  const navLinks = [
    { href: "/#home", label: "Home" },
    { href: "/#services", label: "Services" },
    { href: "/doctors", label: "Doctors" },
    { href: "/#about", label: "About" },
    { href: "/#contact", label: "Contact" },
  ];

  const VisitsMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="relative h-11 rounded-full border-gray-200 px-4 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
        >
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            My Visits
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
          {publicCartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
              {publicCartCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => router.push("/calendar")}>
          <CalendarDays className="mr-2 h-4 w-4 text-blue-600" />
          Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/cart")}>
          <ShoppingCart className="mr-2 h-4 w-4 text-orange-600" />
          Cart
          {publicCartCount > 0 && (
            <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
              {publicCartCount}
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const BookingModeToggle = ({ className = "" }: { className?: string }) => {
    const isSimpleMode = mode === "simple";
    const Icon = isSimpleMode ? Smartphone : Star;

    return (
      <Button
        type="button"
        onClick={toggleMode}
        variant="outline"
        size="sm"
        className={`h-11 rounded-full border-gray-200 px-4 text-xs font-bold text-gray-700 hover:bg-purple-50 hover:text-primary ${className}`}
        title={`Switch to ${isSimpleMode ? "Pro" : "Simple"} mode`}
      >
        <Icon className="mr-2 h-4 w-4" />
        {isSimpleMode ? "Simple" : "Pro"}
      </Button>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-5">
          <Link href="/" prefetch={false} className="flex min-w-fit items-center">
            <h1 className="text-2xl font-black tracking-tight text-primary lg:text-[1.65rem]">
              Villahermosa Dental
            </h1>
          </Link>
          
          <nav className="hidden items-center gap-6 xl:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className="text-sm font-semibold text-gray-900 transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 2xl:flex">
              <Phone className="h-4 w-4 text-primary" />
              <span>(555) 123-4567</span>
            </div>

            <BookingModeToggle className="hidden xl:inline-flex" />

            {isAuthenticated ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Button 
                  onClick={handleBookAppointment}
                  className="h-11 rounded-full bg-primary px-5 font-bold hover:bg-primary/90"
                >
                  Book Appointment
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full bg-gray-100">
                      <User className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{user?.username}</span>
                        <span className="text-xs font-normal text-gray-500 capitalize">{user?.role}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDashboard}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <VisitsMenu />
                <Button 
                  onClick={handleBookAppointment}
                  className="h-11 rounded-full bg-primary px-6 font-bold shadow-sm hover:bg-primary/90"
                >
                  Book Appointment
                </Button>
                <Button 
                  variant="outline" 
                  data-tour-id="landing-login"
                  onClick={() => router.push("/login")}
                  className="h-11 rounded-full border-primary px-5 font-semibold text-primary hover:bg-primary/5"
                >
                  Login
                </Button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full xl:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-2">
                {navLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href} prefetch={false}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1">
                  <BookingModeToggle className="w-full justify-center" />
                </div>
                <DropdownMenuSeparator />
                {isAuthenticated ? (
                  <>
                    <DropdownMenuItem onClick={handleBookAppointment}>
                      <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                      Book Appointment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDashboard}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => logout()} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => router.push("/calendar")}>
                      <CalendarDays className="mr-2 h-4 w-4 text-blue-600" />
                      Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/cart")}>
                      <ShoppingCart className="mr-2 h-4 w-4 text-orange-600" />
                      Cart
                      {publicCartCount > 0 && (
                        <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                          {publicCartCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBookAppointment}>
                      <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                      Book Appointment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/login")}>
                      <User className="mr-2 h-4 w-4" />
                      Login
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
