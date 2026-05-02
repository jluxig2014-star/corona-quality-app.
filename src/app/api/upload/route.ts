import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { QualityRow } from '@/lib/logic'

const CHUNK_SIZE = 500  // rows per Supabase insert call

export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('x-admin-password')
  if (authHeader !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { rows, reportDate, mode } = body as {
    rows: QualityRow[]
    reportDate: string
    mode: 'overwrite' | 'append'
  }

  if (!rows?.length || !reportDate) {
    return NextResponse.json({ error: 'Missing rows or reportDate' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // ── Overwrite: delete existing rows for this date ───────────────────────────
  if (mode === 'overwrite') {
    const { error: delErr } = await db
      .from('quality_records')
      .delete()
      .eq('report_date', reportDate)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // ── Bulk insert in chunks to avoid payload limits ───────────────────────────
  const tagged = rows.map(r => ({ ...r, report_date: reportDate }))
  const chunks: QualityRow[][] = []
  for (let i = 0; i < tagged.length; i += CHUNK_SIZE) {
    chunks.push(tagged.slice(i, i + CHUNK_SIZE))
  }

  let inserted = 0
  for (const chunk of chunks) {
    const { error } = await db.from('quality_records').insert(chunk)
    if (error) return NextResponse.json({ error: error.message, inserted }, { status: 500 })
    inserted += chunk.length
  }

  return NextResponse.json({ success: true, inserted })
}
