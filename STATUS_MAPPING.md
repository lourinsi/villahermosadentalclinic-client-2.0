# Appointment Status Mapping

This document defines the meaning of each appointment status in the Villahermosa Dental Clinic system.

## Status Definitions

### 1. **scheduled** - Confirmed
- Appointment is confirmed and scheduled.
- Shows in patient and clinic calendar views.
- Patient, doctor, or admin can view permitted actions.

### 2. **add-to-cart** - Add to Cart
- Patient has added the appointment to their cart without payment.
- Does not block clinic availability and can be overridden by a scheduled or reserved appointment.
- Shows in the patient's cart only.
- Hidden from staff request/history views.

### 3. **reserved** - Reserved
- Appointment has a partial payment or needs clinic confirmation.
- Blocks availability.
- Shows in staff Requests for approval when action is required.

### 4. **cancelled** - Cancelled
- Appointment has been cancelled.
- Stays in history/records.

### 5. **completed** - Completed
- Appointment has been completed.
- Stays in history/records.

### 6. **tbd** - TBD
- Past appointment awaiting final completion or cancellation status.

## Status Flow

```text
Patient books appointment
  Full payment     -> scheduled
  Partial payment  -> reserved -> staff approves -> scheduled
  No payment       -> add-to-cart -> patient pays -> scheduled/reserved
  Staff booking    -> reserved/scheduled
  Cancelled        -> cancelled
  Past unresolved  -> tbd
```

## Legacy Aliases

- `pending` is treated as `add-to-cart`.
- `tentative` is treated as `reserved`.
- `confirmed` is treated as `scheduled`.
