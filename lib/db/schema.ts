import {
  pgTable, serial, text, integer, numeric, date, timestamp, boolean, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Allowlist + roles for app access. A row here = an account permitted to sign in.
// role: 'admin' (everything, incl. upload + user management) | 'manager'
// (view + issue/acknowledge NTE). Email stored lowercased.
export const appUsers = pgTable('app_users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  role: text('role').notNull().default('manager'),
  displayName: text('display_name'),
  // Soft link to employees.employee_id (no FK on purpose — a roster re-upload
  // must not cascade-delete accounts). Name is snapshotted in display_name.
  employeeId: text('employee_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Append-only audit trail of every NTE action (who / what / when).
export const nteAuditLog = pgTable('nte_audit_log', {
  id: serial('id').primaryKey(),
  nteRecordId: integer('nte_record_id'),
  employeeId: text('employee_id').notNull(),
  month: text('month').notNull(),            // "2026-10" — grouping for the Audit Log filter
  periodStart: date('period_start'),         // the NTE period the entry belongs to
  periodEnd: date('period_end'),
  action: text('action').notNull(),          // 'issued' | 'acknowledged' | …
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

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
  // Soft exclusion: when true, this employee is hidden from the Tardiness Tracker,
  // Attendance Score, and NTE views (data is kept, not deleted). Preserved across
  // roster re-uploads — upsertEmployees deliberately never overwrites this flag.
  excludedFromTracking: boolean('excluded_from_tracking').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Department-level soft exclusion. Every employee whose department name matches a row
// here (case-insensitive, trimmed) is hidden from tracking views — the whole-group
// counterpart to employees.excluded_from_tracking. Seeded with "Do Not Delete".
export const excludedDepartments = pgTable('excluded_departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),            // stored trimmed; matched case-insensitively
  createdBy: text('created_by'),           // actor email
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({ nameUniq: uniqueIndex('excluded_dept_name_idx').on(t.name) }));

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

// Admin overlay on attendance_records.late_minutes for the tardiness/NTE views only
// (Attendance Score keeps reading the raw value). Keyed on (employee_id, date), not
// the attendance row id, because re-uploads delete and re-insert attendance rows.
// adjusted_minutes = 0 means the day is waived.
export const lateAdjustments = pgTable('late_adjustments', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.employeeId),
  date: date('date').notNull(),
  adjustedMinutes: integer('adjusted_minutes').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  employeeDateUniq: uniqueIndex('late_adj_employee_date_idx').on(t.employeeId, t.date),
  minutesNonNegative: check('late_adj_minutes_nonneg', sql`${t.adjustedMinutes} >= 0`),
}));

// One row per employee per NTE period: a Monday–Sunday week from WEEKLY_NTE_START
// (lib/utils/week.ts) on, or a full calendar month for NTEs before it.
export const nteRecords = pgTable('nte_records', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.employeeId),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  status: text('status').notNull().default('required'), // 'required'|'issued'|'acknowledged'
  issuedDate: date('issued_date'),
  issuedBy: text('issued_by'),
  notes: text('notes'),
  acknowledgedDate: date('acknowledged_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  employeePeriodUniq: uniqueIndex('nte_employee_period_idx').on(t.employeeId, t.periodStart, t.periodEnd),
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
  // Dedup the same leave appearing in overlapping weekly reports. Keyed on the
  // employee + type + span only (date_filed is nullable, and NULLs defeat a
  // unique index in Postgres — two of the same leave would slip through).
  leaveUniq: uniqueIndex('leave_uniq').on(
    t.employeeId, t.leaveType, t.dateFrom, t.dateTo,
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
export type AppUser = typeof appUsers.$inferSelect;
export type NteAuditEntry = typeof nteAuditLog.$inferSelect;
export type ExcludedDepartment = typeof excludedDepartments.$inferSelect;
export type LateAdjustment = typeof lateAdjustments.$inferSelect;
export type Role = 'admin' | 'manager';
