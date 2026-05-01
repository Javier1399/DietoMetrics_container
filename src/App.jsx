import { useState, useCallback, Component } from 'react'
import { StepBar } from './components/UI.jsx'
import StepPaciente from './components/StepPaciente.jsx'
import StepMacros from './components/StepMacros.jsx'
import StepGrupos from './components/StepGrupos.jsx'
import StepMenu from './components/StepMenu.jsx'
import StepReceta from './components/StepReceta.jsx'
import StepPlanSemanal from './components/StepPlanSemanal.jsx'

// ── Error boundary para el plan semanal ───────────────────────────────────────
class PlanErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:'2rem', textAlign:'center' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>⚠️</div>
          <h3 style={{ fontFamily:'Fraunces,serif', marginBottom:'.75rem' }}>
            Ocurrió un error en el plan
          </h3>
          <p style={{ color:'var(--muted)', marginBottom:'1.25rem', fontSize:'.9rem' }}>
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <button className="btn-primary" onClick={() => {
            this.setState({ error: null })
            this.props.onReset?.()
          }}>
            Recargar plan
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const STEP_LABELS = ['Paciente','Macros','Grupos','Menú','Receta','Plan semanal']
const INITIAL_DATA = {
  paciente:null, resultadoPaciente:null, kcalSugeridas:null,
  macros:null, equivalencias:null, menuResult:null,
  planNombreNuevoDia:null,   // nombre del día recién confirmado desde StepReceta
  planDiaIdx:null, planPuntoRetorno:null, planDiaBase:null,
}

