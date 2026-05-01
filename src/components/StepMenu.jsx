import { useState, useMemo, useCallback, useEffect } from 'react'
import { api } from '../utils/api.js'
import { Alert } from './UI.jsx'

const MEAL_ICONS = ['☀️','🍎','🍽','🥤','🌙','⭐']
const GRUPO_ICONOS = {
  'Verduras':'🥦','Frutas':'🍎','Cereales sin grasa':'🌾','Cereales con grasa':'🥐',
  'Leguminosas':'🫘','AOA muy bajo aporte de grasa':'🫀','AOA bajo aporte de grasa':'🍗',
  'AOA moderado aporte de grasa':'🥚','AOA alto aporte de grasa':'🥩',
  'Leche descremada':'🥛','Leche semidescremada':'🧃','Leche entera':'🍼',
  'Leche con azúcar':'🧋','Grasas sin proteína':'🥑','Grasas con proteína':'🥜',
  'Azúcares sin grasa':'🍯','Azúcares con grasa':'🍫','Bebidas alcohólicas':'🍷','Libres':'💧'
}

function kcalAli(ali, gramos) { return parseFloat(ali?.energia_kcal || 0) * gramos / 100 }
function macrosAli(ali, gramos) {
  const f = gramos / 100
  return { p: parseFloat(ali?.proteina_g||0)*f, c: parseFloat(ali?.hidratos_de_carbono_g||0)*f, g: parseFloat(ali?.lipidos_g||0)*f }
}
function fmt1(n) { return (Math.round(n*10)/10).toFixed(1) }
function fmtKcal(n) { return Math.round(n) }

