from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import sqlite3, re, math, pandas as pd
from pulp import LpProblem, LpMinimize, LpVariable, lpSum, LpStatus, PULP_CBC_CMD

app = FastAPI(title="Dieto Metrics API", version="4.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"], allow_headers=["*"]
)

DB_PATH = "alimentos5.db"

EQUIVALENCIAS = [
    {"grupo_eq":"Verduras","proteina_g":2,"hc_g":4,"grasa_g":0},
    {"grupo_eq":"Frutas","proteina_g":0,"hc_g":15,"grasa_g":0},
    {"grupo_eq":"Cereales sin grasa","proteina_g":2,"hc_g":15,"grasa_g":0},
    {"grupo_eq":"Cereales con grasa","proteina_g":2,"hc_g":15,"grasa_g":5},
    {"grupo_eq":"Leguminosas","proteina_g":8,"hc_g":20,"grasa_g":1},
    {"grupo_eq":"AOA muy bajo aporte de grasa","proteina_g":7,"hc_g":0,"grasa_g":1},
    {"grupo_eq":"AOA bajo aporte de grasa","proteina_g":7,"hc_g":0,"grasa_g":3},
    {"grupo_eq":"AOA moderado aporte de grasa","proteina_g":7,"hc_g":0,"grasa_g":5},
    {"grupo_eq":"AOA alto aporte de grasa","proteina_g":7,"hc_g":0,"grasa_g":8},
    {"grupo_eq":"Leche descremada","proteina_g":9,"hc_g":12,"grasa_g":2},
    {"grupo_eq":"Leche semidescremada","proteina_g":9,"hc_g":12,"grasa_g":4},
    {"grupo_eq":"Leche entera","proteina_g":9,"hc_g":12,"grasa_g":8},
    {"grupo_eq":"Leche con azúcar","proteina_g":8,"hc_g":30,"grasa_g":5},
    {"grupo_eq":"Grasas sin proteína","proteina_g":0,"hc_g":0,"grasa_g":5},
    {"grupo_eq":"Grasas con proteína","proteina_g":3,"hc_g":3,"grasa_g":5},
    {"grupo_eq":"Azúcares sin grasa","proteina_g":0,"hc_g":10,"grasa_g":0},
    {"grupo_eq":"Azúcares con grasa","proteina_g":0,"hc_g":10,"grasa_g":5},
    {"grupo_eq":"Bebidas alcohólicas","proteina_g":0,"hc_g":20,"grasa_g":0},
    {"grupo_eq":"Libres","proteina_g":0,"hc_g":0,"grasa_g":0},
]

RANGOS_CLINICOS = {
    "Verduras":(2,5),"Frutas":(1,4),"Cereales sin grasa":(4,8),"Cereales con grasa":(2,5),
    "Leguminosas":(1,3),"AOA muy bajo aporte de grasa":(2,5),"AOA bajo aporte de grasa":(2,5),
    "AOA moderado aporte de grasa":(2,5),"AOA alto aporte de grasa":(1,3),"Leche descremada":(1,3),
    "Leche semidescremada":(1,3),"Leche entera":(1,2),"Leche con azúcar":(0,1),
    "Grasas sin proteína":(2,4),"Grasas con proteína":(1,3),"Azúcares sin grasa":(0,2),
    "Azúcares con grasa":(0,1),"Bebidas alcohólicas":(0,1),"Libres":(0,3),
}

TIPOS_COMIDA = {
    "completa":{"pct_min":0.25,"pct_max":0.40},
    "ligera":{"pct_min":0.15,"pct_max":0.25},
    "colacion":{"pct_min":0.05,"pct_max":0.15},
}

def get_con():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def fraccion_a_numero(x):
    x = x.strip()
    m = re.match(r'^(\d+)\s+(\d+)/(\d+)$', x)
    if m: return int(m.group(1)) + int(m.group(2))/int(m.group(3))
    m = re.match(r'^(\d+)/(\d+)$', x)
    if m: return int(m.group(1))/int(m.group(2))
    try: return float(x)
    except: return 1.0

def kcal_eq(r): return 4*r["proteina_g"] + 4*r["hc_g"] + 9*r["grasa_g"]

# ─── DB endpoints ─────────────────────────────────────────────────────────────
@app.get("/grupos")
def get_grupos():
    con = get_con()
    rows = con.execute("SELECT DISTINCT grupo_de_alimentos FROM alimentos5 ORDER BY grupo_de_alimentos").fetchall()
    con.close()
    return [r["grupo_de_alimentos"] for r in rows]

@app.get("/grupos-equivalencias")
def get_grupos_eq():
    return [{"grupo_eq": e["grupo_eq"], "kcal_porcion": kcal_eq(e),
             "proteina_g": e["proteina_g"], "hc_g": e["hc_g"], "grasa_g": e["grasa_g"]}
            for e in EQUIVALENCIAS]

@app.get("/alimentos")
def get_alimentos(grupo: Optional[str] = Query(None), q: Optional[str] = Query(None)):
    con = get_con()
    if grupo and q:
        rows = con.execute(
            "SELECT alimento,unidad,grupo_de_alimentos FROM alimentos5 WHERE grupo_de_alimentos=? AND alimento LIKE ? ORDER BY alimento LIMIT 100",
            (grupo, f"%{q}%")
        ).fetchall()
    elif grupo:
        rows = con.execute(
            "SELECT alimento,unidad,grupo_de_alimentos FROM alimentos5 WHERE grupo_de_alimentos=? ORDER BY alimento",
            (grupo,)
        ).fetchall()
    elif q:
        rows = con.execute(
            "SELECT alimento,unidad,grupo_de_alimentos FROM alimentos5 WHERE alimento LIKE ? ORDER BY alimento LIMIT 100",
            (f"%{q}%",)
        ).fetchall()
    else:
        rows = con.execute("SELECT alimento,unidad,grupo_de_alimentos FROM alimentos5 ORDER BY alimento").fetchall()
    con.close()
    return [{"alimento": r["alimento"], "unidad": r["unidad"], "grupo": r["grupo_de_alimentos"]} for r in rows]

