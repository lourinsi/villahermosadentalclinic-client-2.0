"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  AlertTriangle,
  ChevronLeft,
  HelpCircle,
  LogIn,
  Loader2,
  MousePointerClick,
  PlayCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppointmentModal } from "@/hooks/useAppointmentModal";

type TourAction =
  | { type: "route"; href: string }
  | { type: "openBookingDemo"; delay?: number }
  | { type: "bookingNext"; delay?: number }
  | { type: "clickTarget"; delay?: number }
  | { type: "clickSelector"; selector: string; delay?: number }
  | { type: "clickSelectorAndContinue"; selector: string; delay?: number }
  | { type: "clickSequenceAndContinue"; selectors: string[]; delay?: number; interval?: number }
  | { type: "closeDialog"; delay?: number }
  | { type: "closeDialogAndRoute"; href: string; delay?: number }
  | { type: "finish" }
  | { type: "wait" };

type TourStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  body: string;
  primaryLabel?: string;
  placement?: "top" | "bottom" | "left" | "right";
  allowTargetInteraction?: boolean;
  allowedSelectors?: string[];
  action?: TourAction;
};

type TargetRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const ACTIVE_KEY = "villahermosa-admin-tour-active";
const STEP_KEY = "villahermosa-admin-tour-step";
const COMPLETED_KEY = "villahermosa-admin-tour-completed";

const SELECT_PORTAL_SELECTORS = [
  '[role="listbox"]',
  '[role="option"]',
  '[data-radix-popper-content-wrapper]',
];

const ADD_PATIENT_MODAL_SELECTORS = [
  '[data-tour-id="add-patient-modal"] form input',
  '[data-tour-id="add-patient-review"]',
  '[data-tour-id="add-patient-summary-back"]',
  '[data-tour-id="add-patient-confirm"]',
];

const getReceptionistTourRoute = (route: string) => route.replace(/^\/admin(?=\/|$)/, "/receptionist");