export default function App() {
  const [step,      setStep]      = useState(1)
  const [data,      setData]      = useState(INITIAL_DATA)
  const [showReset, setShowReset] = useState(false)

  const goTo = (n) => setStep(Math.max(1, Math.min(6, n)))
  const patch = useCallback((updates) => setData(d => ({ ...d, ...updates })), [])

  const resetTodo = () => { setData(INITIAL_DATA); setStep(1); setShowReset(false) }

  // Desde StepReceta: usuario confirmó nombre y quiere ir al plan
  const handleIrAlPlan = (nombreDia) => {
    patch({ planNombreNuevoDia: nombreDia })
    goTo(6)
  }

  // Desde StepPlanSemanal: editar un día concreto
  const handleEditarDiaDelPlan = (diaIdx, punto, diaBase) => {
    patch({ planDiaIdx: diaIdx, planPuntoRetorno: punto, planDiaBase: diaBase,
            planNombreNuevoDia: null })
    goTo(4)
  }

  const vieneDePlan = data.planDiaIdx !== null || data.planPuntoRetorno

  return (
    <div style={{ minHeight:'100vh', background:'var(--cream)' }}>
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:`radial-gradient(circle at 5% 10%,var(--sage-pale) 0%,transparent 35%),
          radial-gradient(circle at 95% 85%,var(--teal-pale) 0%,transparent 40%),
          radial-gradient(circle at 50% 50%,var(--amber-pale) 0%,transparent 55%)`,
        opacity:.55,
      }}/>

      <header style={{
        position:'sticky', top:0, zIndex:50,
        background:'rgba(255,249,244,.88)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid var(--border)', padding:'.85rem 0',
      }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 1.5rem',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.85rem' }}>
            <div style={{ width:38, height:38, borderRadius:10,
              background:'linear-gradient(135deg,var(--sage),var(--teal))',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'1.2rem', boxShadow:'var(--shadow-sm)' }}>🌿</div>
            <div>
              <div style={{ fontFamily:'Fraunces, serif', fontSize:'1.45rem', fontWeight:700, color:'var(--ink)', lineHeight:1 }}>
                Dieto<span style={{ color:'var(--sage)' }}>Metrics</span>
              </div>
              <div style={{ fontSize:'.7rem', color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase' }}>
                Plan nutricional · INCMNSZ/SMAE
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
            {data.paciente && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'.85rem', fontWeight:600 }}>{data.paciente.nombre}</div>
                  <div style={{ fontSize:'.7rem', color:'var(--muted)' }}>
                    {data.paciente.edad}a · {data.paciente.sexo==='masculino'?'♂':'♀'} · IMC {data.resultadoPaciente?.imc||'—'}
                  </div>
                </div>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--sage-pale)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:700, color:'var(--sage)', fontSize:'.9rem' }}>
                  {data.paciente.nombre?.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()||'👤'}
                </div>
              </div>
            )}
            <button className="btn-secondary" style={{ fontSize:'.82rem', padding:'.45rem 1rem' }}
              onClick={() => setShowReset(true)}>🔄 Nuevo caso</button>
          </div>
        </div>
      </header>

      {showReset && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,43,30,.35)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
          onClick={() => setShowReset(false)}>
          <div className="card-raised fade-up" style={{ width:'100%', maxWidth:400, padding:'1.75rem' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily:'Fraunces,serif', fontSize:'1.2rem', marginBottom:'.75rem' }}>¿Iniciar nuevo caso?</h3>
            <p style={{ fontSize:'.9rem', color:'var(--muted)', marginBottom:'1.25rem' }}>
              Se perderán todos los datos del caso actual. Esta acción no se puede deshacer.
            </p>
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button className="btn-secondary" style={{ flex:1 }} onClick={() => setShowReset(false)}>Cancelar</button>
              <button className="btn-primary" style={{ flex:1, background:'var(--rose)' }} onClick={resetTodo}>Sí, nuevo caso</button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth:1200, margin:'0 auto', padding:'1.5rem', position:'relative', zIndex:1 }}>
        <StepBar current={step} steps={STEP_LABELS}/>

        {step===1 && (
          <StepPaciente initial={data.paciente}
            onCargarSesion={(sesion) => {
              patch({
                paciente:          sesion.paciente,
                resultadoPaciente: sesion.resultadoPaciente,
                kcalSugeridas:     sesion.kcalSugeridas,
                macros:            sesion.macros,
                equivalencias:     sesion.equivalencias,
                menuResult:        sesion.menuResult,
                _sesionImportada:  { dias: sesion.dias, ficha: sesion.ficha },
              })
              goTo(6)
            }}
            onNext={({ paciente, resultadoPaciente, kcalSugeridas }) => {
              patch({ paciente, resultadoPaciente, kcalSugeridas }); goTo(2)
            }}/>
        )}
        {step===2 && (
          <StepMacros initial={data.macros} kcalSugeridas={data.kcalSugeridas}
            onBack={() => goTo(1)}
            onNext={macros => { patch({ macros }); goTo(3) }}/>
        )}
        {step===3 && data.macros && (
          <StepGrupos macros={data.macros} initial={data.equivalencias}
            onBack={() => goTo(2)}
            onNext={eq => { patch({ equivalencias:eq }); goTo(4) }}/>
        )}
        {step===4 && data.equivalencias && (
          <StepMenu
            equivalencias={data.equivalencias}
            initialUiStep={data.planPuntoRetorno || 'config'}
            diaBase={data.planDiaBase}
            onBack={() => {
              if (vieneDePlan) { patch({ planDiaIdx:null, planPuntoRetorno:null, planDiaBase:null }); goTo(6) }
              else goTo(3)
            }}
            onNext={menuResult => {
              patch({ menuResult })
              if (vieneDePlan) { patch({ planDiaIdx:null, planPuntoRetorno:null, planDiaBase:null }); goTo(6) }
              else goTo(5)
            }}/>
        )}
        {step===5 && data.menuResult && (
          <StepReceta
            paciente={data.paciente} resultadoPaciente={data.resultadoPaciente}
            macros={data.macros} equivalencias={data.equivalencias} menuResult={data.menuResult}
            onBack={() => goTo(4)}
            onPlanSemanal={handleIrAlPlan}/>
        )}
        {step===6 && (
          <PlanErrorBoundary onReset={() => setStep(6)}>
            <StepPlanSemanal
              paciente={data.paciente} macros={data.macros}
              menuResultHoy={data.menuResult} equivalencias={data.equivalencias}
              nombreNuevoDia={data.planNombreNuevoDia}
              onBack={() => { patch({ planNombreNuevoDia:null }); goTo(5) }}
              onEditarDia={handleEditarDiaDelPlan}
              allData={data}
              onCargarSesion={(sesion) => {
                setData({ ...INITIAL_DATA, ...sesion })
                setStep(6)
              }}/>
          </PlanErrorBoundary>
        )}
      </main>

      <footer style={{ textAlign:'center', padding:'1.5rem', fontSize:'.78rem', color:'var(--muted)',
        position:'relative', zIndex:1, marginTop:'2rem' }}>
        DietoMetrics v6.0 · Sistema Mexicano de Alimentos Equivalentes (SMAE) · INCMNSZ
      </footer>
    </div>
  )
}
