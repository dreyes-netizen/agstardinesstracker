-- Weekly NTEs: key nte_records by period instead of month.
-- Existing monthly NTEs become full-month periods and are kept as history.
-- Run once, in a single transaction, before deploying the weekly-NTE code.

BEGIN;

ALTER TABLE nte_records
  ADD COLUMN period_start date,
  ADD COLUMN period_end date;

UPDATE nte_records
SET period_start = (month || '-01')::date,
    period_end   = ((month || '-01')::date + INTERVAL '1 month - 1 day')::date;

ALTER TABLE nte_records
  ALTER COLUMN period_start SET NOT NULL,
  ALTER COLUMN period_end SET NOT NULL;

DROP INDEX nte_employee_month_idx;
CREATE UNIQUE INDEX nte_employee_period_idx ON nte_records (employee_id, period_start, period_end);

ALTER TABLE nte_records DROP COLUMN month;

ALTER TABLE nte_audit_log
  ADD COLUMN period_start date,
  ADD COLUMN period_end date;

UPDATE nte_audit_log
SET period_start = (month || '-01')::date,
    period_end   = ((month || '-01')::date + INTERVAL '1 month - 1 day')::date
WHERE month ~ '^\d{4}-\d{2}$';

COMMIT;
