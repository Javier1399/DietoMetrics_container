import { useState, useRef } from 'react'
import { api } from '../utils/api.js'
import { MetricCard, Alert } from './UI.jsx'

const ACTIVIDADES = [
  { value:'sedentario',  label:'Sedentario',         desc:'Poco o nada de ejercicio' },
  { value:'ligero',      label:'Ligeramente activo',  desc:'1–3 días/semana' },
  { value:'moderado',    label:'Moderadamente activo',desc:'3–5 días/semana' },
  { value:'activo',      label:'Muy activo',           desc:'6–7 días/semana' },
  { value:'muy_activo',  label:'Extra activo',         desc:'Trabajo físico intenso' },
]
const OBJETIVOS = [
  { value:'bajar',    label:'Bajar de peso',       icon:'↓', adj:'-500 kcal' },
  { value:'mantener', label:'Mantener peso',        icon:'=', adj:'0 kcal' },
  { value:'subir',    label:'Aumentar masa',        icon:'↑', adj:'+300 kcal' },
]

export default function StepPaciente({ onNext, initial, onCargarSesion }) {
  const [form, setForm] = useState(initial || {
    nombre:'', edad:30, sexo:'femenino', peso_kg:65, talla_cm:165,
    actividad:'moderado', objetivo:'mantener', notas:''
  })
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const set = (k, v) => { setForm(f => ({...f,[k]:v})); setResultado(null) }

  const calcular = async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.calcularPaciente(form)
      setResultado(res)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const handleCargar = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const sesion = JSON.parse(ev.target.result)
        if (sesion.version && onCargarSesion) onCargarSesion(sesion)
        else alert('Archivo no válido')
      } catch { alert('No se pudo leer el archivo') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const imc = form.peso_kg && form.talla_cm
    ? (form.peso_kg / ((form.talla_cm/100)**2)).toFixed(1) : null

  const imcColor = !imc ? 'var(--muted)'
    : imc < 18.5 ? 'var(--teal)' : imc < 25 ? 'var(--sage)' : imc < 30 ? 'var(--amber)' : 'var(--rose)'
  const imcLabel = !imc ? '—'
    : imc < 18.5 ? 'Bajo peso' : imc < 25 ? 'Peso normal' : imc < 30 ? 'Sobrepeso' : 'Obesidad'

  return (
    <div className="fade-up">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.3rem' }}>
        <h2 style={{ fontFamily:'Fraunces,serif', fontSize:'1.6rem' }}>Perfil del paciente</h2>
        <div>
          <input ref={fileRef} type="file" accept=".dietometrics,.json" style={{ display:'none' }} onChange={handleCargar}/>
          <button className="btn-secondary" style={{ fontSize:'.82rem', display:'flex', alignItems:'center', gap:6 }}
            onClick={() => fileRef.current?.click()}>
            📂 Cargar paciente existente
          </button>
        </div>
      </div>
      <p style={{ color:'var(--muted)', marginBottom:'1.5rem', fontSize:'.92rem' }}>
        Los datos antropométricos permiten calcular el requerimiento energético personalizado.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.5rem', alignItems:'start' }}>

        {/* Form */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>

          <div className="card" style={{ padding:'1.25rem' }}>
            <h3 style={{ fontSize:'1rem', marginBottom:'1rem', color:'var(--sage)' }}>Información general</h3>
            <div style={{ display:'grid', gap:'1rem' }}>
              <div>
                <label className="field-label">Nombre completo</label>
                <input className="input-field" placeholder="Ej. María García López"
                  value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label className="field-label">Edad</label>
                  <input className="input-field" type="number" min={1} max={120}
                    value={form.edad} onChange={e => set('edad', +e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Sexo</label>
                  <select className="input-field" value={form.sexo} onChange={e => set('sexo', e.target.value)}>
                    <option value="femenino">Femenino</option>
                    <option value="masculino">Masculino</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label className="field-label">Peso (kg)</label>
                  <input className="input-field" type="number" min={20} max={300} step={0.1}
                    value={form.peso_kg} onChange={e => set('peso_kg', +e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Talla (cm)</label>
                  <input className="input-field" type="number" min={100} max={250} step={0.5}
                    value={form.talla_cm} onChange={e => set('talla_cm', +e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding:'1.25rem' }}>
            <h3 style={{ fontSize:'1rem', marginBottom:'1rem', color:'var(--sage)' }}>Nivel de actividad física</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
              {ACTIVIDADES.map(a => (
                <label key={a.value} style={{
                  display:'flex', alignItems:'center', gap:'.75rem',
                  padding:'.6rem .85rem', borderRadius:'var(--radius-sm)', cursor:'pointer',
                  background: form.actividad===a.value ? 'var(--sage-pale)' : 'transparent',
                  border: `1.5px solid ${form.actividad===a.value ? 'var(--border-strong)' : 'transparent'}`,
                  transition:'all .15s'
                }}>
                  <input type="radio" name="actividad" value={a.value}
                    checked={form.actividad===a.value} onChange={() => set('actividad', a.value)}
                    style={{ accentColor:'var(--sage)', width:16, height:16 }} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:'.9rem' }}>{a.label}</div>
                    <div style={{ fontSize:'.78rem', color:'var(--muted)' }}>{a.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding:'1.25rem' }}>
            <h3 style={{ fontSize:'1rem', marginBottom:'1rem', color:'var(--sage)' }}>Objetivo de la dieta</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'.6rem' }}>
              {OBJETIVOS.map(o => (
                <button key={o.value} onClick={() => set('objetivo', o.value)}
                  style={{
                    padding:'.8rem', borderRadius:'var(--radius-sm)', cursor:'pointer',
                    border:`2px solid ${form.objetivo===o.value ? 'var(--sage)' : 'var(--border)'}`,
                    background: form.objetivo===o.value ? 'var(--sage-pale)' : 'var(--warm-white)',
                    textAlign:'center', transition:'all .15s'
                  }}>
                  <div style={{ fontSize:'1.5rem', marginBottom:4 }}>{o.icon}</div>
                  <div style={{ fontWeight:600, fontSize:'.85rem', color: form.objetivo===o.value ? 'var(--sage)' : 'var(--ink)' }}>
                    {o.label}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:2 }}>{o.adj}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding:'1.25rem' }}>
            <label className="field-label">Notas clínicas (opcional)</label>
            <textarea className="input-field" rows={2}
              placeholder="Ej. DM2, hipertensión, alergias, diagnóstico..."
              value={form.notas} onChange={e => set('notas', e.target.value)}
              style={{ resize:'vertical' }}/>
          </div>

          {error && <Alert type="error">{error}</Alert>}
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', position:'sticky', top:'1rem' }}>

          {/* Body figure */}
          <div className="card" style={{ padding:'1.5rem', textAlign:'center' }}>
            <BodyFigure imc={imc} imcColor={imcColor} sexo={form.sexo}/>
            <div style={{ marginTop:'1rem' }}>
              <div style={{ fontSize:'2rem', fontWeight:700, fontFamily:'Fraunces,serif', color: imcColor }}>
                {imc || '—'}
              </div>
              <div style={{ fontSize:'.75rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>IMC kg/m²</div>
              <span className={`tag ${imc < 18.5 ? 'tag-teal' : imc < 25 ? 'tag-sage' : imc < 30 ? 'tag-amber' : 'tag-rose'}`}
                style={{ marginTop:6 }}>
                {imcLabel}
              </span>
            </div>
          </div>

          {resultado && (
            <div className="card fade-in" style={{ padding:'1.25rem' }}>
              <h4 style={{ fontSize:'.9rem', color:'var(--sage)', marginBottom:'1rem' }}>⚡ Requerimiento energético</h4>
              <div style={{ display:'grid', gap:'.6rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'.5rem .7rem', background:'var(--cream)', borderRadius:8 }}>
                  <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>TMB (Mifflin-St Jeor)</span>
                  <strong style={{ color:'var(--ink)' }}>{resultado.tmb} kcal</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'.5rem .7rem', background:'var(--cream)', borderRadius:8 }}>
                  <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>GET (con actividad)</span>
                  <strong>{resultado.get} kcal</strong>
                </div>
                <div style={{
                  display:'flex', justifyContent:'space-between', padding:'.6rem .7rem',
                  background:'var(--sage-pale)', borderRadius:8, border:'1px solid var(--border-strong)'
                }}>
                  <span style={{ fontWeight:600, color:'var(--sage)' }}>Kcal objetivo</span>
                  <strong style={{ color:'var(--sage)', fontSize:'1.05rem' }}>{resultado.kcal_recomendadas} kcal</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'.5rem .7rem', background:'var(--cream)', borderRadius:8 }}>
                  <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>Peso saludable</span>
                  <strong>{resultado.peso_ideal_min}–{resultado.peso_ideal_max} kg</strong>
                </div>
              </div>
            </div>
          )}

          <button className="btn-primary" style={{ width:'100%', padding:'.75rem' }}
            onClick={calcular} disabled={!form.nombre || loading}>
            {loading ? <><span className="spinner" style={{width:16,height:16,marginRight:8}}/> Calculando...</> : '📊 Calcular requerimiento'}
          </button>

          {resultado && (
            <button className="btn-primary" style={{ width:'100%', padding:'.75rem', background:'var(--teal)' }}
              onClick={() => onNext({ paciente: form, resultadoPaciente: resultado, kcalSugeridas: resultado.kcal_recomendadas })}>
              Continuar → Macronutrientes
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BodyFigure({ imc, imcColor, sexo }) {
  const c = imcColor || 'var(--sage)'
  return (
    <svg viewBox="0 0 80 170" width="80" style={{ filter:`drop-shadow(0 4px 10px ${c}30)` }}>
      {/* Head */}
      <circle cx="40" cy="20" r="14" fill={c} opacity=".9"/>
      {/* Neck */}
      <rect x="35" y="32" width="10" height="8" rx="3" fill={c} opacity=".85"/>
      {/* Body */}
      <path d="M20 44 Q14 70 16 110 L30 110 L30 155 L38 155 L38 110 L42 110 L42 155 L50 155 L50 110 L64 110 Q66 70 60 44 Q52 38 40 38 Q28 38 20 44Z"
        fill={c} opacity=".78"/>
      {/* Arms */}
      <path d="M20 46 Q8 70 10 100 L18 97 Q17 72 26 52Z" fill={c} opacity=".65"/>
      <path d="M60 46 Q72 70 70 100 L62 97 Q63 72 54 52Z" fill={c} opacity=".65"/>
    </svg>
  )
}
