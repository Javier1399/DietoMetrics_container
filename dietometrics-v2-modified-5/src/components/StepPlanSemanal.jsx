import { useState, useEffect, useRef } from 'react'
import { exportarPDF } from '../utils/exportPDF.js'

const DIA_ICONOS = ['☀️','🌤','⛅','🌥','🌙','🎉','😴','🌈','⭐','🌟']

// ── localStorage ──────────────────────────────────────────────────────────────
const lsKey = (n) => `dietometrics_plan_${(n||'default').replace(/\s/g,'_')}`
const lsLoad = (n) => { try { return JSON.parse(localStorage.getItem(lsKey(n))||'null') } catch { return null } }
const lsSave = (n, data) => { try { localStorage.setItem(lsKey(n), JSON.stringify(data)) } catch {} }

// ── Helpers ───────────────────────────────────────────────────────────────────
let _idSeq = 0
const newId = () => `d_${Date.now()}_${_idSeq++}`

function safeClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)) } catch { return obj }
}

function calcDia(dia) {
  if (!dia?.menuFinal) return { kcal:0, p:0, c:0, g:0 }
  let kcal=0, p=0, c=0, g=0
  Object.values(dia.menuFinal).forEach(t =>
    (t.alimentos||[]).forEach(a => {
      kcal += a.energia_kcal||0; p += a.proteina_g||0; c += a.hc_g||0; g += a.lipidos_g||0
    })
  )
  return { kcal:Math.round(kcal), p:+(p).toFixed(1), c:+(c).toFixed(1), g:+(g).toFixed(1) }
}
const fmt1 = n => (Math.round(n*10)/10).toFixed(1)

// Asegura que cada día tenga un id estable
function normalizarDias(dias) {
  return (dias||[]).map(d => d._id ? d : { ...d, _id: newId() })
}

// ══════════════════════════════════════════════════════════════════════════════
export default function StepPlanSemanal({
  paciente, macros, menuResultHoy, equivalencias,
  nombreNuevoDia,   // viene de StepReceta cuando el usuario hizo "Agregar al plan"
  onBack, onEditarDia, allData, onCargarSesion,
}) {
  const pNombre = paciente?.nombre || 'default'

  // Si viene una sesión importada (desde cargar archivo), la usamos para inicializar
  const sesionImportada = allData?._sesionImportada

  // ── Días del plan ────────────────────────────────────────────────────────────
  const [dias, setDias] = useState(() => {
    if (sesionImportada?.dias?.length) return normalizarDias(sesionImportada.dias)
    const guardado = lsLoad(pNombre)
    if (guardado?.dias?.length) return normalizarDias(guardado.dias)
    if (menuResultHoy) {
      return [{ _id:newId(), nombre: nombreNuevoDia || 'Día 1', menuFinal:menuResultHoy.menuFinal, tiempos:menuResultHoy.tiempos }]
    }
    return []
  })

  // ── Ficha clínica ────────────────────────────────────────────────────────────
  const [ficha, setFicha] = useState(() => {
    if (sesionImportada?.ficha) return sesionImportada.ficha
    const g = lsLoad(pNombre)
    return g?.ficha || { consultas:[], proximaCita:'', recordatorios:[] }
  })

  const [tab, setTab] = useState('plan')  // 'plan'|'ficha'|'exportar'|'sesion'

  // ── Agregar día que viene de StepReceta ──────────────────────────────────────
  useEffect(() => {
    if (nombreNuevoDia && menuResultHoy) {
      setDias(prev => {
        const yaExiste = prev.some(d => d.nombre === nombreNuevoDia)
        if (yaExiste) return prev
        return [...prev, {
          _id: newId(),
          nombre: nombreNuevoDia,
          menuFinal: safeClone(menuResultHoy.menuFinal),
          tiempos: menuResultHoy.tiempos,
        }]
      })
    }
  }, [nombreNuevoDia, menuResultHoy])

  // ── Persistencia ─────────────────────────────────────────────────────────────
  useEffect(() => {
    lsSave(pNombre, { dias, ficha })
  }, [dias, ficha, pNombre])

  // ── Mutations días ────────────────────────────────────────────────────────────
  const renombrarDia = (i, nombre) =>
    setDias(d => d.map((x,j) => j===i ? {...x, nombre} : x))

  const eliminarDia = (i) =>
    setDias(d => d.filter((_,j) => j!==i))

  const copiarDia = (origen, destino) =>
    setDias(d => {
      if (origen >= d.length || destino >= d.length) return d
      const base = d[origen]
      return d.map((x, i) => i===destino
        ? { ...x, menuFinal: safeClone(base.menuFinal), tiempos: base.tiempos, _copia: true }
        : x
      )
    })

  const agregarDia = (base) =>
    setDias(d => {
      const nombre = `Día ${d.length + 1}`
      if (base?.menuFinal) {
        return [...d, { _id:newId(), nombre, menuFinal:safeClone(base.menuFinal), tiempos:base.tiempos, _copia:true }]
      }
      return [...d, { _id:newId(), nombre }]
    })

  // ── Editar día (regresar al menú) ────────────────────────────────────────────
  const editarDia = (i, punto) => onEditarDia(i, punto, dias[i])

  // ── Promedios ─────────────────────────────────────────────────────────────────
  const kcalObj = macros?.kcal_resultantes || macros?.kcal_objetivo || 0
  const diasConMenu = dias.filter(d => d.menuFinal)
  const prom = diasConMenu.length > 0
    ? diasConMenu.reduce((acc,d) => { const r=calcDia(d); return {kcal:acc.kcal+r.kcal,p:acc.p+r.p,c:acc.c+r.c,g:acc.g+r.g} }, {kcal:0,p:0,c:0,g:0})
    : null
  if (prom && diasConMenu.length > 0) {
    const n = diasConMenu.length
    Object.keys(prom).forEach(k => { prom[k] = Math.round(prom[k]/n*10)/10 })
  }

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.75rem' }}>
        <div>
          <h2 style={{ fontFamily:'Fraunces,serif', fontSize:'1.6rem', marginBottom:0 }}>Plan alimenticio</h2>
          <p style={{ color:'var(--muted)', fontSize:'.88rem', margin:0 }}>
            {paciente?.nombre} · objetivo {Math.round(kcalObj)} kcal/día
            {prom && <span style={{ marginLeft:8, color:'var(--sage)', fontWeight:600 }}>· promedio real {prom.kcal} kcal</span>}
          </p>
        </div>
        <button className="btn-secondary" style={{ fontSize:'.82rem' }} onClick={onBack}>← Volver a receta</button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:'1.25rem', background:'var(--border)', borderRadius:10, padding:4 }}>
        {[
          {id:'plan',    label:'📋 Plan'},
          {id:'ficha',   label:'🏥 Ficha clínica'},
          {id:'exportar',label:'📥 Exportar'},
          {id:'sesion',  label:'💾 Sesión'},
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'.5rem', borderRadius:8, fontWeight:600, fontSize:'.83rem',
            background: tab===t.id ? 'var(--warm-white)' : 'transparent',
            color: tab===t.id ? 'var(--sage)' : 'var(--muted)',
            boxShadow: tab===t.id ? 'var(--shadow-sm)' : 'none', transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB: Plan ── */}
      {tab==='plan' && (
        <PlanTab
          dias={dias} kcalObj={kcalObj} prom={prom}
          macros={macros}
          onRenombrar={renombrarDia}
          onEliminar={eliminarDia}
          onCopiar={copiarDia}
          onAgregar={agregarDia}
          onEditar={editarDia}
          onExportarDia={(i) => exportarDiaPDF(dias[i], paciente, macros, equivalencias)}
        />
      )}

      {/* ── TAB: Ficha clínica ── */}
      {tab==='ficha' && (
        <FichaTab ficha={ficha} setFicha={setFicha} paciente={paciente}/>
      )}

      {/* ── TAB: Exportar ── */}
      {tab==='exportar' && (
        <ExportarTab
          dias={dias} paciente={paciente} macros={macros}
          equivalencias={equivalencias} ficha={ficha}
          onExportarDia={(i) => exportarDiaPDF(dias[i], paciente, macros, equivalencias)}
        />
      )}

      {/* ── TAB: Sesión ── */}
      {tab==='sesion' && (
        <SesionTab
          allData={allData} dias={dias} ficha={ficha}
          paciente={paciente}
          onCargarSesion={onCargarSesion}
        />
      )}
    </div>
  )
}