const TOUR_STEPS: TourStep[] = [
  {
    id: "receptionist-credentials",
    route: "/receptionist/login",
    target: '[data-tour-id="receptionist-login-demo-card"]',
    title: "Use the receptionist demo credentials",
    body: "Email: hannah@villahermosa\nPassword: password\nUse the demo-fill button, then sign in.",
    primaryLabel: "Fill credentials",
    placement: "top",
    action: { type: "clickSelector", selector: '[data-tour-id="receptionist-demo-fill"]' },
  },
  {
    id: "receptionist-submit",
    route: "/receptionist/login",
    target: '[data-tour-id="receptionist-login-submit"]',
    title: "Sign in as receptionist",
    body: "Click Sign In. The helper will automatically continue once the dashboard loads.",
    primaryLabel: "Sign in to continue",
    placement: "top",
    allowTargetInteraction: true,
    action: { type: "wait" },
  },
  {
    id: "dashboard-nav",
    route: "/admin/dashboard",
    target: '[data-tour-id="admin-sidebar"]',
    title: "Receptionist workspace",
    body: "The left navigation is the project map: requests, patients, doctors, calendar, finance, staff, and notifications.",
    primaryLabel: "Next",
    placement: "right",
  },
  {
    id: "dashboard-stats",
    route: "/admin/dashboard",
    target: '[data-tour-id="admin-dashboard-stats"]',
    title: "Dashboard overview",
    body: "These cards summarize patient count, appointments, pending requests, and revenue so the front desk can scan clinic activity quickly.",
    primaryLabel: "Next",
    placement: "bottom",
  },
  {
    id: "schedule-action",
    route: "/admin/dashboard",
    target: '[data-tour-id="admin-quick-schedule"]',
    title: "Book an appointment",
    body: "Schedule opens the booking wizard. We'll open it for the demo, but nothing is saved unless the final confirmation is submitted.",
    primaryLabel: "Open booking wizard",
    placement: "left",
    action: { type: "openBookingDemo", delay: 350 },
  },
  {
    id: "booking-patient",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-patient-step"]',
    title: "Booking step one: patient",
    body: "Choose an existing patient from the selector, or use New Patient to create one first. When you're ready, use the helper Next button.",
    primaryLabel: "Next",
    placement: "left",
    allowTargetInteraction: true,
    allowedSelectors: [
      ...SELECT_PORTAL_SELECTORS,
      ...ADD_PATIENT_MODAL_SELECTORS,
    ],
  },
  {
    id: "booking-patient-next",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-next-button"]',
    title: "Continue to schedule",
    body: "Click the highlighted Next: Schedule button in the booking modal to move to the schedule step. The helper button can do it too.",
    primaryLabel: "Next: Schedule",
    placement: "top",
    allowTargetInteraction: true,
    action: { type: "bookingNext", delay: 350 },
  },
  {
    id: "booking-schedule",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-schedule-step"]',
    title: "Booking step two: schedule",
    body: "Pick the appointment date and time. The date and time popups stay available here while the rest of the page stays paused.",
    primaryLabel: "Next",
    placement: "bottom",
    allowTargetInteraction: true,
    allowedSelectors: [
      '[data-tour-id="booking-date-picker"]',
      '[data-tour-id="booking-time-picker"]',
    ],
  },
  {
    id: "booking-schedule-next",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-next-button"]',
    title: "Continue to doctor",
    body: "Click the highlighted Next: Doctor button in the booking modal to choose a dentist for this visit.",
    primaryLabel: "Next: Doctor",
    placement: "top",
    allowTargetInteraction: true,
    action: { type: "bookingNext", delay: 350 },
  },
  {
    id: "booking-doctor",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-doctor-step"]',
    title: "Booking step three: doctor",
    body: "Choose the dentist for the selected time slot. If you skip the choice, the helper can pick the first available doctor when it moves on.",
    primaryLabel: "Next",
    placement: "bottom",
    allowTargetInteraction: true,
  },
  {
    id: "booking-doctor-next",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-next-button"]',
    title: "Continue to treatment",
    body: "Click the highlighted Next: Treatment button in the booking modal to pick the service details.",
    primaryLabel: "Next: Treatment",
    placement: "top",
    allowTargetInteraction: true,
    action: { type: "bookingNext", delay: 350 },
  },
  {
    id: "booking-treatment",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-treatment-step"]',
    title: "Booking step four: treatment",
    body: "Select the treatment and review duration, discounts, and the estimated fee. Routine Cleaning is preselected for the demo.",
    primaryLabel: "Next",
    placement: "bottom",
    allowTargetInteraction: true,
    allowedSelectors: SELECT_PORTAL_SELECTORS,
  },
  {
    id: "booking-treatment-next",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-next-button"]',
    title: "Continue to payment",
    body: "Click the highlighted Next: Payment button in the booking modal to review payment and appointment status.",
    primaryLabel: "Next: Payment",
    placement: "top",
    allowTargetInteraction: true,
    action: { type: "bookingNext", delay: 350 },
  },
  {
    id: "booking-payment",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-payment-step"]',
    title: "Booking step five: payment",
    body: "Review payment amount, method, and status here. We'll open the summary next and stop before the final save.",
    primaryLabel: "Show summary",
    placement: "top",
    allowTargetInteraction: true,
    allowedSelectors: SELECT_PORTAL_SELECTORS,
    action: { type: "bookingNext", delay: 250 },
  },
  {
    id: "booking-summary",
    route: "/admin/dashboard",
    target: '[data-tour-id="booking-summary-modal"]',
    title: "Appointment summary",
    body: "This review screen shows all details before saving. The helper will close the booking modal and then dismiss this summary.",
    primaryLabel: "Close booking modal",
    placement: "right",
    action: { type: "closeDialog", delay: 250 },
  },
  {
    id: "quick-add-patient",
    route: "/admin/dashboard",
    target: '[data-tour-id="admin-quick-add-patient"]',
    title: "Add a patient",
    body: "Admins can create a patient record directly from Quick Actions. We'll open the form and point out the required fields.",
    primaryLabel: "Open patient form",
    placement: "left",
    action: { type: "clickTarget", delay: 350 },
  },
  {
    id: "add-patient-form",
    route: "/admin/dashboard",
    target: '[data-tour-id="add-patient-first-name"]',
    title: "Patient record form",
    body: "This form collects the required patient basics: first name, last name, and phone number.",
    primaryLabel: "Show review button",
    placement: "left",
  },
  {
    id: "add-patient-review",
    route: "/admin/dashboard",
    target: '[data-tour-id="add-patient-review"]',
    title: "Review before saving",
    body: "Review shows a confirmation screen first. For the demo, we'll close this form and continue to the patient directory.",
    primaryLabel: "Go to patients",
    placement: "top",
    action: { type: "closeDialogAndRoute", href: "/admin/patients", delay: 250 },
  },
  {
    id: "patients-page",
    route: "/admin/patients",
    target: '[data-tour-id="patients-demo-row"]',
    title: "Patient directory",
    body: "We'll use Lorenzo Rojas, ID: ENT_TEST, to look deeper at the patient workflow.",
    primaryLabel: "Next",
    placement: "bottom",
  },
  {
    id: "patients-demo-actions",
    route: "/admin/patients",
    target: '[data-tour-id="patients-demo-actions"]',
    title: "Open row actions",
    body: "The three-dot menu gathers the common actions for this patient record.",
    primaryLabel: "Show options",
    placement: "left",
    allowTargetInteraction: true,
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patients-demo-actions"]', delay: 250 },
  },
  {
    id: "patients-demo-view-details",
    route: "/admin/patients",
    target: '[data-tour-id="patients-demo-view-details"]',
    title: "View patient details",
    body: "Open View Details to inspect Lorenzo's full patient profile, clinical notes, visits, and financial history.",
    primaryLabel: "View Details",
    placement: "left",
    allowTargetInteraction: true,
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patients-demo-view-details"]', delay: 350 },
  },
  {
    id: "patient-details-overview",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-modal"]',
    title: "Patient details",
    body: "This modal keeps the patient's profile, care context, charting, visit history, and payments in one focused workspace.",
    primaryLabel: "Next",
    placement: "bottom",
  },
  {
    id: "patient-details-info",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-info-tab"]',
    title: "Personal info",
    body: "The opening tab covers the patient's demographics, contact details, emergency contact, and clinical alerts.",
    primaryLabel: "Next",
    placement: "bottom",
  },
  {
    id: "patient-details-summary",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-summary"]',
    title: "Record snapshot",
    body: "The summary bar keeps account status, balance, patient age, and record reference visible before diving into the tabs.",
    primaryLabel: "Show family tab",
    placement: "bottom",
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patient-details-family-tab"]', delay: 250 },
  },
  {
    id: "patient-details-family",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-family-tab"]',
    title: "Family and relations",
    body: "Family links show the account holder, dependents, and shared household context for coordinated care.",
    primaryLabel: "Medical records",
    placement: "bottom",
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patient-details-records-tab"]', delay: 250 },
  },
  {
    id: "patient-details-records",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-records-tab"]',
    title: "Medical records",
    body: "The records tab captures allergies, medical history, treatment plans, and clinical notes.",
    primaryLabel: "Dental chart",
    placement: "bottom",
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patient-details-chart-tab"]', delay: 250 },
  },
  {
    id: "patient-details-chart",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-chart-tab"]',
    title: "Dental chart",
    body: "Dental charting gives the clinic a tooth-level record that can be updated as treatments progress.",
    primaryLabel: "Visit history",
    placement: "bottom",
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patient-details-history-tab"]', delay: 250 },
  },
  {
    id: "patient-details-history",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-history-tab"]',
    title: "Visit history",
    body: "Visit history groups past and upcoming appointments, filters, notes, and payment shortcuts for this patient.",
    primaryLabel: "Financial log",
    placement: "bottom",
    action: { type: "clickSelectorAndContinue", selector: '[data-tour-id="patient-details-payments-tab"]', delay: 250 },
  },
  {
    id: "patient-details-payments",
    route: "/admin/patients",
    target: '[data-tour-id="patient-details-payments-tab"]',
    title: "Financial log",
    body: "The financial log lists patient payments and supports adding or reviewing transactions from the profile.",
    primaryLabel: "Go to calendar",
    placement: "bottom",
    action: { type: "closeDialogAndRoute", href: "/admin/calendar", delay: 250 },
  },
  {
    id: "calendar-page",
    route: "/admin/calendar",
    target: '[data-tour-id="admin-calendar-new-appointment"]',
    title: "Calendar scheduling",
    body: "The calendar gives a full schedule view. Admins can create appointments from here or inspect existing visits.",
    primaryLabel: "Show week view",
    placement: "left",
    action: { type: "clickSelector", selector: '[data-tour-id="calendar-view-week"]', delay: 250 },
  },
  {
    id: "calendar-week-view",
    route: "/admin/calendar",
    target: '[data-tour-id="calendar-view-week"]',
    title: "Week view",
    body: "Switch this calendar into week mode to inspect appointments over several days at once.",
    primaryLabel: "Show month view",
    placement: "bottom",
    action: { type: "clickSelector", selector: '[data-tour-id="calendar-view-month"]', delay: 250 },
  },
  {
    id: "calendar-month-view",
    route: "/admin/calendar",
    target: '[data-tour-id="calendar-view-month"]',
    title: "Month view",
    body: "Month view lets the receptionist see the full schedule at a glance. You can always switch back to day or week later.",
    primaryLabel: "Find doctors",
    placement: "bottom",
    action: { type: "route", href: "/admin/doctors" },
  },
  {
    id: "find-doctors-page",
    route: "/admin/doctors",
    target: '[data-tour-id="admin-doctors-page"]',
    title: "Find Doctors",
    body: "Use the doctor directory to locate a dentist and start a booking from the card view.",
    primaryLabel: "Next",
    placement: "bottom",
  },
  {
    id: "find-doctors-card",
    route: "/admin/doctors",
    target: '[data-tour-id="doctor-card-button"]',
    title: "Doctor booking action",
    body: "Click a doctor's Book Appointment button to begin a patient booking flow without saving anything yet.",
    primaryLabel: "Next",
    placement: "top",
    allowTargetInteraction: true,
  },
  {
    id: "requests-page",
    route: "/admin/requests",
    target: '[data-tour-id="requests-page"]',
    title: "Requests and approvals",
    body: "Requests collect bookings that need front desk action. Approve, reject, update payment status, or open the appointment details from here.",
    primaryLabel: "Go to finance",
    placement: "bottom",
    action: { type: "route", href: "/admin/finance" },
  },
  {
    id: "finance-page",
    route: "/admin/finance",
    target: '[data-tour-id="finance-page"]',
    title: "Finance overview",
    body: "Finance tracks revenue, expenses, payroll, invoices, and transaction history for the clinic.",
    primaryLabel: "Go to staff",
    placement: "bottom",
    action: { type: "route", href: "/admin/staff" },
  },
  {
    id: "staff-page",
    route: "/admin/staff",
    target: '[data-tour-id="staff-page"]',
    title: "Staff management",
    body: "Staff management handles team records, attendance, salaries, cash advances, and staff schedules.",
    primaryLabel: "Go to notifications",
    placement: "bottom",
    action: { type: "route", href: "/admin/notifications" },
  },
  {
    id: "notifications-page",
    route: "/admin/notifications",
    target: '[data-tour-id="admin-notifications-page"]',
    title: "Notifications",
    body: "Notifications collect appointment updates, payment activity, approvals, and deleted items for quick review.",
    primaryLabel: "Finish tour",
    placement: "bottom",
    action: { type: "finish" },
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isElementVisible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0
  );
};