@app.get("/alimentos-por-equivalencia/{grupo_eq}")
def get_ali_eq(grupo_eq: str, q: Optional[str] = Query(None)):
    con = get_con()
    if q:
        rows = con.execute(
            "SELECT alimento,unidad,peso_neto_g,cantidad_sugerida,energia_kcal,proteina_g,lipidos_g,hidratos_de_carbono_g FROM alimentos5 WHERE grupo_de_alimentos=? AND alimento LIKE ? ORDER BY alimento",
            (grupo_eq, f"%{q}%")
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT alimento,unidad,peso_neto_g,cantidad_sugerida,energia_kcal,proteina_g,lipidos_g,hidratos_de_carbono_g FROM alimentos5 WHERE grupo_de_alimentos=? ORDER BY alimento",
            (grupo_eq,)
        ).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.get("/alimento/{nombre}")
def get_alimento(nombre: str):
    con = get_con()
    row = con.execute("SELECT * FROM alimentos5 WHERE alimento=? LIMIT 1", (nombre,)).fetchone()
    con.close()
    if not row: raise HTTPException(404, "No encontrado")
    return dict(row)

# ─── Paciente ─────────────────────────────────────────────────────────────────
class PacienteReq(BaseModel):
    nombre: str
    edad: int
    sexo: str  # "masculino" | "femenino"
    peso_kg: float
    talla_cm: float
    actividad: str  # "sedentario"|"ligero"|"moderado"|"activo"|"muy_activo"
    objetivo: Optional[str] = "mantenimiento"  # "bajar"|"mantener"|"subir"

@app.post("/paciente/calcular")
def calcular_paciente(req: PacienteReq):
    # Mifflin-St Jeor
    if req.sexo.lower() == "masculino":
        tmb = 10*req.peso_kg + 6.25*req.talla_cm - 5*req.edad + 5
    else:
        tmb = 10*req.peso_kg + 6.25*req.talla_cm - 5*req.edad - 161

    factores = {"sedentario":1.2,"ligero":1.375,"moderado":1.55,"activo":1.725,"muy_activo":1.9}
    factor = factores.get(req.actividad.lower(), 1.55)
    get = tmb * factor

    ajuste = {"bajar": -500, "mantener": 0, "subir": 300}
    kcal_objetivo = get + ajuste.get(req.objetivo, 0)

    imc = req.peso_kg / ((req.talla_cm/100)**2)
    if imc < 18.5: estado_imc = "Bajo peso"
    elif imc < 25: estado_imc = "Peso normal"
    elif imc < 30: estado_imc = "Sobrepeso"
    else: estado_imc = "Obesidad"

    peso_ideal_min = 18.5 * (req.talla_cm/100)**2
    peso_ideal_max = 24.9 * (req.talla_cm/100)**2

    return {
        "tmb": round(tmb, 1),
        "get": round(get, 1),
        "kcal_recomendadas": round(kcal_objetivo),
        "imc": round(imc, 1),
        "estado_imc": estado_imc,
        "peso_ideal_min": round(peso_ideal_min, 1),
        "peso_ideal_max": round(peso_ideal_max, 1),
    }

# ─── Macros ───────────────────────────────────────────────────────────────────
class MacrosReq(BaseModel):
    calorias_objetivo: float
    pct_proteina: float; pct_carbohidrato: float; pct_grasa: float
    min_proteina: Optional[float]=None; max_proteina: Optional[float]=None
    min_carbohidrato: Optional[float]=None; max_carbohidrato: Optional[float]=None
    min_grasa: Optional[float]=None; max_grasa: Optional[float]=None

