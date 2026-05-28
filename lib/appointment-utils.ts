import { Appointment } from "../hooks/useAppointments";
import { isCartAppointmentStatus } from "@/lib/appointment-status";

/**
 * Find next available appointment slot for a given doctor or across all doctors.
 * 
 * @param appointments List of appointments to check for conflicts
 * @param doctorFilter Optional doctor name to filter by
 * @returns { date: Date, time: string } Next available slot
 */
export const getNextAvailableSlot = (appointments: Appointment[], doctorFilter?: string) => {
  const appointmentsToCheck = doctorFilter 
    ? appointments.filter(apt => apt.doctor.toLowerCase() === doctorFilter.toLowerCase())
    : appointments;
  
  const searchDate = new Date();
  searchDate.setDate(searchDate.getDate() + 1); // Start from tomorrow
  const endDate = new Date(searchDate);
  endDate.setDate(endDate.getDate() + 30); // Search up to 30 days

  while (searchDate <= endDate) {
    // Skip weekends (0: Sunday, 6: Saturday)
    if (searchDate.getDay() !== 0 && searchDate.getDay() !== 6) {
      // Try each 30-minute slot from 8 AM to 5 PM
      for (let hour = 8; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const testStart = new Date(searchDate);
          testStart.setHours(hour, minute, 0, 0);
          const testEnd = new Date(testStart.getTime() + 30 * 60000); // 30 min slot

          // Check if this slot conflicts with any appointment
          let hasConflict = false;
          for (const apt of appointmentsToCheck) {
            // Skip cancelled/cart appointments as they don't block
            const status = (apt.status || "").toLowerCase();
            if (status === "cancelled" || isCartAppointmentStatus(status)) continue;
            
            let aptStart: Date;
            if (typeof apt.date === 'string' && apt.date.includes('-') && !apt.date.includes(':')) {
              const [year, month, day] = apt.date.split('-').map(Number);
              aptStart = new Date(year, month - 1, day);
            } else {
              aptStart = new Date(apt.date);
            }

            const [aptHour, aptMin] = (apt.time || '').split(':').map(Number);
            aptStart.setHours(aptHour || 0, aptMin || 0, 0, 0);
            
            const aptDurationMins = parseInt(String(apt.duration), 10) || 30;
            const aptEnd = new Date(aptStart.getTime() + aptDurationMins * 60000);

            // Check overlap
            if (testStart < aptEnd && testEnd > aptStart) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            // Found available slot!
            return {
              date: new Date(searchDate),
              time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
            };
          }
        }
      }
    }

    searchDate.setDate(searchDate.getDate() + 1);
  }

  // If no slot found, return tomorrow 8 AM anyway
  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + 1);
  return { date: fallbackDate, time: '08:00' };
};
