# Copilot Instructions - Villa Hermosa Dental Clinic

## Project Overview
This is a Next.js 15 dental clinic management dashboard built with React 19, TypeScript, and Tailwind CSS. The app features an admin interface for managing patients, appointments, finances, and scheduling.

### Key Stack
- **Framework**: Next.js 15.5.4 with Turbopack (set in `dev` and `build` scripts)
- **UI Components**: Shadcn/ui (Radix UI primitives) in `components/ui/`
- **Styling**: Tailwind CSS 4 with `@tailwindcss/postcss`
- **Icons**: Lucide React
- **Charts**: Recharts
- **State Management**: React Context API (see `AdminLayout.tsx` for pattern)

## Architecture

### Component Structure
```
components/
├── ui/              # Shadcn/ui components (Radix-based, pre-built)
├── figma/           # Custom components (ImageWithFallback)
├── AdminLayout      # Shell with sidebar, context provider for modals
├── Dashboard        # Main stats & charts view
├── PatientsView     # Patient list management
├── CalendarView     # Appointment calendar
├── FinanceView      # Revenue & financial analytics
├── SettingsView     # Admin settings
├── Modals           # ScheduleAppointmentModal, AddPatientModal
└── Public-facing    # Hero, About, Services, Contact, etc.
```

### Data Flow Pattern
1. **Page-level state** (`app/page.tsx`): View routing via `currentView` state
2. **Context-based modals** (`AdminLayout.tsx`): `useAppointmentModal()` hook for triggering modals from any component
3. **Form data handling** (`AddPatientModal.tsx`): Local state, `console.log()` placeholder for API calls (no backend connected yet)

### Key Pattern: Modal Context
The `AppointmentModalContext` in `AdminLayout.tsx` enables nested components to open modals without prop drilling:
```tsx
const { openScheduleModal, openAddPatientModal } = useAppointmentModal();
// Use anywhere in admin layout subtree
```

## Styling & UI Conventions

### Utility Functions
- **`lib/utils.ts`**: `cn()` function combines Tailwind with `clsx` and `tailwind-merge` for dynamic class merging
- Usage: `className={cn(baseClass, condition && conditionalClass)}`

### Button Variants
Custom button variants in `components/ui/button.tsx` include:
- `variant`: "default" (violet), "outline", "ghost", "destructive", "secondary", "brand", "dark", "cancel", "toggle"
- `size`: "default", "sm", "lg", "icon"
- Example: `<Button variant="brand" size="lg">Action</Button>`

### Tailwind + Radix Pattern
All UI components use:
1. **Radix UI** primitives for accessibility/behavior
2. **Tailwind classes** for styling
3. **Class merging** with `cn()` to avoid conflicts

## Development Workflow

### Commands
```bash
npm run dev       # Start with Turbopack (watch mode)
npm run build     # Production build with Turbopack
npm start         # Run production server
npm run lint      # Run ESLint
```

### Path Aliases
- `@/*` maps to workspace root (configured in `tsconfig.json`)
- Import components: `import { Button } from "@/components/ui/button"`

### TypeScript Setup
- `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`
- Target: ES2017, module: esnext
- All components use functional components with TypeScript interfaces

## Form & Modal Patterns

### AddPatientModal Pattern
1. Define `FormData` interface
2. Local `useState` for form data
3. `handleSubmit` with `e.preventDefault()`
4. `console.log()` for debugging (API integration placeholder)
5. Reset form and call `onOpenChange(false)` on success

### Appointment Scheduling
Context-based modal opens from `Dashboard` and other components using:
```tsx
const { openScheduleModal } = useAppointmentModal();
openScheduleModal(patientName, patientId);
```

## Integration Points (Not Yet Implemented)

- **Backend/API**: Components use `console.log()` for form submission (no actual API calls)
- **State persistence**: No database integration yet (all data is mock)
- **Authentication**: No auth system implemented
- **Real-time updates**: Not yet implemented

## Code Style

- **Export style**: Named exports for components, default for pages
- **"use client"**: Must be at top of files using React hooks (per Next.js 15 app router)
- **Component naming**: PascalCase for components
- **Icon usage**: Import from `lucide-react` and use inline

## UI Component Import Pattern
All components follow this import structure:
```tsx
import { ComponentName } from "@/components/ui/component-name";
```

When building new features, use existing Shadcn/ui components (Dialog, Button, Input, Select, etc.) rather than creating custom alternatives.

## Testing & Validation
- ESLint configured but no test suite yet
- Manual testing in `http://localhost:3000` during development

## Important Reminders
- All UI state is client-side only (`"use client"` directives)
- Modal triggering uses Context API, not prop drilling
- Form submissions are console-logged, not persisted
- Use Recharts for all charts (already imported in Dashboard)
- Maintain Tailwind + Radix + CVA pattern when adding new UI components
