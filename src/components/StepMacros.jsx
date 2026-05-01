import { useState } from 'react'
import { api } from '../utils/api.js'
import { DonutChart, Alert, SliderField, MetricCard } from './UI.jsx'

const RANGOS_REF = {
  proteina:     { lo:10, hi:35, label:'Proteína',      color:'#4a7c59' },
  carbohidrato: { lo:45, hi:65, label:'Carbohidratos', color:'#2a7a8c' },
  grasa:        { lo:20, hi:35, label:'Grasas',        color:'#c4702a' },
}

export default function StepMacros({ onNext, onBack, initial, kcalSugeridas }) {
  const [kcal, setKcal] = useState(initial?.kcal_objetivo || kcalSugeridas || 2000)
  const [pcts, setPcts] = useState(initial ? {
    p: Math.round((initial.distribucion_pct?.proteina||.2)*100),
    c: Math.round((initial.distribucion_pct?.carbohidrato||.5)*100),
    g: Math.round((initial.distribucion_pct?.grasa||.3)*100),
  } : { p:20, c:50, g:30 })

  const [resultado, setResultado] = useState(initial || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const total = pcts.p + pcts.c + pcts.g
  const valid  = Math.abs(total - 100) <= 1

  const calcular = async () => {
    if (!valid) return
    setLoading(true); setError(null)
    try {
      const res = await api.optimizarMacros({
        calorias_objetivo: kcal,
        pct_proteina: pcts.p/100,
        pct_carbohidrato: pcts.c/100,
        pct_grasa: pcts.g/100,
      })
      setResultado(res)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const ajustar = (k, v) => {
    setPcts(prev => {
      const next = {...prev, [k]: v}
      // Auto-balance remaining
      return next
    })
    setResultado(null)
  }

  const gP = Math.round((kcal * pcts.p/100) / 4)
  const gC = Math.round((kcal * pcts.c/100) / 4)
  const gG = Math.round((kcal * pcts.g/100) / 9)

  return (
    <div className="fade-up">
      <h2 style={{ fontFamily:'Fraunces,serif', fontSize:'1.6rem', marginBottom:'.3rem' }}>
        Objetivos calóricos y macros
      </h2>
      <p style={{ color:'var(--muted)', marginBottom:'1.5rem', fontSize:'.92rem' }}>
        Optimización por programación lineal · INCMNSZ/SMAE
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'1.5rem', alignItems:'start' }}>

        {/* Controls */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>

          <div className="card" style={{ padding:'1.25rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h3 style={{ fontSize:'1rem', color:'var(--sage)' }}>Calorías objetivo</h3>
              {kcalSugeridas && (
                <button className="tag tag-sage" style={{ cursor:'pointer', border:'none' }}
                  onClick={() => { setKcal(kcalSugeridas); setResultado(null) }}>
                  Usar recomendado: {kcalSugeridas} kcal
                </button>
              )}
            </div>
            <SliderField label="Total kcal/día" value={kcal} min={600} max={5000} step={50}
              onChange={v => { setKcal(v); setResultado(null) }} unit="kcal" color="var(--sage)"/>
          </div>

          <div className="card" style={{ padding:'1.25rem' }}>
            <h3 style={{ fontSize:'1rem', color:'var(--sage)', marginBottom:'1rem' }}>
              Distribución de macronutrientes
              <span style={{ fontSize:'.8rem', fontWeight:400, color: valid ? 'var(--muted)' : 'var(--rose)', marginLeft:12 }}>
                Suma: {total}% {valid ? '✓' : '— debe ser 100%'}
              </span>
            </h3>

            <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
              <SliderField label="🥩 Proteína" value={pcts.p} min={5} max={60}
                onChange={v => ajustar('p',v)} color={RANGOS_REF.proteina.color}
                hint={`${gP} g · ${Math.round(kcal*pcts.p/100)} kcal · Normal: 10–35%`}
                unit="%"/>
              <SliderField label="🌾 Carbohidratos" value={pcts.c} min={5} max={75}
                onChange={v => ajustar('c',v)} color={RANGOS_REF.carbohidrato.color}
                hint={`${gC} g · ${Math.round(kcal*pcts.c/100)} kcal · Normal: 45–65%`}
                unit="%"/>
              <SliderField label="🥑 Grasas" value={pcts.g} min={5} max={60}
                onChange={v => ajustar('g',v)} color={RANGOS_REF.grasa.color}
                hint={`${gG} g · ${Math.round(kcal*pcts.g/100)} kcal · Normal: 20–35%`}
                unit="%"/>
            </div>

            {/* Rangos de referencia */}
            <div style={{ marginTop:'1rem', padding:'.9rem', background:'var(--cream)', borderRadius:'var(--radius-sm)' }}>
              <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em' }}>
                Rangos fisiológicos INCMNSZ
              </div>
              {Object.entries(RANGOS_REF).map(([k, r]) => {
                const v = k==='proteina'?pcts.p:k==='carbohidrato'?pcts.c:pcts.g
                const ok = v>=r.lo && v<=r.hi
                return (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ width:110, fontSize:'.82rem', fontWeight:500 }}>{r.label}</span>
                    <span style={{ width:60, fontSize:'.8rem', color:'var(--muted)' }}>{r.lo}–{r.hi}%</span>
                    <span style={{ fontSize:'.82rem', color: ok ? 'var(--sage)' : 'var(--amber)', fontWeight:600 }}>
                      {ok ? '✓' : '⚠'} {v}%
                    </span>
                    {!ok && <span style={{ fontSize:'.75rem', color:'var(--amber)' }}>Caso clínico</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {resultado?.advertencias?.length > 0 && (
            <Alert type="warning">
              <strong>Caso clínico detectado:</strong> {resultado.advertencias.join(' · ')}
            </Alert>
          )}

          <div style={{ display:'flex', gap:'.75rem' }}>
            <button className="btn-secondary" onClick={onBack}>← Volver</button>
            <button className="btn-primary" style={{ flex:1 }}
              onClick={calcular} disabled={!valid || loading}>
              {loading ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/> Calculando...</> : '⚡ Calcular macros'}
            </button>
            {resultado && (
              <button className="btn-primary" style={{ flex:1, background:'var(--teal)' }}
                onClick={() => onNext(resultado)}>
                Continuar → Grupos
              </button>
            )}
          </div>
        </div>

        {/* Visual */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', position:'sticky', top:'1rem' }}>
          <div className="card" style={{ padding:'1.5rem', textAlign:'center' }}>
            <DonutChart
              slices={[
                { value: pcts.p, color: RANGOS_REF.proteina.color },
                { value: pcts.c, color: RANGOS_REF.carbohidrato.color },
                { value: pcts.g, color: RANGOS_REF.grasa.color },
              ]}
              centerLabel={`${kcal}`}
              centerSub="kcal/día"
            />
            <div style={{ marginTop:'1rem', display:'flex', justifyContent:'center', gap:'1rem', flexWrap:'wrap' }}>
              {[
                { label:'Proteína',      val:pcts.p, g:gP, color:RANGOS_REF.proteina.color },
                { label:'Carbs',         val:pcts.c, g:gC, color:RANGOS_REF.carbohidrato.color },
                { label:'Grasas',        val:pcts.g, g:gG, color:RANGOS_REF.grasa.color },
              ].map(m => (
                <div key={m.label} style={{ textAlign:'center' }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:m.color, margin:'0 auto 4px' }}/>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>{m.label}</div>
                  <div style={{ fontWeight:700, fontSize:'.9rem', color:m.color }}>{m.val}%</div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>{m.g}g</div>
                </div>
              ))}
            </div>
          </div>

          {resultado && (
            <div className="card fade-in" style={{ padding:'1.25rem' }}>
              <h4 style={{ fontSize:'.9rem', color:'var(--sage)', marginBottom:'.8rem' }}>Resultado del optimizador</h4>
              {[
                { label:'Proteína',       val: resultado.macros_g.proteina,      g:true, color:'#4a7c59' },
                { label:'Carbohidratos',  val: resultado.macros_g.carbohidrato,  g:true, color:'#2a7a8c' },
                { label:'Grasas',         val: resultado.macros_g.grasa,         g:true, color:'#c4702a' },
              ].map(m => (
                <div key={m.label} style={{ display:'flex', justifyContent:'space-between', padding:'.45rem .6rem',
                  borderRadius:6, background:'var(--cream)', marginBottom:4 }}>
                  <span style={{ fontSize:'.88rem' }}>{m.label}</span>
                  <strong style={{ color: m.color }}>{m.val} g</strong>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'.5rem .6rem',
                borderRadius:6, background:'var(--sage-pale)', marginTop:4 }}>
                <span style={{ fontWeight:600, color:'var(--sage)' }}>Total</span>
                <strong style={{ color:'var(--sage)' }}>{resultado.kcal_resultantes} kcal</strong>
              </div>
              {resultado.desviacion_kcal > 0.5 && (
                <div style={{ fontSize:'.78rem', color:'var(--muted)', marginTop:6, textAlign:'center' }}>
                  Desviación: {resultado.desviacion_kcal} kcal
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