@app.post("/caso/macros")
def optimizar_macros(req: MacrosReq):
    total_pct = req.pct_proteina + req.pct_carbohidrato + req.pct_grasa
    if abs(total_pct-1.0) > 0.02:
        raise HTTPException(400, f"Porcentajes deben sumar 100% (actual:{total_pct*100:.1f}%)")
    cal = req.calorias_objetivo
    advertencias = []
    rangos_fis = {
        "proteína":(0.10,0.35,req.pct_proteina),
        "carbohidrato":(0.45,0.65,req.pct_carbohidrato),
        "grasa":(0.20,0.35,req.pct_grasa)
    }
    estado = "normal"
    for macro,(lo,hi,val) in rangos_fis.items():
        if val<lo or val>hi:
            estado = "caso clínico extremo"
            advertencias.append(f"{macro}: {val*100:.0f}% fuera del rango normal ({lo*100:.0f}%-{hi*100:.0f}%)")

    prob = LpProblem("M", LpMinimize)
    xp=LpVariable("P",0); xc=LpVariable("C",0); xg=LpVariable("G",0)
    ek=LpVariable("Ek",0); ep=LpVariable("Ep",0); ec=LpVariable("Ec",0); eg=LpVariable("Eg",0)
    prob += ek + 0.1*(ep+ec+eg)
    prob += 4*xp+4*xc+9*xg-cal<=ek; prob += cal-(4*xp+4*xc+9*xg)<=ek
    prob += 4*xp-cal*req.pct_proteina<=ep*cal; prob += cal*req.pct_proteina-4*xp<=ep*cal
    prob += 4*xc-cal*req.pct_carbohidrato<=ec*cal; prob += cal*req.pct_carbohidrato-4*xc<=ec*cal
    prob += 9*xg-cal*req.pct_grasa<=eg*cal; prob += cal*req.pct_grasa-9*xg<=eg*cal
    if req.min_proteina is not None: prob+=xp>=req.min_proteina
    if req.max_proteina is not None: prob+=xp<=req.max_proteina
    if req.min_carbohidrato is not None: prob+=xc>=req.min_carbohidrato
    if req.max_carbohidrato is not None: prob+=xc<=req.max_carbohidrato
    if req.min_grasa is not None: prob+=xg>=req.min_grasa
    if req.max_grasa is not None: prob+=xg<=req.max_grasa
    prob.solve(PULP_CBC_CMD(msg=0))
    if LpStatus[prob.status] != "Optimal": raise HTTPException(422, "Sin solución factible")
    rp,rc,rg = xp.varValue,xc.varValue,xg.varValue
    kr = 4*rp+4*rc+9*rg
    return {
        "macros_g":{"proteina":round(rp,1),"carbohidrato":round(rc,1),"grasa":round(rg,1)},
        "kcal_objetivo":cal,"kcal_resultantes":round(kr,1),"desviacion_kcal":round(abs(kr-cal),1),
        "distribucion_pct":{"proteina":round(rp*4/kr,3) if kr>0 else 0,
                            "carbohidrato":round(rc*4/kr,3) if kr>0 else 0,
                            "grasa":round(rg*9/kr,3) if kr>0 else 0},
        "estado_clinico":estado,"factible":True,"advertencias":advertencias
    }

# ─── Equivalencias + Sensibilidad ────────────────────────────────────────────
class RestGrupo(BaseModel):
    porc_min: Optional[int]=None
    porc_max: Optional[int]=None
    preferencia: Optional[int]=2  # 1=poco, 2=normal, 3=mucho

class EquivReq(BaseModel):
    proteina_obj: float; hc_obj: float; grasa_obj: float
    grupos_seleccionados: List[str]
    restricciones: Optional[Dict[str,RestGrupo]]=None
    estado_clinico: Optional[str]="normal"

def _resolver_equivalencias(proteina_obj, hc_obj, grasa_obj, grupos, df_eq, rest, estado_clinico):
    total_kcal = 4*proteina_obj + 4*hc_obj + 9*grasa_obj
    rangos_aj = {}
    for g in grupos:
        rm,rx = RANGOS_CLINICOS.get(g,(0,10))
        pref = (rest.get(g) or RestGrupo()).preferencia or 2
        ancho = max((rx-rm)/3.0, 1)
        if pref==1: rangos_aj[g]=(rm, max(rm, math.ceil(rm+ancho)))
        elif pref==3: rangos_aj[g]=(max(rm, math.floor(rx-ancho)), rx)
        else: rangos_aj[g]=(rm, rx)

    w = 30 if estado_clinico=="caso clínico extremo" else 10
    prob = LpProblem("Eq", LpMinimize)
    x = LpVariable.dicts("P", grupos, lowBound=0, cat="Integer")
    d = LpVariable.dicts("D", grupos, lowBound=0)
    ep=LpVariable("ep",0); ec=LpVariable("ec",0); eg=LpVariable("eg",0)
    prob += w*(ep+ec+eg) + lpSum([d[g] for g in grupos])
    for g in grupos:
        prob += d[g] >= x[g]-rangos_aj[g][1]
        prob += d[g] >= rangos_aj[g][0]-x[g]
        r = rest.get(g)
        if r:
            if r.porc_min is not None: prob += x[g] >= r.porc_min
            if r.porc_max is not None: prob += x[g] <= r.porc_max
    prob+=lpSum([df_eq.loc[g,"proteina_g"]*x[g] for g in grupos])-proteina_obj<=ep
    prob+=proteina_obj-lpSum([df_eq.loc[g,"proteina_g"]*x[g] for g in grupos])<=ep
    prob+=lpSum([df_eq.loc[g,"hc_g"]*x[g] for g in grupos])-hc_obj<=ec
    prob+=hc_obj-lpSum([df_eq.loc[g,"hc_g"]*x[g] for g in grupos])<=ec
    prob+=lpSum([df_eq.loc[g,"grasa_g"]*x[g] for g in grupos])-grasa_obj<=eg
    prob+=grasa_obj-lpSum([df_eq.loc[g,"grasa_g"]*x[g] for g in grupos])<=eg
    prob.solve(PULP_CBC_CMD(msg=0))
    return prob, x, rangos_aj

