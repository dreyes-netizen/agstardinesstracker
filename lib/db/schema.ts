import {
  pgTable, serial, text, integer, numeric, date, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').unique().notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  middleName: text('middle_name'),
  department: text('department'),
  immediateSupervisor: text('immediate_supervisor'),
  approver2: text('approver2'),
  hireDate: date('hire_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const attendanceRecords = pgTable('attendance_records', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.employeeId),
  date: date('date').notNull(),
  lateMinutes: integer('late_minutes').notNull().default(0),
  undertimeMinutes: integer('undertime_minutes').notNull().default(0),
  // Daily "Total Hours Worked" (Detailed col 7). Distinguishes a present day
  // (> 0) from an absent day (0 / "NO LOGS") for the attendance score.
  // Nullable so already-imported rows (pre-feature) read as absent until re-uploaded.
  totalHoursWorked: numeric('total_hours_worked'),
  shiftType: text('shift_type'),
  shiftSchedule: text('shift_schedule'),
  actualLogs: text('actual_logs'),
  reportPeriodStart: date('report_period_start').notNull(),
  reportPeriodEnd: date('report_period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  employeeDateUniq: uniqueIndex('attendance_employee_date_idx').on(t.employeeId, t.date),
}));

export const nteRecords = pgTable('nte_records', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.employeeId),
  month: text('month').notNull(),       // "2026-06"
  status: text('status').notNull().default('required'), // 'required'|'issued'|'acknowledged'
  issuedDate: date('issued_date'),
  issuedBy: text('issued_by'),
  notes: text('notes'),
  acknowledgedDate: date('acknowledged_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  employeeMonthUniq: uniqueIndex('nte_employee_month_idx').on(t.employeeId, t.month),
}));

export const leaveRecords = pgTable('leave_records', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.employeeId),
  name: text('name'),                       // col B from the leave sheet, for display
  leaveType: text('leave_type'),            // col C — "Sick", "Vacation", …
  dateFiled: date('date_filed'),            // col D
  dateFrom: date('date_from').notNull(),    // col E
  dateTo: date('date_to').notNull(),        // col F
  withPayDays: numeric('with_pay_days').notNull().default('0'),   // col G
  woutPayDays: numeric('wout_pay_days').notNull().default('0'),   // col H
  status: text('status'),                   // col J — "Approved", "Pending …", …
  reportPeriodStart: date('report_period_start'),
  reportPeriodEnd: date('report_period_end'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  // Dedup the same leave appearing in overlapping weekly reports.
  leaveUniq: uniqueIndex('leave_uniq').on(
    t.employeeId, t.leaveType, t.dateFrom, t.dateTo, t.dateFiled,
  ),
}));

export const uploadHistory = pgTable('upload_history', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  recordCount: integer('record_count').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

export type Employee = typeof employees.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NteRecord = typeof nteRecords.$inferSelect;
export type LeaveRecord = typeof leaveRecords.$inferSelect;