// ══════════════════════════════════════════════════════════════════════════════
export default function StepMenu({ onNext, onBack, equivalencias, initialUiStep, diaBase }) {
  const resumen   = equivalencias.resultado.resumen_por_grupo || {}
  const porciones = equivalencias.resultado.porciones
  const grupos    = Object.keys(porciones).filter(g => porciones[g] > 0)

  const [tiempos, setTiempos] = useState(() => {
    // Si viene con un día base (del plan semanal), usar sus tiempos
    if (diaBase?.tiempos) return diaBase.tiempos
    return [
      { nombre:'Desayuno', grupos: grupos.slice(0, Math.ceil(grupos.length/3)) },
      { nombre:'Comida',   grupos: grupos.slice(0, Math.ceil(grupos.length*2/3)) },
      { nombre:'Cena',     grupos: grupos.slice(0, grupos.length) },
    ]
  })

  // distribucion[tiempo][grupo] = porciones asignadas
  const distribucion = useMemo(() => {
    const dist = {}
    tiempos.forEach(t => { dist[t.nombre] = {} })
    grupos.forEach(g => {
      const tWithG = tiempos.filter(t => t.grupos.includes(g))
      if (!tWithG.length) return
      const base = Math.floor(porciones[g]/tWithG.length)
      const extra = porciones[g] % tWithG.length
      tWithG.forEach((t,i) => { dist[t.nombre][g] = base + (i < extra ? 1 : 0) })
    })
    return dist
  }, [tiempos, grupos, porciones])

  // selAlimentos[tiempo][grupo] = [alimento_obj, ...]
  const [selAlimentos, setSelAlimentos] = useState({})
  // gramosOpt[tiempo][grupo][nombre_alimento] = gramos
  const [gramosOpt, setGramosOpt] = useState({})
  // alertasOpt[tiempo] = [alerta, ...]
  const [alertasOpt, setAlertasOpt] = useState({})
  const [optStatus, setOptStatus] = useState({})

  const [uiStep, setUiStep]   = useState(initialUiStep || 'config')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  // Paso 1 → 2
  const irAAlimentos = () => {
    const init = {}
    tiempos.forEach(t => {
      init[t.nombre] = {}
      t.grupos.forEach(g => { init[t.nombre][g] = selAlimentos[t.nombre]?.[g] || [] })
    })
    setSelAlimentos(init)
    setUiStep('alimentos')
  }

  // Paso 2 → 3: optimizar gramos con LP
  const irAEditor = async () => {
    setLoading(true); setError(null)
    const newGramos = {}, newAlertas = {}, newStatus = {}

    for (const t of tiempos) {
      newGramos[t.nombre] = {}; newAlertas[t.nombre] = []; newStatus[t.nombre] = 'idle'
      const grupos_t = []
      for (const g of t.grupos) {
        const alis = selAlimentos[t.nombre]?.[g] || []
        if (!alis.length) continue
        const porc = distribucion[t.nombre]?.[g] || 0
        if (!porc) continue
        grupos_t.push({
          grupo_eq: g, porciones: porc,
          alimentos: alis.map(ali => ({
            nombre: ali.alimento, grupo_eq: g,
            energia_kcal_100g: parseFloat(ali.energia_kcal||0),
            proteina_g_100g:   parseFloat(ali.proteina_g||0),
            hc_g_100g:         parseFloat(ali.hidratos_de_carbono_g||0),
            grasa_g_100g:      parseFloat(ali.lipidos_g||0),
          }))
        })
      }
      if (!grupos_t.length) continue
      try {
        const res = await api.optimizarComida({ nombre_comida: t.nombre, grupos: grupos_t, modo: 'balanceado' })
        res.grupos.forEach(gRes => { newGramos[t.nombre][gRes.grupo_eq] = gRes.gramos_optimizados || {} })
        newAlertas[t.nombre] = res.alertas_globales || []
        newStatus[t.nombre] = 'done'
      } catch(e) { newStatus[t.nombre] = 'error' }
    }
    setGramosOpt(newGramos); setAlertasOpt(newAlertas); setOptStatus(newStatus)
    setLoading(false); setUiStep('edit')
  }

  const setGramos = useCallback((tiempo, grupo, nombre, valor) => {
    setGramosOpt(prev => ({
      ...prev, [tiempo]: { ...prev[tiempo], [grupo]: { ...(prev[tiempo]?.[grupo]||{}), [nombre]: Math.max(0,valor) } }
    }))
  }, [])

  const addAlimento = useCallback((tiempo, grupo, ali) => {
    setSelAlimentos(prev => ({
      ...prev, [tiempo]: { ...prev[tiempo], [grupo]: [...(prev[tiempo]?.[grupo]||[]), ali] }
    }))
    setGramosOpt(prev => ({
      ...prev, [tiempo]: { ...prev[tiempo], [grupo]: { ...(prev[tiempo]?.[grupo]||{}), [ali.alimento]: 50 } }
    }))
  }, [])

  const removeAlimento = useCallback((tiempo, grupo, nombre) => {
    setSelAlimentos(prev => ({
      ...prev, [tiempo]: { ...prev[tiempo], [grupo]: (prev[tiempo]?.[grupo]||[]).filter(a => a.alimento !== nombre) }
    }))
    setGramosOpt(prev => {
      const copy = { ...(prev[tiempo]?.[grupo]||{}) }; delete copy[nombre]
      return { ...prev, [tiempo]: { ...prev[tiempo], [grupo]: copy } }
    })
  }, [])

  const reoptimizarGrupo = useCallback(async (tiempo, grupo, modo='balanceado') => {
    const alis = selAlimentos[tiempo]?.[grupo] || []
    const porc = distribucion[tiempo]?.[grupo] || 0
    if (!alis.length || !porc) return
    setOptStatus(prev => ({ ...prev, [tiempo]: 'loading' }))
    try {
      const res = await api.optimizarComida({
        nombre_comida: tiempo,
        grupos: [{ grupo_eq: grupo, porciones: porc,
          alimentos: alis.map(ali => ({
            nombre: ali.alimento, grupo_eq: grupo,
            energia_kcal_100g: parseFloat(ali.energia_kcal||0),
            proteina_g_100g:   parseFloat(ali.proteina_g||0),
            hc_g_100g:         parseFloat(ali.hidratos_de_carbono_g||0),
            grasa_g_100g:      parseFloat(ali.lipidos_g||0),
            gramos_sugeridos:  gramosOpt[tiempo]?.[grupo]?.[ali.alimento] || undefined,
          }))
        }], modo,
      })
      const gRes = res.grupos[0]
      if (gRes) {
        setGramosOpt(prev => ({ ...prev, [tiempo]: { ...prev[tiempo], [grupo]: gRes.gramos_optimizados||{} } }))
        setAlertasOpt(prev => {
          const otras = (prev[tiempo]||[]).filter(a => a.grupo !== grupo)
          return { ...prev, [tiempo]: [...otras, ...(gRes.alertas||[])] }
        })
      }
      setOptStatus(prev => ({ ...prev, [tiempo]: 'done' }))
    } catch(e) { setOptStatus(prev => ({ ...prev, [tiempo]: 'error' })) }
  }, [selAlimentos, distribucion, gramosOpt])

  const buildMenuFinal = () => {
    const out = {}
    tiempos.forEach(t => {
      const alimentos = []
      t.grupos.forEach(g => {
        ;(selAlimentos[t.nombre]?.[g] || []).forEach(ali => {
          const gr = gramosOpt[t.nombre]?.[g]?.[ali.alimento] || 0
          if (gr > 0) {
            const m = macrosAli(ali, gr)
            alimentos.push({ grupo:g, alimento:ali.alimento, gramos:gr, energia_kcal:kcalAli(ali,gr), proteina_g:m.p, hc_g:m.c, lipidos_g:m.g })
          }
        })
      })
      out[t.nombre] = { alimentos, kcal: alimentos.reduce((s,a)=>s+a.energia_kcal,0) }
    })
    return out
  }

  const totalesDia = useMemo(() => {
    let kcal=0,p=0,c=0,g=0
    tiempos.forEach(t => t.grupos.forEach(gr => {
      ;(selAlimentos[t.nombre]?.[gr]||[]).forEach(ali => {
        const grams = gramosOpt[t.nombre]?.[gr]?.[ali.alimento]||0
        kcal += kcalAli(ali,grams); const m=macrosAli(ali,grams); p+=m.p; c+=m.c; g+=m.g
      })
    }))
    return { kcal:Math.round(kcal), p:Math.round(p*10)/10, c:Math.round(c*10)/10, g:Math.round(g*10)/10 }
  }, [tiempos, selAlimentos, gramosOpt])

  const kcalObjetivoTotal = useMemo(() =>
    Math.round(Object.values(resumen).reduce((s,r) => s+(r.kcal_totales||0), 0)), [resumen])

  const stepLabel = { config:'Configura tus comidas', alimentos:'Selecciona los alimentos', edit:'Ajusta tu menú' }

  return (
    <div className="fade-up">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.3rem' }}>
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:'1.6rem' }}>{stepLabel[uiStep]}</h2>
        {uiStep !== 'config' && (
          <button className="btn-secondary" style={{ fontSize:'.82rem' }}
            onClick={() => setUiStep(uiStep==='edit' ? 'alimentos' : 'config')}>
            ← {uiStep==='edit' ? 'Cambiar alimentos' : 'Cambiar configuración'}
          </button>
        )}
      </div>

      <StepProgress current={uiStep} />

      <p style={{ color:'var(--muted)', marginBottom:'1.5rem', fontSize:'.92rem' }}>
        {uiStep==='config'
          ? 'Nombra tus tiempos de comida y selecciona qué grupos de alimentos incluirás en cada uno.'
          : uiStep==='alimentos'
          ? 'Elige los alimentos específicos de cada grupo. El sistema optimizará los gramos automáticamente.'
          : 'Revisa los gramos optimizados, ajusta si lo deseas y atiende las alertas del nutriólogo.'}
      </p>

      {uiStep==='config' && (
        <ConfigStep tiempos={tiempos} setTiempos={setTiempos} grupos={grupos} porciones={porciones}
          onNext={irAAlimentos} onBack={onBack} />
      )}
      {uiStep==='alimentos' && (
        <AlimentosStep tiempos={tiempos} distribucion={distribucion}
          selAlimentos={selAlimentos} setSelAlimentos={setSelAlimentos}
          resumen={resumen} onNext={irAEditor} loading={loading} error={error}
          onBack={() => setUiStep('config')} />
      )}
      {uiStep==='edit' && (
        <EditStep tiempos={tiempos} distribucion={distribucion}
          selAlimentos={selAlimentos} gramosOpt={gramosOpt}
          alertasOpt={alertasOpt} optStatus={optStatus} resumen={resumen}
          totalesDia={totalesDia} kcalObjetivoTotal={kcalObjetivoTotal}
          setGramos={setGramos} addAlimento={addAlimento} removeAlimento={removeAlimento}
          reoptimizarGrupo={reoptimizarGrupo}
          onBack={() => setUiStep('alimentos')}
          onNext={() => onNext({ menuFinal:buildMenuFinal(), menuItems:selAlimentos, tiempos })} />
      )}
    </div>
  )
}