@app.post("/caso/equivalencias")
def optimizar_equivalencias(req: EquivReq):
    df_eq = pd.DataFrame(EQUIVALENCIAS).set_index("grupo_eq")
    grupos = [g for g in req.grupos_seleccionados if g in df_eq.index]
    if not grupos: raise HTTPException(400, "Ningún grupo válido")
    df = df_eq.loc[grupos]
    rest = req.restricciones or {}

    prob, x, rangos_aj = _resolver_equivalencias(
        req.proteina_obj, req.hc_obj, req.grasa_obj, grupos, df, rest, req.estado_clinico or "normal"
    )
    if LpStatus[prob.status] != "Optimal":
        raise HTTPException(422, "Sin solución factible")

    porciones = {g: int(x[g].varValue or 0) for g in grupos}
    tp=float(sum(float(df.loc[g,"proteina_g"])*porciones[g] for g in grupos))
    tc=float(sum(float(df.loc[g,"hc_g"])*porciones[g] for g in grupos))
    tg=float(sum(float(df.loc[g,"grasa_g"])*porciones[g] for g in grupos))
    tk=float(4*tp+4*tc+9*tg)
    resumen={}
    for g in grupos:
        kp=kcal_eq({"proteina_g":float(df.loc[g,"proteina_g"]),"hc_g":float(df.loc[g,"hc_g"]),"grasa_g":float(df.loc[g,"grasa_g"])})
        kt=float(kp*porciones[g])
        resumen[g]={
            "porciones":int(porciones[g]),
            "kcal_por_porcion":round(kp,1),
            "kcal_totales":round(kt,1),
            "pct_calorico":round(kt/tk*100,1) if tk>0 else 0,
            "rango_clinico":[int(rangos_aj[g][0]),int(rangos_aj[g][1])],
            "dentro_rango":bool(rangos_aj[g][0]<=porciones[g]<=rangos_aj[g][1]),
            "macro_aporte":{"proteina":round(float(df.loc[g,"proteina_g"])*porciones[g],1),
                            "hc":round(float(df.loc[g,"hc_g"])*porciones[g],1),
                            "grasa":round(float(df.loc[g,"grasa_g"])*porciones[g],1)}
        }
    return {
        "porciones":{g:int(v) for g,v in porciones.items()},
        "resumen_por_grupo":resumen,
        "macros_resultantes":{"proteina":round(tp,1),"hc":round(tc,1),"grasa":round(tg,1)},
        "macros_objetivo":{"proteina":float(req.proteina_obj),"hc":float(req.hc_obj),"grasa":float(req.grasa_obj)},
        "desviacion":{"proteina":round(abs(tp-req.proteina_obj),1),"hc":round(abs(tc-req.hc_obj),1),"grasa":round(abs(tg-req.grasa_obj),1)},
        "kcal_totales":round(tk,1),
        "advertencias_rango":[f"{g}: {porciones[g]} porciones fuera de rango {rangos_aj[g]}" for g in grupos if not resumen[g]["dentro_rango"]],
        "factible":True
    }

# ─── Análisis de sensibilidad ─────────────────────────────────────────────────
class SensibilidadReq(BaseModel):
    proteina_obj: float; hc_obj: float; grasa_obj: float
    grupos_seleccionados: List[str]
    restricciones_nuevas: Dict[str, RestGrupo]
    porciones_actuales: Dict[str, int]
    estado_clinico: Optional[str]="normal"

@app.post("/caso/sensibilidad")
def analisis_sensibilidad(req: SensibilidadReq):
    """
    Dados los macros objetivo y las restricciones actuales, evalúa:
    - Si las restricciones son factibles
    - La desviación de macros con las restricciones aplicadas
    - Qué tanto margen hay en cada grupo para moverse sin romper los macros
    """
    df_eq = pd.DataFrame(EQUIVALENCIAS).set_index("grupo_eq")
    grupos = [g for g in req.grupos_seleccionados if g in df_eq.index]
    if not grupos: raise HTTPException(400, "Ningún grupo válido")
    df = df_eq.loc[grupos]
    rest = req.restricciones_nuevas or {}
    total_kcal = 4*req.proteina_obj + 4*req.hc_obj + 9*req.grasa_obj

    prob, x, rangos_aj = _resolver_equivalencias(
        req.proteina_obj, req.hc_obj, req.grasa_obj, grupos, df, rest,
        req.estado_clinico or "normal"
    )

    factible = LpStatus[prob.status] == "Optimal"
    porciones_nuevas = {g: int(x[g].varValue or 0) for g in grupos} if factible else dict(req.porciones_actuales)

    tp=float(sum(float(df.loc[g,"proteina_g"])*porciones_nuevas[g] for g in grupos))
    tc=float(sum(float(df.loc[g,"hc_g"])*porciones_nuevas[g] for g in grupos))
    tg=float(sum(float(df.loc[g,"grasa_g"])*porciones_nuevas[g] for g in grupos))
    tk=float(4*tp+4*tc+9*tg)

    # Margen de ajuste por grupo
    margen = {}
    for g in grupos:
        kp = kcal_eq({"proteina_g":float(df.loc[g,"proteina_g"]),"hc_g":float(df.loc[g,"hc_g"]),"grasa_g":float(df.loc[g,"grasa_g"])})
        r = rest.get(g)
        pct_actual = round(kp * porciones_nuevas[g] / total_kcal * 100, 1) if total_kcal > 0 else 0
        margen[g] = {
            "porciones": porciones_nuevas[g],
            "pct_calorico": pct_actual,
            "rango_porcion": list(rangos_aj.get(g,(0,10))),
            "porc_min_solicitado": r.porc_min if r else None,
            "porc_max_solicitado": r.porc_max if r else None,
        }

    desviacion = {
        "proteina": round(abs(tp - req.proteina_obj), 1),
        "hc": round(abs(tc - req.hc_obj), 1),
        "grasa": round(abs(tg - req.grasa_obj), 1),
    }
    calidad = "excelente" if max(desviacion.values()) < 3 else "aceptable" if max(desviacion.values()) < 8 else "conflicto"

    return {
        "factible": factible,
        "calidad": calidad,
        "porciones_nuevas": porciones_nuevas,
        "macros_resultantes": {"proteina": round(tp,1), "hc": round(tc,1), "grasa": round(tg,1)},
        "desviacion": desviacion,
        "kcal_totales": round(tk, 1),
        "margen_por_grupo": margen,
        "mensaje": ("✓ Restricciones compatibles con los macros objetivo" if calidad=="excelente"
                    else "⚠ Pequeña desviación — aceptable clínicamente" if calidad=="aceptable"
                    else "✗ Conflicto: las restricciones no permiten alcanzar los macros objetivo"),
    }

