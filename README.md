# DietoMetrics v4 🌿

Herramienta para nutriólogos — diseño de planes alimenticios con optimización matemática
basada en el Sistema Mexicano de Alimentos Equivalentes (INCMNSZ/SMAE).

## ✨ Lo nuevo en esta versión

- **Tema claro y amigable** (crema/sage/teal/ámbar) — sin tonos oscuros
- **Paso 1 ahora es el paciente** — y propone calorías recomendadas (Mifflin-St Jeor)
- **Análisis de sensibilidad interactivo** — modificas el % mín/máx por grupo y el algoritmo evalúa en tiempo real si las restricciones son compatibles, mostrando la calidad: ✓ excelente, ⚠ aceptable, ✗ conflicto
- **Búsqueda libre de alimentos** — al armar el menú, cada grupo tiene un buscador que consulta TODA la BD (los 2,863 alimentos), no solo 5 sugerencias
- **Receta final completa** — incluye datos del paciente, estadísticas con 4 visualizaciones (donut por tiempo, barras objetivo vs real, ranking calórico por grupo, stack de macros por tiempo) y exportación PDF
- **PDF profesional** — generado en cliente con jsPDF, 100% en español, con todos los datos del paciente, macros, grupos SMAE y menú detallado

## 🚀 Cómo correrlo

### 1. Backend (FastAPI)
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```
La API queda en `http://localhost:8000`. El archivo `alimentos5.db` debe estar en la misma carpeta.

### 2. Frontend (Vite + React)
```bash
npm install
npm run dev
```
Abre `http://localhost:5173`

## 📋 Flujo de trabajo

| Paso | Pantalla | Qué hace |
|---|---|---|
| 1 | **Paciente** | Datos antropométricos · cálculo IMC, TMB, GET · figura corporal SVG dinámica |
| 2 | **Macros** | Slider de kcal (con sugerencia del paso 1) + % macros con donut chart en vivo |
| 3 | **Grupos** | Selección de grupos SMAE + 3 sub-tabs: Grupos, Restricciones, Sensibilidad |
| 4 | **Menú** | Configuras tiempos de comida (2-6) y buscas alimentos libres en cada grupo |
| 5 | **Receta** | 3 tabs: Receta del día, Estadísticas (4 gráficas), Exportar PDF |

## 🔍 Análisis de sensibilidad — el flujo clave

1. Se calcula la solución base (sin restricciones)
2. En la pestaña "Sensibilidad" cada grupo tiene 2 inputs: `% mínimo` y `% máximo`
3. Al cambiar cualquier valor, el backend re-evalúa instantáneamente:
   - Si las restricciones son factibles
   - Cuánta es la desviación de los macros objetivo
   - Cuánto margen queda en cada grupo
4. Una barra visual muestra el % calórico actual y los límites como líneas punteadas

## 📁 Estructura

```
dietometrics-v2/
├── main.py                     ← FastAPI backend (con endpoint /caso/sensibilidad)
├── alimentos5.db               ← BD SMAE (2,863 alimentos)
├── requirements.txt
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx                 ← Orquesta los 5 pasos
    ├── index.css               ← Tema claro (vars CSS)
    ├── components/
    │   ├── UI.jsx              ← Componentes compartidos (StepBar, DonutChart, etc.)
    │   ├── StepPaciente.jsx
    │   ├── StepMacros.jsx
    │   ├── StepGrupos.jsx      ← Incluye panel de sensibilidad
    │   ├── StepMenu.jsx        ← Buscador libre por grupo
    │   └── StepReceta.jsx      ← Stats + export PDF
    └── utils/
        ├── api.js
        └── exportPDF.js        ← jsPDF + autotable
```

## 🎨 Paleta

| Color | Hex | Uso |
|---|---|---|
| Sage | `#4a7c59` | Primario / proteína |
| Teal | `#2a7a8c` | Carbohidratos / acción secundaria |
| Amber | `#c4702a` | Grasas / advertencias |
| Cream | `#faf7f2` | Fondo |
| Warm white | `#fff9f4` | Tarjetas |

Tipografías: **Fraunces** (display, serif) + **DM Sans** (body).
