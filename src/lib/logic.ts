// ── Defect classification ─────────────────────────────────────────────────────
export const DIRECT_DEFECT_CODES = new Set([
  '3','5','6','7','8','9','13','15','23','25','26','30.1','31','32','33','35','40'
])

export function isDirectDefect(def: string): boolean {
  if (!def) return false
  const code = def.trim().split('-')[0].trim()
  return DIRECT_DEFECT_CODES.has(code)
}

export function isRaja(def: string): boolean {
  const s = (def || '').trim()
  return s === '1' || s.startsWith('1-') || s.startsWith('1 -')
}

// ── Semáforo ─────────────────────────────────────────────────────────────────
export function semaColor(v: number): string {
  return v > 95 ? '#16a34a' : v >= 92 ? '#ca8a04' : '#dc2626'
}
export function semaBg(v: number): string {
  return v > 95 ? '#f0fdf4' : v >= 92 ? '#fefce8' : '#fef2f2'
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : (n / d) * 100
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface QualityRow {
  id?: number
  report_date: string
  attribute_1: string
  attribute_2: string
  buena: number
  desperdicio: number
  retrabajo: number
  loc: string
  def: string
  dueno_proceso: string
}

export interface RankingEntry {
  nombre: string
  gradoAEsm: number
  defTerm: number
  raja: number
  total: number
}

export interface ParetoItem {
  def: string
  v: number
  cumPct: number
}

export interface ChartItem {
  label: string
  value: number
}

export interface DashboardData {
  reportDate: string
  ranking: RankingEntry[]
  globalPareto: ParetoItem[]          // all defects, global
  esmParetoMap: Record<string, ParetoItem[]>  // esmaltador → direct defects pareto
  esmAllParetoMap: Record<string, ParetoItem[]>  // esmaltador → ALL defects pareto
  roturaByRef: ChartItem[]            // ATTRIBUTE_2 → desperdicio
  locByLoc: ChartItem[]              // LOC → desperdicio
  allRefs: string[]
  allDefs: string[]
  allEsm: string[]
  // raw rows for client-side filter (kept small via server aggregation)
  roturaMatrix: Record<string, Record<string, number>>  // ref → def → desp
  locMatrix: Record<string, Record<string, Record<string, number>>> // loc → esm → ref → def → desp
}