# ─── Menú ─────────────────────────────────────────────────────────────────────
class TiempoComida(BaseModel):
    nombre: str
    grupos_asignados: List[str]  # grupos que van en esta comida

class MenuReq(BaseModel):
    porciones_totales: Dict[str, int]
    tiempos: List[TiempoComida]

def _kcal_equivalencia(grupo_eq: str) -> float:
    for eq in EQUIVALENCIAS:
        if eq['grupo_eq'] == grupo_eq:
            return 4*eq['proteina_g'] + 4*eq['hc_g'] + 9*eq['grasa_g']
    return 0

def _macros_equivalencia(grupo_eq: str) -> dict:
    for eq in EQUIVALENCIAS:
        if eq['grupo_eq'] == grupo_eq:
            return {'proteina': eq['proteina_g'], 'hc': eq['hc_g'], 'grasa': eq['grasa_g']}
    return {'proteina': 0, 'hc': 0, 'grasa': 0}

def _gramos_para_kcal(alimento_row: dict, kcal_objetivo: float) -> float:
    """Calculate grams of an alimento needed to cover kcal_objetivo."""
    kcal_por_100g = float(alimento_row.get('energia_kcal') or 0)
    if kcal_por_100g <= 0:
        return float(alimento_row.get('peso_neto_g') or 100)
    return round((kcal_objetivo / kcal_por_100g) * 100, 1)

@app.post("/caso/menu")
def generar_menu(req: MenuReq):
    grupos_disp = {g: p for g, p in req.porciones_totales.items() if p > 0}
    
    # Distribute groups equitably across tiempos that include them
    # Each group goes to each tiempo that requested it
    # Portions are split as evenly as possible
    grupos_por_tiempo = {t.nombre: t.grupos_asignados for t in req.tiempos}
    
    # How many tiempos each group appears in
    grupo_n_tiempos = {}
    for g in grupos_disp:
        n = sum(1 for t in req.tiempos if g in t.grupos_asignados)
        grupo_n_tiempos[g] = max(n, 1)

    # Distribute portions equally; last tiempo gets remainder
    dist = {t.nombre: {} for t in req.tiempos}
    for g, total_porc in grupos_disp.items():
        tiempos_con_g = [t for t in req.tiempos if g in t.grupos_asignados]
        if not tiempos_con_g:
            continue
        base = total_porc // len(tiempos_con_g)
        extra = total_porc % len(tiempos_con_g)
        for i, t in enumerate(tiempos_con_g):
            dist[t.nombre][g] = base + (1 if i < extra else 0)

    con = get_con()
    menu = {}
    for tiempo in req.tiempos:
        grupos_t = dist.get(tiempo.nombre, {})
        kcal_tiempo = sum(
            _kcal_equivalencia(g) * p for g, p in grupos_t.items()
        )
        
        alimentos_tiempo = []
        for grupo, porciones in grupos_t.items():
            if porciones <= 0:
                continue
            # Total kcal target for this group in this tiempo
            kcal_grupo = _kcal_equivalencia(grupo) * porciones
            macros_grupo = _macros_equivalencia(grupo)
            
            # Get first food of group as default
            rows = con.execute(
                """SELECT alimento, unidad, peso_neto_g, energia_kcal, proteina_g,
                   lipidos_g, hidratos_de_carbono_g, fibra_g
                   FROM alimentos5 WHERE grupo_de_alimentos=? ORDER BY alimento""",
                (grupo,)
            ).fetchall()
            opciones = [dict(r) for r in rows]
            
            alimento_default = opciones[0] if opciones else None
            gramos_default = _gramos_para_kcal(alimento_default, kcal_grupo) if alimento_default else 0
            
            alimentos_tiempo.append({
                "grupo": grupo,
                "porciones_eq": porciones,
                "kcal_objetivo_grupo": round(kcal_grupo, 1),
                "macros_objetivo_grupo": {
                    "proteina": round(macros_grupo['proteina'] * porciones, 1),
                    "hc": round(macros_grupo['hc'] * porciones, 1),
                    "grasa": round(macros_grupo['grasa'] * porciones, 1),
                },
                "opciones_grupo": opciones,  # all foods in this group
                "items": [  # actual food items selected for this group
                    {
                        "alimento": alimento_default,
                        "gramos": gramos_default,
                    }
                ] if alimento_default else [],
            })
        
        menu[tiempo.nombre] = {
            "kcal_objetivo": round(kcal_tiempo, 1),
            "grupos": alimentos_tiempo,
        }
    
    con.close()
    return {
        "menu": menu,
        "distribucion_porciones": dist,
    }


# ─── Get foods for a group ────────────────────────────────────────────────────
@app.get("/alimentos-grupo/{grupo}")
def get_alimentos_grupo(grupo: str, q: Optional[str] = Query(None)):
    con = get_con()
    if q:
        rows = con.execute(
            """SELECT alimento, unidad, peso_neto_g, cantidad_sugerida, energia_kcal, proteina_g,
               lipidos_g, hidratos_de_carbono_g, fibra_g
               FROM alimentos5 WHERE grupo_de_alimentos=? AND alimento LIKE ?
               ORDER BY alimento""",
            (grupo, f"%{q}%")
        ).fetchall()
    else:
        rows = con.execute(
            """SELECT alimento, unidad, peso_neto_g, cantidad_sugerida, energia_kcal, proteina_g,
               lipidos_g, hidratos_de_carbono_g, fibra_g
               FROM alimentos5 WHERE grupo_de_alimentos=? ORDER BY alimento""",
            (grupo,)
        ).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.get("/health")
