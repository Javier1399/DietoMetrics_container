import { useState } from 'react'
import { DonutChart, MetricCard } from './UI.jsx'
import { exportarPDF } from '../utils/exportPDF.js'

const MEAL_ICONS_ARR  = ['☀️','🍎','🍽','🥤','🌙','⭐']
const MEAL_COLORS_ARR = ['#4a7c59','#2a7a8c','#c4702a','#9b6a8c','#7a5a3c','#c45a5a']

export default function StepReceta({ onBack, onPlanSemanal, paciente, resultadoPaciente, macros, equivalencias, menuResult }) {
  const [tab,       setTab]       = useState('receta')
  const [exporting, setExporting] = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)   // modal "agregar al plan"

  const { menuFinal, tiempos } = menuResult
  const tiemposNombres = tiempos.map(t => t.nombre)

  const totalesPorTiempo = tiemposNombres.map((nombre, i) => {
    const td   = menuFinal[nombre] || { alimentos:[], kcal:0 }
    const kcal = td.kcal || td.alimentos.reduce((s,a) => s+(a.energia_kcal||0), 0)
    const p    = td.alimentos.reduce((s,a) => s+(a.proteina_g||0),  0)
    const c    = td.alimentos.reduce((s,a) => s+(a.hc_g||0),        0)
    const g    = td.alimentos.reduce((s,a) => s+(a.lipidos_g||0),   0)
    return { nombre, kcal, p, c, g, alimentos: td.alimentos, idx: i }
  })

  const totalDia = totalesPorTiempo.reduce(
    (s,t) => ({ kcal:s.kcal+t.kcal, p:s.p+t.p, c:s.c+t.c, g:s.g+t.g }),
    { kcal:0, p:0, c:0, g:0 }
  )

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportarPDF({ paciente, resultadoPaciente, macros,
        equivalencias: equivalencias.resultado, menuFinal, tiemposNombres })
    } catch(e) { alert('Error al generar PDF: ' + e.message) }
    setExporting(false)
  }

  return (
    <div className="fade-up">
      <h2 style={{ fontFamily:'Fraunces,serif', fontSize:'1.6rem', marginBottom:'.3rem' }}>
        Plan alimenticio · {paciente.nombre}
      </h2>
      <p style={{ color:'var(--muted)', marginBottom:'1.5rem', fontSize:'.92rem' }}>
        Receta completa con estadísticas detalladas. Lista para exportar o agregar al plan semanal.
      </p>

      {/* CTA prominente: agregar al plan */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'1rem 1.25rem', borderRadius:'var(--radius)', marginBottom:'1.25rem',
        background:'linear-gradient(135deg, var(--sage-pale), var(--teal-pale))',
        border:'1.5px solid var(--sage)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:'1.8rem' }}>📅</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'.95rem', color:'var(--ink)' }}>
              ¿Quieres guardar esta receta en el plan semanal?
            </div>
            <div style={{ fontSize:'.8rem', color:'var(--muted)' }}>
              Podrás nombrarla, copiarla a otros días y construir un plan completo.
            </div>
          </div>
        </div>
        <button className="btn-primary" style={{ background:'var(--sage)', whiteSpace:'nowrap', padding:'.6rem 1.2rem' }}
          onClick={() => setShowAdd(true)}>
          + Agregar al plan →
        </button>
      </div>

      {/* Summary bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'.75rem', marginBottom:'1.5rem' }}>
        <MetricCard label="Total kcal" value={Math.round(totalDia.kcal)} color="var(--sage)"
          sub={`obj: ${Math.round(macros.kcal_resultantes||macros.kcal_objetivo)}`} icon="🔥"/>
        <MetricCard label="Proteína"      value={`${totalDia.p.toFixed(0)}`} unit="g" color="#4a7c59"
          sub={`obj: ${macros.macros_g.proteina}g`} icon="🥩"/>
        <MetricCard label="Carbohidratos" value={`${totalDia.c.toFixed(0)}`} unit="g" color="#2a7a8c"
          sub={`obj: ${macros.macros_g.carbohidrato}g`} icon="🌾"/>
        <MetricCard label="Grasas"        value={`${totalDia.g.toFixed(0)}`} unit="g" color="#c4702a"
          sub={`obj: ${macros.macros_g.grasa}g`} icon="🥑"/>
        <MetricCard label="IMC" value={resultadoPaciente?.imc||'—'}
          sub={resultadoPaciente?.estado_imc} color="var(--teal)" icon="📐"/>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:'1.25rem', background:'var(--border)', borderRadius:10, padding:4 }}>
        {[{id:'receta',label:'🍽 Receta del día'},{id:'stats',label:'📊 Estadísticas'},{id:'export',label:'📥 Exportar'}]
          .map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:'.55rem', borderRadius:8, fontWeight:600, fontSize:'.88rem',
              background: tab===t.id ? 'var(--warm-white)' : 'transparent',
              color: tab===t.id ? 'var(--sage)' : 'var(--muted)',
              boxShadow: tab===t.id ? 'var(--shadow-sm)' : 'none', transition:'all .15s'
            }}>{t.label}</button>
          ))}
      </div>

      {tab==='receta' && <RecetaTab totalesPorTiempo={totalesPorTiempo} totalDia={totalDia}/>}
      {tab==='stats'  && <StatsTab  totalesPorTiempo={totalesPorTiempo} equivalencias={equivalencias.resultado} macros={macros} totalDia={totalDia}/>}
      {tab==='export' && <ExportTab onExport={handleExport} exporting={exporting} paciente={paciente} resultadoPaciente={resultadoPaciente}/>}

      <div style={{ display:'flex', gap:'.75rem', marginTop:'1.5rem' }}>
        <button className="btn-secondary" onClick={onBack}>← Volver al menú</button>
        <div style={{ flex:1 }}/>
        {onPlanSemanal && (
          <button className="btn-secondary" onClick={onPlanSemanal}
            style={{ display:'flex', alignItems:'center', gap:6 }}>
            📅 Ver plan semanal
          </button>
        )}
        <button className="btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? <><span className="spinner" style={{width:14,height:14,marginRight:6}}/>Generando...</> : '⬇ Exportar PDF'}
        </button>
      </div>

      {/* Modal: agregar al plan */}
      {showAdd && (
        <ModalAgregarAlPlan
          menuResult={menuResult}
          onConfirmar={(nombreDia) => { setShowAdd(false); onPlanSemanal && onPlanSemanal(nombreDia) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

// ── Receta tab ─────────────────────────────────────────────────────────────────
function RecetaTab({ totalesPorTiempo, totalDia }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {totalesPorTiempo.map((t, i) => {
        const color = MEAL_COLORS_ARR[i % MEAL_COLORS_ARR.length]
        const icon  = MEAL_ICONS_ARR[i % MEAL_ICONS_ARR.length]
        return (
          <div key={t.nombre} className="card-raised" style={{ borderLeft:`4px solid ${color}`, padding:'1.1rem 1.4rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.85rem', flexWrap:'wrap', gap:8 }}>
              <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.1rem', color, display:'flex', alignItems:'center', gap:8 }}>
                <span>{icon}</span>{t.nombre}
              </h3>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <span className="tag tag-sage">{Math.round(t.kcal)} kcal</span>
                <span className="tag" style={{ background:'#e8f4ec',color:'#4a7c59' }}>P {t.p.toFixed(1)}g</span>
                <span className="tag tag-teal">C {t.c.toFixed(1)}g</span>
                <span className="tag tag-amber">G {t.g.toFixed(1)}g</span>
              </div>
            </div>
            {t.alimentos.length === 0 && (
              <div style={{ fontSize:'.85rem', color:'var(--muted)', fontStyle:'italic' }}>Sin alimentos asignados</div>
            )}
            {t.alimentos.map((a, ai) => (
              <div key={ai} style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px',
                gap:'.75rem', alignItems:'center', padding:'.55rem .75rem',
                background:'var(--cream)', borderRadius:'var(--radius-sm)', marginBottom:4, fontSize:'.88rem' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{a.alimento}</div>
                  <div style={{ fontSize:'.74rem', color:'var(--muted)' }}>{a.grupo}</div>
                </div>
                <span style={{ textAlign:'right', fontWeight:600, color }}>{Math.round(a.gramos)}g</span>
                <span style={{ textAlign:'right', fontSize:'.82rem', color:'var(--muted)' }}>
                  {Math.round(a.energia_kcal)} kcal
                </span>
                <span style={{ textAlign:'right', fontSize:'.78rem', color:'var(--muted)' }}>
                  P{a.proteina_g?.toFixed(1)} C{a.hc_g?.toFixed(1)} G{a.lipidos_g?.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )
      })}

      <div className="card" style={{ padding:'1rem 1.4rem', background:'linear-gradient(135deg,var(--sage-pale),var(--warm-white))', textAlign:'center' }}>
        <div style={{ fontSize:'.8rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Totales del día</div>
        <div style={{ fontSize:'1.6rem', fontWeight:700, fontFamily:'Fraunces,serif', color:'var(--sage)' }}>
          {Math.round(totalDia.kcal)} kcal
        </div>
        <div style={{ fontSize:'.85rem', color:'var(--ink-mid)' }}>
          P {totalDia.p.toFixed(1)}g · C {totalDia.c.toFixed(1)}g · G {totalDia.g.toFixed(1)}g
        </div>
      </div>
    </div>
  )
}

// ── Stats tab ──────────────────────────────────────────────────────────────────
function StatsTab({ totalesPorTiempo, equivalencias, macros, totalDia }) {
  const slicesTiempos = totalesPorTiempo.map((t,i) => ({
    label:t.nombre, value:Math.round(t.kcal), color:MEAL_COLORS_ARR[i%MEAL_COLORS_ARR.length]
  }))
  const grupos = Object.entries(equivalencias.resumen_por_grupo||{})
    .sort((a,b) => b[1].kcal_totales - a[1].kcal_totales)
  const maxKcalG = Math.max(...grupos.map(([,i]) => i.kcal_totales), 1)

  const macroComp = [
    { label:'Proteína',     obj:macros.macros_g.proteina,     res:equivalencias.macros_resultantes.proteina, color:'#4a7c59' },
    { label:'Carbohidratos',obj:macros.macros_g.carbohidrato, res:equivalencias.macros_resultantes.hc,       color:'#2a7a8c' },
    { label:'Grasas',       obj:macros.macros_g.grasa,        res:equivalencias.macros_resultantes.grasa,    color:'#c4702a' },
  ]
  const maxM = Math.max(...macroComp.flatMap(m=>[m.obj,m.res]),1)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>

      {/* Donut */}
      <div className="card" style={{ padding:'1.25rem' }}>
        <h3 style={{ fontSize:'1rem', color:'var(--sage)', marginBottom:'1rem' }}>Distribución por tiempo</h3>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'1rem' }}>
          <DonutChart slices={slicesTiempos}
            centerLabel={Math.round(totalDia.kcal)} centerSub="kcal/día"/>
        </div>
        {slicesTiempos.map(s => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'.85rem', marginBottom:4 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:s.color }}/>
            <span style={{ flex:1 }}>{s.label}</span>
            <strong>{s.value} kcal</strong>
            <span style={{ color:'var(--muted)', width:40, textAlign:'right' }}>
              {totalDia.kcal > 0 ? Math.round(s.value/totalDia.kcal*100) : 0}%
            </span>
          </div>
        ))}
      </div>

      {/* Macros comparison */}
      <div className="card" style={{ padding:'1.25rem' }}>
        <h3 style={{ fontSize:'1rem', color:'var(--sage)', marginBottom:'1rem' }}>Macros: objetivo vs resultado</h3>
        {macroComp.map(m => {
          const oW = (m.obj/maxM)*100; const rW = (m.res/maxM)*100
          const diff = m.res - m.obj
          return (
            <div key={m.label} style={{ marginBottom:'.85rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.85rem', marginBottom:4 }}>
                <span style={{ fontWeight:600 }}>{m.label}</span>
                <span style={{ color:Math.abs(diff)<5?'var(--sage)':'var(--amber)', fontSize:'.78rem' }}>
                  {diff>0?'+':''}{diff.toFixed(1)}g
                </span>
              </div>
              {[{label:'obj',w:oW,v:m.obj,op:.4},{label:'real',w:rW,v:m.res,op:1}].map(row => (
                <div key={row.label} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <span style={{ width:32, fontSize:'.72rem', color:'var(--muted)' }}>{row.label}</span>
                  <div style={{ flex:1, background:'var(--border)', borderRadius:4, height:12 }}>
                    <div style={{ width:`${row.w}%`, height:'100%', background:m.color, opacity:row.op, borderRadius:4 }}/>
                  </div>
                  <span style={{ width:44, fontSize:'.78rem', textAlign:'right', fontWeight:row.op===1?600:400, color:row.op===1?m.color:'var(--muted)' }}>
                    {row.v}g
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Group calories bar */}
      <div className="card" style={{ padding:'1.25rem', gridColumn:'span 2' }}>
        <h3 style={{ fontSize:'1rem', color:'var(--sage)', marginBottom:'1rem' }}>Aporte calórico por grupo</h3>
        {grupos.map(([nombre, info], i) => {
          const colors = ['#4a7c59','#2a7a8c','#c4702a','#9b6a8c','#7a5a3c','#c45a5a','#b08a3c','#5a8c7a']
          const color = colors[i%colors.length]
          const w = (info.kcal_totales/maxKcalG)*100
          return (
            <div key={nombre} style={{ display:'grid', gridTemplateColumns:'200px 1fr 80px 60px', gap:'.6rem', alignItems:'center', marginBottom:'.4rem' }}>
              <span style={{ fontSize:'.82rem', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</span>
              <div style={{ background:'var(--border)', borderRadius:4, height:16, overflow:'hidden' }}>
                <div style={{ width:`${w}%`, height:'100%', background:color, borderRadius:4 }}/>
              </div>
              <span style={{ fontSize:'.82rem', textAlign:'right' }}>{info.kcal_totales} kcal</span>
              <span className="tag" style={{ background:color+'18', color, fontSize:'.72rem', border:`1px solid ${color}40` }}>
                {info.pct_calorico}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Stacked bar */}
      <div className="card" style={{ padding:'1.25rem', gridColumn:'span 2' }}>
        <h3 style={{ fontSize:'1rem', color:'var(--sage)', marginBottom:'1rem' }}>Macros por tiempo de comida</h3>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'.6rem', height:180, padding:'0 .5rem' }}>
          {totalesPorTiempo.map((t,i) => {
            const maxK = Math.max(...totalesPorTiempo.map(x=>x.kcal), 1)
            const hP = (t.p*4/maxK)*180; const hC = (t.c*4/maxK)*180; const hG = (t.g*9/maxK)*180
            return (
              <div key={t.nombre} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:4 }}>{Math.round(t.kcal)}</div>
                <div style={{ display:'flex', flexDirection:'column-reverse', height:180, width:32, borderRadius:6, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                  <div style={{ height:hP, background:'#4a7c59', minHeight:hP>0?2:0 }}/>
                  <div style={{ height:hC, background:'#2a7a8c', minHeight:hC>0?2:0 }}/>
                  <div style={{ height:hG, background:'#c4702a', minHeight:hG>0?2:0 }}/>
                </div>
                <div style={{ fontSize:'.7rem', color:'var(--ink-mid)', textAlign:'center', maxWidth:72 }}>{t.nombre}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center', marginTop:'.75rem', fontSize:'.78rem' }}>
          {[['#4a7c59','Proteína'],['#2a7a8c','Carbohidratos'],['#c4702a','Grasas']].map(([c,l]) => (
            <span key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ width:10, height:10, background:c, borderRadius:2 }}/>{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Export tab ─────────────────────────────────────────────────────────────────
const ACT_LABEL = { sedentario:'Sedentario', ligero:'Ligeramente activo', moderado:'Moderadamente activo', activo:'Muy activo', muy_activo:'Extra activo' }
const OBJ_LABEL = { bajar:'Bajar de peso', mantener:'Mantener peso', subir:'Aumentar masa' }

function ExportTab({ onExport, exporting, paciente, resultadoPaciente }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
      <div className="card-raised" style={{ padding:'1.5rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📄</div>
        <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', color:'var(--sage)', marginBottom:'.5rem' }}>
          Reporte PDF profesional
        </h3>
        <p style={{ fontSize:'.88rem', color:'var(--muted)', marginBottom:'1.25rem' }}>
          Incluye datos del paciente, macronutrientes, distribución por grupos SMAE
          y el menú detallado con gramos exactos por alimento.
        </p>
        <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:'.4rem', marginBottom:'1.25rem', fontSize:'.86rem' }}>
          {['Datos del paciente (IMC, TMB, GET)','Tabla de macronutrientes','Distribución por grupos SMAE',
            'Menú diario con gramos y kcal por alimento'].map(t => (
            <li key={t} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'var(--sage)' }}>✓</span>{t}
            </li>
          ))}
        </ul>
        <button className="btn-primary" style={{ width:'100%', padding:'.75rem' }}
          onClick={onExport} disabled={exporting}>
          {exporting ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/>Generando...</> : '⬇ Descargar PDF'}
        </button>
      </div>

      <div className="card" style={{ padding:'1.5rem', background:'var(--cream)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>📋</div>
        <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', color:'var(--teal)', marginBottom:'.5rem' }}>
          Resumen del paciente
        </h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'.5rem', fontSize:'.88rem' }}>
          {[
            ['Nombre', paciente.nombre],
            ['Edad', `${paciente.edad} años`],
            ['Sexo', paciente.sexo === 'masculino' ? 'Masculino' : 'Femenino'],
            ['Peso / Talla', `${paciente.peso_kg} kg / ${paciente.talla_cm} cm`],
            ['IMC', resultadoPaciente ? `${resultadoPaciente.imc} — ${resultadoPaciente.estado_imc}` : '—'],
            ['Actividad', ACT_LABEL[paciente.actividad]||paciente.actividad],
            ['Objetivo', OBJ_LABEL[paciente.objetivo]||paciente.objetivo],
          ].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'.4rem .6rem',
              background:'var(--warm-white)', borderRadius:6 }}>
              <span style={{ color:'var(--muted)' }}>{k}:</span>
              <strong>{v||'—'}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Modal: agregar receta al plan semanal ─────────────────────────────────────
function ModalAgregarAlPlan({ menuResult, onConfirmar, onClose }) {
  const [nombre, setNombre] = useState('')
  const placeholder = 'Ej: Lunes, Día 1, Plan A...'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(28,43,30,.45)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={onClose}>
      <div className="card-raised fade-up" style={{ width:'100%', maxWidth:420, padding:'1.75rem' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ textAlign:'center', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'.4rem' }}>📅</div>
          <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem' }}>Agregar al plan semanal</h3>
          <p style={{ fontSize:'.85rem', color:'var(--muted)', marginTop:4 }}>
            Ponle un nombre a este menú. Puedes modificarlo más tarde.
          </p>
        </div>

        <div style={{ marginBottom:'1.25rem' }}>
          <label style={{ fontSize:'.8rem', color:'var(--muted)', display:'block', marginBottom:5 }}>Nombre del día o plan</label>
          <input className="input-field" autoFocus
            placeholder={placeholder}
            value={nombre} onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key==='Enter' && onConfirmar(nombre || placeholder.split(',')[0])}
          />
          <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:4 }}>
            Puedes usar: día de la semana, número de plan, nombre personalizado, etc.
          </div>
        </div>

        <div style={{ display:'flex', gap:'.75rem' }}>
          <button className="btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" style={{ flex:1, background:'var(--sage)' }}
            onClick={() => onConfirmar(nombre.trim() || 'Nuevo día')}>
            Guardar en el plan →
          </button>
        </div>
      </div>
    </div>
  )
}
