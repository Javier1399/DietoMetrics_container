const BASE = '/api'

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(BASE + path, opts)
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(err.detail || 'Error del servidor')
  }
  return r.json()
}

export const api = {
  calcularPaciente:   (data)  => req('POST', '/paciente/calcular', data),
  optimizarMacros:    (data)  => req('POST', '/caso/macros', data),
  optimizarEquiv:     (data)  => req('POST', '/caso/equivalencias', data),
  sensibilidad:       (data)  => req('POST', '/caso/sensibilidad', data),
  generarMenu:        (data)  => req('POST', '/caso/menu', data),
  optimizarGrupo:     (data)  => req('POST', '/caso/optimizar-grupo', data),
  optimizarComida:    (data)  => req('POST', '/caso/optimizar-comida', data),
  sugerirGramos:      (data)  => req('POST', '/caso/sugerir-gramos', data),
  getGruposEq:        ()      => req('GET',  '/grupos-equivalencias'),
  getAlimentosGrupo:  (g, q)  => req('GET',  `/alimentos-grupo/${encodeURIComponent(g)}${q ? '?q='+encodeURIComponent(q) : ''}`),
  getAlimentosEq:     (g, q)  => req('GET',  `/alimentos-por-equivalencia/${encodeURIComponent(g)}${q ? '?q='+encodeURIComponent(q) : ''}`),
}
