import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = supabaseAdmin()

  // Pedimos los report_date. 
  const { data, error } = await db
    .from('quality_records')
    .select('report_date')
    .order('report_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Si data es null o undefined, usamos un arreglo vacío
  const rawData = data || [];
  
  // Extraemos fechas, eliminamos duplicados y filtramos valores nulos
  const dates = [...new Set(rawData.map((r: any) => r.report_date).filter(Boolean))];
  
  return NextResponse.json(dates)
}
