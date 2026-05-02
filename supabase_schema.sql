-- ═══════════════════════════════════════════════════════════════════════════
-- CORONA QUALITY — Supabase Schema
-- Run this entire script in: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Main quality records table
CREATE TABLE IF NOT EXISTS quality_records (
  id            BIGSERIAL PRIMARY KEY,
  report_date   DATE        NOT NULL,
  attribute_1   TEXT,                          -- Familia
  attribute_2   TEXT,                          -- Referencia
  buena         INTEGER     NOT NULL DEFAULT 0,
  desperdicio   INTEGER     NOT NULL DEFAULT 0,
  retrabajo     INTEGER     NOT NULL DEFAULT 0,
  loc           TEXT,                          -- Localización
  def           TEXT,                          -- Defecto code e.g. "1-Raja gruesa"
  dueno_proceso TEXT,                          -- Esmaltador
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index for fast date + esmaltador queries
CREATE INDEX IF NOT EXISTS idx_quality_date        ON quality_records(report_date);
CREATE INDEX IF NOT EXISTS idx_quality_date_dueno  ON quality_records(report_date, dueno_proceso);
CREATE INDEX IF NOT EXISTS idx_quality_date_def    ON quality_records(report_date, def);
CREATE INDEX IF NOT EXISTS idx_quality_date_loc    ON quality_records(report_date, loc);
CREATE INDEX IF NOT EXISTS idx_quality_date_ref    ON quality_records(report_date, attribute_2);

-- 3. View: ranking aggregation (computed server-side)
-- Direct defect codes: 3,5,6,7,8,9,13,15,23,25,26,30.1,31,32,33,35,40
CREATE OR REPLACE VIEW ranking_by_date AS
SELECT
  report_date,
  dueno_proceso,
  SUM(buena)                                         AS total_buena,
  SUM(desperdicio)                                   AS total_desp,
  SUM(retrabajo)                                     AS total_retrab,
  SUM(buena) + SUM(desperdicio) + SUM(retrabajo)     AS total,
  -- Direct defects desperdicio
  SUM(CASE WHEN
    SPLIT_PART(def, '-', 1) IN ('3','5','6','7','8','9','13','15','23','25','26','30.1','31','32','33','35','40')
    THEN desperdicio ELSE 0 END)                     AS direct_desp,
  -- Raja defects (code starting with 1-)
  SUM(CASE WHEN def LIKE '1-%' OR def = '1' THEN desperdicio ELSE 0 END) AS raja_desp
FROM quality_records
GROUP BY report_date, dueno_proceso;

-- 4. Enable Row Level Security (open for service role)
ALTER TABLE quality_records ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API routes)
CREATE POLICY "service_role_all" ON quality_records
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anon to SELECT only (frontend reads)
CREATE POLICY "anon_select" ON quality_records
  FOR SELECT USING (true);
