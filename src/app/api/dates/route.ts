import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()

  const { data, error } = await db
    .from('quality_records')
    .select('*') // Asegúrate de que tenga el asterisco para traer todo
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enviamos los datos crudos para ver si el dashboard reacciona
  return NextResponse.json(data) 
}