// ── Progress ───────────────────────────────────────────────────────────────────
function StepProgress({ current }) {
  const steps = [{ key:'config', label:'1. Tiempos' }, { key:'alimentos', label:'2. Alimentos' }, { key:'edit', label:'3. Ajustes' }]
  const idx = steps.findIndex(s => s.key===current)
  return (
    <div style={{ display:'flex', gap:0, marginBottom:'1.25rem', alignItems:'center' }}>
      {steps.map((s,i) => (
        <div key={s.key} style={{ display:'flex', alignItems:'center', flex: i<steps.length-1?1:'none' }}>
          <div style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'.28rem .7rem', borderRadius:99, fontSize:'.78rem', fontWeight:i<=idx?600:400,
            background: i<idx?'var(--sage)': i===idx?'var(--teal-pale)':'var(--cream)',
            color: i<idx?'#fff': i===idx?'var(--teal)':'var(--muted)',
            border:`1.5px solid ${i===idx?'var(--teal)':i<idx?'var(--sage)':'var(--border)'}`,
          }}>
            {i<idx?'✓':i+1} {s.label}
          </div>
          {i<steps.length-1 && <div style={{ flex:1, height:2, background:i<idx?'var(--sage)':'var(--border)', margin:'0 6px' }}/>}
        </div>
      ))}
    </div>
  )
}

