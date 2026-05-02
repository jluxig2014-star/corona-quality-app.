'use client'

import { useState, useRef, useCallback } from 'react'

const HEADERS = ['ATTRIBUTE_1','ATTRIBUTE_2','BUENA','DESPERDICIO','RETRABAJO','LOC','DEF','DUEÑO_DEL_PROCE']
const HLABELS = ['Familia','Referencia','Buena','Desperdicio','Retrabajo','Localización','Defecto','Esmaltador']

interface ParsedRow {
  attribute_1: string; attribute_2: string
  buena: number; desperdicio: number; retrabajo: number
  loc: string; def: string; dueno_proceso: string
}

export default function AdminPage() {
  const [authed, setAuthed]         = useState(false)
  const [password, setPassword]     = useState('')
  const [authErr, setAuthErr]       = useState('')
  const [rows, setRows]             = useState<ParsedRow[]>([])
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0,10))
  const [mode, setMode]             = useState<'overwrite'|'append'>('overwrite')
  const [status, setStatus]         = useState<{msg:string;type:'info'|'success'|'error'}|null>(null)
  const [progress, setProgress]     = useState(0)
  const [uploading, setUploading]   = useState(false)
  const pasteRef = useRef<HTMLDivElement>(null)

  function handleLogin() {
    // Client-side gate — real auth happens in the API via x-admin-password header
    if (password.trim() === '') { setAuthErr('Ingrese la contraseña'); return }
    setAuthed(true); setAuthErr('')
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const lines = text.trim().split('\n').filter(Boolean)
    const parsed: ParsedRow[] = lines.map(line => {
      const cols = line.split('\t')
      return {
        attribute_1:   (cols[0]||'').trim(),
        attribute_2:   (cols[1]||'').trim(),
        buena:         Number((cols[2]||'0').trim()) || 0,
        desperdicio:   Number((cols[3]||'0').trim()) || 0,
        retrabajo:     Number((cols[4]||'0').trim()) || 0,
        loc:           (cols[5]||'').trim(),
        def:           (cols[6]||'').trim(),
        dueno_proceso: (cols[7]||'').trim(),
      }
    }).filter(r => r.attribute_1 || r.attribute_2 || r.buena)

    setRows(parsed)
    setStatus({ msg: `✅ ${parsed.length} filas cargadas en memoria. Listo para subir.`, type:'info' })
    if (pasteRef.current) pasteRef.current.classList.add('has-data')
  }, [])

  async function handleUpload() {
    if (!rows.length)   { setStatus({msg:'No hay filas para subir.',type:'error'}); return }
    if (!reportDate)    { setStatus({msg:'Seleccione una fecha de reporte.',type:'error'}); return }
    setUploading(true); setProgress(0)
    setStatus({msg:`Subiendo ${rows.length} registros a Supabase...`,type:'info'})

    // Simulate progress on client (actual insert is server-side chunked)
    const ticker = setInterval(() => setProgress(p => Math.min(p + 8, 90)), 300)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
        },
        body: JSON.stringify({ rows, reportDate, mode })
      })
      clearInterval(ticker); setProgress(100)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error del servidor')
      setStatus({ msg: `✅ ${json.inserted} registros guardados exitosamente para ${reportDate}.`, type:'success' })
      setRows([]); if (pasteRef.current) pasteRef.current.classList.remove('has-data')
      if (pasteRef.current) pasteRef.current.textContent = '📋 Haga clic aquí y pegue los datos desde Excel (Ctrl+V)'
    } catch(err: any) {
      clearInterval(ticker)
      setStatus({ msg: `❌ Error: ${err.message}`, type:'error' })
    } finally {
      setUploading(false)
      setTimeout(()=>setProgress(0), 2000)
    }
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) return (
    <div>
      <header className="app-header">
        <div><div className="logo">corona<span>Control de Calidad · Esmaltado</span></div></div>
        <a href="/" className="btn btn-outline" style={{fontSize:12,padding:'6px 14px'}}>← Volver</a>
      </header>
      <div style={{maxWidth:380,margin:'6rem auto',padding:'0 1rem'}}>
        <div className="admin-card">
          <h2>⚙ Panel de Administrador</h2>
          <p>Acceso restringido. Ingrese la contraseña para continuar.</p>
          <div className="form-group">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="Contraseña de administrador" />
          </div>
          {authErr && <p style={{color:'#dc2626',fontSize:13,marginBottom:12}}>{authErr}</p>}
          <button className="btn btn-primary" style={{width:'100%'}} onClick={handleLogin}>Ingresar</button>
        </div>
      </div>
    </div>
  )

  // ── Admin panel ───────────────────────────────────────────────────────────
  return (
    <div>
      <header className="app-header">
        <div><div className="logo">corona<span>Panel de Administrador</span></div></div>
        <a href="/" className="btn btn-outline" style={{fontSize:12,padding:'6px 14px'}}>← Dashboard</a>
      </header>

      <div className="content">
        <div className="admin-card">
          <h2>📤 Cargar Datos de Calidad</h2>
          <p>Pegue los datos copiados desde Excel y configure la fecha antes de subir.</p>

          {/* Date + Mode */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label>📅 Fecha de Reporte</label>
              <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} />
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>Modo de carga</label>
              <div className="mode-toggle">
                <button className={`mode-btn ${mode==='overwrite'?'active':''}`} onClick={()=>setMode('overwrite')}>
                  🔄 Sobrescribir
                </button>
                <button className={`mode-btn ${mode==='append'?'active':''}`} onClick={()=>setMode('append')}>
                  ➕ Añadir
                </button>
              </div>
            </div>
          </div>

          {mode==='overwrite' && (
            <div style={{background:'#fef9c3',border:'1px solid #fde047',borderRadius:8,padding:'8px 14px',fontSize:12,color:'#713f12',marginBottom:16}}>
              ⚠️ <strong>Modo Sobrescribir:</strong> Se eliminarán todos los registros existentes para la fecha {reportDate} antes de insertar.
            </div>
          )}

          {/* Paste zone */}
          <div className="form-group">
            <label>📋 Datos de Excel</label>
            <div
              ref={pasteRef}
              className="paste-zone"
              tabIndex={0}
              onPaste={handlePaste}
              onFocus={e=>(e.currentTarget.style.borderColor='#2563b8')}
              onBlur={e=>(e.currentTarget.style.borderColor=rows.length?'#16a34a':'#cbd5e1')}
            >
              {rows.length === 0
                ? '📋 Haga clic aquí y pegue los datos desde Excel (Ctrl+V)'
                : `✅ ${rows.length} filas listas — ${reportDate}`}
            </div>
          </div>

          {/* Upload button */}
          <button className="btn btn-primary" style={{width:'100%',marginBottom:12}}
            onClick={handleUpload} disabled={uploading || !rows.length}>
            {uploading
              ? <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                  <span className="spinner" style={{width:18,height:18,borderWidth:2}}/>
                  Subiendo {rows.length} registros...
                </span>
              : `⬆ Subir ${rows.length} registros a Supabase`}
          </button>

          {/* Progress bar */}
          <div className={`progress-bar-wrap ${uploading || progress>0 ? 'show' : ''}`}>
            <div className="progress-bar" style={{width:progress+'%'}}/>
          </div>

          {/* Status */}
          {status && (
            <div className={`status-bar show ${status.type}`}>{status.msg}</div>
          )}
        </div>

        {/* Preview table */}
        {rows.length > 0 && (
          <div style={{marginTop:24}}>
            <div className="flex-between" style={{marginBottom:12}}>
              <h3 style={{fontWeight:800,fontSize:15}}>Vista previa — {rows.length} filas</h3>
              <button className="btn btn-danger" style={{padding:'6px 14px',fontSize:12}}
                onClick={()=>{setRows([]); if(pasteRef.current){pasteRef.current.classList.remove('has-data'); pasteRef.current.textContent='📋 Haga clic aquí y pegue los datos desde Excel (Ctrl+V)'}}}>
                🗑 Limpiar
              </button>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th style={{textAlign:'center'}}>#</th>
                  {HLABELS.map((h,i)=><th key={i}>{HEADERS[i]}<br/><span style={{color:'#64748b',fontWeight:400}}>{h}</span></th>)}
                </tr></thead>
                <tbody>
                  {rows.slice(0,100).map((r,i)=>(
                    <tr key={i}>
                      <td style={{textAlign:'center',color:'#94a3b8'}}>{i+1}</td>
                      <td>{r.attribute_1||'—'}</td>
                      <td>{r.attribute_2||'—'}</td>
                      <td>{r.buena}</td>
                      <td>{r.desperdicio}</td>
                      <td>{r.retrabajo}</td>
                      <td>{r.loc||'—'}</td>
                      <td>{r.def||'—'}</td>
                      <td>{r.dueno_proceso||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div style={{padding:12,textAlign:'center',color:'#64748b',fontSize:12}}>
                  Mostrando 100 de {rows.length} filas en preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