// ══ TAB PLAN ══════════════════════════════════════════════════════════════════
function PlanTab({ dias, kcalObj, prom, macros, onRenombrar, onEliminar, onCopiar, onAgregar, onEditar, onExportarDia }) {
  const [modal, setModal] = useState(null)  // índice del día gestionado

  return (
    <>
      {/* Chips de resumen */}
      {prom && (
        <div style={{ display:'flex', gap:10, marginBottom:'1.25rem', flexWrap:'wrap' }}>
          {[
            {icon:'📅', l:'Días con menú', v:`${dias.filter(d=>d.menuFinal).length} / ${dias.length}`, c:'var(--sage)'},
            {icon:'🔥', l:'Prom. kcal',  v:prom.kcal, c:Math.abs(prom.kcal-kcalObj)<80?'var(--sage)':'var(--amber)'},
            {icon:'🥩', l:'Prom. P',     v:`${prom.p}g`, c:'#4a7c59'},
            {icon:'🌾', l:'Prom. C',     v:`${prom.c}g`, c:'#2a7a8c'},
            {icon:'🥑', l:'Prom. G',     v:`${prom.g}g`, c:'#c4702a'},
          ].map(s => (
            <div key={s.l} style={{ display:'flex', alignItems:'center', gap:8, padding:'.4rem .9rem',
              background:'var(--warm-white)', borderRadius:99, border:'1px solid var(--border)' }}>
              <span>{s.icon}</span>
              <div>
                <div style={{ fontSize:'.63rem', color:'var(--muted)', textTransform:'uppercase' }}>{s.l}</div>
                <div style={{ fontWeight:700, color:s.c, fontSize:'.88rem', lineHeight:1 }}>{s.v}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid de días */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {dias.map((dia, i) => (
          <DiaTarjeta key={dia._id || i} dia={dia} indice={i} icon={DIA_ICONOS[i%DIA_ICONOS.length]}
            kcalObj={kcalObj}
            onGestionar={() => setModal(i)}
            onRenombrar={(n) => onRenombrar(i, n)}
            onExportar={() => onExportarDia(i)}/>
        ))}

        {/* Botón agregar */}
        <button onClick={() => onAgregar(null)} style={{
          minHeight:160, borderRadius:'var(--radius)', cursor:'pointer',
          border:'2px dashed var(--border)', background:'transparent',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:8, color:'var(--muted)', fontSize:'.88rem', transition:'all .2s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--sage)';e.currentTarget.style.color='var(--sage)'}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--muted)'}}>
          <span style={{ fontSize:'1.8rem' }}>+</span>
          <span>Agregar día</span>
        </button>
      </div>

      {/* Tabla resumen */}
      {dias.length >= 2 && <TablaResumen dias={dias} kcalObj={kcalObj} macros={macros}/>}

      {/* Modal gestión día */}
      {modal !== null && dias[modal] && (
        <ModalGestionDia
          dia={dias[modal]} indice={modal} totalDias={dias.length}
          onClose={() => setModal(null)}
          onEditar={(punto) => { setModal(null); onEditar(modal, punto) }}
          onEliminar={() => { onEliminar(modal); setModal(null) }}
          onCopiarA={(dest) => { onCopiar(modal, dest); setModal(null) }}
          onAgregarCopia={() => { onAgregar(dias[modal]); setModal(null) }}
        />
      )}
    </>
  )
}

// ── Tarjeta de día ─────────────────────────────────────────────────────────────
function DiaTarjeta({ dia, indice, icon, kcalObj, onGestionar, onRenombrar, onExportar }) {
  const [editando, setEditando] = useState(false)
  const [nombre,   setNombre]   = useState(dia.nombre)

  // Sincronizar si el nombre cambia desde afuera (ej. renombrado en otro lugar)
  useEffect(() => { if (!editando) setNombre(dia.nombre) }, [dia.nombre, editando])

  const confirmarNombre = () => {
    const n = nombre.trim() || dia.nombre
    onRenombrar(n)
    setNombre(n)
    setEditando(false)
  }

  const res = calcDia(dia)
  const tieneMenu = !!dia.menuFinal
  const pctKcal   = kcalObj > 0 ? Math.min(130,(res.kcal/kcalObj)*100) : 0
  const barColor  = Math.abs(res.kcal-kcalObj) < kcalObj*.05 ? 'var(--sage)'
    : res.kcal > kcalObj ? 'var(--rose)' : 'var(--amber)'

  return (
    <div className="card" style={{ padding:'1rem', position:'relative' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.65rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
          <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{icon}</span>
          {editando ? (
            <input ref={inputRef} autoFocus value={nombre}
              onChange={e=>setNombre(e.target.value)}
              onBlur={confirmarNombre}
              onKeyDown={e=>{ if(e.key==='Enter') confirmarNombre(); if(e.key==='Escape') setEditando(false) }}
              style={{ flex:1, fontWeight:700, fontFamily:'Fraunces,serif', fontSize:'1rem',
                border:'none', borderBottom:'2px solid var(--sage)', outline:'none',
                background:'transparent', padding:'0 2px' }}/>
          ) : (
            <div style={{ fontWeight:700, fontFamily:'Fraunces,serif', fontSize:'1rem',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              cursor:'text', flex:1 }}
              onDoubleClick={() => setEditando(true)}
              title="Doble click para renombrar">
              {dia.nombre}
            </div>
          )}
          <button className="btn-ghost" style={{ padding:'2px 5px', fontSize:'.7rem', flexShrink:0 }}
            onClick={() => setEditando(true)} title="Renombrar">✏️</button>
        </div>
        <div style={{
          width:26, height:26, borderRadius:'50%', flexShrink:0, marginLeft:4,
          background:tieneMenu?'var(--sage)':'var(--cream)',
          border:`2px solid ${tieneMenu?'var(--sage)':'var(--border)'}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'.72rem', color:tieneMenu?'#fff':'var(--muted)',
        }}>{tieneMenu?'✓':'—'}</div>
      </div>

      {tieneMenu ? (
        <>
          <div style={{ fontSize:'1.4rem', fontWeight:700, color:'var(--sage)', lineHeight:1 }}>{res.kcal}</div>
          <div style={{ fontSize:'.7rem', color:'var(--muted)', marginBottom:6 }}>kcal · obj {Math.round(kcalObj)}</div>
          <div style={{ background:'var(--border)', borderRadius:99, height:5, overflow:'hidden', marginBottom:8 }}>
            <div style={{ width:`${Math.min(pctKcal,100)}%`, height:'100%', background:barColor, borderRadius:99 }}/>
          </div>
          <div style={{ display:'flex', gap:5, fontSize:'.69rem', marginBottom:8 }}>
            {[{l:'P',v:res.p,c:'#4a7c59'},{l:'C',v:res.c,c:'#2a7a8c'},{l:'G',v:res.g,c:'#c4702a'}].map(m => (
              <span key={m.l} style={{ background:'var(--cream)', borderRadius:4, padding:'2px 5px', color:m.c, fontWeight:600 }}>
                {m.l} {m.v}g
              </span>
            ))}
          </div>
          {dia.tiempos && <div style={{ fontSize:'.7rem', color:'var(--muted)', marginBottom:8 }}>{dia.tiempos.map(t=>t.nombre).join(' · ')}</div>}
        </>
      ) : (
        <div style={{ color:'var(--muted)', fontSize:'.82rem', margin:'.75rem 0', fontStyle:'italic' }}>
          Sin menú definido
        </div>
      )}

      {/* Acciones */}
      <div style={{ display:'flex', gap:5 }}>
        <button className="btn-ghost" style={{ flex:1, fontSize:'.75rem', padding:'.3rem' }}
          onClick={onGestionar}>⚙️ Gestionar</button>
        {tieneMenu && (
          <button className="btn-ghost" style={{ fontSize:'.75rem', padding:'.3rem .6rem' }}
            title="Exportar este día" onClick={onExportar}>⬇ PDF</button>
        )}
      </div>
    </div>
  )
}

// ── Tabla resumen semanal ──────────────────────────────────────────────────────
function TablaResumen({ dias, kcalObj, macros }) {
  const obj = macros?.macros_g || {}
  const diasConMenu = dias.filter(d=>d.menuFinal)
  const n = diasConMenu.length
  const prom = n > 0 ? diasConMenu.reduce((acc,d) => {
    const r=calcDia(d); return {kcal:acc.kcal+r.kcal,p:acc.p+r.p,c:acc.c+r.c,g:acc.g+r.g}
  }, {kcal:0,p:0,c:0,g:0}) : null
  if (prom && n > 0) { const nf=n; Object.keys(prom).forEach(k => prom[k]=+(prom[k]/nf).toFixed(1)) }

  return (
    <div className="card" style={{ padding:'1.1rem' }}>
      <h4 style={{ fontSize:'.95rem', color:'var(--sage)', marginBottom:'1rem' }}>
        📊 Resumen · {dias.length} días
      </h4>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.8rem' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid var(--border)' }}>
              {['Día','kcal','P (g)','C (g)','G (g)','vs obj.'].map(h => (
                <th key={h} style={{ padding:'6px 8px', color:'var(--muted)', fontWeight:600,
                  textAlign:h==='Día'?'left':'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((dia,i) => {
              const r=calcDia(dia); const diff=r.kcal-kcalObj
              const ok=Math.abs(diff)<kcalObj*.05
              return (
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'6px 8px', fontWeight:600 }}>{DIA_ICONOS[i%DIA_ICONOS.length]} {dia.nombre}</td>
                  <td style={{ textAlign:'right', padding:'6px 8px', fontWeight:700 }}>{r.kcal||'—'}</td>
                  <td style={{ textAlign:'right', padding:'6px 8px', color:'#4a7c59' }}>{r.p||'—'}</td>
                  <td style={{ textAlign:'right', padding:'6px 8px', color:'#2a7a8c' }}>{r.c||'—'}</td>
                  <td style={{ textAlign:'right', padding:'6px 8px', color:'#c4702a' }}>{r.g||'—'}</td>
                  <td style={{ textAlign:'right', padding:'6px 8px' }}>
                    {r.kcal > 0 && <span style={{ color:ok?'var(--sage)':Math.abs(diff)<kcalObj*.1?'var(--amber)':'var(--rose)', fontWeight:600, fontSize:'.75rem' }}>
                      {diff>0?'+':''}{Math.round(diff)}
                    </span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {prom && n >= 2 && (
            <tfoot>
              <tr style={{ background:'var(--sage-pale)', fontWeight:700, borderTop:'2px solid var(--sage)' }}>
                <td style={{ padding:'6px 8px', color:'var(--sage)' }}>📈 Promedio</td>
                <td style={{ textAlign:'right', padding:'6px 8px' }}>{prom.kcal}</td>
                <td style={{ textAlign:'right', padding:'6px 8px', color:'#4a7c59' }}>{prom.p}</td>
                <td style={{ textAlign:'right', padding:'6px 8px', color:'#2a7a8c' }}>{prom.c}</td>
                <td style={{ textAlign:'right', padding:'6px 8px', color:'#c4702a' }}>{prom.g}</td>
                <td style={{ textAlign:'right', padding:'6px 8px', fontSize:'.75rem', color:'var(--muted)' }}>
                  obj {Math.round(kcalObj)} kcal
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── Modal: gestionar día ───────────────────────────────────────────────────────
function ModalGestionDia({ dia, indice, totalDias, onClose, onEditar, onEliminar, onCopiarA, onAgregarCopia }) {
  const [copiarA, setCopiarA] = useState(false)
  const [dest, setDest]       = useState(null)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(28,43,30,.4)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={onClose}>
      <div className="card-raised fade-up" style={{ width:'100%', maxWidth:460, padding:'1.5rem' }}
        onClick={e=>e.stopPropagation()}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.1rem' }}>{dia.nombre}</h3>
          <button className="btn-ghost" style={{ padding:'.2rem .5rem' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'.55rem' }}>
          {dia.menuFinal && (<>
            <OpBtn icon="✏️" title="Ajustar gramos directamente"
              sub="Abre el editor de cantidades — lo más rápido para cambios menores"
              onClick={() => onEditar('edit')} highlight/>

            <OpBtn icon="🥦" title="Cambiar alimentos (mismos grupos)"
              sub="Mantiene la configuración de tiempos, elige otros alimentos"
              onClick={() => onEditar('alimentos')}/>

            <OpBtn icon="⚙️" title="Reconfigurar desde tiempos"
              sub="Cambia nombres de comidas, grupos y alimentos"
              onClick={() => onEditar('config')}/>
          </>)}

          {!copiarA ? (
            <OpBtn icon="📋" title="Copiar a otro día"
              sub="Usa este menú como base de otro día ya existente"
              onClick={() => setCopiarA(true)}/>
          ) : (
            <div style={{ background:'var(--cream)', borderRadius:8, padding:'.75rem' }}>
              <div style={{ fontSize:'.82rem', fontWeight:600, marginBottom:'.5rem' }}>Copiar a:</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem', marginBottom:'.6rem' }}>
                {Array.from({length:totalDias},(_,i)=>i).filter(i=>i!==indice).map(i => (
                  <button key={i} onClick={() => setDest(i)} style={{
                    padding:'.3rem .7rem', borderRadius:99, fontSize:'.78rem', cursor:'pointer',
                    background:dest===i?'var(--sage)':'var(--warm-white)',
                    color:dest===i?'#fff':'var(--ink-mid)',
                    border:`1.5px solid ${dest===i?'var(--sage)':'var(--border)'}` }}>
                    Día {i+1}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'.5rem' }}>
                <button className="btn-ghost" style={{ flex:1,fontSize:'.8rem' }}
                  onClick={() => { setCopiarA(false); setDest(null) }}>Cancelar</button>
                <button className="btn-primary" style={{ flex:1,fontSize:'.8rem' }}
                  disabled={dest===null} onClick={() => onCopiarA(dest)}>Copiar</button>
              </div>
            </div>
          )}

          <OpBtn icon="➕" title="Agregar como nuevo día"
            sub="Crea un nuevo día copiando este menú como base"
            onClick={onAgregarCopia}/>

          <button style={{ width:'100%', padding:'.5rem', borderRadius:8, cursor:'pointer',
            background:'var(--warm-white)', color:'var(--rose)', border:'1.5px solid #f0c0c0',
            fontSize:'.85rem', fontWeight:600 }} onClick={onEliminar}>
            🗑 Eliminar este día
          </button>
        </div>
      </div>
    </div>
  )
}

function OpBtn({ icon, title, sub, onClick, highlight }) {
  return (
    <button style={{ width:'100%', textAlign:'left', display:'flex', alignItems:'center', gap:12,
      padding:'.6rem .85rem', borderRadius:9, cursor:'pointer', transition:'all .15s',
      background:highlight?'var(--sage-pale)':'var(--warm-white)',
      border:`1.5px solid ${highlight?'var(--sage)':'var(--border)'}` }}
      onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--sage)';e.currentTarget.style.background='var(--sage-pale)'}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=highlight?'var(--sage)':'var(--border)';e.currentTarget.style.background=highlight?'var(--sage-pale)':'var(--warm-white)'}}>
      <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight:600, fontSize:'.88rem' }}>{title}</div>
        {sub && <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:2 }}>{sub}</div>}
      </div>
    </button>
  )
}

// ══ TAB FICHA CLÍNICA ═════════════════════════════════════════════════════════
function FichaTab({ ficha, setFicha, paciente }) {
  const [formConsulta, setFormConsulta] = useState({
    fecha: new Date().toISOString().slice(0,10),
    peso: '', cintura: '', cadera: '', pct_grasa: '',
    notas: '', planRef: '',
  })
  const [formCita, setFormCita] = useState(ficha.proximaCita || '')
  const [formRecordatorio, setFormRecordatorio] = useState('')

  const agregarConsulta = () => {
    if (!formConsulta.fecha) return
    setFicha(f => ({
      ...f,
      consultas: [{ ...formConsulta, id: Date.now() }, ...(f.consultas||[])]
    }))
    setFormConsulta({ fecha:new Date().toISOString().slice(0,10), peso:'',cintura:'',cadera:'',pct_grasa:'',notas:'',planRef:'' })
  }

  const eliminarConsulta = (id) => setFicha(f => ({ ...f, consultas:f.consultas.filter(c=>c.id!==id) }))

  const guardarCita = () => setFicha(f => ({ ...f, proximaCita:formCita }))

  const agregarRecordatorio = () => {
    if (!formRecordatorio.trim()) return
    setFicha(f => ({ ...f, recordatorios:[...(f.recordatorios||[]), { texto:formRecordatorio.trim(), id:Date.now() }] }))
    setFormRecordatorio('')
  }

  const borrarRecordatorio = (id) => setFicha(f => ({ ...f, recordatorios:f.recordatorios.filter(r=>r.id!==id) }))

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.25rem' }}>
      {/* Left: historial + nueva consulta */}
      <div>
        {/* Nueva consulta */}
        <div className="card" style={{ padding:'1.1rem', marginBottom:'1rem' }}>
          <h4 style={{ fontSize:'.9rem', color:'var(--sage)', marginBottom:'.85rem' }}>➕ Registrar consulta</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.75rem', marginBottom:'.75rem' }}>
            {[
              {label:'Fecha',     key:'fecha',    type:'date'},
              {label:'Peso (kg)', key:'peso',     type:'number', placeholder:'70.5'},
              {label:'Cintura (cm)', key:'cintura', type:'number', placeholder:'90'},
              {label:'Cadera (cm)', key:'cadera',  type:'number', placeholder:'100'},
              {label:'% Grasa',   key:'pct_grasa',type:'number', placeholder:'25'},
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize:'.72rem', color:'var(--muted)', display:'block', marginBottom:3 }}>{f.label}</label>
                <input className="input-field" type={f.type} step={f.type==='number'?'.1':undefined}
                  placeholder={f.placeholder} value={formConsulta[f.key]}
                  onChange={e=>setFormConsulta(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:'.75rem' }}>
            <label style={{ fontSize:'.72rem', color:'var(--muted)', display:'block', marginBottom:3 }}>Notas de consulta</label>
            <textarea className="input-field" rows={3} placeholder="Observaciones, cambios, indicaciones..."
              value={formConsulta.notas} onChange={e=>setFormConsulta(p=>({...p,notas:e.target.value}))}
              style={{ resize:'vertical', fontSize:'.85rem' }}/>
          </div>
          <button className="btn-primary" style={{ width:'100%' }} onClick={agregarConsulta}>
            Guardar consulta
          </button>
        </div>

        {/* Historial */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {(ficha.consultas||[]).length === 0 && (
            <div className="card" style={{ padding:'1.5rem', textAlign:'center', color:'var(--muted)' }}>
              <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>📋</div>
              <div>Sin consultas registradas aún</div>
            </div>
          )}
          {(ficha.consultas||[]).map((c, i) => (
            <div key={c.id||i} className="card" style={{ padding:'1rem', borderLeft:'3px solid var(--sage)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.6rem' }}>
                <div style={{ fontWeight:700, fontSize:'.95rem', fontFamily:'Fraunces,serif' }}>
                  {new Date(c.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}
                </div>
                <button className="btn-ghost" style={{ color:'var(--rose)', fontSize:'.75rem' }}
                  onClick={() => eliminarConsulta(c.id)}>✕</button>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:c.notas?.trim()?'.6rem':0 }}>
                {[['⚖️','Peso',`${c.peso} kg`],['📏','Cintura',`${c.cintura} cm`],
                  ['📐','Cadera',`${c.cadera} cm`],['📊','% Grasa',`${c.pct_grasa}%`]].map(([icon,label,val]) =>
                  c[label.toLowerCase().replace('% ','')] ? (
                    <span key={label} style={{ background:'var(--cream)', borderRadius:5, padding:'3px 8px', fontSize:'.78rem' }}>
                      {icon} {label}: <strong>{val}</strong>
                    </span>
                  ) : null
                )}
              </div>
              {c.notas?.trim() && (
                <div style={{ fontSize:'.82rem', color:'var(--ink-mid)', fontStyle:'italic', background:'var(--cream)',
                  borderRadius:6, padding:'.5rem .75rem' }}>{c.notas}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: próxima cita + recordatorios + gráfica peso */}
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {/* Próxima cita */}
        <div className="card" style={{ padding:'1rem' }}>
          <h4 style={{ fontSize:'.88rem', color:'var(--teal)', marginBottom:'.75rem' }}>📅 Próxima cita</h4>
          <input className="input-field" type="date" value={formCita}
            onChange={e=>setFormCita(e.target.value)}/>
          {formCita && (
            <div style={{ fontSize:'.78rem', color:'var(--sage)', marginTop:6, fontWeight:600 }}>
              {Math.round((new Date(formCita)-new Date())/86400000)} días a partir de hoy
            </div>
          )}
          <button className="btn-secondary" style={{ width:'100%', marginTop:8 }} onClick={guardarCita}>
            Guardar fecha
          </button>
        </div>

        {/* Recordatorios */}
        <div className="card" style={{ padding:'1rem' }}>
          <h4 style={{ fontSize:'.88rem', color:'var(--amber)', marginBottom:'.75rem' }}>📝 Recordatorios</h4>
          <div style={{ display:'flex', gap:6, marginBottom:'.6rem' }}>
            <input className="input-field" placeholder="Añadir recordatorio..."
              value={formRecordatorio} onChange={e=>setFormRecordatorio(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&agregarRecordatorio()}
              style={{ flex:1, fontSize:'.83rem' }}/>
            <button className="btn-primary" style={{ padding:'.4rem .7rem' }} onClick={agregarRecordatorio}>+</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(ficha.recordatorios||[]).map((r,i) => (
              <div key={r.id||i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'.4rem .65rem', background:'var(--cream)', borderRadius:6, fontSize:'.82rem' }}>
                <span>• {r.texto}</span>
                <button className="btn-ghost" style={{ color:'var(--rose)', padding:'0 4px', fontSize:'.75rem' }}
                  onClick={() => borrarRecordatorio(r.id)}>✕</button>
              </div>
            ))}
            {!(ficha.recordatorios||[]).length && (
              <div style={{ fontSize:'.78rem', color:'var(--muted)', fontStyle:'italic', textAlign:'center' }}>Sin recordatorios</div>
            )}
          </div>
        </div>

        {/* Mini-gráfica peso */}
        {(ficha.consultas||[]).filter(c=>c.peso).length >= 2 && (
          <div className="card" style={{ padding:'1rem' }}>
            <h4 style={{ fontSize:'.88rem', color:'var(--sage)', marginBottom:'.75rem' }}>⚖️ Evolución del peso</h4>
            <MiniLineChart
              data={(ficha.consultas||[]).filter(c=>c.peso).slice(0,8).reverse().map(c => ({
                x: new Date(c.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}),
                y: parseFloat(c.peso),
              }))}
              color="var(--sage)"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mini line chart SVG ────────────────────────────────────────────────────────
function MiniLineChart({ data, color }) {
  if (!data || data.length < 2) return null
  const W=260, H=80, pad=10
  const ys = data.map(d=>d.y)
  const minY=Math.min(...ys), maxY=Math.max(...ys)
  const rng = maxY-minY || 1
  const pts = data.map((d,i) => {
    const x = pad + (i/(data.length-1))*(W-2*pad)
    const y = H-pad - ((d.y-minY)/rng)*(H-2*pad)
    return { x, y, label:d.x, val:d.y }
  })
  const d = `M ${pts.map(p=>`${p.x},${p.y}`).join(' L ')}`
  return (
    <svg viewBox={`0 0 ${W} ${H+20}`} style={{ width:'100%' }}>
      <polyline points={pts.map(p=>`${p.x},${p.y}`).join(' ')}
        fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round"/>
      {pts.map((p,i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={color}/>
          <text x={p.x} y={p.y-7} textAnchor="middle" fontSize={9} fill="#888">{p.val}</text>
          <text x={p.x} y={H+15} textAnchor="middle" fontSize={7.5} fill="#aaa">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ══ TAB EXPORTAR ══════════════════════════════════════════════════════════════
function ExportarTab({ dias, paciente, macros, equivalencias, ficha, onExportarDia }) {
  const [exportandoPlan, setExportandoPlan] = useState(false)

  const exportarPlanCompleto = async () => {
    setExportandoPlan(true)
    try {
      await exportarPlanPDF({ dias, paciente, macros, equivalencias, ficha })
    } catch(e) { alert('Error al generar PDF: ' + e.message) }
    setExportandoPlan(false)
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
      {/* Exportar plan completo */}
      <div className="card-raised" style={{ padding:'1.5rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📚</div>
        <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', color:'var(--sage)', marginBottom:'.5rem' }}>
          Plan completo (todos los días)
        </h3>
        <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:'1rem' }}>
          Un PDF con portada del paciente, todos los menús del plan y resumen semanal con gráficas.
        </p>
        <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:4, marginBottom:'1.25rem', fontSize:'.83rem' }}>
          {['Datos del paciente','Tabla de macros objetivo','Un menú por página con gráfica de barras',
            'Resumen semanal con promedios'].map(t => (
            <li key={t} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ color:'var(--sage)' }}>✓</span>{t}
            </li>
          ))}
        </ul>
        <button className="btn-primary" style={{ width:'100%', padding:'.75rem' }}
          onClick={exportarPlanCompleto} disabled={exportandoPlan || dias.length===0}>
          {exportandoPlan
            ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/>Generando...</>
            : `⬇ Exportar plan (${dias.length} días)`}
        </button>
      </div>

      {/* Exportar días individuales */}
      <div className="card" style={{ padding:'1.5rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📄</div>
        <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', color:'var(--teal)', marginBottom:'.5rem' }}>
          Exportar día individual
        </h3>
        <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:'1rem' }}>
          Descarga la receta de un día específico.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
          {dias.map((dia, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'.5rem .75rem', background:'var(--cream)', borderRadius:7 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>{DIA_ICONOS[i%DIA_ICONOS.length]}</span>
                <span style={{ fontWeight:600, fontSize:'.88rem' }}>{dia.nombre}</span>
                {dia.menuFinal && (
                  <span style={{ fontSize:'.7rem', color:'var(--sage)' }}>{calcDia(dia).kcal} kcal</span>
                )}
              </div>
              <button className="btn-ghost" style={{ fontSize:'.78rem', padding:'.3rem .65rem' }}
                disabled={!dia.menuFinal} onClick={() => onExportarDia(i)}>
                ⬇ PDF
              </button>
            </div>
          ))}
          {dias.length===0 && (
            <div style={{ fontSize:'.82rem', color:'var(--muted)', fontStyle:'italic', textAlign:'center', padding:'1rem' }}>
              Agrega días al plan primero
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ══ TAB SESIÓN ═══════════════════════════════════════════════════════════════
function SesionTab({ allData, dias, ficha, paciente, onCargarSesion }) {
  const fileRef = useRef()
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState(null)

  const guardarSesion = () => {
    const sesion = {
      version: '6.0',
      fecha_guardado: new Date().toISOString(),
      paciente:           allData?.paciente,
      resultadoPaciente:  allData?.resultadoPaciente,
      kcalSugeridas:      allData?.kcalSugeridas,
      macros:             allData?.macros,
      equivalencias:      allData?.equivalencias,
      menuResult:         allData?.menuResult,
      dias,
      ficha,
    }
    const blob = new Blob([JSON.stringify(sesion, null, 2)], { type:'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `DietoMetrics_${(paciente?.nombre||'paciente').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.dietometrics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cargarSesion = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCargando(true); setMsg(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const sesion = JSON.parse(ev.target.result)
        if (!sesion.version) throw new Error('Archivo no válido')
        onCargarSesion({
          paciente:          sesion.paciente,
          resultadoPaciente: sesion.resultadoPaciente,
          kcalSugeridas:     sesion.kcalSugeridas,
          macros:            sesion.macros,
          equivalencias:     sesion.equivalencias,
          menuResult:        sesion.menuResult,
          // Los días y ficha se cargan en StepPlanSemanal vía localStorage
          _sesionImportada: { dias: sesion.dias, ficha: sesion.ficha },
        })
        setMsg({ tipo:'ok', texto:`Sesión de ${sesion.paciente?.nombre || 'paciente'} cargada correctamente.` })
      } catch(err) {
        setMsg({ tipo:'error', texto:'Archivo no válido o corrupto.' })
      }
      setCargando(false)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
      {/* Guardar */}
      <div className="card-raised" style={{ padding:'1.5rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>💾</div>
        <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', color:'var(--sage)', marginBottom:'.5rem' }}>
          Guardar sesión
        </h3>
        <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:'1rem' }}>
          Descarga un archivo <code>.dietometrics</code> con toda la información del paciente, plan y ficha clínica. Puedes retomarlo en cualquier momento.
        </p>
        <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:4, marginBottom:'1.25rem', fontSize:'.83rem' }}>
          {['Datos del paciente y cálculos','Macros y distribución SMAE',
            'Todos los días del plan','Ficha clínica e historial'].map(t => (
            <li key={t} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ color:'var(--sage)' }}>✓</span>{t}
            </li>
          ))}
        </ul>
        <button className="btn-primary" style={{ width:'100%', padding:'.75rem' }} onClick={guardarSesion}>
          ⬇ Descargar .dietometrics
        </button>
      </div>

      {/* Cargar */}
      <div className="card" style={{ padding:'1.5rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📂</div>
        <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', color:'var(--teal)', marginBottom:'.5rem' }}>
          Cargar paciente existente
        </h3>
        <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:'1rem' }}>
          Selecciona un archivo <code>.dietometrics</code> previamente guardado para continuar donde lo dejaste.
        </p>
        <input ref={fileRef} type="file" accept=".dietometrics,.json" style={{ display:'none' }}
          onChange={cargarSesion}/>
        <button className="btn-secondary" style={{ width:'100%', padding:'.75rem' }}
          onClick={() => fileRef.current?.click()} disabled={cargando}>
          {cargando ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/>Cargando...</> : '📂 Seleccionar archivo'}
        </button>
        {msg && (
          <div style={{ marginTop:'.75rem', padding:'.65rem .85rem', borderRadius:8, fontSize:'.83rem',
            background:msg.tipo==='ok'?'var(--sage-pale)':'#fff0f0',
            border:`1.5px solid ${msg.tipo==='ok'?'var(--sage)':'var(--rose)'}`,
            color:msg.tipo==='ok'?'var(--sage)':'var(--rose)', fontWeight:600 }}>
            {msg.tipo==='ok'?'✓':'✕'} {msg.texto}
          </div>
        )}

        {/* Drop zone */}
        <div style={{ marginTop:'1rem', border:'2px dashed var(--border)', borderRadius:10, padding:'1.25rem',
          textAlign:'center', fontSize:'.8rem', color:'var(--muted)' }}
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='var(--sage)'}}
          onDragLeave={e=>{e.currentTarget.style.borderColor='var(--border)'}}
          onDrop={e=>{
            e.preventDefault(); e.currentTarget.style.borderColor='var(--border)'
            const file=e.dataTransfer.files?.[0]
            if (file) { const dt=new DataTransfer(); dt.items.add(file); fileRef.current.files=dt.files; cargarSesion({target:{files:dt.files,value:''}}) }
          }}>
          📁 O arrastra el archivo aquí
        </div>
      </div>
    </div>
  )
}

// ══ EXPORTAR DÍA PDF ══════════════════════════════════════════════════════════
function exportarDiaPDF(dia, paciente, macros, equivalencias) {
  if (!dia?.menuFinal) { alert('Este día no tiene menú definido'); return }
  return exportarPDF({
    paciente, macros,
    equivalencias: equivalencias?.resultado,
    menuFinal: dia.menuFinal,
    tiemposNombres: (dia.tiempos||[]).map(t=>t.nombre),
    subtitulo: dia.nombre,
  })
}

// ══ EXPORTAR PLAN COMPLETO PDF ═════════════════════════════════════════════════
async function exportarPlanPDF({ dias, paciente, macros, equivalencias, ficha }) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W=210, margin=18
  let y=0

  const sage=[74,124,89], teal=[42,122,140], amber=[196,112,42]
  const ink=[28,43,30], muted=[120,143,130], white=[255,255,255], cream=[250,247,242]

  const ACT_LABEL = { sedentario:'Sedentario', ligero:'Ligeramente activo', moderado:'Moderadamente activo', activo:'Muy activo', muy_activo:'Extra activo' }
  const OBJ_LABEL = { bajar:'Bajar de peso', mantener:'Mantener peso', subir:'Aumentar masa' }

  const checkPage = (n=25) => { if (y+n>275) { doc.addPage(); y=18 } }

  const sectionBar = (title, color=sage) => {
    doc.setFillColor(...color)
    doc.roundedRect(margin, y, W-2*margin, 8, 2, 2, 'F')
    doc.setTextColor(...white); doc.setFont('helvetica','bold'); doc.setFontSize(10)
    doc.text(title, margin+4, y+5.5); y+=13
  }

  // ── PORTADA ──
  doc.setFillColor(...sage)
  doc.rect(0,0,W,45,'F')
  doc.setFontSize(26); doc.setFont('helvetica','bold'); doc.setTextColor(...white)
  doc.text('DietoMetrics', margin, 20)
  doc.setFontSize(12); doc.setFont('helvetica','normal')
  doc.text('Plan Alimenticio Completo · INCMNSZ / SMAE', margin, 30)
  doc.setFontSize(9)
  doc.text(`${dias.length} días · Generado el ${new Date().toLocaleDateString('es-MX',{dateStyle:'long'})}`, margin, 39)
  y=55

  // Paciente
  sectionBar('Datos del Paciente')
  doc.setFillColor(...cream); doc.rect(margin,y-2,W-2*margin,42,'F')
  const r2=(l,v,l2='',v2='')=>{
    doc.setFont('helvetica','bold'); doc.setTextColor(...muted); doc.setFontSize(8.5); doc.text(l,margin,y)
    doc.setFont('helvetica','normal'); doc.setTextColor(...ink); doc.setFontSize(9); doc.text(String(v||'—'),margin+38,y)
    if(l2){ doc.setFont('helvetica','bold'); doc.setTextColor(...muted); doc.setFontSize(8.5); doc.text(l2,W/2,y)
      doc.setFont('helvetica','normal'); doc.setTextColor(...ink); doc.setFontSize(9); doc.text(String(v2||'—'),W/2+38,y) }
    y+=7
  }
  r2('Nombre:', paciente?.nombre, 'Fecha:', new Date().toLocaleDateString('es-MX'))
  r2('Peso:', `${paciente?.peso_kg} kg`, 'Talla:', `${paciente?.talla_cm} cm`)
  r2('Objetivo:', OBJ_LABEL[paciente?.objetivo]||paciente?.objetivo||'—', 'Actividad:', ACT_LABEL[paciente?.actividad]||'—')
  if (macros) {
    const m=macros.macros_g; const kcal=macros.kcal_resultantes||macros.kcal_objetivo
    r2('Energía obj:', `${Math.round(kcal)} kcal`, 'Macros:', `P${m.proteina}g C${m.carbohidrato}g G${m.grasa}g`)
  }
  y+=6

  // Resumen semanal con mini gráfica SVG-like usando rectángulos
  const diasConMenu = dias.filter(d=>d.menuFinal)
  if (diasConMenu.length > 0) {
    checkPage(60)
    sectionBar('Resumen del Plan', teal)

    // Tabla resumen
    const resRows = dias.map((d,i) => {
      const r=calcDia(d)
      return [d.nombre, r.kcal||'—', `${r.p}g`, `${r.c}g`, `${r.g}g`,
        r.kcal>0 ? `${r.kcal>Math.round(macros?.kcal_resultantes||macros?.kcal_objetivo||0)?'+':''}${r.kcal-Math.round(macros?.kcal_resultantes||macros?.kcal_objetivo||0)} kcal` : '—']
    })
    doc.autoTable({
      startY:y, margin:{left:margin,right:margin},
      head:[['Día','kcal','Proteína','Carbohid.','Grasas','vs. objetivo']],
      body:resRows,
      headStyles:{fillColor:teal,textColor:255,fontStyle:'bold',fontSize:8.5},
      bodyStyles:{fontSize:8.5,textColor:ink},
      alternateRowStyles:{fillColor:[240,250,252]},
      theme:'grid',
    })
    y=doc.lastAutoTable.finalY+10

    // Mini gráfica de barras kcal (rectángulos)
    checkPage(50)
    doc.setFont('helvetica','bold'); doc.setTextColor(...teal); doc.setFontSize(9)
    doc.text('Distribución calórica por día', margin, y); y+=8

    const kcalObj = Math.round(macros?.kcal_resultantes||macros?.kcal_objetivo||0)
    const maxKcal = Math.max(...diasConMenu.map(d=>calcDia(d).kcal), kcalObj, 1)
    const barW    = Math.min(22, (W-2*margin)/dias.length - 3)
    const chartH  = 35
    const startX  = margin

    // Línea objetivo
    const objY = y + chartH - (kcalObj/maxKcal)*chartH
    doc.setDrawColor(...muted); doc.setLineDash([2,2])
    doc.line(startX, objY, startX+(dias.length*(barW+3)), objY)
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...muted)
    doc.text(`obj ${kcalObj}`, startX+(dias.length*(barW+3))+1, objY+2)
    doc.setLineDash([])

    dias.forEach((d,i) => {
      const r=calcDia(d)
      const bH=(r.kcal/maxKcal)*chartH
      const bX=startX+i*(barW+3)
      const bY=y+chartH-bH
      const col = Math.abs(r.kcal-kcalObj)<kcalObj*.05 ? sage : r.kcal>kcalObj ? [196,90,90] : amber
      doc.setFillColor(...col)
      doc.rect(bX, bY, barW, bH, 'F')
      // etiqueta kcal
      doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...ink)
      if (r.kcal>0) doc.text(String(r.kcal), bX+barW/2, bY-2, {align:'center'})
      // nombre día
      doc.setFontSize(6); doc.setFont('helvetica','normal'); doc.setTextColor(...muted)
      doc.text(d.nombre.slice(0,8), bX+barW/2, y+chartH+5, {align:'center'})
    })
    y+=chartH+12
  }

  // ── MENÚ DE CADA DÍA ──
  for (const dia of dias) {
    if (!dia.menuFinal) continue
    doc.addPage(); y=18
    const tiemposNombres=(dia.tiempos||[]).map(t=>t.nombre)
    const totalDia=tiemposNombres.reduce((s,tn)=>{
      const td=dia.menuFinal[tn]||{alimentos:[]};
      const kcal=td.alimentos.reduce((ss,a)=>ss+(a.energia_kcal||0),0)
      return {kcal:s.kcal+kcal, p:s.p+td.alimentos.reduce((ss,a)=>ss+(a.proteina_g||0),0),
        c:s.c+td.alimentos.reduce((ss,a)=>ss+(a.hc_g||0),0), g:s.g+td.alimentos.reduce((ss,a)=>ss+(a.lipidos_g||0),0)}
    },{kcal:0,p:0,c:0,g:0})

    // Header del día
    doc.setFillColor(...amber)
    doc.roundedRect(margin, y, W-2*margin, 12, 3,3,'F')
    doc.setFont('helvetica','bold'); doc.setTextColor(...white); doc.setFontSize(13)
    doc.text(dia.nombre, margin+5, y+8.5)
    doc.setFont('helvetica','normal'); doc.setFontSize(9)
    doc.text(`${Math.round(totalDia.kcal)} kcal · P${totalDia.p.toFixed(1)}g C${totalDia.c.toFixed(1)}g G${totalDia.g.toFixed(1)}g`, W-margin, y+8.5, {align:'right'})
    y+=18

    // Mini gráfica de macros del día
    const mkObj=macros?.macros_g||{}
    const macrosBars=[
      {l:'Proteína',  res:totalDia.p, obj:mkObj.proteina||0,      col:[74,124,89]},
      {l:'Carbohid.', res:totalDia.c, obj:mkObj.carbohidrato||0,  col:[42,122,140]},
      {l:'Grasas',    res:totalDia.g, obj:mkObj.grasa||0,         col:[196,112,42]},
    ]
    const maxMacro=Math.max(...macrosBars.map(m=>Math.max(m.res,m.obj)),1)
    const bW2=40, bH2=18, gapY=8
    macrosBars.forEach((mb,i) => {
      const bX=margin+i*(bW2+10)
      const objBarH=(mb.obj/maxMacro)*bH2
      const resBarH=(mb.res/maxMacro)*bH2
      // obj (outline)
      doc.setDrawColor(...mb.col); doc.setLineWidth(.5)
      doc.rect(bX, y+bH2-objBarH, bW2, objBarH)
      // real (filled)
      doc.setFillColor(...mb.col)
      doc.rect(bX+2, y+bH2-resBarH+2, bW2-4, Math.max(resBarH-2,0), 'F')
      // etiquetas
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...mb.col)
      doc.text(`${mb.l}: ${mb.res.toFixed(1)}g / ${mb.obj}g obj`, bX, y+bH2+5)
    })
    y+=bH2+gapY+6

    // Tablas por tiempo
    for (const tn of tiemposNombres) {
      const td=dia.menuFinal[tn]
      if (!td?.alimentos?.length) continue
      checkPage(35)
      const kcalT=td.alimentos.reduce((s,a)=>s+(a.energia_kcal||0),0)
      doc.setFont('helvetica','bold'); doc.setTextColor(...amber); doc.setFontSize(10)
      doc.text(`${tn}  ·  ${Math.round(kcalT)} kcal`, margin, y); y+=5
      doc.autoTable({
        startY:y, margin:{left:margin+4,right:margin},
        head:[['Alimento','Grupo','Peso','Energía','P / C / G']],
        body:td.alimentos.map(a=>[a.alimento,a.grupo,`${Math.round(a.gramos)}g`,`${Math.round(a.energia_kcal||0)} kcal`,
          `${(a.proteina_g||0).toFixed(1)} / ${(a.hc_g||0).toFixed(1)} / ${(a.lipidos_g||0).toFixed(1)}`]),
        headStyles:{fillColor:[245,226,208],textColor:amber,fontStyle:'bold',fontSize:7.5},
        bodyStyles:{fontSize:7.5,textColor:ink},
        alternateRowStyles:{fillColor:[253,247,240]},
        theme:'grid',
      })
      y=doc.lastAutoTable.finalY+6
    }
  }

  // ── FOOTERS ──
  const pages=doc.getNumberOfPages()
  for (let i=1;i<=pages;i++) {
    doc.setPage(i)
    doc.setFillColor(220,232,220); doc.rect(0,285,W,12,'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...muted)
    doc.text('DietoMetrics · INCMNSZ/SMAE · Plan orientativo, validar con profesional de salud', margin, 291)
    doc.text(`Pág. ${i}/${pages}`, W-margin, 291, {align:'right'})
  }

  const nombre=(paciente?.nombre||'plan').replace(/\s+/g,'_')
  doc.save(`DietoMetrics_Plan_${nombre}_${new Date().toISOString().slice(0,10)}.pdf`)
}