def health(): return {"status":"ok","version":"6.0.0"}


# ─── Mínimos realistas por grupo alimenticio ──────────────────────────────────
MINIMOS_POR_GRUPO = {
    'Verduras': 20, 'Frutas': 40, 'Cereales sin grasa': 15, 'Cereales con grasa': 15,
    'Leguminosas': 30, 'AOA muy bajo aporte de grasa': 20, 'AOA bajo aporte de grasa': 20,
    'AOA moderado aporte de grasa': 20, 'AOA alto aporte de grasa': 20,
    'Leche descremada': 100, 'Leche semidescremada': 100, 'Leche entera': 100,
    'Leche con azúcar': 100, 'Grasas sin proteína': 3, 'Grasas con proteína': 5,
    'Azúcares sin grasa': 5, 'Azúcares con grasa': 5, 'Bebidas alcohólicas': 30, 'Libres': 5,
}


# ─── Optimizar menú por comida (flujo nuevo) ──────────────────────────────────
class AlimentoSeleccionado(BaseModel):
    nombre: str
    grupo_eq: str
    energia_kcal_100g: float
    proteina_g_100g: float
    hc_g_100g: float
    grasa_g_100g: float
    gramos_sugeridos: Optional[float] = None


class GrupoComidaReq(BaseModel):
    grupo_eq: str
    porciones: int
    alimentos: List[AlimentoSeleccionado]


class OptimizarComidaReq(BaseModel):
    nombre_comida: str
    grupos: List[GrupoComidaReq]
    modo: Optional[str] = "balanceado"


@app.post("/caso/optimizar-comida")
def optimizar_comida(req: OptimizarComidaReq):
    """
    Recibe alimentos seleccionados por grupo por comida y optimiza
    gramos para que macros + calorías cuadren con targets SMAE.
    Incluye validación de cambios extremos (>50% desviación).
    """
    resultado_grupos = []
    alertas_globales = []

    for grupo_req in req.grupos:
        grupo_eq = grupo_req.grupo_eq
        porciones = grupo_req.porciones
        alis = grupo_req.alimentos

        eq_row = next((e for e in EQUIVALENCIAS if e['grupo_eq'] == grupo_eq), None)
        if not eq_row or not alis:
            continue

        kcal_obj = kcal_eq(eq_row) * porciones
        prot_obj = eq_row['proteina_g'] * porciones
        hc_obj   = eq_row['hc_g'] * porciones
        gras_obj = eq_row['grasa_g'] * porciones

        alis_validos = [a for a in alis if a.energia_kcal_100g > 0]
        if not alis_validos:
            continue

        n = len(alis_validos)
        min_g = MINIMOS_POR_GRUPO.get(grupo_eq, 5)

        gramos_ini = []
        for a in alis_validos:
            if a.gramos_sugeridos and a.gramos_sugeridos > 0:
                gramos_ini.append(a.gramos_sugeridos)
            else:
                gramos_ini.append(round((kcal_obj / n) / (a.energia_kcal_100g / 100), 1))

        prob = LpProblem(f"OptComida_{grupo_eq[:10].replace(' ','_')}", LpMinimize)
        g_vars  = [LpVariable(f"g_{i}", lowBound=min_g) for i in range(n)]
        e_kcal  = LpVariable("e_kcal", 0); e_prot = LpVariable("e_prot", 0)
        e_hc    = LpVariable("e_hc",   0); e_gras = LpVariable("e_gras", 0)
        e_prop  = [LpVariable(f"ep_{i}", 0) for i in range(n)]

        if req.modo == "kcal":   w_k, w_p, w_c, w_g = 10, 1, 1, 1
        elif req.modo == "macros": w_k, w_p, w_c, w_g = 1, 10, 10, 10
        else:                     w_k, w_p, w_c, w_g = 5, 5, 5, 5

        prob += w_k*e_kcal + w_p*e_prot + w_c*e_hc + w_g*e_gras + 0.3*lpSum(e_prop)

        for i in range(n):
            prob += g_vars[i] - gramos_ini[i] <= e_prop[i]
            prob += gramos_ini[i] - g_vars[i] <= e_prop[i]

        kcal_expr = lpSum(alis_validos[i].energia_kcal_100g/100*g_vars[i] for i in range(n))
        prot_expr = lpSum(alis_validos[i].proteina_g_100g  /100*g_vars[i] for i in range(n))
        hc_expr   = lpSum(alis_validos[i].hc_g_100g        /100*g_vars[i] for i in range(n))
        gras_expr = lpSum(alis_validos[i].grasa_g_100g     /100*g_vars[i] for i in range(n))

        prob += kcal_expr - kcal_obj <= e_kcal; prob += kcal_obj - kcal_expr <= e_kcal
        prob += prot_expr - prot_obj <= e_prot; prob += prot_obj - prot_expr <= e_prot
        prob += hc_expr   - hc_obj   <= e_hc;   prob += hc_obj   - hc_expr   <= e_hc
        prob += gras_expr - gras_obj <= e_gras; prob += gras_obj - gras_expr <= e_gras

        prob.solve(PULP_CBC_CMD(msg=0))

        if LpStatus[prob.status] == "Optimal":
            gramos_opt = [round(float(g_vars[i].varValue or min_g), 1) for i in range(n)]
        else:
            total_kcal_den = sum(a.energia_kcal_100g for a in alis_validos)
            if total_kcal_den > 0:
                gramos_opt = [round((a.energia_kcal_100g/total_kcal_den)*kcal_obj/(a.energia_kcal_100g/100), 1) for a in alis_validos]
            else:
                gramos_opt = [max(min_g, g) for g in gramos_ini]

        kcal_real = round(sum(alis_validos[i].energia_kcal_100g/100*gramos_opt[i] for i in range(n)), 1)
        prot_real = round(sum(alis_validos[i].proteina_g_100g  /100*gramos_opt[i] for i in range(n)), 2)
        hc_real   = round(sum(alis_validos[i].hc_g_100g        /100*gramos_opt[i] for i in range(n)), 2)
        gras_real = round(sum(alis_validos[i].grasa_g_100g     /100*gramos_opt[i] for i in range(n)), 2)

        alertas_grupo = []
        for i in range(n):
            g_ini = gramos_ini[i]; g_opt = gramos_opt[i]
            if g_ini > 0:
                cambio_pct = abs((g_opt / g_ini - 1) * 100)
                if cambio_pct > 50:
                    es_realista = g_opt >= min_g
                    alerta = {
                        "alimento": alis_validos[i].nombre, "grupo": grupo_eq,
                        "gramos_inicial": round(g_ini, 1), "gramos_optimizado": round(g_opt, 1),
                        "cambio_pct": round(cambio_pct, 1), "es_realista": es_realista,
                        "mensaje": (
                            f"{'⚠️' if not es_realista else '💡'} {alis_validos[i].nombre}: "
                            f"{round(g_ini,1)}g → {round(g_opt,1)}g ({'+' if g_opt>g_ini else ''}{cambio_pct:.0f}%)"
                            + ("" if es_realista else " — porción muy pequeña, considera reemplazarlo")
                        )
                    }
                    alertas_grupo.append(alerta)
                    alertas_globales.append(alerta)

        resultado_grupos.append({
            "grupo_eq": grupo_eq, "porciones": porciones,
            "factible": LpStatus[prob.status] == "Optimal",
            "gramos_optimizados": {alis_validos[i].nombre: gramos_opt[i] for i in range(n)},
            "macros_resultantes": {"kcal": kcal_real, "proteina": prot_real, "hc": hc_real, "grasa": gras_real},
            "macros_objetivo": {"kcal": round(kcal_obj,1), "proteina": round(prot_obj,1), "hc": round(hc_obj,1), "grasa": round(gras_obj,1)},
            "desviacion": {
                "kcal": round(abs(kcal_real-kcal_obj),1), "proteina": round(abs(prot_real-prot_obj),1),
                "hc": round(abs(hc_real-hc_obj),1), "grasa": round(abs(gras_real-gras_obj),1),
            },
            "alertas": alertas_grupo,
        })

    return {
        "nombre_comida": req.nombre_comida,
        "grupos": resultado_grupos,
        "alertas_globales": alertas_globales,
        "hay_alertas": len(alertas_globales) > 0,
    }


