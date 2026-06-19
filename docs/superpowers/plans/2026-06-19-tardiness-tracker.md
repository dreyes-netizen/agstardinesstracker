# Tardiness Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js internal web app that parses Sprout attendance exports, tracks monthly tardiness per employee, and manages NTE issuance when the 6-late or 60-minute threshold is crossed.

**Architecture:** Next.js 14 App Router with Server Actions for file uploads and server components for data fetching. Neon PostgreSQL (via Drizzle ORM) stores employees, attendance records, and NTE workflow state. Excel files are parsed server-side with SheetJS.

**Tech Stack:** Next.js 14, Neon PostgreSQL, Drizzle ORM, SheetJS (xlsx), TanStack Table v8, shadcn/ui, Tailwind CSS, Vitest, Vercel

---

## File Map

```
app/
  layout.tsx               root layout — wraps every page in sidebar shell
  globals.css              design token CSS vars + Tailwind base
  page.tsx                 dashboard (/) — server component, passes data to client table
  upload/
    page.tsx               upload form page
    actions.ts             'use server' — parses files, writes to DB
  nte/
    page.tsx               NTE management list
  roster/
    page.tsx               employee roster table

components/
  layout/
    Sidebar.tsx            navy sidebar with nav links
  dashboard/
    FilterBar.tsx          month + dept + supervisor + manager selects
    StatCards.tsx          3 summary cards
    EmployeeTable.tsx      TanStack Table with status badges
    EmployeeDrawer.tsx     shadcn Sheet (slide-over) with late dates + NTE section
    NteForm.tsx            issue/acknowledge form inside drawer
  nte/
    NteTable.tsx           NTE management table with inline quick-actions
  roster/
    RosterTable.tsx        read-only employee roster table
  upload/
    UploadForm.tsx         two file pickers + submit

lib/
  db/
    schema.ts              Drizzle table definitions (4 tables)
    index.ts               Neon client + Drizzle instance
  parsers/
    attendance.ts          SheetJS parser for Sprout Detailed sheet
    roster.ts              SheetJS parser for Employee List Report
  queries/
    employees.ts           filter options + roster data
    attendance.ts          monthly stats aggregation
    nte.ts                 NTE record CRUD + upsert-required logic

__tests__/
  parsers/
    attendance.test.ts
    roster.test.ts
  utils/
    nte-status.test.ts

lib/utils/
  nte-status.ts            pure function: (lateCount, mins, dbStatus) → display status

drizzle.config.ts
vitest.config.ts
.env.local
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via create-next-app)
- Create: all Next.js boilerplate files

- [ ] **Step 1: Initialise the Next.js project**

Run in `C:\Users\D_Reyes\Desktop\Tardiness`:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*" --no-git
```
When prompted: answer **Yes** to all defaults (TypeScript ✓, ESLint ✓, Tailwind ✓, App Router ✓).

Expected: project files created (package.json, app/, etc.). The existing .xlsx files are unaffected.

- [ ] **Step 2: Install app dependencies**

```bash
npm install @neondatabase/serverless drizzle-orm xlsx @tanstack/react-table
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D drizzle-kit vitest @types/node dotenv
```

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```
Expected: `ready - started server on 0.0.0.0:3000`. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 14 project with dependencies"
```

---

## Task 2: Environment & Config Files

**Files:**
- Create: `.env.local`
- Create: `drizzle.config.ts`
- Create: `vitest.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.local`**

```
DATABASE_URL=postgresql://neondb_owner:npg_SlNFeZD4yQ9p@ep-shiny-mouse-ahajtp0p-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

- [ ] **Step 2: Ensure `.env.local` is in `.gitignore`**

Open `.gitignore`, confirm `.env.local` is listed (create-next-app adds it by default). If not present, add it.

- [ ] **Step 3: Create `drizzle.config.ts`**

```typescript
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 5: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Commit**

```bash
git add .env.local drizzle.config.ts vitest.config.ts package.json .gitignore
git commit -m "chore: add env, drizzle, and vitest config"
```

---

