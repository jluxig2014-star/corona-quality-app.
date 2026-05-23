export const dynamic = 'force-dynamic
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isDirectDefect, isRaja, pct,
  ParetoItem, RankingEntry, ChartItem, DashboardData
} from '@/lib/logic'

function buildPareto(freq: Record<string, number>): ParetoItem[] {
  const arr = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([def, v]) => ({ def, v, cumPct: 0 }))
  let cs = 0
  const gt = arr.reduce((s, x) => s + x.v, 0)
  arr.forEach(p => { cs += p.v; p.cumPct = gt > 0 ? (cs / gt) * 100 : 0 })
  return arr
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let reportDate = searchParams.get('date')

  const db = supabaseAdmin()

  // ── If no date given, find the latest ─────────────────────────────────────
  if (!reportDate) {
    const { data: latestRow } = await db
      .from('quality_records')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()
    if (!latestRow) return NextResponse.json({ error: 'No data found' }, { status: 404 })
    reportDate = latestRow.report_date
  }

  // ── Fetch all rows for this date ──────────────────────────────────────────
  // We fetch in pages to handle 2500+ rows safely
  const PAGE = 1000
  let allRows: any[] = []
  let from = 0
  
 while (true) {
    const { data, error } = await db
      .from('quality_records')
      .select('attribute_2,buena,desperdicio,retrabajo,loc,def,dueno_proceso')
      .eq('report_date', reportDate) 
      .range(from, from + PAGE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    allRows = allRows.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  if (!allRows.length) return NextResponse.json({ error: 'No rows for this date' }, { status: 404 })

  // ── Aggregate server-side ─────────────────────────────────────────────────
  const globalDefFreq: Record<string, number> = {}
  const esmMap: Record<string, {
    b: number; d: number; rb: number
    dirD: number; raj: number
    dirFreq: Record<string, number>
    allFreq: Record<string, number>
  }> = {}
  const roturaMatrix: Record<string, Record<string, number>> = {}  // ref → def → desp
  const locMatrix: Record<string, Record<string, Record<string, Record<string, number>>>> = {}
  // loc → esm → ref → def → desp
  const allRefsSet = new Set<string>()
  const allDefsSet = new Set<string>()
  const allEsmSet  = new Set<string>()

  for (const r of allRows) {
    const b   = Number(r.buena)       || 0
    const d   = Number(r.desperdicio) || 0
    const rb  = Number(r.retrabajo)   || 0
    const def = (r.def && r.def !== 'EMPTY' ? r.def : '').trim()
    const loc = (r.loc && r.loc !== 'EMPTY' ? r.loc : 'Sin LOC').trim()
    const esm = (r.dueno_proceso || 'Sin nombre').trim()
    const ref = (r.attribute_2   || 'N/A').trim()

    if (def) { globalDefFreq[def] = (globalDefFreq[def] || 0) + d; allDefsSet.add(def) }
    allRefsSet.add(ref)
    allEsmSet.add(esm)

    const direct = isDirectDefect(def)
    const raja   = isRaja(def)

    if (!esmMap[esm]) esmMap[esm] = { b:0, d:0, rb:0, dirD:0, raj:0, dirFreq:{}, allFreq:{} }
    esmMap[esm].b  += b;  esmMap[esm].d  += d;  esmMap[esm].rb += rb
    if (direct) { esmMap[esm].dirD += d; esmMap[esm].dirFreq[def] = (esmMap[esm].dirFreq[def] || 0) + d }
    if (raja)     esmMap[esm].raj  += d
    if (def)      esmMap[esm].allFreq[def] = (esmMap[esm].allFreq[def] || 0) + d

    // rotura matrix
    if (!roturaMatrix[ref]) roturaMatrix[ref] = {}
    if (def) roturaMatrix[ref][def] = (roturaMatrix[ref][def] || 0) + d

    // loc matrix
    if (!locMatrix[loc]) locMatrix[loc] = {}
    if (!locMatrix[loc][esm]) locMatrix[loc][esm] = {}
    if (!locMatrix[loc][esm][ref]) locMatrix[loc][esm][ref] = {}
    if (def) locMatrix[loc][esm][ref][def] = (locMatrix[loc][esm][ref][def] || 0) + d
  }

  // ── Build ranking ─────────────────────────────────────────────────────────
  const ranking: RankingEntry[] = Object.entries(esmMap).map(([nombre, m]) => {
    const tot = m.b + m.d + m.rb
    return {
      nombre,
      gradoAEsm: pct(m.b, m.b + m.dirD + m.rb),
      defTerm:   pct(m.dirD, tot),
      raja:      pct(m.raj, tot),
      total: tot
    }
  }).sort((a, b) => b.gradoAEsm - a.gradoAEsm)

  // ── Pareto maps ───────────────────────────────────────────────────────────
  const esmParetoMap: Record<string, ParetoItem[]>    = {}
  const esmAllParetoMap: Record<string, ParetoItem[]> = {}
  for (const [esm, m] of Object.entries(esmMap)) {
    esmParetoMap[esm]    = buildPareto(m.dirFreq).slice(0, 20)
    esmAllParetoMap[esm] = buildPareto(m.allFreq).slice(0, 20)
  }

  // ── Global charts ─────────────────────────────────────────────────────────
  const globalPareto = buildPareto(globalDefFreq).slice(0, 20)

  // Global rotura by ref (all defects)
  const rotByRef: Record<string, number> = {}
  for (const [ref, defs] of Object.entries(roturaMatrix))
    rotByRef[ref] = Object.values(defs).reduce((s, v) => s + v, 0)
  const roturaByRef: ChartItem[] = Object.entries(rotByRef)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  // Global loc by loc
  const locByLocMap: Record<string, number> = {}
  for (const [loc, esms] of Object.entries(locMatrix))
    for (const refs of Object.values(esms))
      for (const defs of Object.values(refs))
        for (const v of Object.values(defs))
          locByLocMap[loc] = (locByLocMap[loc] || 0) + v
  const locByLoc: ChartItem[] = Object.entries(locByLocMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

 const dashboard: any = {
      reportDate: reportDate || "",
      ranking,
      globalPareto,
      esmParetoMap,
      allEsm: [...allEsmSet].sort(),
      roturaMatrix,
      locMatrix,
    };

  return NextResponse.json(dashboard)
}
