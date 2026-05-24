import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = supabaseAdmin()

  // Intentamos obtener CUALQUIER cosa de la tabla sin filtros
  const { data, error } = await db
    .from('quality_records')
    .select('*')
    .limit(5)

  if (error) {
    return NextResponse.json({ error: "Error en DB: " + error.message }, { status: 500 })
  }

  // Si esto devuelve registros, entonces la conexión está BIEN.
  // Si esto sigue devolviendo [], el problema es la conexión a la base de datos (URL o KEY).
  return NextResponse.json({ 
    message: "Conexión exitosa",
    cantidad_registros: data ? data.length : 0,
    primer_registro: data && data.length > 0 ? data[0] : null
  })
}