const getVisibleElement = (selector: string) => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return elements.find(isElementVisible) || null;
};

const getEventElement = (target: EventTarget | null) => {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const isBookingNextStep = (stepId?: string) =>
  Boolean(stepId?.startsWith("booking-") && stepId.endsWith("-next"));

const getRect = (element: HTMLElement): TargetRect => {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

const getDialogRoot = (element: HTMLElement | null) =>
  element?.closest('[data-slot="dialog-content"]') as HTMLElement | null;

const getAdminNavSelectorForPath = (path: string) => {
  const managementPath = path.replace(/^\/receptionist(?=\/|$)/, "/admin");
  if (managementPath.startsWith("/admin/dashboard")) return '[data-tour-id="admin-nav-dashboard"]';
  if (managementPath.startsWith("/admin/requests")) return '[data-tour-id="admin-nav-requests"]';
  if (managementPath.startsWith("/admin/patients")) return '[data-tour-id="admin-nav-patients"]';
  if (managementPath.startsWith("/admin/doctors")) return '[data-tour-id="admin-nav-find-doctors"]';
  if (managementPath.startsWith("/admin/calendar")) return '[data-tour-id="admin-nav-calendar"]';
  if (managementPath.startsWith("/admin/finance")) return '[data-tour-id="admin-nav-finance"]';
  if (managementPath.startsWith("/admin/staff")) return '[data-tour-id="admin-nav-staff"]';
  if (managementPath.startsWith("/admin/notifications")) return '[data-tour-id="admin-nav-notifications"]';
  if (managementPath.startsWith("/admin/settings")) return '[data-tour-id="admin-nav-settings"]';
  return "";
};

const PATIENT_DETAILS_PREVIOUS_TAB_TARGETS: Record<string, string> = {
  "patient-details-family": '[data-tour-id="patient-details-info-tab"]',
  "patient-details-records": '[data-tour-id="patient-details-family-tab"]',
  "patient-details-chart": '[data-tour-id="patient-details-records-tab"]',
  "patient-details-history": '[data-tour-id="patient-details-chart-tab"]',
  "patient-details-payments": '[data-tour-id="patient-details-history-tab"]',
};

type TourWindow = Window & { __villahermosaTourStepId?: string };

export function UserTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { openCreateModal } = useAppointmentModal();
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [activeNavRect, setActiveNavRect] = useState<TargetRect | null>(null);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const internalActionRef = useRef(false);
  const pendingRouteStepRef = useRef<{ index: number; route: string } | null>(null);
  const transitionFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeUnrelatedDialogs = (stepTarget: string) => {
    const targetElement = getVisibleElement(stepTarget);
  if (!targetElement) return;

  const currentDialog = getDialogRoot(targetElement);
  if (!currentDialog) return;

  const closeButtons = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="dialog-close"]'));
  let clicked = false;

  closeButtons.forEach((button) => {
    if (!isElementVisible(button)) return;
    if (currentDialog.contains(button)) return;
      button.click();
    });

    if (clicked) {
      window.setTimeout(() => {
        internalActionRef.current = false;
      }, 0);
    }
  };

  const step = TOUR_STEPS[stepIndex];
  const progressText = `${stepIndex + 1} of ${TOUR_STEPS.length}`;
  const isWaiting = step?.action?.type === "wait";
  const isAdminRoute = pathname.startsWith("/admin");

  const persistStep = useCallback((index: number) => {
    localStorage.setItem(ACTIVE_KEY, "true");
    localStorage.setItem(STEP_KEY, String(index));
  }, []);

  const clearTransition = useCallback(() => {
    if (transitionFallbackRef.current) {
      clearTimeout(transitionFallbackRef.current);
      transitionFallbackRef.current = null;
    }
    setIsTransitioning(false);
  }, []);

  const beginTransition = useCallback(() => {
    if (transitionFallbackRef.current) {
      clearTimeout(transitionFallbackRef.current);
    }
    setIsTransitioning(true);
    transitionFallbackRef.current = setTimeout(() => {
      transitionFallbackRef.current = null;
      setIsTransitioning(false);
    }, 12000);
  }, []);

  const goToStep = useCallback(
    (index: number, routeOverride?: string) => {
      const nextIndex = clamp(index, 0, TOUR_STEPS.length - 1);
      const nextStep = TOUR_STEPS[nextIndex];
      const nextRoute = getReceptionistTourRoute(routeOverride || nextStep.route);
      const shouldNavigate = nextRoute !== pathname;

      pendingRouteStepRef.current = shouldNavigate
        ? { index: nextIndex, route: nextRoute }
        : null;
      setStepIndex(nextIndex);
      persistStep(nextIndex);
      if (shouldNavigate) {
        router.push(nextRoute);
      }
    },
    [pathname, persistStep, router]
  );

  const finishTour = useCallback(() => {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(STEP_KEY);
    localStorage.setItem(COMPLETED_KEY, "true");
    setIsActive(false);
    setIsExitDialogOpen(false);
    setTargetRect(null);
    setActiveNavRect(null);
    pendingRouteStepRef.current = null;
    clearTransition();
  }, [clearTransition]);

  const startTour = useCallback(
    (preferredIndex = 0) => {
      localStorage.removeItem(COMPLETED_KEY);
      localStorage.setItem(ACTIVE_KEY, "true");
      setIsActive(true);
      goToStep(preferredIndex);
    },
    [goToStep]
  );

  const dispatchInternalTourEvent = useCallback((eventName: string) => {
    internalActionRef.current = true;
    window.dispatchEvent(new CustomEvent(eventName));
    window.setTimeout(() => {
      internalActionRef.current = false;
    }, 0);
  }, []);

  const scrollPatientDetailsToTop = useCallback(() => {
    const scrollArea = getVisibleElement('[data-tour-id="patient-details-scroll-area"]');
    scrollArea?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const clickTourElement = useCallback(
    (selector: string) => {
      const element = getVisibleElement(selector);
      if (!element) return false;

      internalActionRef.current = true;
      if (typeof PointerEvent !== "undefined") {
        element.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            pointerType: "mouse",
          })
        );
      }
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
      element.click();

      if (selector.includes("patient-details-")) {
        window.setTimeout(scrollPatientDetailsToTop, 0);
      }

      window.setTimeout(() => {
        internalActionRef.current = false;
      }, 0);
      return true;
    },
    [scrollPatientDetailsToTop]
  );

  const handleBack = useCallback(() => {
    if (stepIndex === 0) return;
    if (isTransitioning) return;
    beginTransition();

    if (step?.id === "calendar-page") {
      const patientsStepIndex = TOUR_STEPS.findIndex((candidate) => candidate.id === "patients-page");
      goToStep(patientsStepIndex >= 0 ? patientsStepIndex : stepIndex - 1);
      return;
    }

    if (step?.id === "patient-details-overview") {
      internalActionRef.current = true;
      const modal = getVisibleElement('[data-tour-id="patient-details-modal"]');
      const closeButton =
        modal?.querySelector<HTMLElement>('[data-slot="dialog-close"]') ||
        getVisibleElement('[data-slot="dialog-close"]');

      closeButton?.click();
      window.setTimeout(() => {
        clickTourElement('[data-tour-id="patients-demo-actions"]');
        window.setTimeout(() => {
          internalActionRef.current = false;
          goToStep(stepIndex - 1);
        }, 150);
      }, 250);
      return;
    }

    if (step?.id === "patients-demo-actions") {
      const addPatientFormIndex = TOUR_STEPS.findIndex((candidate) => candidate.id === "add-patient-form");
      if (addPatientFormIndex >= 0) {
        goToStep(addPatientFormIndex);
        return;
      }
    }

    const previousPatientDetailsTab = step?.id ? PATIENT_DETAILS_PREVIOUS_TAB_TARGETS[step.id] : undefined;
    if (previousPatientDetailsTab) {
      clickTourElement(previousPatientDetailsTab);
      window.setTimeout(() => goToStep(stepIndex - 1), 150);
      return;
    }

    if (step?.id === "booking-patient") {
      internalActionRef.current = true;
      getVisibleElement('[data-slot="dialog-close"]')?.click();
      window.setTimeout(() => {
        internalActionRef.current = false;
        goToStep(stepIndex - 1);
      }, 250);
      return;
    }

    if (step?.id === "booking-summary") {
      const previousStepIndex = stepIndex - 1;
      const previousStep = TOUR_STEPS[previousStepIndex];
      const clickedBackToEdit = clickTourElement('[data-tour-id="booking-summary-back"]');

      if (!clickedBackToEdit || !previousStep) {
        clearTransition();
        return;
      }

      let attempts = 0;
      const waitForSummaryToClose = () => {
        const summaryModal = getVisibleElement('[data-tour-id="booking-summary-modal"]');
        const previousTarget = getVisibleElement(previousStep.target);

        if (!summaryModal && previousTarget) {
          goToStep(previousStepIndex);
          return;
        }

        attempts += 1;
        if (attempts < 30) {
          window.setTimeout(waitForSummaryToClose, 100);
        }
      };

      window.setTimeout(waitForSummaryToClose, 100);
      return;
    }

    if (isBookingNextStep(step?.id)) {
      goToStep(stepIndex - 1);
      return;
    }

    if (step?.id.startsWith("booking-")) {
      dispatchInternalTourEvent("villahermosa-tour:booking-prev");
      window.setTimeout(() => goToStep(stepIndex - 1), 250);
      return;
    }

    goToStep(stepIndex - 1);
  }, [beginTransition, clearTransition, clickTourElement, dispatchInternalTourEvent, goToStep, isTransitioning, step?.id, stepIndex]);

  useEffect(() => {
    setIsMounted(true);

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();

    mediaQuery.addEventListener("change", updateViewport);

    const storedActive = localStorage.getItem(ACTIVE_KEY) === "true";

    if (storedActive) {
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(STEP_KEY);
    }

    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, [persistStep]);

  useEffect(() => {
    if (!isMounted) return;
    if (!isAdminRoute && isDesktopViewport) return;

    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(STEP_KEY);
    setIsActive(false);
    setIsExitDialogOpen(false);
    setTargetRect(null);
    setActiveNavRect(null);
    pendingRouteStepRef.current = null;
    clearTransition();
  }, [clearTransition, isAdminRoute, isDesktopViewport, isMounted]);

  useEffect(() => {
    if (!isActive) return;

    const pendingRouteStep = pendingRouteStepRef.current;
    if (pendingRouteStep) {
      if (pathname === pendingRouteStep.route) {
        pendingRouteStepRef.current = null;
        if (stepIndex !== pendingRouteStep.index) {
          setStepIndex(pendingRouteStep.index);
          persistStep(pendingRouteStep.index);
        }
      }
      return;
    }

    if (!step) return;
    if (getReceptionistTourRoute(step.route) === pathname) return;

    const nextRouteIndex = TOUR_STEPS.findIndex(
      (candidate, index) => index >= stepIndex && getReceptionistTourRoute(candidate.route) === pathname
    );

    if (nextRouteIndex >= 0) {
      setStepIndex(nextRouteIndex);
      persistStep(nextRouteIndex);
    }
  }, [isActive, pathname, persistStep, step, stepIndex]);

  useEffect(() => {
    const tourWindow = window as TourWindow;
    const stepId = isActive && step ? step.id : "";
    tourWindow.__villahermosaTourStepId = stepId;
    window.dispatchEvent(
      new CustomEvent("villahermosa-tour:step-change", {
        detail: { stepId },
      })
    );
  }, [isActive, step?.id, step]);

  useEffect(() => {
    if (!isTransitioning || !isActive || !step) return;
    if (getReceptionistTourRoute(step.route) !== pathname) return;
    if (!getVisibleElement(step.target)) return;

    const frameId = window.requestAnimationFrame(() => {
      clearTransition();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [clearTransition, isActive, isTransitioning, pathname, step, stepIndex, targetRect]);

  useEffect(() => {
    if (!isActive) return;

    const modalStepToTourId: Record<string, string> = {
      patient: "booking-patient",
      schedule: "booking-schedule",
      doctor: "booking-doctor",
      treatment: "booking-treatment",
      payment: "booking-payment",
    };

    const handleBookingStepChange = (event: Event) => {
      const bookingStep = (event as CustomEvent<{ step?: string }>).detail?.step;
      const tourStepId = bookingStep ? modalStepToTourId[bookingStep] : undefined;
      if (!tourStepId) return;

      const nextIndex = TOUR_STEPS.findIndex((candidate) => candidate.id === tourStepId);
      if (nextIndex < 0 || nextIndex === stepIndex) return;

      setStepIndex(nextIndex);
      persistStep(nextIndex);
    };

    window.addEventListener("villahermosa-tour:booking-step-change", handleBookingStepChange);

    return () => {
      window.removeEventListener("villahermosa-tour:booking-step-change", handleBookingStepChange);
    };
  }, [isActive, persistStep, stepIndex]);

  useEffect(() => {
    if (!isActive || !step) return;

    const isAllowedEventTarget = (target: EventTarget | null) => {
      if (internalActionRef.current) return true;
      const element = getEventElement(target);
      if (!element) return false;
      if (element.closest('[data-tour-ui="true"]')) return true;
      if (element.closest('[data-slot="dialog-close"]')) return false;

      if ((step.allowedSelectors || []).some((selector) => Boolean(element.closest(selector)))) {
        return true;
      }

      return Boolean(step.allowTargetInteraction && element.closest(step.target));
    };

    const continueWhenNextTargetReady = (delay = 250) => {
      window.setTimeout(() => {
        const nextIndex = clamp(stepIndex + 1, 0, TOUR_STEPS.length - 1);
        const nextStep = TOUR_STEPS[nextIndex];
        if (!nextStep) return;

        let attempts = 0;
        const poll = () => {
          if (getReceptionistTourRoute(nextStep.route) !== window.location.pathname) {
            goToStep(nextIndex);
            return;
          }

          if (getVisibleElement(nextStep.target)) {
            goToStep(nextIndex);
            return;
          }

          attempts += 1;
          if (attempts < 40) {
            window.setTimeout(poll, 150);
          }
        };

        poll();
      }, delay);
    };

    const continueFromDirectClick = (event: Event) => {
      if (event.type !== "click" || internalActionRef.current || isTransitioning) return;
      if (step.action?.type !== "clickSelectorAndContinue") return;

      const element = getEventElement(event.target);
      if (!element?.closest(step.action.selector)) return;

      beginTransition();
      continueWhenNextTargetReady(step.action.delay ?? 250);
    };

    const blockEvent = (event: Event) => {
      if (event.type === "submit" && step.id === "receptionist-submit") return;
      if (isAllowedEventTarget(event.target)) {
        continueFromDirectClick(event);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const blockKeyEvent = (event: KeyboardEvent) => {
      if (event.key === "Escape" || !isAllowedEventTarget(event.target)) {
        blockEvent(event);
      }
    };

    document.addEventListener("pointerdown", blockEvent, true);
    document.addEventListener("click", blockEvent, true);
    document.addEventListener("submit", blockEvent, true);
    document.addEventListener("keydown", blockKeyEvent, true);

    return () => {
      document.removeEventListener("pointerdown", blockEvent, true);
      document.removeEventListener("click", blockEvent, true);
      document.removeEventListener("submit", blockEvent, true);
      document.removeEventListener("keydown", blockKeyEvent, true);
    };
  }, [beginTransition, goToStep, isActive, isTransitioning, step, stepIndex]);

  useEffect(() => {
    if (!isActive || !step) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let target: HTMLElement | null = null;

    const updateActiveNavRect = () => {
      const navSelector = getAdminNavSelectorForPath(window.location.pathname);
      const activeNav = navSelector ? getVisibleElement(navSelector) : null;
      setActiveNavRect(activeNav ? getRect(activeNav) : null);
    };

    const updateRect = () => {
      target = getVisibleElement(step.target);
      updateActiveNavRect();

      if (target) {
        if (attempts === 0) {
          target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        }
        setTargetRect(getRect(target));
      } else {
        setTargetRect(null);
      }

      attempts += 1;
      if (attempts < 24) {
        timeoutId = setTimeout(updateRect, 250);
      }
    };

    const refreshOnly = () => {
      const currentTarget = getVisibleElement(step.target);
      setTargetRect(currentTarget ? getRect(currentTarget) : null);
      updateActiveNavRect();
    };

    updateRect();
    window.addEventListener("resize", refreshOnly);
    window.addEventListener("scroll", refreshOnly, true);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("resize", refreshOnly);
      window.removeEventListener("scroll", refreshOnly, true);
    };
  }, [isActive, pathname, step, stepIndex]);

  const runAction = useCallback(() => {
    if (!step) return;
    if (isTransitioning) return;

    const action = step.action;
    const nextIndex = clamp(stepIndex + 1, 0, TOUR_STEPS.length - 1);
    const clickElement = clickTourElement;

    const continueWhenTargetReady = (delay = 250) => {
      window.setTimeout(() => {
        const nextStep = TOUR_STEPS[nextIndex];
        if (!nextStep) return;

        let attempts = 0;
        const poll = () => {
          if (getReceptionistTourRoute(nextStep.route) !== window.location.pathname) {
            goToStep(nextIndex);
            return;
          }

          if (getVisibleElement(nextStep.target)) {
            goToStep(nextIndex);
            return;
          }

          attempts += 1;
          if (attempts < 40) {
            window.setTimeout(poll, 150);
          }
        };

        poll();
      }, delay);
    };

    closeUnrelatedDialogs(step.target);

    if (action?.type === "wait") return;

    if (action?.type === "finish") {
      finishTour();
      return;
    }

    beginTransition();

    if (!action) {
      goToStep(nextIndex);
      return;
    }

    if (action.type === "route") {
      goToStep(nextIndex, action.href);
      return;
    }

    if (action.type === "openBookingDemo") {
      openCreateModal();
      continueWhenTargetReady(action.delay ?? 350);
      return;
    }

    if (action.type === "bookingNext") {
      console.log('[UserTour] bookingNext action triggered', { stepId: step?.id, nextIndex, step });
      dispatchInternalTourEvent("villahermosa-tour:booking-next");
      continueWhenTargetReady(action.delay ?? 350);
      return;
    }

    if (action.type === "clickTarget") {
      if (!clickElement(step.target)) {
        clearTransition();
        return;
      }
      continueWhenTargetReady(action.delay ?? 250);
      return;
    }

    if (action.type === "clickSelector") {
      if (!clickElement(action.selector)) {
        clearTransition();
        return;
      }
      window.setTimeout(() => goToStep(nextIndex), action.delay ?? 250);
      return;
    }

    if (action.type === "clickSelectorAndContinue") {
      if (!clickElement(action.selector)) {
        clearTransition();
        return;
      }
      continueWhenTargetReady(action.delay ?? 250);
      return;
    }

    if (action.type === "clickSequenceAndContinue") {
      action.selectors.forEach((selector, index) => {
        window.setTimeout(() => clickElement(selector), index * (action.interval ?? 150));
      });
      continueWhenTargetReady(action.delay ?? 350);
      return;
    }

    if (action.type === "closeDialog") {
      if (!clickElement('[data-slot="dialog-close"]')) {
        clearTransition();
        return;
      }
      continueWhenTargetReady(action.delay ?? 250);
      return;
    }

    if (action.type === "closeDialogAndRoute") {
      if (!clickElement('[data-slot="dialog-close"]')) {
        clearTransition();
        return;
      }
      setTimeout(() => {
        goToStep(nextIndex, action.href);
      }, action.delay ?? 250);
    }
  }, [beginTransition, clearTransition, clickTourElement, dispatchInternalTourEvent, finishTour, goToStep, isTransitioning, openCreateModal, step, stepIndex]);

  const tooltipStyle = useMemo(() => {
    if (!isMounted) return {};
    const width = Math.min(360, window.innerWidth - 32);
    const spacing = 20;
    const defaultTop = Math.max(16, window.innerHeight / 2 - 160);
    const defaultLeft = Math.max(16, window.innerWidth / 2 - width / 2);

    if (!targetRect) {
      return { width, top: defaultTop, left: defaultLeft };
    }

    const placement = step?.placement || "bottom";
    const leftCentered = clamp(targetRect.left + targetRect.width / 2 - width / 2, 16, window.innerWidth - width - 16);
    const verticalCenter = clamp(targetRect.top + targetRect.height / 2 - 120, 16, window.innerHeight - 260);

    if (placement === "top") {
      return {
        width,
        left: leftCentered,
        top: clamp(targetRect.top - 260 - spacing, 16, window.innerHeight - 280),
      };
    }

    if (placement === "left") {
      return {
        width,
        left: clamp(targetRect.left - width - spacing, 16, window.innerWidth - width - 16),
        top: verticalCenter,
      };
    }

    if (placement === "right") {
      return {
        width,
        left: clamp(targetRect.right + spacing, 16, window.innerWidth - width - 16),
        top: verticalCenter,
      };
    }

    return {
      width,
      left: leftCentered,
      top: clamp(targetRect.bottom + spacing, 16, window.innerHeight - 280),
    };
  }, [isMounted, step?.placement, targetRect]);

  const spotlightStyle = useMemo(() => {
    if (!targetRect) return null;
    const padding = 8;
    const top = Math.max(8, targetRect.top - padding);
    const left = Math.max(8, targetRect.left - padding);
    return {
      top,
      left,
      width: Math.min(targetRect.width + padding * 2, window.innerWidth - left - 8),
      height: Math.min(targetRect.height + padding * 2, window.innerHeight - top - 8),
    };
  }, [targetRect]);

  const activeNavSpotlightStyle = useMemo(() => {
    if (!activeNavRect) return null;
    const padding = 4;
    return {
      top: Math.max(8, activeNavRect.top - padding),
      left: Math.max(8, activeNavRect.left - padding),
      width: activeNavRect.width + padding * 2,
      height: activeNavRect.height + padding * 2,
    };
  }, [activeNavRect]);

  if (!isMounted || isAdminRoute || !isDesktopViewport) return null;

  if (!isActive || !step) {
    return (
      <button
        type="button"
        data-tour-ui="true"
        onClick={() => {
          const currentRouteIndex = TOUR_STEPS.findIndex(
            (candidate) => getReceptionistTourRoute(candidate.route) === pathname
          );
          startTour(currentRouteIndex >= 0 ? currentRouteIndex : 0);
        }}
        className="fixed bottom-5 right-5 z-[80] inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-xl shadow-blue-100/70 transition hover:-translate-y-0.5 hover:bg-blue-50"
      >
        <HelpCircle className="h-4 w-4" />
        Demo guide
      </button>
    );
  }

  return (
    <>
      {spotlightStyle && (
        <div
          className="pointer-events-none fixed z-[9990] rounded-[1rem] border-2 border-blue-400 bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.45),0_18px_50px_rgba(37,99,235,0.28)] ring-4 ring-blue-100/80 transition-all duration-200"
          style={spotlightStyle}
        />
      )}

      {!spotlightStyle && (
        <div className="pointer-events-none fixed inset-0 z-[9990] bg-slate-950/35" />
      )}

      {activeNavSpotlightStyle && (
        <div
          className="pointer-events-none fixed z-[9991] rounded-xl border-2 border-cyan-300 bg-cyan-300/15 shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_0_34px_rgba(34,211,238,0.85)] ring-4 ring-cyan-100/80 transition-all duration-200"
          style={activeNavSpotlightStyle}
        />
      )}

      <div
        data-tour-ui="true"
        className="fixed z-[9999] rounded-2xl border border-blue-100 bg-white p-4 text-slate-800 shadow-2xl shadow-slate-950/20"
        style={{ ...tooltipStyle, pointerEvents: "auto" }}
        onPointerDownCapture={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              {step.id === "landing-login" ? (
                <LogIn className="h-4 w-4" />
              ) : step.action?.type === "clickTarget" || step.action?.type === "clickSelector" ? (
                <MousePointerClick className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">
                Receptionist demo helper
              </p>
              <h2 className="text-base font-black leading-tight text-slate-950">
                {step.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsExitDialogOpen(true)}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
            {progressText}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              disabled={stepIndex === 0 || isTransitioning}
              className="h-9 gap-1 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={runAction}
              disabled={isWaiting || isTransitioning}
              className="h-9 gap-1 rounded-full bg-blue-600 px-4 font-bold text-white hover:bg-blue-700"
            >
              {isTransitioning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                <>
                  {step.primaryLabel || "Next"}
                  {!isWaiting && <ArrowRight className="h-4 w-4" />}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {isExitDialogOpen && (
        <div
          data-tour-ui="true"
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/50 px-4"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-amber-100 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">Stop the helper?</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This will end the guided demo. Continue only if you already know your way around the receptionist workflow.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsExitDialogOpen(false)}
                className="rounded-full"
              >
                Continue tour
              </Button>
              <Button
                type="button"
                onClick={finishTour}
                className="rounded-full bg-amber-600 text-white hover:bg-amber-700"
              >
                I know what I&apos;m doing
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
