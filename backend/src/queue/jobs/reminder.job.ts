export const REMINDER_QUEUE = 'reminders';

export interface ReminderJobData {
  appointmentId: string;
  patientId: string;
  organizationId: string;
  startAt: string;
}