## Task 3: Database Schema & Client

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/index.ts`

- [ ] **Step 1: Create `lib/db/schema.ts`**

```typescript
import {
  pgTable, serial, text, integer, date, timestamp, uniqueIndex,
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
```

- [ ] **Step 2: Create `lib/db/index.ts`**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add database schema and Neon client"
```

---

## Task 4: Push Schema to Neon

**Files:** None (runs migration against live DB)

- [ ] **Step 1: Push schema**

```bash
npx drizzle-kit push
```

Expected output:
```
[✓] Changes applied:
  - Created table employees
  - Created table attendance_records
  - Created table nte_records
  - Created table upload_history
```

- [ ] **Step 2: Verify in Neon console**

Open Neon dashboard → Tables. Confirm all 4 tables exist with correct columns.

---

## Task 5: NTE Status Utility (TDD)

**Files:**
- Create: `lib/utils/nte-status.ts`
- Create: `__tests__/utils/nte-status.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/utils/nte-status.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeNteStatus } from '@/lib/utils/nte-status';

describe('computeNteStatus', () => {
  it('returns safe when count < 4 and minutes < 45', () => {
    expect(computeNteStatus(0, 0, null)).toBe('safe');
    expect(computeNteStatus(3, 44, null)).toBe('safe');
  });

  it('returns warning when count is 4-5', () => {
    expect(computeNteStatus(4, 10, null)).toBe('warning');
    expect(computeNteStatus(5, 10, null)).toBe('warning');
  });

  it('returns warning when minutes are 45-59', () => {
    expect(computeNteStatus(1, 45, null)).toBe('warning');
    expect(computeNteStatus(1, 59, null)).toBe('warning');
  });

  it('returns required when count >= 6', () => {
    expect(computeNteStatus(6, 0, null)).toBe('required');
    expect(computeNteStatus(7, 100, null)).toBe('required');
  });

  it('returns required when minutes >= 60', () => {
    expect(computeNteStatus(1, 60, null)).toBe('required');
    expect(computeNteStatus(2, 75, null)).toBe('required');
  });

  it('returns issued when db status is issued (regardless of counts)', () => {
    expect(computeNteStatus(6, 65, 'issued')).toBe('issued');
  });

  it('returns acknowledged when db status is acknowledged', () => {
    expect(computeNteStatus(6, 65, 'acknowledged')).toBe('acknowledged');
  });

  it('db status required is treated same as computed required', () => {
    expect(computeNteStatus(6, 0, 'required')).toBe('required');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — `computeNteStatus` is not defined.

- [ ] **Step 3: Implement `lib/utils/nte-status.ts`**

```typescript
export type NteDbStatus = 'required' | 'issued' | 'acknowledged' | null;
export type NteStatus = 'safe' | 'warning' | 'required' | 'issued' | 'acknowledged';

export function computeNteStatus(
  lateCount: number,
  accumulatedMinutes: number,
  dbStatus: NteDbStatus,
): NteStatus {
  if (dbStatus === 'acknowledged') return 'acknowledged';
  if (dbStatus === 'issued') return 'issued';
  if (lateCount >= 6 || accumulatedMinutes >= 60) return 'required';
  if (lateCount >= 4 || accumulatedMinutes >= 45) return 'warning';
  return 'safe';
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/ __tests__/utils/
git commit -m "feat: add NTE status utility with tests"
```

---

## Task 6: Attendance Parser (TDD)

**Files:**
- Create: `lib/parsers/attendance.ts`
- Create: `__tests__/parsers/attendance.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/parsers/attendance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAttendanceSheet } from '@/lib/parsers/attendance';

function buildTestBuffer(): Buffer {
  const data: (string | number | Date | null)[][] = [
    // Employee 1 block
    ['Date:', '2026-06-01 - 2026-06-15'],
    [null],
    ['Name:', 'Aban, Ma. Melanie Pombo'],
    ['ID Number:', '25358'],
    ['Days Present:', 11],
    ['Days Absent:', 0],
    ['Date', 'Day', 'Shift Type', 'Shift', 'Biologs', 'Late', 'Undertime', 'Hrs', 'Total'],
    [new Date('2026-06-01'), 'Mon', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:09 PM TO 06:06 AM', 9, 0, 7.85, 8.95],
    [new Date('2026-06-02'), 'Tue', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:00 PM TO 06:00 AM', 0, 0, 9, 9],
    [new Date('2026-06-03'), 'Wed', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:02 PM TO 06:02 AM', 2, 0, 8.97, 8.97],
    [null, 'Sat', '', 'REST DAY', '', 0, 0, 0, 0],
    [null, 'Totals', '', '', '', 11, 0, 80.82, 100.8],
    [null], [null],
    // Employee 2 block
    ['Date:', '2026-06-01 - 2026-06-15'],
    [null],
    ['Name:', 'Ado, Jaypee Dhan Juayong'],
    ['ID Number:', '25369'],
    ['Days Present:', 11],
    ['Days Absent:', 0],
    ['Date', 'Day', 'Shift Type', 'Shift', 'Biologs', 'Late', 'Undertime', 'Hrs', 'Total'],
    [new Date('2026-06-01'), 'Mon', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:00 PM TO 06:00 AM', 0, 0, 9, 9],
    [new Date('2026-06-11'), 'Thu', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:03 PM TO 06:03 AM', 3, 0, 8.95, 8.95],
    [null, 'Totals', '', '', '', 3, 0, 80.95, 101.63],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detailed');
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('parseAttendanceSheet', () => {
  it('throws if Detailed sheet is missing', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(() => parseAttendanceSheet(buf)).toThrow('Sheet "Detailed" not found');
  });

  it('extracts the report period', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    expect(result.periodStart).toBe('2026-06-01');
    expect(result.periodEnd).toBe('2026-06-15');
  });

  it('counts employees correctly', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    expect(result.employeeCount).toBe(2);
  });

  it('parses daily records for employee 25358 (skips REST DAY and Totals rows)', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    const records = result.records.filter(r => r.employeeId === '25358');
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ date: '2026-06-01', lateMinutes: 9 });
    expect(records[1]).toMatchObject({ date: '2026-06-02', lateMinutes: 0 });
    expect(records[2]).toMatchObject({ date: '2026-06-03', lateMinutes: 2 });
  });

  it('parses daily records for employee 25369', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    const records = result.records.filter(r => r.employeeId === '25369');
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ date: '2026-06-11', lateMinutes: 3 });
  });

  it('stamps reportPeriodStart/End on every record', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    for (const r of result.records) {
      expect(r.reportPeriodStart).toBe('2026-06-01');
      expect(r.reportPeriodEnd).toBe('2026-06-15');
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — `parseAttendanceSheet` is not defined.

- [ ] **Step 3: Implement `lib/parsers/attendance.ts`**

```typescript
import * as XLSX from 'xlsx';

export interface ParsedAttendanceRecord {
  employeeId: string;
  date: string;           // YYYY-MM-DD
  lateMinutes: number;
  undertimeMinutes: number;
  shiftType: string;
  shiftSchedule: string;
  actualLogs: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
}

export interface AttendanceParseResult {
  periodStart: string;
  periodEnd: string;
  records: ParsedAttendanceRecord[];
  employeeCount: number;
}

const DAY_ABBREVS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

function isDateLike(val: unknown): val is Date | number {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') return val > 40000 && val < 60000;
  return false;
}

function toISODate(val: Date | number): string {
  let d: Date;
  if (val instanceof Date) {
    // Compensate for timezone shift that occurs when XLSX converts serial → Date
    d = new Date(val.getTime() + val.getTimezoneOffset() * 60000);
  } else {
    // Excel serial → JS Date (accounts for Lotus 1-2-3 bug at 60)
    d = new Date((val - 25569) * 86400 * 1000);
  }
  return d.toISOString().split('T')[0];
}

function parsePeriod(val: unknown): { start: string; end: string } | null {
  if (typeof val !== 'string') return null;
  const m = val.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  return m ? { start: m[1], end: m[2] } : null;
}

export function parseAttendanceSheet(buffer: Buffer): AttendanceParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets['Detailed'];
  if (!sheet) throw new Error('Sheet "Detailed" not found in workbook');

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  let periodStart = '';
  let periodEnd = '';
  let currentEmployeeId = '';
  const seenEmployees = new Set<string>();
  const records: ParsedAttendanceRecord[] = [];

  for (const row of rows) {
    const col0 = row[0] != null ? String(row[0]).trim() : '';

    if (col0 === 'Date:') {
      const p = parsePeriod(row[1]);
      if (p && !periodStart) { periodStart = p.start; periodEnd = p.end; }
      continue;
    }

    if (col0 === 'ID Number:') {
      currentEmployeeId = row[1] != null ? String(row[1]).trim() : '';
      if (currentEmployeeId) seenEmployees.add(currentEmployeeId);
      continue;
    }

    if (!currentEmployeeId) continue;
    if (!isDateLike(row[0])) continue;
    const dayStr = row[1] != null ? String(row[1]).trim() : '';
    if (!DAY_ABBREVS.has(dayStr)) continue;

    const shiftSchedule = row[3] != null ? String(row[3]) : '';
    if (shiftSchedule.toUpperCase().includes('REST DAY')) continue;

    records.push({
      employeeId: currentEmployeeId,
      date: toISODate(row[0] as Date | number),
      lateMinutes: typeof row[5] === 'number' ? Math.round(row[5]) : 0,
      undertimeMinutes: typeof row[6] === 'number' ? Math.round(row[6]) : 0,
      shiftType: row[2] != null ? String(row[2]) : '',
      shiftSchedule,
      actualLogs: row[4] != null ? String(row[4]) : '',
      reportPeriodStart: periodStart,
      reportPeriodEnd: periodEnd,
    });
  }

  if (!periodStart) throw new Error('Could not detect report period from file');
  return { periodStart, periodEnd, records, employeeCount: seenEmployees.size };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS — 6 tests in attendance.test.ts.

- [ ] **Step 5: Commit**

```bash
git add lib/parsers/attendance.ts __tests__/parsers/attendance.test.ts
git commit -m "feat: attendance parser with tests"
```

---

## Task 7: Roster Parser (TDD)

**Files:**
- Create: `lib/parsers/roster.ts`
- Create: `__tests__/parsers/roster.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/parsers/roster.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRosterSheet } from '@/lib/parsers/roster';

function buildRosterBuffer(): Buffer {
  const data = [
    ['Employee ID', 'Last Name', 'Middle Name', 'First Name', 'Department', 'Immediate Supervisor', 'Approver 2', 'Approver 3', 'Approver 4', 'Approver 5', 'Hire Date'],
    ['25358', 'Aban', 'Pombo', 'Ma. Melanie', 'Flyland Recovery', 'Roxanne Reyes', 'Mark Dwane Laurente', 'N/A', 'N/A', 'N/A', '2020-01-15'],
    ['25369', 'Ado', 'Juayong', 'Jaypee Dhan', 'Flyland Recovery', 'Roxanne Reyes', 'Mark Dwane Laurente', 'N/A', 'N/A', 'N/A', null],
    ['24229', 'Budol', 'Aquino', 'Arjay', 'Fundward', 'Carl Stephen Paolo Ong', 'Djanisse Toledo', 'N/A', 'N/A', 'N/A', '2019-03-10'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employee List Report');
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('parseRosterSheet', () => {
  it('returns one employee per data row (skips header)', () => {
    const employees = parseRosterSheet(buildRosterBuffer());
    expect(employees).toHaveLength(3);
  });

  it('maps columns to correct fields', () => {
    const [emp] = parseRosterSheet(buildRosterBuffer());
    expect(emp).toMatchObject({
      employeeId: '25358',
      lastName: 'Aban',
      middleName: 'Pombo',
      firstName: 'Ma. Melanie',
      department: 'Flyland Recovery',
      immediateSupervisor: 'Roxanne Reyes',
      approver2: 'Mark Dwane Laurente',
    });
  });

  it('parses a valid hire date', () => {
    const [emp] = parseRosterSheet(buildRosterBuffer());
    expect(emp.hireDate).toBe('2020-01-15');
  });

  it('returns null hireDate when cell is empty', () => {
    const employees = parseRosterSheet(buildRosterBuffer());
    expect(employees[1].hireDate).toBeNull();
  });

  it('skips rows with no employee ID', () => {
    const data = [
      ['Employee ID', 'Last Name', 'Middle Name', 'First Name', 'Department', 'Immediate Supervisor', 'Approver 2'],
      [null, 'Nobody', '', 'Empty', 'Dept', 'Sup', 'Mgr'],
      ['99999', 'Valid', '', 'Employee', 'Dept', 'Sup', 'Mgr'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee List Report');
    const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    const employees = parseRosterSheet(buf);
    expect(employees).toHaveLength(1);
    expect(employees[0].employeeId).toBe('99999');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — `parseRosterSheet` is not defined.

- [ ] **Step 3: Implement `lib/parsers/roster.ts`**

```typescript
import * as XLSX from 'xlsx';

export interface ParsedEmployee {
  employeeId: string;
  lastName: string;
  middleName: string;
  firstName: string;
  department: string;
  immediateSupervisor: string;
  approver2: string;
  hireDate: string | null; // YYYY-MM-DD or null
}

function parseHireDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = new Date(val.getTime() + val.getTimezoneOffset() * 60000);
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str || str === 'N/A') return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

export function parseRosterSheet(buffer: Buffer): ParsedEmployee[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes('employee')) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error('No employee sheet found in roster file');

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const employees: ParsedEmployee[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const employeeId = row[0] != null ? String(row[0]).trim() : '';
    if (!employeeId) continue;

    employees.push({
      employeeId,
      lastName: row[1] != null ? String(row[1]).trim() : '',
      middleName: row[2] != null ? String(row[2]).trim() : '',
      firstName: row[3] != null ? String(row[3]).trim() : '',
      department: row[4] != null ? String(row[4]).trim() : '',
      immediateSupervisor: row[5] != null ? String(row[5]).trim() : '',
      approver2: row[6] != null ? String(row[6]).trim() : '',
      hireDate: parseHireDate(row[10]),
    });
  }

  return employees;
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: PASS — all tests in all 3 test files.

- [ ] **Step 5: Commit**

```bash
git add lib/parsers/roster.ts __tests__/parsers/roster.test.ts
git commit -m "feat: roster parser with tests"
```

---

## Task 8: Database Queries

**Files:**
- Create: `lib/queries/employees.ts`
- Create: `lib/queries/attendance.ts`
- Create: `lib/queries/nte.ts`

- [ ] **Step 1: Create `lib/queries/employees.ts`**

```typescript
import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function getAllEmployees() {
  return db.select().from(employees).orderBy(asc(employees.lastName));
}

export async function getFilterOptions() {
  const rows = await db
    .selectDistinct({
      department: employees.department,
      immediateSupervisor: employees.immediateSupervisor,
      approver2: employees.approver2,
    })
    .from(employees)
    .orderBy(asc(employees.department));

  const departments = [...new Set(rows.map((r) => r.department).filter(Boolean))] as string[];
  const supervisors = [...new Set(rows.map((r) => r.immediateSupervisor).filter(Boolean))] as string[];
  const managers = [...new Set(rows.map((r) => r.approver2).filter(Boolean))] as string[];

  return { departments, supervisors, managers };
}

export async function upsertEmployees(
  parsed: {
    employeeId: string;
    firstName: string;
    lastName: string;
    middleName: string;
    department: string;
    immediateSupervisor: string;
    approver2: string;
    hireDate: string | null;
  }[],
) {
  if (parsed.length === 0) return 0;
  for (const emp of parsed) {
    await db
      .insert(employees)
      .values({
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        middleName: emp.middleName || null,
        department: emp.department || null,
        immediateSupervisor: emp.immediateSupervisor || null,
        approver2: emp.approver2 || null,
        hireDate: emp.hireDate,
      })
      .onConflictDoUpdate({
        target: employees.employeeId,
        set: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          middleName: emp.middleName || null,
          department: emp.department || null,
          immediateSupervisor: emp.immediateSupervisor || null,
          approver2: emp.approver2 || null,
          hireDate: emp.hireDate,
          updatedAt: new Date(),
        },
      });
  }
  return parsed.length;
}
```

- [ ] **Step 2: Create `lib/queries/attendance.ts`**

```typescript
import { db } from '@/lib/db';
import { attendanceRecords, employees, nteRecords, uploadHistory } from '@/lib/db/schema';
import { and, eq, sql, inArray } from 'drizzle-orm';
import { computeNteStatus, NteStatus } from '@/lib/utils/nte-status';

export interface EmployeeMonthlyStats {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  department: string | null;
  immediateSupervisor: string | null;
  approver2: string | null;
  lateCount: number;
  accumulatedMinutes: number;
  nteStatus: NteStatus;
  nteRecordId: number | null;
  issuedDate: string | null;
  issuedBy: string | null;
  acknowledgedDate: string | null;
}

export interface DashboardFilters {
  year: number;
  month: number;       // 1-12
  department?: string;
  immediateSupervisor?: string;
  approver2?: string;
}

export async function getMonthlyStats(filters: DashboardFilters): Promise<EmployeeMonthlyStats[]> {
  const monthStr = `${filters.year}-${String(filters.month).padStart(2, '0')}`;

  const rows = await db.execute(sql`
    SELECT
      e.employee_id,
      e.first_name,
      e.last_name,
      e.middle_name,
      e.department,
      e.immediate_supervisor,
      e.approver2,
      COUNT(CASE WHEN a.late_minutes > 0 THEN 1 END)::int AS late_count,
      COALESCE(SUM(a.late_minutes), 0)::int AS accumulated_minutes,
      n.id AS nte_record_id,
      n.status AS nte_db_status,
      n.issued_date,
      n.issued_by,
      n.acknowledged_date
    FROM employees e
    LEFT JOIN attendance_records a
      ON e.employee_id = a.employee_id
      AND EXTRACT(YEAR FROM a.date::date) = ${filters.year}
      AND EXTRACT(MONTH FROM a.date::date) = ${filters.month}
    LEFT JOIN nte_records n
      ON e.employee_id = n.employee_id
      AND n.month = ${monthStr}
    WHERE
      (${filters.department ?? null} IS NULL OR e.department = ${filters.department ?? null})
      AND (${filters.immediateSupervisor ?? null} IS NULL OR e.immediate_supervisor = ${filters.immediateSupervisor ?? null})
      AND (${filters.approver2 ?? null} IS NULL OR e.approver2 = ${filters.approver2 ?? null})
    GROUP BY e.employee_id, e.first_name, e.last_name, e.middle_name,
             e.department, e.immediate_supervisor, e.approver2,
             n.id, n.status, n.issued_date, n.issued_by, n.acknowledged_date
    ORDER BY
      CASE n.status
        WHEN 'required' THEN 1
        WHEN 'issued'   THEN 2
        ELSE 3
      END,
      late_count DESC
  `);

  return (rows.rows as Record<string, unknown>[]).map((row) => {
    const lateCount = Number(row.late_count) || 0;
    const accumulatedMinutes = Number(row.accumulated_minutes) || 0;
    const dbStatus = (row.nte_db_status as 'required' | 'issued' | 'acknowledged' | null) ?? null;

    return {
      employeeId: String(row.employee_id),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      middleName: row.middle_name ? String(row.middle_name) : null,
      department: row.department ? String(row.department) : null,
      immediateSupervisor: row.immediate_supervisor ? String(row.immediate_supervisor) : null,
      approver2: row.approver2 ? String(row.approver2) : null,
      lateCount,
      accumulatedMinutes,
      nteStatus: computeNteStatus(lateCount, accumulatedMinutes, dbStatus),
      nteRecordId: row.nte_record_id ? Number(row.nte_record_id) : null,
      issuedDate: row.issued_date ? String(row.issued_date) : null,
      issuedBy: row.issued_by ? String(row.issued_by) : null,
      acknowledgedDate: row.acknowledged_date ? String(row.acknowledged_date) : null,
    };
  });
}

export async function getEmployeeLateRecords(employeeId: string, year: number, month: number) {
  return db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employeeId),
        sql`EXTRACT(YEAR FROM ${attendanceRecords.date}::date) = ${year}`,
        sql`EXTRACT(MONTH FROM ${attendanceRecords.date}::date) = ${month}`,
        sql`${attendanceRecords.lateMinutes} > 0`,
      ),
    )
    .orderBy(attendanceRecords.date);
}

export async function replaceAttendancePeriod(
  periodStart: string,
  periodEnd: string,
  records: {
    employeeId: string;
    date: string;
    lateMinutes: number;
    undertimeMinutes: number;
    shiftType: string;
    shiftSchedule: string;
    actualLogs: string;
  }[],
) {
  // Delete existing records for this period
  await db
    .delete(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.reportPeriodStart, periodStart),
        eq(attendanceRecords.reportPeriodEnd, periodEnd),
      ),
    );

  // Insert new records
  if (records.length > 0) {
    await db.insert(attendanceRecords).values(
      records.map((r) => ({
        employeeId: r.employeeId,
        date: r.date,
        lateMinutes: r.lateMinutes,
        undertimeMinutes: r.undertimeMinutes,
        shiftType: r.shiftType || null,
        shiftSchedule: r.shiftSchedule || null,
        actualLogs: r.actualLogs || null,
        reportPeriodStart: periodStart,
        reportPeriodEnd: periodEnd,
      })),
    );
  }

  return records.length;
}

export async function recordUpload(
  filename: string,
  periodStart: string,
  periodEnd: string,
  recordCount: number,
) {
  await db.insert(uploadHistory).values({ filename, periodStart, periodEnd, recordCount });
}

export async function getDashboardStats(year: number, month: number) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN n.status = 'required' THEN 1 END)::int AS nte_required,
      COUNT(CASE WHEN n.status = 'issued' THEN 1 END)::int AS nte_issued,
      COUNT(CASE WHEN
        (SELECT SUM(a2.late_minutes) FROM attendance_records a2
         WHERE a2.employee_id = e.employee_id
           AND EXTRACT(YEAR FROM a2.date::date) = ${year}
           AND EXTRACT(MONTH FROM a2.date::date) = ${month}
        ) >= 45
        AND n.status IS NULL THEN 1 END
      )::int AS approaching,
      (SELECT COUNT(*) FROM attendance_records a3
       WHERE EXTRACT(YEAR FROM a3.date::date) = ${year}
         AND EXTRACT(MONTH FROM a3.date::date) = ${month}
         AND a3.late_minutes > 0
      )::int AS total_incidents
    FROM employees e
    LEFT JOIN nte_records n ON e.employee_id = n.employee_id AND n.month = ${monthStr}
  `);
  const row = (rows.rows as Record<string, unknown>[])[0] ?? {};
  return {
    nteRequired: Number(row.nte_required) || 0,
    nteIssued: Number(row.nte_issued) || 0,
    approaching: Number(row.approaching) || 0,
    totalIncidents: Number(row.total_incidents) || 0,
  };
}
```

- [ ] **Step 3: Create `lib/queries/nte.ts`**

```typescript
import { db } from '@/lib/db';
import { nteRecords, attendanceRecords, employees } from '@/lib/db/schema';
import { and, eq, inArray, sql, asc } from 'drizzle-orm';

export async function upsertNteRequired(employeeId: string, month: string) {
  await db
    .insert(nteRecords)
    .values({ employeeId, month, status: 'required' })
    .onConflictDoNothing();
}

export async function issueNte(
  employeeId: string,
  month: string,
  issuedBy: string,
  notes: string,
) {
  await db
    .insert(nteRecords)
    .values({ employeeId, month, status: 'issued', issuedBy, notes, issuedDate: new Date().toISOString().split('T')[0] })
    .onConflictDoUpdate({
      target: [nteRecords.employeeId, nteRecords.month],
      set: {
        status: 'issued',
        issuedBy,
        notes,
        issuedDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      },
    });
}

export async function acknowledgeNte(employeeId: string, month: string) {
  await db
    .update(nteRecords)
    .set({ status: 'acknowledged', acknowledgedDate: new Date().toISOString().split('T')[0], updatedAt: new Date() })
    .where(and(eq(nteRecords.employeeId, employeeId), eq(nteRecords.month, month)));
}

export async function getNteList() {
  const rows = await db.execute(sql`
    SELECT
      n.id,
      n.employee_id,
      e.first_name,
      e.last_name,
      e.department,
      e.immediate_supervisor,
      e.approver2,
      n.month,
      n.status,
      n.issued_date,
      n.issued_by,
      n.notes,
      n.acknowledged_date,
      COUNT(CASE WHEN a.late_minutes > 0 THEN 1 END)::int AS late_count,
      COALESCE(SUM(a.late_minutes), 0)::int AS accumulated_minutes
    FROM nte_records n
    JOIN employees e ON n.employee_id = e.employee_id
    LEFT JOIN attendance_records a
      ON n.employee_id = a.employee_id
      AND TO_CHAR(a.date::date, 'YYYY-MM') = n.month
    WHERE n.status IN ('required', 'issued')
    GROUP BY n.id, n.employee_id, e.first_name, e.last_name,
             e.department, e.immediate_supervisor, e.approver2,
             n.month, n.status, n.issued_date, n.issued_by, n.notes, n.acknowledged_date
    ORDER BY n.month DESC, e.last_name ASC
  `);
  return rows.rows as Record<string, unknown>[];
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/queries/
git commit -m "feat: database queries for employees, attendance, and NTE"
```

---

## Task 9: Tailwind Config & App Shell

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Create: `components/layout/Sidebar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `tailwind.config.ts`**

Replace the content with:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ground:   '#EDF0F4',
        navy:     '#1A2332',
        'app-text': '#1E2330',
        amber:    '#E8900A',
        'app-blue': '#2155CD',
        'nte-red':  '#C8320A',
        'safe-green': '#1A7A4A',
        muted:    '#6B7A90',
        border:   '#CDD4DC',
      },
      fontFamily: {
        mono: ["'Cascadia Code'", "'Fira Mono'", 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Update `app/globals.css`**

Replace the content with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #EDF0F4;
  --foreground: #1E2330;
}

body {
  background: var(--background);
  color: var(--foreground);
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 3: Create `components/layout/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/',        label: 'Dashboard',       icon: '▦' },
  { href: '/nte',     label: 'NTE Management',  icon: '⚑' },
  { href: '/roster',  label: 'Roster',          icon: '☰' },
  { href: '/upload',  label: 'Upload Report',   icon: '↑' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] bg-navy flex flex-col flex-shrink-0 h-screen sticky top-0">
      <div className="px-5 py-[22px] border-b border-white/[0.07]">
        <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/35 mb-1">
          AGS Internal
        </p>
        <p className="text-[15px] font-semibold text-white tracking-tight">
          Tardiness Tracker
        </p>
      </div>

      <nav className="flex-1 px-2.5 py-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-[13px] transition-colors ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/55 hover:bg-white/[0.07] hover:text-white/85'
              }`}
            >
              <span className="w-4 text-center opacity-80">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <Link
          href="/upload"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber text-white rounded-[5px] text-[12.5px] font-semibold hover:bg-amber/90 transition-colors"
        >
          ↑ Upload Report
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'Tardiness Tracker — AGS',
  description: 'AGS internal tardiness tracking and NTE management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-ground">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Start dev server and verify sidebar renders**

```bash
npm run dev
```
Open `http://localhost:3000`. Expected: navy sidebar on the left with nav links and amber "Upload Report" button.

- [ ] **Step 6: Commit**

```bash
git add app/ components/layout/ tailwind.config.ts
git commit -m "feat: app shell with sidebar navigation"
```

---

## Task 10: shadcn/ui Setup

**Files:**
- Create: `components/ui/` (auto-generated by shadcn)
- Create: `components.json`

- [ ] **Step 1: Initialise shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

- [ ] **Step 2: Add required components**

```bash
npx shadcn@latest add button input label select sheet badge table
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/ components.json
git commit -m "chore: add shadcn/ui components"
```

---

## Task 11: Upload Page

**Files:**
- Create: `app/upload/actions.ts`
- Create: `components/upload/UploadForm.tsx`
- Create: `app/upload/page.tsx`

- [ ] **Step 1: Create `app/upload/actions.ts`**

```typescript
'use server';

import { parseAttendanceSheet } from '@/lib/parsers/attendance';
import { parseRosterSheet } from '@/lib/parsers/roster';
import { upsertEmployees } from '@/lib/queries/employees';
import { replaceAttendancePeriod, recordUpload } from '@/lib/queries/attendance';

export interface UploadResult {
  success: boolean;
  attendanceSummary?: { period: string; employees: number; records: number };
  rosterSummary?: { employees: number };
  error?: string;
}

export async function uploadFiles(formData: FormData): Promise<UploadResult> {
  try {
    const attendanceFile = formData.get('attendance') as File | null;
    const rosterFile = formData.get('roster') as File | null;

    let attendanceSummary: UploadResult['attendanceSummary'];
    let rosterSummary: UploadResult['rosterSummary'];

    if (rosterFile && rosterFile.size > 0) {
      const buffer = Buffer.from(await rosterFile.arrayBuffer());
      const parsed = parseRosterSheet(buffer);
      await upsertEmployees(parsed);
      rosterSummary = { employees: parsed.length };
    }

    if (attendanceFile && attendanceFile.size > 0) {
      const buffer = Buffer.from(await attendanceFile.arrayBuffer());
      const result = parseAttendanceSheet(buffer);

      // Upsert any employees found in attendance that aren't in the roster yet
      const minimalEmployees = [...new Set(result.records.map(r => r.employeeId))].map(id => ({
        employeeId: id,
        firstName: '',
        lastName: id,
        middleName: '',
        department: '',
        immediateSupervisor: '',
        approver2: '',
        hireDate: null,
      }));
      await upsertEmployees(minimalEmployees);

      const count = await replaceAttendancePeriod(
        result.periodStart,
        result.periodEnd,
        result.records,
      );
      await recordUpload(attendanceFile.name, result.periodStart, result.periodEnd, count);

      attendanceSummary = {
        period: `${result.periodStart} to ${result.periodEnd}`,
        employees: result.employeeCount,
        records: count,
      };
    }

    return { success: true, attendanceSummary, rosterSummary };
  } catch (err) {
    console.error('Upload error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}
```

- [ ] **Step 2: Create `components/upload/UploadForm.tsx`**

```tsx
'use client';

import { useState, useRef } from 'react';
import { uploadFiles, UploadResult } from '@/app/upload/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function UploadForm() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await uploadFiles(formData);
    setResult(res);
    setLoading(false);
    if (res.success) formRef.current?.reset();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="roster" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          Employee Roster (.xls)
        </Label>
        <input
          id="roster"
          name="roster"
          type="file"
          accept=".xls,.xlsx"
          className="block w-full text-[13px] text-app-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-navy file:text-white hover:file:bg-navy/90 cursor-pointer"
        />
        <p className="text-[11.5px] text-muted">
          Upload to add or update the employee list. File from Sprout: Employee List Report.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="attendance" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          Attendance Report (.xlsx)
        </Label>
        <input
          id="attendance"
          name="attendance"
          type="file"
          accept=".xls,.xlsx"
          className="block w-full text-[13px] text-app-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-navy file:text-white hover:file:bg-navy/90 cursor-pointer"
        />
        <p className="text-[11.5px] text-muted">
          Upload to replace attendance records for the detected period. File from Sprout: Attendance Report (Detailed sheet).
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="bg-navy hover:bg-navy/90 text-white px-6"
      >
        {loading ? 'Uploading…' : 'Upload Files'}
      </Button>

      {result && (
        <div className={`rounded-[5px] border p-4 text-[13px] ${result.success ? 'border-safe-green/30 bg-safe-green/[0.06] text-safe-green' : 'border-nte-red/30 bg-nte-red/[0.06] text-nte-red'}`}>
          {result.success ? (
            <div className="space-y-1">
              <p className="font-semibold">Upload complete</p>
              {result.rosterSummary && (
                <p>Roster: {result.rosterSummary.employees} employees updated</p>
              )}
              {result.attendanceSummary && (
                <p>
                  Attendance: {result.attendanceSummary.records} records imported for{' '}
                  {result.attendanceSummary.employees} employees ({result.attendanceSummary.period})
                </p>
              )}
            </div>
          ) : (
            <p><span className="font-semibold">Error:</span> {result.error}</p>
          )}
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Create `app/upload/page.tsx`**

```tsx
import { UploadForm } from '@/components/upload/UploadForm';

export default function UploadPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted mb-1">
          Upload
        </p>
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">
          Import reports
        </h1>
        <p className="text-[14px] text-muted mt-1.5">
          Upload your Sprout exports to update attendance records and the employee roster.
        </p>
      </div>

      <div className="bg-white rounded-[7px] border border-border p-6">
        <UploadForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Test upload page in browser**

```bash
npm run dev
```
Open `http://localhost:3000/upload`. Upload the `AttendanceReport(06012026-06152026).xlsx` and `Employee list report - 2026-06-18-22_28.xls` files together. Expected: success message with record count.

- [ ] **Step 5: Commit**

```bash
git add app/upload/ components/upload/
git commit -m "feat: upload page with server actions for Excel parsing"
```

---

## Task 12: Dashboard Filter Bar & Stat Cards

**Files:**
- Create: `components/dashboard/FilterBar.tsx`
- Create: `components/dashboard/StatCards.tsx`

- [ ] **Step 1: Create `components/dashboard/FilterBar.tsx`**

```tsx
'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface FilterBarProps {
  year: number;
  month: number;
  departments: string[];
  supervisors: string[];
  managers: string[];
  selectedDept?: string;
  selectedSupervisor?: string;
  selectedManager?: string;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function FilterBar({
  year, month, departments, supervisors, managers,
  selectedDept, selectedSupervisor, selectedManager,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleMonthChange = (value: string) => {
    const [y, m] = value.split('-');
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', y);
    params.set('month', m);
    router.push(`${pathname}?${params.toString()}`);
  };

  const currentMonthValue = `${year}-${String(month).padStart(2, '0')}`;

  // Build list of available months (last 12 months)
  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthOptions.push({ value: val, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }

  return (
    <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-6 flex-wrap">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-2">
        {MONTHS[month - 1]} {year}
      </h1>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Period</span>
        <select
          value={currentMonthValue}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus:ring-2 focus:ring-app-blue/40"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Dept</span>
        <select
          value={selectedDept ?? ''}
          onChange={(e) => updateParam('dept', e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus:ring-2 focus:ring-app-blue/40"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Supervisor</span>
        <select
          value={selectedSupervisor ?? ''}
          onChange={(e) => updateParam('supervisor', e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus:ring-2 focus:ring-app-blue/40"
        >
          <option value="">All Supervisors</option>
          {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Manager</span>
        <select
          value={selectedManager ?? ''}
          onChange={(e) => updateParam('manager', e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus:ring-2 focus:ring-app-blue/40"
        >
          <option value="">All Managers</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/dashboard/StatCards.tsx`**

```tsx
interface StatCardsProps {
  nteRequired: number;
  approaching: number;
  totalIncidents: number;
}

export function StatCards({ nteRequired, approaching, totalIncidents }: StatCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3.5">
      <div className="bg-white border border-border border-l-[3px] border-l-nte-red rounded-[7px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted mb-1.5">
          NTE Required
        </p>
        <p className="text-[32px] font-bold text-nte-red leading-none tracking-tight">
          {nteRequired}
        </p>
        <p className="text-[11.5px] text-muted mt-1.5">
          Crossed 6 lates or 60 min this month
        </p>
      </div>

      <div className="bg-white border border-border border-l-[3px] border-l-amber rounded-[7px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted mb-1.5">
          Approaching Threshold
        </p>
        <p className="text-[32px] font-bold text-amber leading-none tracking-tight"
           style={{ color: '#B86D00' }}>
          {approaching}
        </p>
        <p className="text-[11.5px] text-muted mt-1.5">
          4–5 lates or 45–59 min accumulated
        </p>
      </div>

      <div className="bg-white border border-border border-l-[3px] border-l-app-blue rounded-[7px] px-5 py-[18px]">
        <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted mb-1.5">
          Total Late Incidents
        </p>
        <p className="text-[32px] font-bold text-app-text leading-none tracking-tight">
          {totalIncidents}
        </p>
        <p className="text-[11.5px] text-muted mt-1.5">
          Across all employees this month
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/FilterBar.tsx components/dashboard/StatCards.tsx
git commit -m "feat: dashboard filter bar and stat cards"
```

---

## Task 13: Employee Table

**Files:**
- Create: `components/dashboard/StatusBadge.tsx`
- Create: `components/dashboard/EmployeeTable.tsx`

- [ ] **Step 1: Create `components/dashboard/StatusBadge.tsx`**

```tsx
import { NteStatus } from '@/lib/utils/nte-status';

const config: Record<NteStatus, { label: string; className: string }> = {
  safe:         { label: 'Safe',         className: 'bg-safe-green/10 text-safe-green rounded-[3px]' },
  warning:      { label: 'Warning',      className: 'bg-amber/10 text-amber rounded-[3px]' },
  required:     { label: 'NTE Required', className: 'bg-nte-red/12 text-nte-red rounded-[2px]' },
  issued:       { label: 'NTE Issued',   className: 'bg-app-blue/10 text-app-blue rounded-[3px]' },
  acknowledged: { label: 'Acknowledged', className: 'bg-muted/10 text-muted rounded-[3px]' },
};

const dotColor: Record<NteStatus, string> = {
  safe:         'bg-safe-green',
  warning:      'bg-amber',
  required:     'bg-nte-red',
  issued:       'bg-app-blue',
  acknowledged: 'bg-muted',
};

export function StatusBadge({ status }: { status: NteStatus }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold tracking-[0.03em] ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[status]}`} />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create `components/dashboard/EmployeeTable.tsx`**

```tsx
'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { EmployeeMonthlyStats } from '@/lib/queries/attendance';
import { StatusBadge } from './StatusBadge';
import { EmployeeDrawer } from './EmployeeDrawer';

const col = createColumnHelper<EmployeeMonthlyStats>();

const columns = [
  col.accessor('employeeId', {
    header: 'Employee ID',
    cell: (info) => (
      <span className="font-mono text-[12px]">{info.getValue()}</span>
    ),
  }),
  col.display({
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.lastName}, {row.original.firstName}{row.original.middleName ? ` ${row.original.middleName.charAt(0)}.` : ''}
      </span>
    ),
  }),
  col.accessor('department', {
    header: 'Department',
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('immediateSupervisor', {
    header: 'Supervisor',
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('lateCount', {
    header: () => <span className="block text-right">Late Count</span>,
    cell: (info) => (
      <span className="font-mono text-[13px] block text-right">
        {info.getValue()} <span className="text-[10px] text-muted">×</span>
      </span>
    ),
  }),
  col.accessor('accumulatedMinutes', {
    header: () => <span className="block text-right">Accum. Min</span>,
    cell: (info) => (
      <span className="font-mono text-[13px] block text-right">
        {info.getValue()} <span className="text-[10px] text-muted">min</span>
      </span>
    ),
  }),
  col.accessor('nteStatus', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
];

interface EmployeeTableProps {
  data: EmployeeMonthlyStats[];
  year: number;
  month: number;
}

export function EmployeeTable({ data, year, month }: EmployeeTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selected, setSelected] = useState<EmployeeMonthlyStats | null>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="bg-white border border-border rounded-[7px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <span className="text-[13.5px] font-semibold text-app-text">Employees</span>
          <span className="text-[11.5px] text-muted">{data.length} employees</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-ground border-b border-border">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted cursor-pointer hover:text-app-text select-none first:pl-5 last:pr-5"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row.original)}
                  className={`border-b border-[#EEF1F4] cursor-pointer transition-colors ${
                    i % 2 === 1 ? 'bg-[#F6F8FA]' : ''
                  } ${selected?.employeeId === row.original.employeeId ? 'bg-[#E4ECFA]' : 'hover:bg-[#EBF0FA]'}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3.5 py-[11px] text-[13px] first:pl-5 last:pr-5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted text-[13px]">
                    No employees found. Upload an attendance report to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeDrawer
        employee={selected}
        year={year}
        month={month}
        onClose={() => setSelected(null)}
        onNteAction={() => setSelected(null)}
      />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/StatusBadge.tsx components/dashboard/EmployeeTable.tsx
git commit -m "feat: employee table with TanStack Table and status badges"
```

---

## Task 14: Employee Drawer & NTE Form

**Files:**
- Create: `components/dashboard/NteForm.tsx`
- Create: `components/dashboard/EmployeeDrawer.tsx`
- Create: `app/nte/actions.ts`

- [ ] **Step 1: Create `app/nte/actions.ts`**

```typescript
'use server';

import { issueNte, acknowledgeNte } from '@/lib/queries/nte';
import { revalidatePath } from 'next/cache';

export async function issueNteAction(employeeId: string, month: string, issuedBy: string, notes: string) {
  await issueNte(employeeId, month, issuedBy, notes);
  revalidatePath('/');
  revalidatePath('/nte');
}

export async function acknowledgeNteAction(employeeId: string, month: string) {
  await acknowledgeNte(employeeId, month);
  revalidatePath('/');
  revalidatePath('/nte');
}
```

- [ ] **Step 2: Create `components/dashboard/NteForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { issueNteAction, acknowledgeNteAction } from '@/app/nte/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NteStatus } from '@/lib/utils/nte-status';

interface NteFormProps {
  employeeId: string;
  month: string;       // "2026-06"
  nteStatus: NteStatus;
  issuedDate: string | null;
  issuedBy: string | null;
  acknowledgedDate: string | null;
  notes: string | null;
  onSuccess: () => void;
}

export function NteForm({ employeeId, month, nteStatus, issuedDate, issuedBy, acknowledgedDate, notes, onSuccess }: NteFormProps) {
  const [issuedByInput, setIssuedByInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [loading, setLoading] = useState(false);

  const monthLabel = new Date(`${month}-01`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await issueNteAction(employeeId, month, issuedByInput, notesInput);
    setLoading(false);
    onSuccess();
  }

  async function handleAcknowledge() {
    setLoading(true);
    await acknowledgeNteAction(employeeId, month);
    setLoading(false);
    onSuccess();
  }

  if (nteStatus === 'acknowledged') {
    return (
      <div className="space-y-2 text-[12.5px] text-muted">
        <p>NTE issued {issuedDate} by {issuedBy}</p>
        {notes && <p>Notes: {notes}</p>}
        <p className="text-safe-green font-medium">Acknowledged {acknowledgedDate}</p>
      </div>
    );
  }

  if (nteStatus === 'issued') {
    return (
      <div className="space-y-3">
        <div className="text-[12.5px] text-muted space-y-1">
          <p>NTE issued {issuedDate} by <span className="font-medium text-app-text">{issuedBy}</span></p>
          {notes && <p>Notes: {notes}</p>}
        </div>
        <Button
          onClick={handleAcknowledge}
          disabled={loading}
          variant="outline"
          className="w-full border-safe-green/40 text-safe-green hover:bg-safe-green/5"
        >
          {loading ? 'Saving…' : `Mark Acknowledged`}
        </Button>
      </div>
    );
  }

  if (nteStatus === 'required') {
    return (
      <div className="space-y-3">
        <div className="bg-nte-red/[0.08] border border-nte-red/20 rounded-[5px] px-3.5 py-2.5 text-[12px] text-nte-red font-medium">
          Threshold crossed — NTE required for {monthLabel}
        </div>
        <form onSubmit={handleIssue} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Issued by</Label>
            <Input
              value={issuedByInput}
              onChange={(e) => setIssuedByInput(e.target.value)}
              placeholder="Your name"
              required
              className="text-[12.5px] bg-ground"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Notes</Label>
            <Input
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Optional — context or follow-up"
              className="text-[12.5px] bg-ground"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-nte-red hover:bg-nte-red/90 text-white"
          >
            {loading ? 'Saving…' : `Issue NTE for ${monthLabel}`}
          </Button>
        </form>
      </div>
    );
  }

  // safe or warning — show progress only
  return null;
}
```

- [ ] **Step 3: Create `components/dashboard/EmployeeDrawer.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { EmployeeMonthlyStats } from '@/lib/queries/attendance';
import { NteForm } from './NteForm';

interface LateRecord {
  date: string;
  lateMinutes: number;
  shiftSchedule: string | null;
  actualLogs: string | null;
}

interface EmployeeDrawerProps {
  employee: EmployeeMonthlyStats | null;
  year: number;
  month: number;
  onClose: () => void;
  onNteAction: () => void;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDay(dateStr: string) {
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
}

export function EmployeeDrawer({ employee, year, month, onClose, onNteAction }: EmployeeDrawerProps) {
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    if (!employee) { setLateRecords([]); return; }
    fetch(`/api/employee/${employee.employeeId}/lates?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data: LateRecord[]) => setLateRecords(data))
      .catch(() => setLateRecords([]));
  }, [employee, year, month]);

  if (!employee) return null;

  const fullName = `${employee.lastName}, ${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ''}`;

  return (
    <Sheet open={!!employee} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[400px] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-navy px-[22px] py-5 flex-shrink-0">
          <p className="font-mono text-[11px] tracking-[0.12em] text-white/45 mb-1">
            ID #{employee.employeeId} · {employee.department ?? 'No dept'}
          </p>
          <p className="text-[17px] font-semibold text-white tracking-tight">{fullName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {employee.immediateSupervisor && (
              <span className="bg-white/10 text-white/70 text-[11px] px-2 py-0.5 rounded-[3px]">
                {employee.immediateSupervisor}
              </span>
            )}
            {employee.approver2 && (
              <span className="bg-white/10 text-white/70 text-[11px] px-2 py-0.5 rounded-[3px]">
                Mgr: {employee.approver2}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Monthly totals */}
          <div className="px-[22px] py-4 border-b border-border">
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted mb-3">
              {new Date(`${monthStr}-01`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })} — Totals
            </p>
            <div className="flex gap-4">
              <div className="flex-1 bg-ground rounded-[5px] px-3.5 py-3">
                <p className="font-mono text-[24px] font-bold text-nte-red leading-none tracking-tight">
                  {employee.lateCount}
                </p>
                <p className="text-[11px] text-muted mt-1">Late instances</p>
              </div>
              <div className="flex-1 bg-ground rounded-[5px] px-3.5 py-3">
                <p className="font-mono text-[24px] font-bold text-nte-red leading-none tracking-tight">
                  {employee.accumulatedMinutes}
                </p>
                <p className="text-[11px] text-muted mt-1">Minutes accumulated</p>
              </div>
            </div>
          </div>

          {/* Late dates */}
          <div className="px-[22px] py-4 border-b border-border">
            <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted mb-3">
              Late Dates
            </p>
            {lateRecords.length === 0 ? (
              <p className="text-[12.5px] text-muted">No late records for this month.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted text-left pb-2">Date</th>
                    <th className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted text-left pb-2">Day</th>
                    <th className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted text-right pb-2">Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {lateRecords.map((r) => (
                    <tr key={r.date} className="border-b border-[#F0F2F5]">
                      <td className="font-mono text-[12px] py-2">{r.date}</td>
                      <td className="text-[12px] text-muted py-2">{getDay(r.date)}</td>
                      <td className="font-mono text-[13px] font-semibold text-nte-red text-right py-2">
                        {r.lateMinutes} <span className="text-[10px] text-muted font-normal">min</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* NTE section */}
          {['required', 'issued', 'acknowledged'].includes(employee.nteStatus) && (
            <div className="px-[22px] py-4">
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted mb-3">
                NTE Action
              </p>
              <NteForm
                employeeId={employee.employeeId}
                month={monthStr}
                nteStatus={employee.nteStatus}
                issuedDate={employee.issuedDate}
                issuedBy={employee.issuedBy}
                acknowledgedDate={employee.acknowledgedDate}
                notes={null}
                onSuccess={onNteAction}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Create `app/api/employee/[id]/lates/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeLateRecords } from '@/lib/queries/attendance';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;

  const records = await getEmployeeLateRecords(params.id, year, month);
  return NextResponse.json(records);
}
```

- [ ] **Step 5: Commit**

```bash
git add app/nte/actions.ts components/dashboard/NteForm.tsx components/dashboard/EmployeeDrawer.tsx app/api/
git commit -m "feat: employee drawer with late records and NTE form"
```

---

## Task 15: Dashboard Page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

Note: stats are computed from the already-loaded employees array — no second DB round-trip needed.

```tsx
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatCards } from '@/components/dashboard/StatCards';
import { EmployeeTable } from '@/components/dashboard/EmployeeTable';
import { getFilterOptions } from '@/lib/queries/employees';
import { getMonthlyStats } from '@/lib/queries/attendance';

interface PageProps {
  searchParams: {
    year?: string;
    month?: string;
    dept?: string;
    supervisor?: string;
    manager?: string;
  };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const now = new Date();
  const year = Number(searchParams.year) || now.getFullYear();
  const month = Number(searchParams.month) || (now.getMonth() + 1);
  const dept = searchParams.dept;
  const supervisor = searchParams.supervisor;
  const manager = searchParams.manager;

  const [filterOptions, employees] = await Promise.all([
    getFilterOptions(),
    getMonthlyStats({ year, month, department: dept, immediateSupervisor: supervisor, approver2: manager }),
  ]);

  // Compute summary stats from the loaded employee list
  const nteRequired  = employees.filter((e) => e.nteStatus === 'required').length;
  const approaching  = employees.filter((e) => e.nteStatus === 'warning').length;
  const totalIncidents = employees.reduce((sum, e) => sum + e.lateCount, 0);

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        year={year}
        month={month}
        departments={filterOptions.departments}
        supervisors={filterOptions.supervisors}
        managers={filterOptions.managers}
        selectedDept={dept}
        selectedSupervisor={supervisor}
        selectedManager={manager}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <StatCards
          nteRequired={nteRequired}
          approaching={approaching}
          totalIncidents={totalIncidents}
        />
        <EmployeeTable data={employees} year={year} month={month} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test dashboard end-to-end**

```bash
npm run dev
```
1. Upload the roster and attendance files at `/upload`.
2. Navigate to `/`. Expected: filter bar, 3 stat cards, employee table with Aban (2 lates, 11 min), Ado (1 late, 3 min), Agustin (0 lates).
3. Click an employee row. Expected: navy drawer slides in with late dates.
4. Filter by "Flyland Recovery". Expected: table shows only Flyland employees.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: dashboard page wiring filters, stats, and employee table"
```

---

## Task 16: NTE Management Page

**Files:**
- Create: `components/nte/NteTable.tsx`
- Create: `app/nte/page.tsx`

- [ ] **Step 1: Create `components/nte/NteTable.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { issueNteAction, acknowledgeNteAction } from '@/app/nte/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NteRow {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  immediate_supervisor: string | null;
  month: string;
  status: string;
  issued_date: string | null;
  issued_by: string | null;
  late_count: number;
  accumulated_minutes: number;
}

export function NteTable({ rows }: { rows: NteRow[] }) {
  const [issueForm, setIssueForm] = useState<{ employeeId: string; month: string } | null>(null);
  const [issuedBy, setIssuedBy] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!issueForm) return;
    setLoading(true);
    await issueNteAction(issueForm.employeeId, issueForm.month, issuedBy, '');
    setIssueForm(null);
    setIssuedBy('');
    setLoading(false);
  }

  async function handleAcknowledge(employeeId: string, month: string) {
    setLoading(true);
    await acknowledgeNteAction(employeeId, month);
    setLoading(false);
  }

  return (
    <div className="bg-white border border-border rounded-[7px] overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-ground border-b border-border">
            {['Employee', 'Month', 'Department', 'Supervisor', 'Late Count', 'Accum. Min', 'Status', 'Action'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              <tr key={`${row.employee_id}-${row.month}`} className="border-b border-[#EEF1F4] hover:bg-[#F6F8FA]">
                <td className="px-4 py-3 first:pl-5">
                  <div className="font-medium text-[13px]">{row.last_name}, {row.first_name}</div>
                  <div className="font-mono text-[11px] text-muted">{row.employee_id}</div>
                </td>
                <td className="px-4 py-3 font-mono text-[12px]">{row.month}</td>
                <td className="px-4 py-3 text-[12px] text-muted">{row.department ?? '—'}</td>
                <td className="px-4 py-3 text-[12px] text-muted">{row.immediate_supervisor ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-right">{row.late_count} <span className="text-[10px] text-muted">×</span></td>
                <td className="px-4 py-3 font-mono text-[13px] text-right">{row.accumulated_minutes} <span className="text-[10px] text-muted">min</span></td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status as 'required' | 'issued'} />
                </td>
                <td className="px-4 py-3 pr-5">
                  {row.status === 'required' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] border-nte-red/30 text-nte-red hover:bg-nte-red/5 h-7 px-3"
                      onClick={() => setIssueForm({ employeeId: row.employee_id, month: row.month })}
                    >
                      Issue NTE
                    </Button>
                  )}
                  {row.status === 'issued' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      className="text-[11px] border-safe-green/30 text-safe-green hover:bg-safe-green/5 h-7 px-3"
                      onClick={() => handleAcknowledge(row.employee_id, row.month)}
                    >
                      Mark Acknowledged
                    </Button>
                  )}
                </td>
              </tr>
              {issueForm?.employeeId === row.employee_id && issueForm?.month === row.month && (
                <tr key={`${row.employee_id}-${row.month}-form`} className="bg-[#FFF8F5] border-b border-nte-red/10">
                  <td colSpan={8} className="px-5 py-3">
                    <form onSubmit={handleIssue} className="flex items-center gap-3">
                      <span className="text-[12px] text-muted">Issued by:</span>
                      <Input
                        value={issuedBy}
                        onChange={(e) => setIssuedBy(e.target.value)}
                        placeholder="Your name"
                        required
                        className="h-7 text-[12.5px] bg-white w-52"
                      />
                      <Button type="submit" disabled={loading} size="sm" className="bg-nte-red hover:bg-nte-red/90 text-white h-7 text-[11px] px-3">
                        {loading ? 'Saving…' : 'Confirm'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setIssueForm(null)}>
                        Cancel
                      </Button>
                    </form>
                  </td>
                </tr>
              )}
            </>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-12 text-muted text-[13px]">
                No pending NTEs. All employees are within threshold.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/nte/page.tsx`**

```tsx
import { NteTable } from '@/components/nte/NteTable';
import { getNteList } from '@/lib/queries/nte';

export default async function NtePage() {
  const rows = await getNteList();

  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted mb-1">Management</p>
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">NTE Management</h1>
        <p className="text-[14px] text-muted mt-1.5">
          Employees who have crossed the tardiness threshold this month. Issue and track NTE documents here.
        </p>
      </div>
      <NteTable rows={rows as Parameters<typeof NteTable>[0]['rows']} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/nte/ app/nte/
git commit -m "feat: NTE management page with inline issue and acknowledge actions"
```

---

## Task 17: Roster Page

**Files:**
- Create: `components/roster/RosterTable.tsx`
- Create: `app/roster/page.tsx`

- [ ] **Step 1: Create `components/roster/RosterTable.tsx`**

```tsx
import { Employee } from '@/lib/db/schema';

export function RosterTable({ employees }: { employees: Employee[] }) {
  return (
    <div className="bg-white border border-border rounded-[7px] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-app-text">All Employees</span>
        <span className="text-[11.5px] text-muted">{employees.length} employees</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-ground border-b border-border">
              {['Employee ID', 'Name', 'Department', 'Immediate Supervisor', 'Manager (Approver 2)', 'Hire Date'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-5 last:pr-5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr key={emp.employeeId} className={`border-b border-[#EEF1F4] ${i % 2 === 1 ? 'bg-[#F6F8FA]' : ''}`}>
                <td className="px-4 py-2.5 first:pl-5 font-mono text-[12px]">{emp.employeeId}</td>
                <td className="px-4 py-2.5 font-medium text-[13px]">
                  {emp.lastName}, {emp.firstName}{emp.middleName ? ` ${emp.middleName.charAt(0)}.` : ''}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.department ?? '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.immediateSupervisor ?? '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{emp.approver2 ?? '—'}</td>
                <td className="px-4 py-2.5 last:pr-5 font-mono text-[12px] text-muted">{emp.hireDate ?? '—'}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted text-[13px]">
                  No employees yet. Upload the employee roster to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/roster/page.tsx`**

```tsx
import { RosterTable } from '@/components/roster/RosterTable';
import { getAllEmployees } from '@/lib/queries/employees';

export default async function RosterPage() {
  const employees = await getAllEmployees();

  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted mb-1">Employees</p>
        <h1 className="text-2xl font-semibold text-app-text tracking-tight">Roster</h1>
        <p className="text-[14px] text-muted mt-1.5">
          All employees imported from the Sprout roster. Update by uploading a new roster file.
        </p>
      </div>
      <RosterTable employees={employees} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/roster/ app/roster/
git commit -m "feat: roster page showing all employees"
```

---

## Task 18: Vercel Deployment

**Files:** None (Vercel dashboard configuration)

- [ ] **Step 1: Push code to GitHub**

Create a new GitHub repository named `tardiness-tracker` (private), then:
```bash
git remote add origin https://github.com/<your-username>/tardiness-tracker.git
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import the `tardiness-tracker` GitHub repository
3. Framework preset: **Next.js** (auto-detected)
4. Click **Environment Variables** and add:
   - `DATABASE_URL` = (your Neon connection string)
5. Click **Deploy**

- [ ] **Step 3: Verify production deployment**

1. Open the deployed URL
2. Upload the attendance and roster files
3. Navigate to the dashboard — confirm data loads
4. Issue an NTE — confirm status updates
5. Check the roster page — confirm employees list

---

## Verification Checklist

After completing all tasks, run through this list:

- [ ] `npm test` passes — all parser and NTE status tests green
- [ ] Upload roster + attendance → success summary shows correct employee and record counts
- [ ] Dashboard filter by "Flyland Recovery" → shows only Flyland employees
- [ ] Aban shows 2 lates / 11 min; Ado shows 1 late / 3 min; Agustin shows 0 lates
- [ ] Employee with 6+ lates shows "NTE Required" badge
- [ ] Click employee row → drawer opens with late dates table
- [ ] Issue NTE in drawer → status badge updates to "NTE Issued"
- [ ] Mark Acknowledged → drawer shows audit trail
- [ ] `/nte` page lists all required/issued NTEs with quick-action buttons
- [ ] `/roster` shows all employees with correct department, supervisor, manager
- [ ] Upload same period again → record count stays the same (replace, not append)
- [ ] Production deploy on Vercel loads with data
