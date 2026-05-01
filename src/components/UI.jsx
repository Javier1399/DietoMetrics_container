import { useState } from 'react'

// ── Step indicator ────────────────────────────────────────────────────────────
export function StepBar({ current, steps }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:'2rem' }}>
      {steps.map((s, i) => {
        const done = i < current - 1
        const active = i === current - 1
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', flex: i < steps.length-1 ? 1 : 'none' }}>
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
              minWidth: 72
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display:'flex',
                alignItems:'center', justifyContent:'center',
                fontWeight: 700, fontSize: '.85rem',
                background: done ? 'var(--sage)' : active ? 'var(--warm-white)' : 'var(--cream)',
                color: done ? '#fff' : active ? 'var(--sage)' : 'var(--muted)',
                border: `2px solid ${done || active ? 'var(--sage)' : 'var(--border)'}`,
                boxShadow: active ? '0 0 0 4px var(--sage-pale)' : 'none',
                transition: 'all .25s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '.72rem', fontWeight: active ? 600 : 400,
                color: active ? 'var(--sage)' : done ? 'var(--ink-mid)' : 'var(--muted)',
                whiteSpace: 'nowrap', textAlign: 'center'
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: done ? 'var(--sage)' : 'var(--border)',
                margin: '0 4px', marginTop: '-16px', transition: 'background .3s'
              }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
export function MetricCard({ label, value, unit, sub, color = 'var(--sage)', icon }) {
  return (
    <div className="card" style={{ padding: '1rem 1.2rem', textAlign: 'center' }}>
      {icon && <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: '1.7rem', fontWeight: 700, fontFamily: 'Fraunces, serif', color, lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = 'var(--sage)', label, showPct = true }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      {label && (
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 4 }}>
          <span style={{ fontSize:'.85rem', fontWeight:500 }}>{label}</span>
          {showPct && <span style={{ fontSize:'.8rem', color:'var(--muted)' }}>{value} / {max}</span>}
        </div>
      )}
      <div style={{ background:'var(--border)', borderRadius:99, height:8, overflow:'hidden' }}>
        <div style={{
          width: `${pct}%`, height:'100%', background: color,
          borderRadius: 99, transition: 'width .5s ease'
        }}/>
      </div>
    </div>
  )
}

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────
export function DonutChart({ slices, size = 180, centerLabel, centerSub }) {
  const r = 68, cx = size/2, cy = size/2
  const circumference = 2 * Math.PI * r
  let offset = 0
  const total = slices.reduce((s,sl) => s + sl.value, 0)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={20}/>
      {slices.map((sl, i) => {
        const pct = total > 0 ? sl.value / total : 0
        const dash = pct * circumference
        const gap  = circumference - dash
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={sl.color} strokeWidth={20}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circumference}
            strokeLinecap="butt"
            style={{ transition:'stroke-dasharray .6s ease' }}
          />
        )
        offset += pct
        return el
      })}
      {(centerLabel || centerSub) && (
        <g style={{ transform: `rotate(90deg) translate(0, 0)` }}>
          <text x={cx} y={cy - 6} textAnchor="middle"
            style={{ fontSize: 22, fontWeight:700, fontFamily:'Fraunces, serif', fill:'var(--ink)' }}
            transform={`rotate(90, ${cx}, ${cy})`}>
            {centerLabel}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle"
            style={{ fontSize: 11, fill:'var(--muted)' }}
            transform={`rotate(90, ${cx}, ${cy})`}>
            {centerSub}
          </text>
        </g>
      )}
    </svg>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const styles = {
    info:    { bg: 'var(--teal-pale)',  border: '#b0d8e2', color: 'var(--teal)',  icon: 'ℹ' },
    success: { bg: 'var(--sage-pale)',  border: '#b8d8bf', color: 'var(--sage)',  icon: '✓' },
    warning: { bg: 'var(--amber-pale)', border: '#f0d0b0', color: 'var(--amber)', icon: '⚠' },
    error:   { bg: 'var(--rose-pale)',  border: '#f0c0c0', color: 'var(--rose)',  icon: '✕' },
  }
  const s = styles[type]
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius-sm)',
      padding: '.7rem 1rem', display:'flex', gap:'.6rem', alignItems:'flex-start',
      fontSize: '.88rem', color: 'var(--ink)'
    }}>
      <span style={{ color: s.color, fontWeight:700, marginTop:1 }}>{s.icon}</span>
      <span>{children}</span>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(28,43,30,.35)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem'
    }} onClick={onClose}>
      <div className="card-raised fade-up" style={{ width: '100%', maxWidth: width, maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'1.25rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ fontSize:'1.1rem', fontFamily:'Fraunces,serif' }}>{title}</h3>
          <button className="btn-ghost" style={{ padding:'.3rem .6rem', fontSize:1.1+'rem' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:'1.25rem 1.5rem' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Search input ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder, style }) {
  return (
    <div style={{ position:'relative', ...style }}>
      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', fontSize:'1rem' }}>🔍</span>
      <input
        className="input-field"
        style={{ paddingLeft: '2.2rem' }}
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Buscar...'}
      />
    </div>
  )
}

// ── Slider with numeric input ─────────────────────────────────────────────────
export function SliderField({ label, value, min, max, step=1, onChange, color='var(--sage)', unit='%', hint }) {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <label className="field-label" style={{ margin:0 }}>{label}</label>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input
            type="number" min={min} max={max} step={step}
            value={value}
            onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
            style={{ width:64, padding:'.3rem .5rem', border:'1.5px solid var(--border)',
              borderRadius:6, textAlign:'center', fontWeight:600, fontSize:'.9rem',
              fontFamily:'DM Sans, sans-serif', background:'var(--warm-white)' }}
          />
          <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>{unit}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:'100%', accentColor: color, cursor:'pointer' }}
      />
      {hint && <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:3 }}>{hint}</div>}
    </div>
  )
}
