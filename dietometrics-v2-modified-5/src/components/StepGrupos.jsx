import { useState, useEffect } from 'react'
import { api } from '../utils/api.js'
import { Alert, ProgressBar } from './UI.jsx'

const GRUPOS_DEFAULT = [
  'Verduras','Frutas','Cereales sin grasa','Leguminosas',
  'AOA bajo aporte de grasa','Leche descremada','Grasas sin proteína'
]

const GRUPO_ICONOS = {
  'Verduras':'🥦','Frutas':'🍎','Cereales sin grasa':'🌾','Cereales con grasa':'🥐',
  'Leguminosas':'🫘','AOA muy bajo aporte de grasa':'🫀','AOA bajo aporte de grasa':'🍗',
  'AOA moderado aporte de grasa':'🥚','AOA alto aporte de grasa':'🥩',
  'Leche descremada':'🥛','Leche semidescremada':'🧃','Leche entera':'🍼',
  'Leche con azúcar':'🧋','Grasas sin proteína':'🥑','Grasas con proteína':'🥜',
  'Azúcares sin grasa':'🍯','Azúcares con grasa':'🍫','Bebidas alcohólicas':'🍷','Libres':'💧'
}

export default function StepGrupos({ onNext, onBack, macros, initial }) {
  const [grupos, setGrupos] = useState([])
  const [seleccionados, setSeleccionados] = useState(initial?.grupos || GRUPOS_DEFAULT)
  const [restricciones, setRestricciones] = useState(initial?.restricciones || {})
  const [resultado, setResultado] = useState(initial?.resultado || null)
  const [sensibilidad, setSensibilidad] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingSens, setLoadingSens] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('grupos') // 'grupos' | 'restricciones' | 'sensibilidad'

  useEffect(() => {
    api.getGruposEq().then(setGrupos)
  }, [])

  const toggleGrupo = g => {
    setSeleccionados(s => s.includes(g) ? s.filter(x=>x!==g) : [...s, g])
    setResultado(null); setSensibilidad(null)
  }

  const setRest = (grupo, key, val) => {
    setRestricciones(r => ({
      ...r,
      [grupo]: { ...(r[grupo]||{}), [key]: val === '' ? undefined : Number(val) }
    }))
    setSensibilidad(null)
  }

  const calcular = async () => {
    setLoading(true); setError(null); setSensibilidad(null)
    try {
      const res = await api.optimizarEquiv({
        proteina_obj: macros.macros_g.proteina,
        hc_obj: macros.macros_g.carbohidrato,
        grasa_obj: macros.macros_g.grasa,
        grupos_seleccionados: seleccionados,
        restricciones: Object.fromEntries(
          Object.entries(restricciones).map(([g,r]) => [g, {
            porc_min: r.porc_min || null,
            porc_max: r.porc_max || null,
            preferencia: r.preferencia || 2,
          }])
        ),
        estado_clinico: macros.estado_clinico,
      })
      setResultado(res)
      setTab('sensibilidad')
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const evaluarSensibilidad = async (restNuevas) => {
    if (!resultado) return
    setLoadingSens(true)
    try {
      const res = await api.sensibilidad({
        proteina_obj: macros.macros_g.proteina,
        hc_obj: macros.macros_g.carbohidrato,
        grasa_obj: macros.macros_g.grasa,
        grupos_seleccionados: seleccionados,
        restricciones_nuevas: Object.fromEntries(
          Object.entries(restNuevas).map(([g,r]) => [g, {
            porc_min: r.porc_min || null,
            porc_max: r.porc_max || null,
            preferencia: r.preferencia || 2,
          }])
        ),
        porciones_actuales: resultado.porciones,
        estado_clinico: macros.estado_clinico,
      })
      setSensibilidad(res)
    } catch(e) {}
    setLoadingSens(false)
  }

  const totalKcal = macros.kcal_resultantes || macros.kcal_objetivo

  return (
    <div className="fade-up">
      <h2 style={{ fontFamily:'Fraunces,serif', fontSize:'1.6rem', marginBottom:'.3rem' }}>
        Grupos alimenticios & restricciones
      </h2>
      <p style={{ color:'var(--muted)', marginBottom:'1.5rem', fontSize:'.92rem' }}>
        Selecciona los grupos SMAE, ajusta sus restricciones y observa el análisis de sensibilidad en tiempo real.
      </p>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:'1.25rem', background:'var(--border)', borderRadius:10, padding:4 }}>
        {[
          { id:'grupos',        label:'📋 Grupos' },
          { id:'restricciones', label:'⚙️ Restricciones' },
          { id:'sensibilidad',  label:'📊 Sensibilidad', disabled: !resultado },
        ].map(t => (
          <button key={t.id} onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            style={{
              flex:1, padding:'.5rem', borderRadius:8, fontWeight:600, fontSize:'.85rem',
              background: tab===t.id ? 'var(--warm-white)' : 'transparent',
              color: tab===t.id ? 'var(--sage)' : t.disabled ? 'var(--border-strong)' : 'var(--muted)',
              boxShadow: tab===t.id ? 'var(--shadow-sm)' : 'none',
              transition:'all .15s', cursor: t.disabled ? 'not-allowed' : 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'1.5rem', alignItems:'start' }}>

        {/* Main panel */}
        <div>
          {tab === 'grupos' && (
            <div className="card" style={{ padding:'1.25rem' }}>
              <h3 style={{ fontSize:'1rem', color:'var(--sage)', marginBottom:'1rem' }}>
                Grupos disponibles ({seleccionados.length} seleccionados)
              </h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                {grupos.map(g => {
                  const sel = seleccionados.includes(g.grupo_eq)
                  return (
                    <label key={g.grupo_eq} style={{
                      display:'flex', alignItems:'center', gap:'.75rem',
                      padding:'.65rem .9rem', borderRadius:'var(--radius-sm)', cursor:'pointer',
                      background: sel ? 'var(--sage-pale)' : 'var(--warm-white)',
                      border:`1.5px solid ${sel ? 'var(--border-strong)' : 'var(--border)'}`,
                      transition:'all .15s',
                    }}>
                      <input type="checkbox" checked={sel}
                        onChange={() => toggleGrupo(g.grupo_eq)}
                        style={{ width:16, height:16, accentColor:'var(--sage)', cursor:'pointer' }}/>
                      <span style={{ fontSize:'1.1rem' }}>{GRUPO_ICONOS[g.grupo_eq]||'🍽'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:sel?600:400, fontSize:'.88rem' }}>{g.grupo_eq}</div>
                        <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>
                          {g.kcal_porcion} kcal/porc · P:{g.proteina_g}g C:{g.hc_g}g G:{g.grasa_g}g
                        </div>
                      </div>
                      {sel && <span style={{ fontSize:'.7rem', color:'var(--sage)', fontWeight:700 }}>✓</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'restricciones' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              <Alert type="info">
                Define rangos de <strong>% calórico</strong> mínimo/máximo para cada grupo.
                El análisis de sensibilidad te mostrará si son compatibles con tus macros objetivo.
              </Alert>
              {seleccionados.map(g => {
                const r = restricciones[g] || {}
                const pct_actual = resultado?.resumen_por_grupo?.[g]?.pct_calorico
                return (
                  <div key={g} className="card" style={{ padding:'1rem 1.25rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:.5+'rem', marginBottom:'.75rem' }}>
                      <span style={{ fontSize:'1.1rem' }}>{GRUPO_ICONOS[g]||'🍽'}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:'.9rem' }}>{g}</div>
                        {pct_actual !== undefined && (
                          <span className="tag tag-sage" style={{ fontSize:'.7rem' }}>
                            Actual: {pct_actual}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
                      <div>
                        <label className="field-label">Porciones mín</label>
                        <input className="input-field" type="number" min={0} max={50} placeholder="—"
                          value={r.porc_min ?? ''} onChange={e => setRest(g,'porc_min',e.target.value)}/>
                        <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:3 }}>0 = sin mínimo</div>
                      </div>
                      <div>
                        <label className="field-label">Porciones máx</label>
                        <input className="input-field" type="number" min={0} max={50} placeholder="—"
                          value={r.porc_max ?? ''} onChange={e => setRest(g,'porc_max',e.target.value)}/>
                        <div style={{ fontSize:'.7rem', color:'var(--muted)', marginTop:3 }}>0 = sin máximo</div>
                      </div>
                      <div>
                        <label className="field-label">Preferencia</label>
                        <select className="input-field" value={r.preferencia||2}
                          onChange={e => setRest(g,'preferencia',+e.target.value)}>
                          <option value={1}>Poco (mínimo)</option>
                          <option value={2}>Normal</option>
                          <option value={3}>Mucho (máximo)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button className="btn-primary"
                style={{ padding:'.65rem', marginTop:'.5rem' }}
                onClick={() => { calcular(); setTab('grupos') }}
                disabled={loading}>
                ⚡ Recalcular con restricciones
              </button>
            </div>
          )}

          {tab === 'sensibilidad' && resultado && (
            <SensibilidadPanel
              resultado={resultado}
              sensibilidad={sensibilidad}
              loading={loadingSens}
              totalKcal={totalKcal}
              macros={macros}
              restricciones={restricciones}
              onEvaluar={evaluarSensibilidad}
            />
          )}
        </div>

        {/* Summary */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', position:'sticky', top:'1rem' }}>
          {resultado ? (
            <ResultadoResumen resultado={resultado} macros={macros}/>
          ) : (
            <div className="card" style={{ padding:'1.5rem', textAlign:'center', color:'var(--muted)' }}>
              <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>⚡</div>
              <div style={{ fontSize:'.88rem' }}>Selecciona grupos y presiona calcular para ver el resultado</div>
            </div>
          )}

          {error && <Alert type="error">{error}</Alert>}

          <button className="btn-primary" style={{ width:'100%', padding:'.65rem' }}
            onClick={calcular} disabled={seleccionados.length === 0 || loading}>
            {loading ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/>Calculando...</>
              : resultado ? '🔄 Recalcular' : '⚡ Calcular equivalencias'}
          </button>

          {resultado && (
            <button className="btn-primary"
              style={{ width:'100%', padding:'.65rem', background:'var(--teal)' }}
              onClick={() => onNext({ grupos: seleccionados, restricciones, resultado })}>
              Continuar → Menú →
            </button>
          )}

          <button className="btn-ghost" style={{ width:'100%' }} onClick={onBack}>← Volver</button>
        </div>
      </div>
    </div>
  )
}

// ── Sensibilidad panel ────────────────────────────────────────────────────────
function SensibilidadPanel({ resultado, sensibilidad, loading, totalKcal, macros, restricciones, onEvaluar }) {
  const [restTemp, setRestTemp] = useState({ ...restricciones })

  const handleChange = (grupo, key, val) => {
    const updated = {
      ...restTemp,
      [grupo]: { ...(restTemp[grupo]||{}), [key]: val === '' ? undefined : Number(val) }
    }
    setRestTemp(updated)
    onEvaluar(updated)
  }

  const calidad = sensibilidad?.calidad
  const cColor = calidad==='excelente' ? 'var(--sage)' : calidad==='aceptable' ? 'var(--amber)' : 'var(--rose)'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {sensibilidad && (
        <div className="card" style={{ padding:'1.1rem', borderLeft:`3px solid ${cColor}` }}>
          <div style={{ fontWeight:600, color:cColor, marginBottom:4 }}>{sensibilidad.mensaje}</div>
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
            {Object.entries(sensibilidad.desviacion).map(([k,v]) => (
              <span key={k} style={{ fontSize:'.82rem' }}>
                <span style={{ color:'var(--muted)' }}>{k}: </span>
                <strong style={{ color: v<3 ? 'var(--sage)' : v<8 ? 'var(--amber)' : 'var(--rose)' }}>±{v}g</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding:'1.1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h4 style={{ fontSize:'.95rem', color:'var(--ink)' }}>🎛 Ajuste interactivo de rangos</h4>
          {loading && <span className="spinner" style={{width:16,height:16}}/>}
        </div>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginBottom:'1rem' }}>
          Modifica los porcentajes calóricos de cada grupo. El análisis evalúa en tiempo real si son compatibles con los macros objetivo.
        </p>

        {Object.keys(resultado.resumen_por_grupo).map(g => {
          const info = resultado.resumen_por_grupo[g]
          const r = restTemp[g] || {}
          const marg = sensibilidad?.margen_por_grupo?.[g]
          const pctActual = marg?.pct_calorico ?? info.pct_calorico
          const [rMin, rMax] = info.rango_clinico || [0, 10]

          return (
            <div key={g} style={{
              padding:'.85rem', marginBottom:'.6rem',
              background:'var(--cream)', borderRadius:'var(--radius-sm)',
              border:`1px solid ${info.dentro_rango ? 'var(--border)' : '#f0d0b0'}`
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontWeight:600, fontSize:'.88rem' }}>{g}</span>
                <span className={`tag ${info.dentro_rango ? 'tag-sage' : 'tag-amber'}`}>
                  {marg?.porciones ?? info.porciones} porc · {pctActual}%
                </span>
              </div>
              <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:8 }}>
                Rango clínico: {rMin}–{rMax} porciones · {info.kcal_por_porcion} kcal/porción
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.6rem' }}>
                <div>
                  <label style={{ fontSize:'.72rem', color:'var(--muted)', display:'block', marginBottom:3 }}>
                    Porciones mínimas
                  </label>
                  <input className="input-field" type="number" min={0} max={50} step={1}
                    placeholder="Sin límite"
                    value={r.porc_min ?? ''} style={{ fontSize:'.85rem' }}
                    onChange={e => handleChange(g,'porc_min',e.target.value)}/>
                </div>
                <div>
                  <label style={{ fontSize:'.72rem', color:'var(--muted)', display:'block', marginBottom:3 }}>
                    Porciones máximas
                  </label>
                  <input className="input-field" type="number" min={0} max={50} step={1}
                    placeholder="Sin límite"
                    value={r.porc_max ?? ''} style={{ fontSize:'.85rem' }}
                    onChange={e => handleChange(g,'porc_max',e.target.value)}/>
                </div>
              </div>
              {/* Mini bar de % */}
              <div style={{ marginTop:8 }}>
                <div style={{ background:'var(--border)', borderRadius:99, height:5, position:'relative' }}>
                  <div style={{ position:'absolute', left:`${Math.min(pctActual,100)}%`, transform:'translateX(-50%)',
                    width:10, height:10, borderRadius:'50%', background:'var(--sage)',
                    top:-2.5, border:'2px solid white', transition:'left .4s' }}/>
                  {r.porc_min && r.porc_min > 0 && <div style={{
                    position:'absolute', left:`${Math.min((r.porc_min / rMax * 100),100)}%`, top:0, height:'100%',
                    borderLeft:'2px dashed var(--amber)', opacity:.7
                  }}/>}
                  {r.porc_max && r.porc_max > 0 && <div style={{
                    position:'absolute', left:`${Math.min((r.porc_max / rMax * 100),100)}%`, top:0, height:'100%',
                    borderLeft:'2px dashed var(--rose)', opacity:.7
                  }}/>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                  <span style={{ fontSize:'.65rem', color:'var(--muted)' }}>0 porc</span>
                  <span style={{ fontSize:'.65rem', color:'var(--muted)' }}>{Math.round(rMax/2)} porc</span>
                  <span style={{ fontSize:'.65rem', color:'var(--muted)' }}>{rMax} porc</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Resultado resumen ─────────────────────────────────────────────────────────
function ResultadoResumen({ resultado, macros }) {
  const obj = macros.macros_g
  const res = resultado.macros_resultantes
  const kcal = resultado.kcal_totales

  return (
    <div className="card" style={{ padding:'1.1rem' }}>
      <h4 style={{ fontSize:'.9rem', color:'var(--sage)', marginBottom:'.8rem' }}>
        Resultado · {kcal} kcal
      </h4>
      {[
        { label:'Proteína',     obj:obj.proteina,      res:res.proteina,  color:'#4a7c59' },
        { label:'Carbohidratos',obj:obj.carbohidrato,  res:res.hc,        color:'#2a7a8c' },
        { label:'Grasas',       obj:obj.grasa,         res:res.grasa,     color:'#c4702a' },
      ].map(m => {
        const pct = m.obj > 0 ? Math.min(100,(m.res/m.obj*100)) : 0
        const diff = m.res - m.obj
        return (
          <div key={m.label} style={{ marginBottom:'.75rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:'.82rem', fontWeight:500 }}>{m.label}</span>
              <span style={{ fontSize:'.78rem', color:'var(--muted)' }}>
                {m.res}g / {m.obj}g
                <span style={{ color: Math.abs(diff)<5?'var(--sage)':'var(--amber)', marginLeft:4 }}>
                  {diff>0?'+':''}{diff.toFixed(1)}g
                </span>
              </span>
            </div>
            <ProgressBar value={m.res} max={m.obj} color={m.color}/>
          </div>
        )
      })}

      <div style={{ marginTop:'.8rem', fontSize:'.8rem', color:'var(--muted)' }}>
        <div style={{ fontWeight:600, color:'var(--ink-mid)', marginBottom:6 }}>Porciones por grupo:</div>
        {Object.entries(resultado.resumen_por_grupo).map(([g, info]) => {
          const ma = info.macro_aporte || {}
          return (
            <div key={g} style={{
              padding:'6px 8px', marginBottom:4, borderRadius:7,
              background: info.dentro_rango ? 'var(--cream)' : '#fff8e8',
              border:`1px solid ${info.dentro_rango ? 'var(--border)' : '#f0d0a0'}`
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <span style={{ fontWeight:600, color:'var(--ink-mid)', fontSize:'.79rem' }}>{g}</span>
                <strong style={{ color: info.dentro_rango ? 'var(--sage)' : 'var(--amber)', fontSize:'.79rem' }}>
                  {info.porciones} porc
                </strong>
              </div>
              <div style={{ display:'flex', gap:6, fontSize:'.69rem', color:'var(--muted)' }}>
                <span style={{ background:'var(--warm-white)', borderRadius:4, padding:'1px 5px' }}>
                  🔥 {Math.round(info.kcal_totales)} kcal
                </span>
                <span style={{ background:'#e8f5ee', borderRadius:4, padding:'1px 5px', color:'#2d6a42' }}>
                  P {(ma.proteina||0).toFixed(1)}g
                </span>
                <span style={{ background:'#e6f3f7', borderRadius:4, padding:'1px 5px', color:'#1a5f70' }}>
                  C {(ma.hc||0).toFixed(1)}g
                </span>
                <span style={{ background:'#fdf0e6', borderRadius:4, padding:'1px 5px', color:'#8a4010' }}>
                  G {(ma.grasa||0).toFixed(1)}g
                </span>
              </div>
              {/* Mini bar de aporte calórico */}
              <div style={{ marginTop:4, background:'var(--border)', borderRadius:99, height:3, overflow:'hidden' }}>
                <div style={{ width:`${Math.min(info.pct_calorico,100)}%`, height:'100%', background:'var(--sage)', borderRadius:99 }}/>
              </div>
              <div style={{ fontSize:'.62rem', color:'var(--muted)', marginTop:1, textAlign:'right' }}>
                {info.pct_calorico}% del total
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
