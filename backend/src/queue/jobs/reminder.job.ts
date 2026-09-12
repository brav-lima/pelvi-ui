export const REMINDER_QUEUE = 'reminders';

export interface ReminderJobData {
  appointmentId: string;
  patientId: string;
  professionalId: string;
  organizationId: string;
  startAt: string;
}