# ─── Sugerir gramos iniciales equitativos por grupo/alimento ─────────────────
class SugerirGramosReq(BaseModel):
    grupo_eq: str
    porciones: int
    nombres_alimentos: List[str]

@app.post("/caso/sugerir-gramos")
def sugerir_gramos(req: SugerirGramosReq):
    eq_row = next((e for e in EQUIVALENCIAS if e['grupo_eq'] == req.grupo_eq), None)
    if not eq_row:
        raise HTTPException(404, "Grupo de equivalencia no encontrado")
    kcal_obj = kcal_eq(eq_row) * req.porciones
    if not req.nombres_alimentos:
        return {"gramos": {}, "kcal_objetivo": round(kcal_obj, 1)}
    con = get_con()
    n = len(req.nombres_alimentos)
    kcal_por_ali = kcal_obj / n
    sugerencias = {}
    for nombre in req.nombres_alimentos:
        row = con.execute("SELECT energia_kcal, peso_neto_g FROM alimentos5 WHERE alimento=? LIMIT 1", (nombre,)).fetchone()
        if row and float(row['energia_kcal'] or 0) > 0:
            sugerencias[nombre] = round((kcal_por_ali / float(row['energia_kcal'])) * 100, 1)
        elif row and float(row.get('peso_neto_g') or 0) > 0:
            sugerencias[nombre] = float(row['peso_neto_g'])
        else:
            sugerencias[nombre] = 50.0
    con.close()
    return {
        "gramos": sugerencias,
        "kcal_objetivo": round(kcal_obj, 1),
        "proteina_objetivo": round(eq_row['proteina_g'] * req.porciones, 1),
        "hc_objetivo": round(eq_row['hc_g'] * req.porciones, 1),
        "grasa_objetivo": round(eq_row['grasa_g'] * req.porciones, 1),
    }


# ─── Optimizar gramos de alimentos para cumplir macros del grupo ──────────────
class AlimentoItem(BaseModel):
    nombre: str
    gramos_actuales: float
    energia_kcal_100g: float
    proteina_g_100g: float
    hc_g_100g: float
    grasa_g_100g: float

class OptimizarGrupoReq(BaseModel):
    grupo_eq: str
    porciones: int
    alimentos: List[AlimentoItem]
    # Objetivos vienen de la tabla SMAE × porciones
    kcal_objetivo: float
    proteina_objetivo: float
    hc_objetivo: float
    grasa_objetivo: float
    modo: Optional[str] = "balanceado"  # "kcal" | "macros" | "balanceado"

