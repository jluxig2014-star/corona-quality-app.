'use client'

import { useEffect, useRef, useState } from 'react'
import { DashboardData, ParetoItem, semaColor, semaBg } from '@/lib/logic'

declare const Chart: any

const COLORS = ['#1e40af','#0369a1','#0f766e','#7c3aed','#be185d','#b45309','#15803d','#9333ea','#0284c7','#16a34a','#dc2626','#f97316']

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [selDate, setSelDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEsm, setSelectedEsm] = useState<string | null>(null)
  const [selRoturaDef, setSelRoturaDef] = useState('TODOS')
  const [selLocRef, setSelLocRef] = useState('TODOS')
  const [selLocDef, setSelLocDef] = useState('TODOS')

  const charts = useRef<Record<string, any>>({})

  // ── Fetch dates list ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/dates')
      .then(r => r.json())
      .then(j => { setDates(j.dates || []); if (j.dates?.length) setSelDate(j.dates[0]) })
  }, [])

  // ── Fetch dashboard data when date changes ────────────────────────────────
  useEffect(() => {
    if (!selDate) return
    setLoading(true); setError(''); setSelectedEsm(null)
    fetch(`/api/dashboard?date=${selDate}`)
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else setData(j); setLoading(false) })
      .catch(() => { setError('Error de conexión'); setLoading(false) })
  }, [selDate])

  // ── Re-render charts when data or filters change ──────────────────────────
  useEffect(() => {
    if (!data) return
    renderRankPareto()
    renderParetoGeneral()
    renderRotura()
    renderLoc()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedEsm, selRoturaDef, selLocRef, selLocDef])

  function destroyChart(id: string) {
    if (charts.current[id]) { charts.current[id].destroy(); delete charts.current[id] }
  }

  function drawParetoChart(id: string, items: ParetoItem[], h: number) {
    destroyChart(id)
    const canvas = document.getElementById(id) as HTMLCanvasElement
    if (!canvas || !items.length) return
    canvas.parentElement!.style.height = h + 'px'
    charts.current[id] = new Chart(canvas, {
      data: {
        labels: items.map(d => d.def),
        datasets: [
          { type:'bar', label:'Frecuencia', data: items.map(d => d.v),
            backgroundColor: items.map((_,i) => i<3?'#dc2626':i<7?'#f97316':'#2563b8'),
            borderRadius: 4, yAxisID:'y', order:2 },
          { type:'line', label:'% Acumulado', data: items.map(d => d.cumPct),
            borderColor:'#0f172a', borderWidth:2, pointRadius:0, tension:0, yAxisID:'y2', order:1 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{mode:'index',intersect:false} },
        scales:{
          x:{ ticks:{maxRotation:65,minRotation:65,font:{size:10}}, grid:{display:false} },
          y:{ position:'left', ticks:{font:{size:10}}, grid:{color:'#f1f5f9'} },
          y2:{ position:'right', min:0, max:100, ticks:{font:{size:10},callback:(v:number)=>v+'%'}, grid:{display:false},
            afterDraw(chart:any) {
              const{ctx,chartArea:{left,right},scales:{y2}}=chart
              const y=y2.getPixelForValue(80)
              ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle='#ca8a04';ctx.lineWidth=1.5
              ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke()
              ctx.fillStyle='#ca8a04';ctx.font='9px Segoe UI';ctx.fillText('80%',right+4,y+4);ctx.restore()
            }
          }
        }
      }
    })
  }

  function drawBarChart(id: string, labels: string[], values: number[], h: number) {
    destroyChart(id)
    const canvas = document.getElementById(id) as HTMLCanvasElement
    if (!canvas || !labels.length) return
    canvas.parentElement!.style.height = h + 'px'
    charts.current[id] = new Chart(canvas, {
      type:'bar',
      data:{ labels, datasets:[{ label:'Desperdicio', data:values,
        backgroundColor: labels.map((_,i) => COLORS[i%COLORS.length]), borderRadius:4 }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false} },
        scales:{
          x:{ ticks:{maxRotation:65,minRotation:65,font:{size:10}}, grid:{display:false} },
          y:{ ticks:{font:{size:10}}, grid:{color:'#f1f5f9'} }
        }
      }
    })
  }

  function renderRankPareto() {
    if (!data) return
    let items: ParetoItem[]
    if (!selectedEsm) items = data.globalPareto
    else items = data.esmParetoMap[selectedEsm] || []
    drawParetoChart('chartRankPareto', items, 310)
  }

  function renderParetoGeneral() {
    if (!data) return
    let items: ParetoItem[]
    if (!selectedEsm) items = data.globalPareto
    else items = data.esmAllParetoMap[selectedEsm] || []
    drawParetoChart('chartPareto', items, 380)
  }

  function renderRotura() {
    if (!data) return
    const agg: Record<string, number> = {}
    for (const [ref, defs] of Object.entries(data.roturaMatrix)) {
      // filter by esmaltador: locMatrix already aggregated globally,
      // so we re-filter from raw roturaMatrix (per ref/def, no esm dimension needed for rotura)
      // For esmaltador filter on rotura we use locMatrix to recalculate
      let total = 0
      if (selRoturaDef === 'TODOS') {
        total = Object.values(defs).reduce((s,v)=>s+v,0)
      } else {
        total = defs[selRoturaDef] || 0
      }
      if (total > 0) agg[ref] = total
    }
    // If esmaltador selected, filter via locMatrix
    if (selectedEsm) {
      const esmAgg: Record<string, number> = {}
      for (const [, esms] of Object.entries(data.locMatrix)) {
        const esmRefs = esms[selectedEsm] || {}
        for (const [ref, defs] of Object.entries(esmRefs)) {
          if (selRoturaDef === 'TODOS') {
            esmAgg[ref] = (esmAgg[ref]||0) + Object.values(defs).reduce((s,v)=>s+v,0)
          } else {
            esmAgg[ref] = (esmAgg[ref]||0) + (defs[selRoturaDef]||0)
          }
        }
      }
      const sorted = Object.entries(esmAgg).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
      drawBarChart('chartRotura', sorted.map(d=>d[0]), sorted.map(d=>d[1]), 380)
      return
    }
    const sorted = Object.entries(agg).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
    drawBarChart('chartRotura', sorted.map(d=>d[0]), sorted.map(d=>d[1]), 380)
  }

  function renderLoc() {
    if (!data) return
    const agg: Record<string, number> = {}
    for (const [loc, esms] of Object.entries(data.locMatrix)) {
      const esmList = selectedEsm ? [selectedEsm] : Object.keys(esms)
      let total = 0
      for (const esm of esmList) {
        const refs = esms[esm] || {}
        for (const [ref, defs] of Object.entries(refs)) {
          if (selLocRef !== 'TODOS' && ref !== selLocRef) continue
          for (const [def, v] of Object.entries(defs)) {
            if (selLocDef !== 'TODOS' && def !== selLocDef) continue
            total += v
          }
        }
      }
      if (total > 0) agg[loc] = total
    }
    const sorted = Object.entries(agg).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
    drawBarChart('chartLoc', sorted.map(d=>d[0]), sorted.map(d=>d[1]), 380)
  }

  function handleSelectEsm(nombre: string) {
    setSelectedEsm(prev => prev === nombre ? null : nombre)
  }

  if (loading) return (
    <div>
      <header className="app-header">
        <div><div className="logo">corona<span>Control de Calidad · Esmaltado</span></div></div>
      </header>
      <div className="empty"><div className="spinner" style={{width:40,height:40,margin:'0 auto 16px'}}/><h2>Cargando datos...</h2></div>
    </div>
  )

  if (error) return (
    <div>
      <header className="app-header">
        <div><div className="logo">corona<span>Control de Calidad · Esmaltado</span></div></div>
        <a href="/admin" className="btn btn-outline" style={{fontSize:12}}>⚙ Admin</a>
      </header>
      <div className="empty"><div className="icon">⚠️</div><h2>{error}</h2>
        <p>No hay datos disponibles. <a href="/admin" style={{color:'#2563b8'}}>Subir datos →</a></p></div>
    </div>
  )

  return (
    <div>
      {/* HEADER */}
      <header className="app-header">
        <div><div className="logo">corona<span>Control de Calidad · Esmaltado</span></div></div>
        <a href="/admin" className="btn btn-outline" style={{fontSize:12,padding:'6px 14px'}}>⚙ Admin</a>
      </header>

      {/* DATE BAR */}
      <div className="date-bar">
        <label>Reporte:</label>
        <select value={selDate} onChange={e=>setSelDate(e.target.value)} style={{minWidth:160}}>
          {dates.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        {data && <span className="date-badge">📅 {data.reportDate}</span>}
        {selectedEsm && (
          <span className="active-filter show" style={{marginLeft:'auto'}}>
            🔵 Filtrando: <strong>{selectedEsm}</strong>
            <span onClick={()=>setSelectedEsm(null)} style={{cursor:'pointer',color:'#dc2626',fontWeight:900,marginLeft:4}}>✕</span>
          </span>
        )}
      </div>

      <div className="content">

        {/* 1. RANKING */}
        <section>
          <div className="sec-header">
            <div className="sec-title"><span className="sec-num">1</span> Ranking de Esmaltadores</div>
          </div>
          <div className="ranking-grid">
            <div className="rank-card">
              <div className="rank-hint">👆 Toque un esmaltador para filtrar todas las gráficas</div>
              <table className="rank-table" style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:'#0f172a'}}>
                  <th style={{color:'#94a3b8',textAlign:'center'}}>#</th>
                  <th style={{textAlign:'left'}}>ESMALTADOR</th>
                  <th style={{textAlign:'right'}}>% GRADO A ESM.</th>
                  <th style={{textAlign:'right'}}>% DEF. TERM.</th>
                  <th style={{textAlign:'right'}}>% RAJA</th>
                </tr></thead>
                <tbody>
                  {data?.ranking.map((esm, i) => {
                    const c = semaColor(esm.gradoAEsm), bg = semaBg(esm.gradoAEsm)
                    const isSel = selectedEsm === esm.nombre
                    return (
                      <tr key={esm.nombre} className={isSel ? 'selected' : ''} onClick={()=>handleSelectEsm(esm.nombre)}>
                        <td style={{textAlign:'center',color:'#94a3b8',fontWeight:700}}>{i+1}</td>
                        <td style={{fontWeight:700,color:isSel?'#2563b8':'#0f172a'}}>{esm.nombre}</td>
                        <td style={{textAlign:'right'}}>
                          <span className="badge-sema" style={{background:bg,color:c}}>● {esm.gradoAEsm.toFixed(1)}%</span>
                        </td>
                        <td style={{textAlign:'right',color:'#dc2626',fontWeight:700,fontFamily:'monospace'}}>{esm.defTerm.toFixed(2)}%</td>
                        <td style={{textAlign:'right',color:'#b45309',fontWeight:700,fontFamily:'monospace'}}>{esm.raja.toFixed(2)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="rank-legend">
                <span><span style={{color:'#16a34a',fontWeight:700}}>●</span> &gt;95%</span>
                <span><span style={{color:'#ca8a04',fontWeight:700}}>●</span> 92–95%</span>
                <span><span style={{color:'#dc2626',fontWeight:700}}>●</span> &lt;92%</span>
              </div>
            </div>
            <div className={`pareto-card ${selectedEsm ? 'sel' : ''}`} id="rankParetoCard">
              <div style={{fontWeight:800,fontSize:13}}>Pareto — Defectos Directos</div>
              <div className={`pareto-sub ${selectedEsm ? 'active' : ''}`}>
                {selectedEsm ? `▶ ${selectedEsm}` : '▶ Vista global (toque un esmaltador)'}
              </div>
              <div className="chart-wrap" style={{height:310,marginTop:10}}><canvas id="chartRankPareto"/></div>
            </div>
          </div>
        </section>

        {/* 2. PARETO GENERAL */}
        <section>
          <div className="sec-header">
            <div className="sec-title"><span className="sec-num">2</span> Pareto General de Defectos</div>
            {selectedEsm && <div style={{fontSize:12,color:'#2563b8',fontWeight:600}}>🔵 {selectedEsm}</div>}
          </div>
          <div className="chart-card"><div className="chart-wrap" style={{height:380}}><canvas id="chartPareto"/></div></div>
        </section>

        {/* 3. ROTURA POR REFERENCIA */}
        <section>
          <div className="sec-header">
            <div className="sec-title"><span className="sec-num">3</span> Rotura por Referencia</div>
            <div className="filters">
              <div className="filter-group">
                <label>Defecto:</label>
                <select value={selRoturaDef} onChange={e=>setSelRoturaDef(e.target.value)}>
                  <option value="TODOS">TODOS</option>
                  {data?.allDefs.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="chart-card"><div className="chart-wrap" style={{height:380}}><canvas id="chartRotura"/></div></div>
        </section>

        {/* 4. POSICIÓN DEL DEFECTO */}
        <section>
          <div className="sec-header">
            <div className="sec-title"><span className="sec-num">4</span> Posición del Defecto</div>
            <div className="filters">
              <div className="filter-group">
                <label>Referencia:</label>
                <select value={selLocRef} onChange={e=>setSelLocRef(e.target.value)}>
                  <option value="TODOS">TODOS</option>
                  {data?.allRefs.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>Defecto:</label>
                <select value={selLocDef} onChange={e=>setSelLocDef(e.target.value)}>
                  <option value="TODOS">TODOS</option>
                  {data?.allDefs.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="chart-card"><div className="chart-wrap" style={{height:380}}><canvas id="chartLoc"/></div></div>
        </section>

      </div>
    </div>
  )
}
