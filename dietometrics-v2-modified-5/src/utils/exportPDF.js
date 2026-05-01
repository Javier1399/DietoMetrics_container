export function exportarPDF({ paciente, resultadoPaciente, macros, equivalencias, menuFinal, tiemposNombres }) {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const W = 210, margin = 18
  let y = 0

  const sage  = [74,124,89]; const teal  = [42,122,140]; const amber = [196,112,42]
  const ink   = [28,43,30];  const muted = [120,143,130]
  const cream = [250,247,242]; const white = [255,255,255]; const border = [220,232,220]

  const ACT_LABEL = { sedentario:'Sedentario', ligero:'Ligeramente activo', moderado:'Moderadamente activo', activo:'Muy activo', muy_activo:'Extra activo' }
  const OBJ_LABEL = { bajar:'Bajar de peso', mantener:'Mantener peso', subir:'Aumentar masa' }

  // Header
  doc.setFillColor(...sage)
  doc.rect(0, 0, W, 38, 'F')
  doc.setFontSize(24); doc.setFont('helvetica','bold'); doc.setTextColor(...white)
  doc.text('DietoMetrics', margin, 18)
  doc.setFontSize(10); doc.setFont('helvetica','normal')
  doc.text('Plan Alimenticio Personalizado · INCMNSZ / SMAE', margin, 27)
  doc.setFontSize(9)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-MX',{dateStyle:'long'})}`, margin, 34)
  y = 48

  const section = (title, color=sage) => {
    doc.setFillColor(...color)
    doc.roundedRect(margin, y, W-2*margin, 8, 2, 2, 'F')
    doc.setTextColor(...white); doc.setFont('helvetica','bold'); doc.setFontSize(10)
    doc.text(title, margin+4, y+5.5)
    y += 13
  }

  const row2 = (label, val, l2='', v2='') => {
    doc.setFont('helvetica','bold'); doc.setTextColor(...muted); doc.setFontSize(8.5)
    doc.text(label, margin, y)
    doc.setFont('helvetica','normal'); doc.setTextColor(...ink); doc.setFontSize(9)
    doc.text(String(val), margin+38, y)
    if (l2) {
      doc.setFont('helvetica','bold'); doc.setTextColor(...muted); doc.setFontSize(8.5)
      doc.text(l2, W/2, y)
      doc.setFont('helvetica','normal'); doc.setTextColor(...ink); doc.setFontSize(9)
      doc.text(String(v2), W/2+38, y)
    }
    y += 7
  }

  const checkPage = (needed=20) => { if (y+needed>275) { doc.addPage(); y=18 } }

  // ── Paciente ──
  section('Datos del Paciente')
  doc.setFillColor(...cream); doc.rect(margin, y-2, W-2*margin, 50, 'F')
  row2('Nombre:', paciente.nombre, 'Fecha:', new Date().toLocaleDateString('es-MX'))
  row2('Edad:', `${paciente.edad} años`, 'Sexo:', paciente.sexo==='masculino'?'Masculino':'Femenino')
  row2('Peso:', `${paciente.peso_kg} kg`, 'Talla:', `${paciente.talla_cm} cm`)
  if (resultadoPaciente) {
    row2('IMC:', `${resultadoPaciente.imc} (${resultadoPaciente.estado_imc})`, 'Peso ideal:', `${resultadoPaciente.peso_ideal_min}–${resultadoPaciente.peso_ideal_max} kg`)
    row2('TMB:', `${resultadoPaciente.tmb} kcal`, 'GET:', `${resultadoPaciente.get} kcal`)
  }
  row2('Objetivo:', OBJ_LABEL[paciente.objetivo]||paciente.objetivo||'-',
       'Actividad:', ACT_LABEL[paciente.actividad]||paciente.actividad||'-')
  if (paciente.notas) row2('Notas:', paciente.notas)
  y += 4

  // ── Macronutrientes ──
  checkPage(50)
  section('Distribución de Macronutrientes', teal)
  if (macros) {
    const m = macros.macros_g
    const kcal = macros.kcal_resultantes || macros.kcal_objetivo
    doc.autoTable({
      startY: y, margin:{ left:margin, right:margin },
      head:[['Macronutriente','Gramos (g)','Calorías (kcal)','% del total']],
      body:[
        ['Proteína',      `${m.proteina} g`,     `${Math.round(m.proteina*4)} kcal`,     `${Math.round((macros.distribucion_pct?.proteina||0)*100)}%`],
        ['Carbohidratos', `${m.carbohidrato} g`,  `${Math.round(m.carbohidrato*4)} kcal`, `${Math.round((macros.distribucion_pct?.carbohidrato||0)*100)}%`],
        ['Grasas',        `${m.grasa} g`,         `${Math.round(m.grasa*9)} kcal`,        `${Math.round((macros.distribucion_pct?.grasa||0)*100)}%`],
        ['TOTAL',         '—',                    `${Math.round(kcal)} kcal`,             '100%'],
      ],
      headStyles:{ fillColor:teal, textColor:255, fontStyle:'bold', fontSize:9 },
      bodyStyles:{ fontSize:9, textColor:ink },
      alternateRowStyles:{ fillColor:[240,250,252] },
      didParseCell: (d) => {
        if (d.section==='body' && d.row.index===3) {
          d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=teal; d.cell.styles.textColor=255
        }
      },
      theme:'grid',
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Grupos SMAE ──
  checkPage(60)
  section('Distribución por Grupos SMAE', sage)
  if (equivalencias?.resumen_por_grupo) {
    const rows = Object.entries(equivalencias.resumen_por_grupo).map(([g,info]) => [
      g, info.porciones, `${info.kcal_por_porcion} kcal`, `${info.kcal_totales} kcal`, `${info.pct_calorico}%`
    ])
    doc.autoTable({
      startY:y, margin:{left:margin, right:margin},
      head:[['Grupo','Porciones','kcal/porc','kcal totales','% del día']],
      body:rows,
      foot:[['TOTAL','—','—',`${equivalencias.kcal_totales} kcal`,'100%']],
      headStyles:{ fillColor:sage, textColor:255, fontStyle:'bold', fontSize:8.5 },
      footStyles:{ fillColor:sage, textColor:255, fontStyle:'bold', fontSize:8.5 },
      bodyStyles:{ fontSize:8.5, textColor:ink },
      alternateRowStyles:{ fillColor:[240,250,244] },
      theme:'grid',
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // ── Menú diario ──
  if (menuFinal && tiemposNombres) {
    checkPage(30)
    section('Menú Diario Propuesto', amber)

    for (const nombre of tiemposNombres) {
      const td = menuFinal[nombre]
      if (!td?.alimentos?.length) continue
      checkPage(40)

      doc.setFont('helvetica','bold'); doc.setTextColor(...amber); doc.setFontSize(10)
      const kcalT = td.alimentos.reduce((s,a) => s+(a.energia_kcal||0), 0)
      doc.text(`${nombre}  ·  ${Math.round(kcalT)} kcal`, margin, y)
      y += 6

      const aliRows = td.alimentos.map(a => [
        a.alimento, a.grupo,
        `${Math.round(a.gramos)} g`,
        `${Math.round(a.energia_kcal||0)} kcal`,
        `P${(a.proteina_g||0).toFixed(1)} C${(a.hc_g||0).toFixed(1)} G${(a.lipidos_g||0).toFixed(1)}`,
      ])

      doc.autoTable({
        startY:y, margin:{left:margin+4, right:margin},
        head:[['Alimento','Grupo','Peso','Energía','Macros']],
        body:aliRows,
        headStyles:{ fillColor:[245,226,208], textColor:amber, fontStyle:'bold', fontSize:8 },
        bodyStyles:{ fontSize:8, textColor:ink },
        alternateRowStyles:{ fillColor:[253,247,240] },
        theme:'grid',
      })
      y = doc.lastAutoTable.finalY + 7
    }
  }

  // Footer
  const pages = doc.getNumberOfPages()
  for (let i=1; i<=pages; i++) {
    doc.setPage(i)
    doc.setFillColor(...border); doc.rect(0,285,W,12,'F')
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...muted)
    doc.text('DietoMetrics · INCMNSZ/SMAE · Plan orientativo, validar con profesional de salud', margin, 291)
    doc.text(`Pág. ${i}/${pages}`, W-margin, 291, {align:'right'})
  }

  const nombre = paciente.nombre?.replace(/\s+/g,'_') || 'paciente'
  doc.save(`DietoMetrics_${nombre}_${new Date().toISOString().slice(0,10)}.pdf`)
}