@app.post("/caso/optimizar-grupo")
def optimizar_grupo(req: OptimizarGrupoReq):
    """
    Dado un grupo de alimentos con N items seleccionados por el usuario,
    optimiza los gramos de cada uno para aproximarse lo máximo posible
    a los objetivos de kcal y macros del grupo (de la tabla SMAE),
    manteniendo las proporciones relativas como punto de partida.
    """
    if not req.alimentos:
        raise HTTPException(400, "Sin alimentos para optimizar")

    # Filter alimentos with non-zero caloric content
    alis = [a for a in req.alimentos if a.energia_kcal_100g > 0]
    if not alis:
        raise HTTPException(400, "Los alimentos seleccionados no tienen datos calóricos")

    n = len(alis)
    nombres = [a.nombre for a in alis]

    # Proporciones actuales como punto de referencia
    total_gramos_actual = sum(a.gramos_actuales for a in alis)
    if total_gramos_actual <= 0:
        total_gramos_actual = 100 * n

    # Build LP
    prob = LpProblem("OptGrupo", LpMinimize)

    # Variables: gramos de cada alimento (mín 5g para no trivializar)
    g_vars = [LpVariable(f"g_{i}", lowBound=5) for i in range(n)]

    # Slack variables for deviation from objectives
    e_kcal = LpVariable("e_kcal", 0)
    e_prot = LpVariable("e_prot", 0)
    e_hc   = LpVariable("e_hc",   0)
    e_gras = LpVariable("e_gras", 0)

    # Weights depending on mode
    if req.modo == "kcal":
        w_k, w_p, w_c, w_g = 10, 1, 1, 1
    elif req.modo == "macros":
        w_k, w_p, w_c, w_g = 1, 10, 10, 10
    else:  # balanceado
        w_k, w_p, w_c, w_g = 5, 5, 5, 5

    # Penalty for deviating from original proportions
    e_prop = [LpVariable(f"ep_{i}", 0) for i in range(n)]
    prop_targets = [
        (a.gramos_actuales / total_gramos_actual) * total_gramos_actual
        for a in alis
    ]

    prob += (
        w_k * e_kcal + w_p * e_prot + w_c * e_hc + w_g * e_gras
        + 0.5 * lpSum(e_prop)
    )

    # Proportion deviation constraints
    for i in range(n):
        prob += g_vars[i] - prop_targets[i] <= e_prop[i]
        prob += prop_targets[i] - g_vars[i] <= e_prop[i]

    # Caloric constraints
    kcal_expr = lpSum(alis[i].energia_kcal_100g / 100 * g_vars[i] for i in range(n))
    prob += kcal_expr - req.kcal_objetivo <= e_kcal
    prob += req.kcal_objetivo - kcal_expr <= e_kcal

    # Protein constraints
    prot_expr = lpSum(alis[i].proteina_g_100g / 100 * g_vars[i] for i in range(n))
    prob += prot_expr - req.proteina_objetivo <= e_prot
    prob += req.proteina_objetivo - prot_expr <= e_prot

    # Carb constraints
    hc_expr = lpSum(alis[i].hc_g_100g / 100 * g_vars[i] for i in range(n))
    prob += hc_expr - req.hc_objetivo <= e_hc
    prob += req.hc_objetivo - hc_expr <= e_hc

    # Fat constraints
    gras_expr = lpSum(alis[i].grasa_g_100g / 100 * g_vars[i] for i in range(n))
    prob += gras_expr - req.grasa_objetivo <= e_gras
    prob += req.grasa_objetivo - gras_expr <= e_gras

    prob.solve(PULP_CBC_CMD(msg=0))

    if LpStatus[prob.status] != "Optimal":
        # Fallback: just scale proportionally to hit kcal
        total_kcal_100g = sum(a.energia_kcal_100g for a in alis)
        if total_kcal_100g > 0:
            gramos_result = [
                round((a.energia_kcal_100g / total_kcal_100g) * req.kcal_objetivo / (a.energia_kcal_100g / 100), 1)
                for a in alis
            ]
        else:
            gramos_result = [a.gramos_actuales for a in alis]
    else:
        gramos_result = [round(float(g_vars[i].varValue or 0), 1) for i in range(n)]

    # Compute actual macros with optimized grams
    def calc(attr, gramos):
        return round(sum(getattr(alis[i], attr) / 100 * gramos[i] for i in range(n)), 2)

    kcal_real = round(sum(alis[i].energia_kcal_100g / 100 * gramos_result[i] for i in range(n)), 1)
    prot_real = calc("proteina_g_100g", gramos_result)
    hc_real   = calc("hc_g_100g", gramos_result)
    gras_real = calc("grasa_g_100g", gramos_result)

    return {
        "factible": LpStatus[prob.status] == "Optimal",
        "gramos_optimizados": {nombres[i]: gramos_result[i] for i in range(n)},
        "macros_resultantes": {
            "kcal": kcal_real, "proteina": prot_real, "hc": hc_real, "grasa": gras_real
        },
        "macros_objetivo": {
            "kcal": req.kcal_objetivo, "proteina": req.proteina_objetivo,
            "hc": req.hc_objetivo, "grasa": req.grasa_objetivo
        },
        "desviacion": {
            "kcal": round(abs(kcal_real - req.kcal_objetivo), 1),
            "proteina": round(abs(prot_real - req.proteina_objetivo), 1),
            "hc": round(abs(hc_real - req.hc_objetivo), 1),
            "grasa": round(abs(gras_real - req.grasa_objetivo), 1),
        }
    }
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

STATIC_DIR = Path(__file__).parent / "dist"
FRONTEND_EXISTS = STATIC_DIR.exists()

if FRONTEND_EXISTS:
    print(f"✓ Frontend compilado encontrado")
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")
else:
    print("⚠️  Frontend no compilado")
    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        return {"error": "Frontend no disponible"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.0.0", "frontend": "compiled" if FRONTEND_EXISTS else "not_compiled"}
