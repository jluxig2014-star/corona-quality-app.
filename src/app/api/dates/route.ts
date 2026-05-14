import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()

  // Solo pedimos la columna report_date para ahorrar memoria
  const { data, error } = await db
    .from('quality_records')
    .select('report_date')
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Extraemos solo las fechas únicas (ej: ["2026-05-14"])
  const dates = [...new Set((data || []).map((r: any) => r.report_date))]
  
  return NextResponse.json(dates)
}
