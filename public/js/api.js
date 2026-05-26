const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:4000/api' : '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function apiFetch(path, options = {}) {
  let url = `${API_BASE}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'GET' && !path.includes('/auth/') && !path.includes('/public/')) {
    const bId = localStorage.getItem('selected_barrio_id');
    if (bId) {
      const urlObj = new URL(url, window.location.origin);
      if (path.startsWith('/barrios')) {
        urlObj.searchParams.set('id', bId);
      } else {
        urlObj.searchParams.set('barrio_id', bId);
      }
      url = urlObj.pathname + urlObj.search;
    }
  }

  const opts = {
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    ...options
  };
  if (options.body && typeof options.body === 'object') {
    opts.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(url, opts);
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/index.html';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  } catch (err) {
    if (!navigator.onLine) {
      throw new Error('Sin conexion a internet');
    }
    throw err;
  }
}

const api = {
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => apiFetch('/auth/me'),
  consultarPublico: (buscar) => apiFetch('/electores/public/consultar?buscar=' + encodeURIComponent(buscar)),
  electores: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/electores?${qs}`);
  },
  crearElector: (body) => apiFetch('/electores', { method: 'POST', body }),
  actualizarElector: (id, body) => apiFetch(`/electores/${id}`, { method: 'PUT', body }),
  eliminarElector: (id) => apiFetch(`/electores/${id}`, { method: 'DELETE' }),
  statsElectores: () => apiFetch('/electores/stats/resumen'),
  mesas: () => apiFetch('/mesas'),
  barrios: () => apiFetch('/barrios'),
  dashboard: () => apiFetch('/reportes/dashboard'),
  syncPush: (electores) => apiFetch('/sync/push', { method: 'POST', body: { electores } }),
  vehiculos: () => apiFetch('/logistica/vehiculos'),
  crearVehiculo: (body) => apiFetch('/logistica/vehiculos', { method: 'POST', body }),
  traslados: () => apiFetch('/logistica/traslados'),
  crearTraslado: (body) => apiFetch('/logistica/traslados', { method: 'POST', body }),
  actualizarTraslado: (id, estado) => apiFetch('/logistica/traslados/' + id, { method: 'PUT', body: { estado } }),
  gastos: () => apiFetch('/logistica/gastos'),
  crearGasto: (body) => apiFetch('/logistica/gastos', { method: 'POST', body }),
  eliminarGasto: (id) => apiFetch('/logistica/gastos/' + id, { method: 'DELETE' }),
  incidencias: () => apiFetch('/incidencias'),
  crearIncidencia: (body) => apiFetch('/incidencias', { method: 'POST', body }),
  verificarQR: (uuid) => apiFetch('/auth/verificar-qr/' + uuid),
  actualizarPerfil: (body) => apiFetch('/auth/profile', { method: 'PUT', body }),
  subirAvatar: (formData) => fetch(API_BASE + '/auth/avatar', {
    method: 'POST',
    headers: { ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
    body: formData
  }).then(res => {
    if (res.status === 401) { localStorage.clear(); window.location.href = '/index.html'; return; }
    if (!res.ok) throw new Error('Error al subir imagen: ' + res.status);
    return res.json();
  }),
  usuarios: {
    listar: () => apiFetch('/usuarios'),
    crear: (body) => apiFetch('/usuarios', { method: 'POST', body }),
    actualizar: (id, body) => apiFetch(`/usuarios/${id}`, { method: 'PUT', body }),
    eliminar: (id) => apiFetch(`/usuarios/${id}`, { method: 'DELETE' }),
  }
};