// ══ CONFIG STEP ═══════════════════════════════════════════════════════════════
function ConfigStep({ tiempos, setTiempos, grupos, porciones, onNext, onBack }) {
  const addTiempo    = () => setTiempos(t => [...t, { nombre:`Comida ${t.length+1}`, grupos:[] }])
  const removeTiempo = i  => setTiempos(t => t.filter((_,j)=>j!==i))
  const setNombre    = (i,v) => setTiempos(t => t.map((x,j) => j===i?{...x,nombre:v}:x))
  const toggleGrupo  = (i,g) => setTiempos(t => t.map((x,j) => {
    if (j!==i) return x
    const gs = x.grupos.includes(g) ? x.grupos.filter(k=>k!==g) : [...x.grupos,g]
    return {...x,grupos:gs}
  }))
  const puedeContinuar = tiempos.some(t => t.grupos.length>0)
  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', gap:'.85rem', marginBottom:'1.25rem' }}>
        {tiempos.map((t,i) => (
          <div key={i} className="card" style={{ padding:'1rem 1.2rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'.85rem' }}>
              <span style={{ fontSize:'1.3rem' }}>{MEAL_ICONS[i]||'🍽'}</span>
              <input className="input-field" value={t.nombre} onChange={e=>setNombre(i,e.target.value)}
                style={{ width:180, fontWeight:600, fontSize:'.95rem', padding:'.35rem .7rem' }}/>
              <span style={{ fontSize:'.8rem', color:'var(--muted)' }}>{t.grupos.length} grupo{t.grupos.length!==1?'s':''} seleccionado{t.grupos.length!==1?'s':''}</span>
              <div style={{ flex:1 }}/>
              {tiempos.length>1 && <button className="btn-ghost" style={{ color:'var(--rose)', fontSize:'.82rem', padding:'.3rem .6rem' }} onClick={()=>removeTiempo(i)}>🗑</button>}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.45rem' }}>
              {grupos.map(g => {
                const sel = t.grupos.includes(g)
                return (
                  <button key={g} onClick={()=>toggleGrupo(i,g)} style={{
                    display:'flex', alignItems:'center', gap:5,
                    padding:'.35rem .75rem', borderRadius:99, fontSize:'.8rem', cursor:'pointer',
                    background:sel?'var(--sage)':'var(--cream)', color:sel?'#fff':'var(--ink-mid)',
                    border:`1.5px solid ${sel?'var(--sage)':'var(--border)'}`, fontWeight:sel?600:400, transition:'all .15s',
                  }}>
                    {GRUPO_ICONOS[g]||'🍽'} {g} <span style={{opacity:.7}}>({porciones[g]}p)</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:'.75rem', marginBottom:'1.25rem' }}>
        <button className="btn-ghost" onClick={addTiempo} disabled={tiempos.length>=6}>+ Agregar tiempo</button>
      </div>
      <div style={{ display:'flex', gap:'.75rem' }}>
        <button className="btn-secondary" onClick={onBack}>← Volver</button>
        <button className="btn-primary" style={{ flex:1 }} onClick={onNext} disabled={!puedeContinuar}>Elegir alimentos →</button>
      </div>
    </>
  )
}

// ══ ALIMENTOS STEP ════════════════════════════════════════════════════════════
function AlimentosStep({ tiempos, distribucion, selAlimentos, setSelAlimentos, resumen, onNext, loading, error, onBack }) {
  const [activeTiempo, setActiveTiempo] = useState(tiempos[0]?.nombre||'')

  const toggleAlimento = (tiempo, grupo, ali) => {
    setSelAlimentos(prev => {
      const current = prev[tiempo]?.[grupo]||[]
      const exists  = current.some(a => a.alimento===ali.alimento)
      return { ...prev, [tiempo]: { ...prev[tiempo], [grupo]: exists ? current.filter(a=>a.alimento!==ali.alimento) : [...current,ali] } }
    })
  }

  const totalSel = tiempos.reduce((s,t) => s+t.grupos.reduce((gs,g) => gs+(selAlimentos[t.nombre]?.[g]?.length||0), 0), 0)
  const puedeContinuar = tiempos.every(t => t.grupos.every(g => (selAlimentos[t.nombre]?.[g]?.length||0)>0))

  return (
    <>
      {/* Tabs */}
      <div style={{ display:'flex', gap:'.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {tiempos.map((t,i) => {
          const nSel    = t.grupos.reduce((s,g) => s+(selAlimentos[t.nombre]?.[g]?.length||0), 0)
          const completo = t.grupos.every(g => (selAlimentos[t.nombre]?.[g]?.length||0)>0)
          return (
            <button key={t.nombre} onClick={() => setActiveTiempo(t.nombre)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'.4rem 1rem', borderRadius:99, fontSize:'.85rem', fontWeight:600, cursor:'pointer', transition:'all .15s',
              background: activeTiempo===t.nombre?'var(--teal)': completo?'var(--sage-pale)':'var(--cream)',
              color: activeTiempo===t.nombre?'#fff': completo?'var(--sage)':'var(--ink-mid)',
              border:`1.5px solid ${activeTiempo===t.nombre?'var(--teal)': completo?'var(--sage)':'var(--border)'}`,
            }}>
              {MEAL_ICONS[i]||'🍽'} {t.nombre}
              {nSel>0 && <span style={{ background:activeTiempo===t.nombre?'rgba(255,255,255,.3)':'var(--sage)', color:'#fff', borderRadius:99, padding:'0 6px', fontSize:'.7rem', fontWeight:700 }}>{nSel}</span>}
              {completo && <span>✓</span>}
            </button>
          )
        })}
      </div>

      {tiempos.filter(t=>t.nombre===activeTiempo).map(t => (
        <div key={t.nombre} style={{ display:'flex', flexDirection:'column', gap:'1rem', marginBottom:'1.5rem' }}>
          {t.grupos.map(g => (
            <GrupoAlimentosPicker key={g} grupo={g} porciones={distribucion[t.nombre]?.[g]||0}
              seleccionados={selAlimentos[t.nombre]?.[g]||[]}
              resumenGrupo={resumen[g]}
              onToggle={ali => toggleAlimento(t.nombre, g, ali)} />
          ))}
        </div>
      ))}

      {!puedeContinuar && <Alert type="info" style={{ marginBottom:'1rem' }}>Selecciona al menos un alimento en cada grupo de todos los tiempos de comida.</Alert>}
      {error && <Alert type="error" style={{ marginBottom:'1rem' }}>{error}</Alert>}

      <div style={{ display:'flex', gap:'.75rem' }}>
        <button className="btn-secondary" onClick={onBack}>← Volver</button>
        <button className="btn-primary" style={{ flex:1 }} onClick={onNext} disabled={loading||!puedeContinuar}>
          {loading ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/>Optimizando gramos...</> : `✦ Optimizar y continuar (${totalSel} alimentos)`}
        </button>
      </div>
    </>
  )
}

// ── Picker de alimentos por grupo ─────────────────────────────────────────────
function GrupoAlimentosPicker({ grupo, porciones, seleccionados, resumenGrupo, onToggle }) {
  const [query,      setQuery]      = useState('')
  const [resultados, setResultados] = useState([])
  const [loadingB,   setLoadingB]   = useState(false)
  const [expanded,   setExpanded]   = useState(true)

  useEffect(() => {
    let cancel = false
    const buscar = async () => {
      setLoadingB(true)
      try { const res = await api.getAlimentosGrupo(grupo, query||undefined); if (!cancel) setResultados(res) }
      catch(e) { if (!cancel) setResultados([]) }
      if (!cancel) setLoadingB(false)
    }
    buscar()
    return () => { cancel=true }
  }, [grupo, query])

  const macrosObj = resumenGrupo?.macro_aporte||{}
  const scale = porciones / (resumenGrupo?.porciones||1)

  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <button style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'.85rem 1.1rem', background:'transparent', textAlign:'left',
        borderBottom: expanded?'1px solid var(--border)':'none' }} onClick={() => setExpanded(o=>!o)}>
        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
          <span style={{ fontSize:'1.2rem' }}>{GRUPO_ICONOS[grupo]||'🍽'}</span>
          <div>
            <span style={{ fontWeight:600, fontSize:'.9rem' }}>{grupo}</span>
            <span style={{ fontSize:'.77rem', color:'var(--muted)', marginLeft:8 }}>
              {porciones} porc · {seleccionados.length>0 ? `${seleccionados.length} seleccionado${seleccionados.length>1?'s':''}` : 'ninguno aún'}
            </span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {seleccionados.length>0 && <span style={{ background:'var(--sage)', color:'#fff', borderRadius:99, padding:'2px 8px', fontSize:'.72rem', fontWeight:700 }}>✓ {seleccionados.length}</span>}
          <span style={{ color:'var(--muted)', fontSize:'.8rem' }}>{expanded?'▼':'▶'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding:'.75rem 1rem' }}>
          {/* Target macros */}
          <div style={{ display:'flex', gap:12, marginBottom:'.75rem', padding:'.5rem .75rem',
            background:'var(--teal-pale)', borderRadius:8, fontSize:'.73rem', color:'var(--teal)' }}>
            <span style={{ fontWeight:600 }}>Objetivo:</span>
            <span>P {fmt1((macrosObj.proteina||0)*scale)}g</span>
            <span>C {fmt1((macrosObj.hc||0)*scale)}g</span>
            <span>G {fmt1((macrosObj.grasa||0)*scale)}g</span>
            <span>· {Math.round((resumenGrupo?.kcal_totales||0)*scale)} kcal</span>
          </div>

          {/* Seleccionados chips */}
          {seleccionados.length>0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem', marginBottom:'.65rem' }}>
              {seleccionados.map(ali => (
                <span key={ali.alimento} onClick={() => onToggle(ali)} style={{
                  display:'flex', alignItems:'center', gap:5,
                  padding:'.28rem .65rem', borderRadius:99, fontSize:'.78rem',
                  background:'var(--sage)', color:'#fff', cursor:'pointer',
                }}>{ali.alimento} ✕</span>
              ))}
            </div>
          )}

          {/* Buscador */}
          <div style={{ position:'relative', marginBottom:'.5rem' }}>
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:'.85rem', color:'var(--muted)' }}>🔍</span>
            <input className="input-field" style={{ paddingLeft:'2rem', fontSize:'.83rem' }}
              placeholder={`Buscar en ${grupo}...`} value={query} onChange={e=>setQuery(e.target.value)}/>
          </div>

          {loadingB && <div style={{ textAlign:'center', padding:'.4rem', fontSize:'.78rem', color:'var(--muted)' }}><span className="spinner" style={{width:12,height:12,marginRight:5}}/>Buscando...</div>}

          <div style={{ maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
            {resultados.map((ali,i) => {
              const sel = seleccionados.some(a => a.alimento===ali.alimento)
              return (
                <button key={i} onClick={() => onToggle(ali)} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'.45rem .75rem', borderRadius:7, textAlign:'left', fontSize:'.83rem',
                  background:sel?'var(--sage-pale)':'transparent',
                  border:`1.5px solid ${sel?'var(--sage)':'transparent'}`, cursor:'pointer', transition:'all .1s',
                }}
                onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background='var(--cream)' }}
                onMouseLeave={e=>{ if(!sel) e.currentTarget.style.background='transparent' }}>
                  <div>
                    <div style={{ fontWeight:sel?600:400, color:sel?'var(--sage)':'inherit' }}>{sel&&'✓ '}{ali.alimento}</div>
                    <div style={{ fontSize:'.68rem', color:'var(--muted)' }}>
                      {parseFloat(ali.energia_kcal||0).toFixed(0)} kcal/100g · P{parseFloat(ali.proteina_g||0).toFixed(1)} · C{parseFloat(ali.hidratos_de_carbono_g||0).toFixed(1)} · G{parseFloat(ali.lipidos_g||0).toFixed(1)}{ali.unidad?` · ${ali.unidad}`:''}
                    </div>
                  </div>
                  {sel && <span style={{ color:'var(--rose)', fontSize:'.72rem' }}>quitar</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ══ EDIT STEP ════════════════════════════════════════════════════════════════
function EditStep({ tiempos, distribucion, selAlimentos, gramosOpt, alertasOpt, optStatus,
  resumen, totalesDia, kcalObjetivoTotal, setGramos, addAlimento, removeAlimento,
  reoptimizarGrupo, onBack, onNext }) {

  const totalAlertas = Object.values(alertasOpt).flat().length

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:'1.5rem', alignItems:'start' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {tiempos.map((t,i) => (
          <TiempoEditCard key={t.nombre}
            nombre={t.nombre} icon={MEAL_ICONS[i]||'🍽'}
            grupos={t.grupos} distribucion={distribucion[t.nombre]||{}}
            selAlimentos={selAlimentos[t.nombre]||{}} gramosOpt={gramosOpt[t.nombre]||{}}
            alertas={alertasOpt[t.nombre]||[]} optStatus={optStatus[t.nombre]||'idle'}
            resumen={resumen}
            setGramos={(g,n,v) => setGramos(t.nombre,g,n,v)}
            addAlimento={(g,ali) => addAlimento(t.nombre,g,ali)}
            removeAlimento={(g,n) => removeAlimento(t.nombre,g,n)}
            reoptimizarGrupo={(g,m) => reoptimizarGrupo(t.nombre,g,m)} />
        ))}
      </div>

      <div style={{ position:'sticky', top:'1rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
        {/* Total kcal */}
        <div className="card" style={{ padding:'1.1rem' }}>
          <div style={{ textAlign:'center', marginBottom:'.85rem' }}>
            <div style={{ fontSize:'1.8rem', fontWeight:700, fontFamily:'Fraunces,serif', color:'var(--sage)' }}>{totalesDia.kcal}</div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>kcal totales</div>
            <div style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:3 }}>objetivo: {kcalObjetivoTotal} kcal</div>
          </div>
          <BigMeter value={totalesDia.kcal} objetivo={kcalObjetivoTotal}/>
          <div style={{ marginTop:'.75rem', display:'flex', flexDirection:'column', gap:4 }}>
            {[{label:'Proteína',v:totalesDia.p,color:'#4a7c59'},{label:'Carbohidratos',v:totalesDia.c,color:'#2a7a8c'},{label:'Grasas',v:totalesDia.g,color:'#c4702a'}].map(m => (
              <div key={m.label} style={{ fontSize:'.77rem', display:'flex', justifyContent:'space-between', color:'var(--muted)' }}>
                <span style={{ color:m.color, fontWeight:600 }}>{m.label}</span><span>{m.v}g</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        {totalAlertas > 0 && (
          <div className="card" style={{ padding:'1rem', border:'1.5px solid var(--amber)' }}>
            <div style={{ fontWeight:600, fontSize:'.82rem', color:'#b07e00', marginBottom:'.6rem' }}>⚠️ Alertas del optimizador</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'.45rem' }}>
              {Object.entries(alertasOpt).map(([tn, alertas]) => alertas.map((a,i) => (
                <div key={`${tn}-${i}`} style={{ fontSize:'.73rem', padding:'.35rem .6rem',
                  background:a.es_realista?'#fffbe6':'#fff0f0',
                  borderRadius:6, border:`1px solid ${a.es_realista?'#f0d080':'#f0a0a0'}` }}>
                  <span style={{ fontWeight:600, color:'var(--muted)' }}>{tn} · </span>{a.mensaje}
                </div>
              )))}
            </div>
          </div>
        )}

        <button className="btn-primary" style={{ width:'100%', padding:'.75rem', background:'var(--teal)' }} onClick={onNext}>Continuar → Receta final</button>
        <button className="btn-ghost" style={{ width:'100%' }} onClick={onBack}>← Volver</button>
      </div>
    </div>
  )
}

// ══ TIEMPO EDIT CARD ══════════════════════════════════════════════════════════
function TiempoEditCard({ nombre, icon, grupos, distribucion, selAlimentos, gramosOpt, alertas, optStatus, resumen, setGramos, addAlimento, removeAlimento, reoptimizarGrupo }) {
  const [open, setOpen] = useState(true)

  const kcalActual  = grupos.reduce((s,g) => s+(selAlimentos[g]||[]).reduce((sg,ali) => sg+kcalAli(ali,gramosOpt[g]?.[ali.alimento]||0), 0), 0)
  const kcalObjetivo = grupos.reduce((s,g) => {
    const scale = (distribucion[g]||0)/(resumen[g]?.porciones||1)
    return s+(resumen[g]?.kcal_totales||0)*scale
  }, 0)
  const diff = kcalActual - kcalObjetivo
  const diffColor = Math.abs(diff)<30?'var(--sage)':Math.abs(diff)<80?'var(--amber)':'var(--rose)'

  return (
    <div className="card-raised" style={{ overflow:'hidden' }}>
      <button style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'.9rem 1.2rem', background:'transparent', textAlign:'left', borderBottom:open?'1px solid var(--border)':'none' }}
        onClick={() => setOpen(o=>!o)}>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <span style={{ fontSize:'1.3rem' }}>{icon}</span>
          <div>
            <div style={{ fontFamily:'Fraunces,serif', fontWeight:700, fontSize:'1.05rem' }}>{nombre}</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)' }}>
              obj: {fmtKcal(kcalObjetivo)} · actual: {fmtKcal(kcalActual)} kcal
              <span style={{ color:diffColor, marginLeft:8, fontWeight:600 }}>{diff>=0?'+':''}{fmtKcal(diff)} kcal</span>
              {optStatus==='loading' && <span className="spinner" style={{width:10,height:10,marginLeft:8}}/>}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {alertas.length>0 && <span style={{ background:'#f0d060', color:'#7a5a00', borderRadius:99, padding:'2px 7px', fontSize:'.7rem', fontWeight:700 }}>⚠️ {alertas.length}</span>}
          <span style={{ color:'var(--muted)', fontSize:'.8rem' }}>{open?'▼':'▶'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding:'1rem 1.2rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          {grupos.map(g => {
            const alis = selAlimentos[g]||[]
            const porc = distribucion[g]||0
            const gOpt = gramosOpt[g]||{}
            const scale = porc/(resumen[g]?.porciones||1)
            const macrosObj = { p:(resumen[g]?.macro_aporte?.proteina||0)*scale, c:(resumen[g]?.macro_aporte?.hc||0)*scale, g:(resumen[g]?.macro_aporte?.grasa||0)*scale }
            const kcalObjG  = (resumen[g]?.kcal_totales||0)*scale
            const kcalActG  = alis.reduce((s,ali) => s+kcalAli(ali,gOpt[ali.alimento]||0), 0)
            const macrosAct = alis.reduce((acc,ali) => { const gr=gOpt[ali.alimento]||0; const m=macrosAli(ali,gr); return {p:acc.p+m.p,c:acc.c+m.c,g:acc.g+m.g} }, {p:0,c:0,g:0})
            return (
              <GrupoEditSection key={g} grupo={g} porciones={porc}
                alis={alis} gramosMap={gOpt}
                kcalObj={kcalObjG} macrosObj={macrosObj}
                kcalActual={kcalActG} macrosActuales={macrosAct}
                alertas={alertas.filter(a=>a.grupo===g)}
                onSetGramos={(n,v) => setGramos(g,n,v)}
                onAdd={ali => addAlimento(g,ali)}
                onRemove={n => removeAlimento(g,n)}
                onReoptimizar={m => reoptimizarGrupo(g,m)} />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══ GRUPO EDIT SECTION ════════════════════════════════════════════════════════
function GrupoEditSection({ grupo, porciones, alis, gramosMap, kcalObj, macrosObj, kcalActual, macrosActuales, alertas, onSetGramos, onAdd, onRemove, onReoptimizar }) {
  const [showPicker, setShowPicker] = useState(false)
  const [loadingOpt, setLoadingOpt] = useState(false)
  const [optMode,    setOptMode]    = useState('balanceado')
  const [badge,      setBadge]      = useState(null)

  const diffKcal = kcalActual - kcalObj
  const pctKcal  = kcalObj>0 ? Math.min(130,(kcalActual/kcalObj)*100) : 0
  const barColor = Math.abs(diffKcal)<15?'var(--sage)':diffKcal>0?'var(--rose)':'var(--amber)'

  const handleOpt = async () => {
    setLoadingOpt(true); setBadge(null)
    await onReoptimizar(optMode)
    setBadge('✓'); setLoadingOpt(false)
    setTimeout(() => setBadge(null), 3000)
  }

  return (
    <div style={{ background:'var(--cream)', borderRadius:'var(--radius-sm)', padding:'.85rem 1rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.5rem' }}>
        <span style={{ fontWeight:600, fontSize:'.9rem' }}>{GRUPO_ICONOS[grupo]||'🍽'} {grupo}</span>
        <span style={{ fontSize:'.75rem', color:'var(--muted)' }}>{porciones} porc · obj {fmtKcal(kcalObj)} kcal</span>
      </div>

      {alertas.length>0 && (
        <div style={{ marginBottom:'.6rem', display:'flex', flexDirection:'column', gap:3 }}>
          {alertas.map((a,i) => (
            <div key={i} style={{ fontSize:'.72rem', padding:'.3rem .6rem',
              background:a.es_realista?'#fffbe6':'#fff0f0',
              borderRadius:6, border:`1px solid ${a.es_realista?'#f0d080':'#f0a0a0'}` }}>{a.mensaje}</div>
          ))}
        </div>
      )}

      <div style={{ marginBottom:'.75rem', display:'flex', flexDirection:'column', gap:4 }}>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.7rem', color:'var(--muted)', marginBottom:2 }}>
            <span>Energía: {fmtKcal(kcalActual)} / {fmtKcal(kcalObj)} kcal</span>
            <span style={{ color:barColor, fontWeight:600 }}>{diffKcal>=0?'+':''}{fmtKcal(diffKcal)} kcal</span>
          </div>
          <MiniBar pct={pctKcal} color={barColor}/>
        </div>
        {[{label:'P',actual:macrosActuales.p,obj:macrosObj.p,color:'#4a7c59'},{label:'C',actual:macrosActuales.c,obj:macrosObj.c,color:'#2a7a8c'},{label:'G',actual:macrosActuales.g,obj:macrosObj.g,color:'#c4702a'}].map(m => {
          const pct=m.obj>0?Math.min(130,(m.actual/m.obj)*100):0; const col=m.actual>m.obj*1.1?'var(--rose)':m.color
          return (
            <div key={m.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:12, fontSize:'.68rem', color:m.color, fontWeight:700 }}>{m.label}</span>
              <div style={{ flex:1 }}><MiniBar pct={pct} color={col} thin/></div>
              <span style={{ width:70, fontSize:'.68rem', color:'var(--muted)', textAlign:'right' }}>{fmt1(m.actual)}/{fmt1(m.obj)}g</span>
            </div>
          )
        })}
      </div>

      {alis.map(ali => (
        <FoodItemRow key={ali.alimento} alimento={ali} gramos={gramosMap[ali.alimento]||0}
          onGramos={v => onSetGramos(ali.alimento,v)}
          onRemove={() => onRemove(ali.alimento)} canRemove={alis.length>1} />
      ))}

      <div style={{ display:'flex', gap:'.5rem', marginTop:'.5rem', flexWrap:'wrap' }}>
        <button className="btn-ghost" style={{ flex:1, fontSize:'.8rem', padding:'.35rem' }} onClick={() => setShowPicker(true)}>+ Añadir alimento</button>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <select value={optMode} onChange={e=>setOptMode(e.target.value)} style={{ fontSize:'.72rem', padding:'.3rem .4rem', border:'1px solid var(--border)', borderRadius:6, background:'var(--warm-white)', cursor:'pointer' }}>
            <option value="balanceado">⚖ Balanceado</option>
            <option value="kcal">🔥 Priorizar kcal</option>
            <option value="macros">💊 Priorizar macros</option>
          </select>
          <button onClick={handleOpt} disabled={loadingOpt||alis.length===0} style={{
            display:'flex', alignItems:'center', gap:4, padding:'.35rem .7rem', borderRadius:6, fontSize:'.8rem', fontWeight:600,
            background:badge?'var(--sage-pale)':'var(--teal-pale)', color:badge?'var(--sage)':'var(--teal)',
            border:`1px solid ${badge?'var(--sage)':'#b0d8e2'}`, cursor:'pointer', whiteSpace:'nowrap', opacity:alis.length===0?.5:1 }}>
            {loadingOpt?<><span className="spinner" style={{width:12,height:12}}/>Optimizando...</>:badge?`${badge} Optimizado`:'✦ Optimizar'}
          </button>
        </div>
      </div>

      {showPicker && <FoodPicker grupo={grupo} titulo={`Añadir alimento de ${grupo}`} onSelect={ali=>{ onAdd(ali); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}

// ══ FOOD ITEM ROW ═════════════════════════════════════════════════════════════
function FoodItemRow({ alimento, gramos, onGramos, onRemove, canRemove }) {
  const kcal = kcalAli(alimento, gramos)
  const m    = macrosAli(alimento, gramos)

  // Conversión SMAE: si tiene unidad y peso_neto_g, calculamos cuántas unidades equivalen
  const tieneUnidad  = alimento?.unidad && alimento.unidad.trim() !== '' && alimento.unidad.toLowerCase() !== 'g'
  const pesoNeto     = parseFloat(alimento?.peso_neto_g || 0)
  const cantSugerida = parseFloat(alimento?.cantidad_sugerida || 1)
  // gramos por unidad = peso_neto_g / cantidad_sugerida
  const gramosPorUnidad = (tieneUnidad && cantSugerida > 0 && pesoNeto > 0)
    ? pesoNeto / cantSugerida
    : 0

  const [modoUnidad, setModoUnidad] = useState(false)
  // Cuántas unidades corresponden a los gramos actuales
  const unidades = gramosPorUnidad > 0 ? gramos / gramosPorUnidad : 0

  const handleUnidadesChange = (val) => {
    const g = Math.max(0, val * gramosPorUnidad)
    onGramos(Math.round(g * 10) / 10)
  }

  return (
    <div style={{ background:'var(--warm-white)', borderRadius:8, padding:'.5rem .75rem',
      marginBottom:'.4rem', border:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:500, fontSize:'.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {alimento?.alimento || '—'}
          </div>
          <div style={{ fontSize:'.7rem', color:'var(--muted)' }}>
            {fmtKcal(kcal)} kcal · P{fmt1(m.p)} C{fmt1(m.c)} G{fmt1(m.g)}
          </div>
        </div>

        {/* Toggle modo de medida */}
        {tieneUnidad && gramosPorUnidad > 0 && (
          <button onClick={() => setModoUnidad(v => !v)} title={modoUnidad ? 'Cambiar a gramos' : `Cambiar a ${alimento.unidad}`}
            style={{ padding:'2px 7px', borderRadius:5, fontSize:'.68rem', fontWeight:600, cursor:'pointer',
              background: modoUnidad ? 'var(--teal-pale)' : 'var(--cream)',
              color: modoUnidad ? 'var(--teal)' : 'var(--muted)',
              border:`1px solid ${modoUnidad ? '#b0d8e2' : 'var(--border)'}`,
              whiteSpace:'nowrap', flexShrink:0 }}>
            {modoUnidad ? alimento.unidad : 'g'}
          </button>
        )}

        {/* Controles de cantidad */}
        {modoUnidad && gramosPorUnidad > 0 ? (
          <div style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
            <button onClick={() => handleUnidadesChange(Math.max(0, unidades - 0.5))}
              style={{ width:22, height:22, borderRadius:5, border:'1px solid var(--border)',
                background:'var(--cream)', fontSize:'1rem', cursor:'pointer', lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <input type="number" min={0} step={0.5} value={Math.round(unidades*10)/10}
              onChange={e => handleUnidadesChange(Math.max(0, Number(e.target.value)))}
              style={{ width:55, textAlign:'center', padding:'.22rem .3rem',
                border:'1.5px solid var(--border-strong)', borderRadius:6,
                fontSize:'.88rem', fontWeight:600, fontFamily:'DM Sans,sans-serif',
                background:'var(--warm-white)' }}/>
            <span style={{ fontSize:'.68rem', color:'var(--muted)', maxWidth:45, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {alimento.unidad}
            </span>
            <button onClick={() => handleUnidadesChange(unidades + 0.5)}
              style={{ width:22, height:22, borderRadius:5, border:'1px solid var(--border)',
                background:'var(--cream)', fontSize:'1rem', cursor:'pointer', lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
            <button onClick={() => onGramos(Math.max(0, gramos-5))}
              style={{ width:22, height:22, borderRadius:5, border:'1px solid var(--border)',
                background:'var(--cream)', fontSize:'1rem', cursor:'pointer', lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <input type="number" min={0} step={5} value={gramos}
              onChange={e => onGramos(Math.max(0, Number(e.target.value)))}
              style={{ width:55, textAlign:'center', padding:'.22rem .3rem',
                border:'1.5px solid var(--border-strong)', borderRadius:6,
                fontSize:'.88rem', fontWeight:600, fontFamily:'DM Sans,sans-serif',
                background:'var(--warm-white)' }}/>
            <span style={{ fontSize:'.72rem', color:'var(--muted)' }}>g</span>
            <button onClick={() => onGramos(gramos+5)}
              style={{ width:22, height:22, borderRadius:5, border:'1px solid var(--border)',
                background:'var(--cream)', fontSize:'1rem', cursor:'pointer', lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        )}

        {/* Referencia SMAE siempre visible si tiene unidad */}
        {canRemove && (
          <button className="btn-ghost" style={{ padding:'.2rem .4rem', color:'var(--rose)', fontSize:'.8rem', flexShrink:0 }}
            onClick={onRemove}>✕</button>
        )}
      </div>

      {/* Línea de referencia SMAE bajo el item */}
      {tieneUnidad && gramosPorUnidad > 0 && (
        <div style={{ marginTop:4, fontSize:'.66rem', color:'var(--muted)',
          padding:'2px 6px', background:'var(--cream)', borderRadius:4, display:'inline-flex', gap:6 }}>
          <span>📏 Ref. SMAE:</span>
          <span style={{ fontWeight:600 }}>{cantSugerida} {alimento.unidad}</span>
          <span>≈ {Math.round(pesoNeto)}g</span>
          {gramos > 0 && gramosPorUnidad > 0 && (
            <span style={{ color:'var(--teal)' }}>· actual: {Math.round(unidades*10)/10} {alimento.unidad}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ══ FOOD PICKER ═══════════════════════════════════════════════════════════════
function FoodPicker({ grupo, titulo, onSelect, onClose }) {
  const [query, setQuery]       = useState('')
  const [resultados, setResul]  = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    let cancel = false
    const buscar = async () => {
      setLoading(true)
      try { const res = await api.getAlimentosGrupo(grupo, query||undefined); if (!cancel) setResul(res) }
      catch(e) { if (!cancel) setResul([]) }
      if (!cancel) setLoading(false)
    }
    buscar()
    return () => { cancel=true }
  }, [grupo, query])

  return (
    <div style={{ marginTop:'.6rem', border:'1.5px solid var(--border-strong)', borderRadius:'var(--radius-sm)', background:'var(--warm-white)', overflow:'hidden' }}>
      <div style={{ padding:'.6rem .85rem', background:'var(--sage-pale)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:600, fontSize:'.85rem', color:'var(--sage)' }}>{titulo}</span>
        <button className="btn-ghost" style={{ padding:'.2rem .5rem', fontSize:'.8rem' }} onClick={onClose}>✕ Cerrar</button>
      </div>
      <div style={{ padding:'.6rem' }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:'.9rem', color:'var(--muted)' }}>🔍</span>
          <input className="input-field" autoFocus style={{ paddingLeft:'2rem', fontSize:'.85rem' }}
            placeholder={`Buscar en ${grupo}...`} value={query} onChange={e=>setQuery(e.target.value)}/>
        </div>
      </div>
      {loading && <div style={{ textAlign:'center', padding:'.5rem', fontSize:'.8rem', color:'var(--muted)' }}><span className="spinner" style={{width:13,height:13,marginRight:5}}/>Buscando...</div>}
      <div style={{ maxHeight:220, overflowY:'auto' }}>
        {resultados.map((ali,i) => (
          <button key={i} onClick={() => onSelect(ali)} style={{ width:'100%', textAlign:'left', padding:'.5rem .85rem', borderBottom:'1px solid var(--border)', background:'transparent', cursor:'pointer', transition:'background .1s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--sage-pale)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{ fontWeight:500, fontSize:'.88rem' }}>{ali.alimento}</div>
            <div style={{ fontSize:'.7rem', color:'var(--muted)' }}>{parseFloat(ali.energia_kcal||0).toFixed(0)} kcal/100g · P{parseFloat(ali.proteina_g||0).toFixed(1)} · C{parseFloat(ali.hidratos_de_carbono_g||0).toFixed(1)} · G{parseFloat(ali.lipidos_g||0).toFixed(1)}{ali.unidad?` · ${ali.unidad}`:''}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ══ METERS ════════════════════════════════════════════════════════════════════
function MiniBar({ pct, color, thin }) {
  const h = thin?4:6
  return (
    <div style={{ background:'var(--border)', borderRadius:99, height:h, overflow:'hidden' }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:'100%', background:color, borderRadius:99, transition:'width .3s' }}/>
    </div>
  )
}

function BigMeter({ value, objetivo }) {
  const pct = objetivo>0?Math.min(130,(value/objetivo)*100):0
  const color = value>objetivo*1.05?'var(--rose)':value<objetivo*.95?'var(--amber)':'var(--sage)'
  return (
    <div>
      <div style={{ background:'var(--border)', borderRadius:99, height:10, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(pct,100)}%`, height:'100%', background:color, borderRadius:99, transition:'width .4s' }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:'.72rem', color:'var(--muted)' }}>
        <span>{value} actual</span><span>objetivo {objetivo}</span>
      </div>
    </div>
  )
}
