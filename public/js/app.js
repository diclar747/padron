// Padrón Electoral - SPA Premium Control Panel
let currentUser = null;
let mesasData = [];
let barriosData = [];
let mapInstance = null;
let mapMarkers = [];
let chartInstance = null;
let allElectores = [];

function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const barrioId = localStorage.getItem('selected_barrio_id');
  const barrioNombre = localStorage.getItem('selected_barrio_nombre') || 'CIUDAD';
  if (!token || !userStr || !barrioId) { window.location.href = '/index.html'; return false; }
  currentUser = JSON.parse(userStr);
  
  const display = document.getElementById('userDisplay');
  const avatarHtml = currentUser.avatar 
    ? `<img src="${currentUser.avatar}" class="w-6 h-6 rounded-full object-cover border border-slate-700 shadow-sm" alt="Avatar">`
    : `<div class="w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 text-white font-extrabold flex items-center justify-center text-[10px] uppercase shadow-sm border border-red-500">${currentUser.nombre.charAt(0)}</div>`;

  display.innerHTML = `
    ${avatarHtml}
    <span class="font-bold text-slate-100 hidden md:inline">${currentUser.nombre}</span>
    <span class="text-[10px] text-slate-400 bg-slate-900 border border-slate-700/60 px-2 py-0.5 rounded-md uppercase tracking-wider hidden sm:inline">${currentUser.rol}</span>
    <span class="text-[10px] text-red-400 bg-red-950/60 border border-red-900 px-2 py-0.5 rounded-md uppercase tracking-wider font-extrabold shadow-sm hidden md:inline">${barrioNombre}</span>
  `;
  display.onclick = openProfileModal;
  updateNavigationMenu();
  return true;
}

function updateNavigationMenu() {
  const navBtnAdmin = document.getElementById('navAdminBtn');
  if (navBtnAdmin) {
    if (currentUser.rol === 'admin') {
      navBtnAdmin.classList.remove('hidden');
      navBtnAdmin.classList.add('flex');
    } else {
      navBtnAdmin.classList.add('hidden');
      navBtnAdmin.classList.remove('flex');
    }
  }

  const drawerBtnAdmin = document.getElementById('drawerAdminBtn');
  if (drawerBtnAdmin) {
    if (currentUser.rol === 'admin') {
      drawerBtnAdmin.classList.remove('hidden');
    } else {
      drawerBtnAdmin.classList.add('hidden');
    }
  }

  document.querySelectorAll('.app-nav button[data-page]').forEach(btn => {
    const page = btn.dataset.page;
    if (page === 'admin') return;

    if (currentUser.rol === 'admin') {
      btn.classList.remove('hidden');
      return;
    }

    const permisos = currentUser.permisos || {};
    if (permisos[page] === true) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });

  // Apply permission filtering to mobile drawer buttons
  document.querySelectorAll('[data-drawer-page]').forEach(btn => {
    const page = btn.dataset.drawerPage;
    if (page === 'admin') return;

    if (currentUser.rol === 'admin') {
      btn.classList.remove('hidden');
      return;
    }

    const permisos = currentUser.permisos || {};
    if (permisos[page] === true) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  let classes = 'toast px-4 py-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border shadow-2xl shadow-slate-950/40 pointer-events-auto ';
  let icon = '';
  
  if (type === 'success') {
    classes += 'bg-emerald-950/90 border-emerald-800 text-emerald-400';
    icon = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === 'error') {
    classes += 'bg-rose-950/90 border-rose-800 text-rose-400';
    icon = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  } else {
    classes += 'bg-amber-950/90 border-amber-800 text-amber-400';
    icon = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }
  
  el.className = classes;
  el.innerHTML = icon + '<span>' + msg + '</span>';
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    setTimeout(() => el.remove(), 350);
  }, 4000);
}

function updateOfflineStatus() {
  const banner = document.getElementById('offlineBanner');
  banner.classList.toggle('hidden', navigator.onLine);
}
window.addEventListener('online', () => { updateOfflineStatus(); showToast('Conexión de red restaurada.', 'success'); syncIfOnline(); });
window.addEventListener('offline', () => { updateOfflineStatus(); showToast('Conexión perdida. Operando en modo offline.', 'warning'); });

// Global Real-time Broadcast SSE Connection
let sseSource = null;
function initSSE() {
  if (sseSource) sseSource.close();
  const sseUrl = `${API_BASE}/stream`;
  sseSource = new EventSource(sseUrl);
  sseSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'incidencia') {
        showToast('ALERTA: Nueva incidencia (' + msg.data.tipo + ') reportada por ' + msg.data.veedor_nombre, 'error');
        const activeBtn = document.querySelector('.app-nav button.active');
        if (activeBtn && activeBtn.dataset.page === 'emergencia') {
          cargarIncidencias();
        }
      } else if (msg.type === 'sync_completo') {
        showToast('Sincronización completada por ' + msg.user + ' (' + msg.count + ' electores)', 'success');
        const activeBtn = document.querySelector('.app-nav button.active');
        if (activeBtn) {
          const page = activeBtn.dataset.page;
          if (page === 'dashboard') renderDashboard(document.getElementById('mainContent'));
          else if (page === 'electores') cargarElectoresLista();
        }
      }
    } catch (e) {
      console.error('SSE Payload error:', e);
    }
  };
  sseSource.onerror = () => {
    setTimeout(initSSE, 10000); // Auto reconnect in 10s
  };
}

function openProfileModal() {
  const qr = qrcode(4, 'H');
  qr.addData(currentUser.qr_uuid || 'no-uuid');
  qr.make();
  const qrImgTag = qr.createImgTag(5);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm';
  
  const renderCard = () => {
    const avatarHtml = currentUser.avatar 
      ? `<img src="${currentUser.avatar}" class="w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-700 shadow-lg">`
      : `<div class="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xl mx-auto shadow-md border-2 border-blue-500">${currentUser.nombre.charAt(0)}</div>`;

    modal.innerHTML = `
      <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative text-center">
        ${avatarHtml}
        <h3 class="text-xl font-bold tracking-tight text-slate-100 mt-3">Credencial de Acreditación</h3>
        <p class="text-slate-400 text-xs mt-1 font-light">${currentUser.nombre}</p>
        
        <div class="qr-display my-5 bg-slate-950 p-4 rounded-2xl inline-flex flex-col items-center border border-slate-800/80 shadow-inner">
          ${qrImgTag}
          <span class="text-[9px] text-slate-500 mt-2 font-mono break-all max-w-[200px] select-all">${currentUser.qr_uuid || ''}</span>
        </div>
        
        <div class="mb-5 space-y-1.5 text-xs text-left bg-slate-950/40 p-4 rounded-xl border border-slate-850">
          <p class="text-slate-350"><strong>Rol:</strong> <span class="uppercase font-bold text-blue-400 ml-1">${currentUser.rol}</span></p>
          <p class="text-slate-350"><strong>Email:</strong> <span class="text-slate-200 font-semibold ml-1">${currentUser.email}</span></p>
          <p class="text-slate-350"><strong>Teléfono:</strong> <span class="text-slate-200 font-semibold ml-1">${currentUser.telefono || '-'}</span></p>
          <p class="text-slate-350"><strong>Dirección:</strong> <span class="text-slate-200 font-semibold ml-1">${currentUser.direccion || '-'}</span></p>
        </div>

        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <button class="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-200 text-xs font-semibold active:scale-[0.98] transition-all" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
            <button class="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition-all" id="btnEditProfile">Editar Perfil</button>
          </div>
          <button class="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-xl text-white text-xs font-semibold active:scale-[0.98] transition-all" onclick="cerrarSesion()">Cerrar Sesión</button>
        </div>
      </div>
    `;
    
    document.getElementById('btnEditProfile').onclick = () => {
      renderEditForm();
    };
  };

  const renderEditForm = () => {
    const avatarPreviewHtml = currentUser.avatar 
      ? `<img src="${currentUser.avatar}" id="editAvatarPreview" class="w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-700 shadow-md">`
      : `<div id="editAvatarPreview" class="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xl mx-auto shadow-md border-2 border-blue-500">${currentUser.nombre.charAt(0)}</div>`;

    modal.innerHTML = `
      <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
        <h3 class="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
          Editar Perfil
        </h3>
        
        <form id="editProfileForm" class="space-y-4">
          <div class="text-center relative group max-w-[80px] mx-auto cursor-pointer" onclick="document.getElementById('profileAvatarInput').click()">
            ${avatarPreviewHtml}
            <div class="absolute inset-0 bg-slate-950/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
              <svg class="w-5 h-5 text-slate-350" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /></svg>
            </div>
            <input type="file" id="profileAvatarInput" accept="image/*" class="hidden">
          </div>
          <input type="hidden" name="avatar" id="profileAvatarPath" value="${currentUser.avatar || ''}">

          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Nombre Completo</label>
            <input type="text" name="nombre" value="${currentUser.nombre}" required 
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Correo Electrónico</label>
            <input type="email" name="email" value="${currentUser.email}" required 
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Teléfono</label>
            <input type="text" name="telefono" value="${currentUser.telefono || ''}" placeholder="0981 123456" 
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Dirección</label>
            <input type="text" name="direccion" value="${currentUser.direccion || ''}" placeholder="Calle, Ciudad" 
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Cambiar Contraseña (Dejar en blanco para mantener)</label>
            <input type="password" name="password" placeholder="Nueva contraseña" minlength="4" 
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none">
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button type="button" class="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-350 text-xs font-semibold" id="btnCancelEdit">Atrás</button>
            <button type="submit" class="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg">Guardar</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('btnCancelEdit').onclick = () => {
      renderCard();
    };

    document.getElementById('profileAvatarInput').onchange = async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      try {
        const res = await api.subirAvatar(formData);
        if (res && res.success) {
          document.getElementById('profileAvatarPath').value = res.avatar_url;
          const previewEl = document.getElementById('editAvatarPreview');
          if (previewEl.tagName === 'IMG') {
            previewEl.src = res.avatar_url;
          } else {
            const img = document.createElement('img');
            img.id = 'editAvatarPreview';
            img.className = 'w-16 h-16 rounded-full object-cover mx-auto border-2 border-slate-700 shadow-md';
            img.src = res.avatar_url;
            previewEl.replaceWith(img);
          }
          showToast('Avatar subido temporalmente. Guarde el perfil para aplicar.');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    document.getElementById('editProfileForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const body = Object.fromEntries(fd.entries());
      
      try {
        const res = await api.actualizarPerfil(body);
        if (res && res.success) {
          showToast('Perfil actualizado con éxito.');
          currentUser = res.user;
          localStorage.setItem('user', JSON.stringify(currentUser));
          checkAuth();
          renderCard();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  };

  renderCard();
  document.body.appendChild(modal);
}

window.cerrarSesion = function() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('selected_barrio_id');
  localStorage.removeItem('selected_barrio_nombre');
  window.location.href = '/index.html';
};

window.abrirEscaneoQR = function() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
      <h3 class="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-400 animate-pulse" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
        Escanear Acreditación
      </h3>
      <div id="reader" class="w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner p-2"></div>
      <div id="scannerResult" class="mt-4"></div>
      <button class="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-200 text-sm font-semibold mt-4" id="btnCloseScanner">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);

  const html5QrcodeScanner = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 200, height: 200 } };

  const onScanSuccess = async (decodedText) => {
    try {
      await html5QrcodeScanner.stop();
      document.getElementById('reader').style.display = 'none';
      const resultDiv = document.getElementById('scannerResult');
      resultDiv.innerHTML = '<p class="text-slate-400 text-xs text-center py-4 animate-pulse">Verificando firma digital en base de datos...</p>';
      
      const res = await api.verificarQR(decodedText);
      if (res.success && res.user) {
        const u = res.user;
        resultDiv.innerHTML = `
          <div class="p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-2xl text-center mb-4">
            <svg class="w-8 h-8 mx-auto mb-2 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            <h4 class="font-extrabold text-sm uppercase tracking-wide">VEEDOR ACREDITADO</h4>
          </div>
          <div class="space-y-1.5 text-xs text-slate-300 bg-slate-950 p-4 border border-slate-800 rounded-xl">
            <p><strong>Nombre:</strong> ${u.nombre}</p>
            <p><strong>Email:</strong> ${u.email}</p>
            <p><strong>Rol:</strong> <span class="uppercase text-blue-400 font-semibold">${u.rol}</span></p>
            <p><strong>Estado:</strong> <span class="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 font-bold border border-emerald-800 text-[10px] uppercase">ACTIVO</span></p>
          </div>
        `;
      } else {
        throw new Error('Usuario no registrado');
      }
    } catch (err) {
      document.getElementById('scannerResult').innerHTML = `
        <div class="p-4 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-2xl text-center">
          <svg class="w-8 h-8 mx-auto mb-2 text-rose-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <h4 class="font-extrabold text-sm uppercase tracking-wide">CREDENCIAL NO VÁLIDA</h4>
          <p class="text-[11px] mt-1.5 text-rose-300/80">${err.message || 'Código QR no registrado o inactivo'}</p>
        </div>
      `;
    }
  };

  html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess).catch(err => {
    document.getElementById('scannerResult').innerHTML = `<p class="text-xs text-rose-400 text-center py-4">Error de cámara: ${err}</p>`;
  });

  document.getElementById('btnCloseScanner').addEventListener('click', async () => {
    try {
      await html5QrcodeScanner.stop();
    } catch {}
    modal.remove();
  });
};

function calcularProbabilidadVoto(elector) {
  let score = 0;
  let detail = [];

  switch (elector.estado) {
    case 'ya_voto':
      return { percentage: 100, label: 'Votó', color: '#10b981', details: ['El elector ya emitió su voto'] };
    case 'confirmado':
      score = 75;
      detail.push('Confirmado vota (+75%)');
      break;
    case 'dudoso':
      score = 40;
      detail.push('Estado indeciso (+40%)');
      break;
    case 'ausente':
      score = 15;
      detail.push('Ausencia supuesta (+15%)');
      break;
    case 'no_vota':
      score = 5;
      detail.push('No vota (+5%)');
      break;
    default:
      score = 50;
      detail.push('Sin definir (+50%)');
  }

  const obs = (elector.observaciones || '').toLowerCase();
  const needsTransport = obs.includes('transporte') || obs.includes('movilidad') || obs.includes('vehiculo') || obs.includes('chofer') || obs.includes('llevar');
  if (needsTransport) {
    if (obs.includes('coordinado') || obs.includes('confirmado') || obs.includes('listo')) {
      score += 15;
      detail.push('Logística lista (+15%)');
    } else {
      score -= 10;
      detail.push('Logística faltante (-10%)');
    }
  }

  if (obs.includes('seguro') || obs.includes('convencido') || obs.includes('va a ir') || obs.includes('entusiasmado') || obs.includes('comprometido') || obs.includes('sí o sí')) {
    score += 15;
    detail.push('Feedback positivo (+15%)');
  }

  if (obs.includes('dificil') || obs.includes('enfermo') || obs.includes('no quiere') || obs.includes('indeciso') || obs.includes('duda') || obs.includes('lejos')) {
    score -= 20;
    detail.push('Feedback adverso (-20%)');
  }

  score = Math.max(0, Math.min(100, score));

  let label = 'Media';
  let color = '#f59e0b'; // Amber
  if (score >= 80) {
    label = 'Muy Alta';
    color = '#10b981'; // Emerald
  } else if (score >= 60) {
    label = 'Alta';
    color = '#3b82f6'; // Blue
  } else if (score < 30) {
    label = 'Baja';
    color = '#ef4444'; // Red
  }

  return { percentage: score, label, color, details: detail };
}

// Custom aesthetic confirmation modal dialog
window.confirmarAccion = function(title, message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200';
    modal.innerHTML = `
      <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center transform scale-95 transition-all duration-200">
        <div class="w-12 h-12 bg-red-950/50 border border-red-800/60 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 shadow-lg">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 class="text-sm font-bold text-slate-100">${title}</h3>
        <p class="text-slate-400 text-xs mt-2 leading-relaxed font-light">${message}</p>
        
        <div class="grid grid-cols-2 gap-3 mt-6">
          <button id="btnConfirmNo" class="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 text-xs font-semibold rounded-xl active:scale-[0.98] transition-all cursor-pointer">Cancelar</button>
          <button id="btnConfirmYes" class="py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-red-950/20 active:scale-[0.98] transition-all cursor-pointer">Confirmar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // trigger scale transition
    setTimeout(() => {
      modal.querySelector('.modal-card').classList.remove('scale-95');
    }, 20);
    
    const cleanup = (val) => {
      modal.classList.add('opacity-0');
      modal.querySelector('.modal-card').classList.add('scale-95');
      setTimeout(() => {
        modal.remove();
        resolve(val);
      }, 200);
    };
    
    document.getElementById('btnConfirmNo').onclick = () => cleanup(false);
    document.getElementById('btnConfirmYes').onclick = () => cleanup(true);
    
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(false);
    };
  });
};

// 1-Click Vote Registration for Veedores (Online/Offline)
window.registrarVotoRapido = async function(id, name) {
  const confirmed = await window.confirmarAccion('Registrar Voto', `¿Registrar que el elector "${name}" ya emitió su voto?`);
  if (!confirmed) return;
  
  const elector = allElectores.find(x => x.id === id) || { id };
  const updatedElector = { ...elector, estado: 'ya_voto' };

  try {
    if (navigator.onLine) {
      await api.actualizarElector(id, updatedElector);
      showToast('Voto registrado para ' + name);
    } else {
      await localDB.addElector(updatedElector);
      showToast('Voto registrado localmente (offline) para ' + name, 'warning');
    }
    
    // Update local variable cache
    const cached = allElectores.find(x => x.id === id);
    if (cached) cached.estado = 'ya_voto';

    // Refresh dynamic views
    const activeBtn = document.querySelector('.app-nav button.active');
    if (activeBtn) {
      const page = activeBtn.dataset.page;
      if (page === 'dashboard') renderDashboard(document.getElementById('mainContent'));
      else if (page === 'electores') filtrarElectores();
    }
  } catch (err) {
    await localDB.addElector(updatedElector);
    showToast('Error de conexión - Guardado local', 'warning');
    const activeBtn = document.querySelector('.app-nav button.active');
    if (activeBtn && activeBtn.dataset.page === 'electores') filtrarElectores();
  }
};

// Navigation
const pages = {
  dashboard: renderDashboard,
  electores: renderElectores,
  cargar: renderCargar,
  mesas: renderMesas,
  mapa: renderMapa,
  logistica: renderLogistica,
  emergencia: renderEmergencia,
  admin: renderAdmin,
};

function navigate(page) {
  document.querySelectorAll('.app-nav button').forEach(b => {
    b.classList.remove('active');
    if (b.dataset.page === page) b.classList.add('active');
  });
  const main = document.getElementById('mainContent');
  main.innerHTML = '';
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  (pages[page] || renderDashboard)(main);
}

document.querySelectorAll('.app-nav button').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});

// ===================== DASHBOARD =====================
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-8 animate-pulse">
      <div class="h-8 bg-slate-800 rounded-xl w-48"></div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      ${Array(3).fill('<div class="h-28 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse"></div>').join('')}
    </div>
  `;
  
  try {
    const stats = await api.dashboard();
    const sectores = await api.barrios();
    
    // Calculate total numbers
    const totalVoters = stats.total_electores;
    const votedVoters = stats.ya_votaron;
    const pendingVoters = stats.no_votaron;
    const participationPct = totalVoters > 0 ? Math.round((votedVoters / totalVoters) * 100) : 0;

    container.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Panel de Control</h2>
          <p class="text-xs text-slate-400 mt-1">Monitoreo del escrutinio en base de datos real</p>
        </div>
      </div>
      
      <!-- Key Statistics Dashboard Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full filter blur-xl group-hover:scale-125 transition-all"></div>
          <div class="text-xs font-bold text-blue-400 uppercase tracking-widest">Total del Padrón</div>
          <div class="text-4xl font-black text-slate-100 mt-2 tracking-tight">${totalVoters.toLocaleString()}</div>
          <p class="text-[10px] text-slate-500 mt-1 font-light">Personas registradas físicamente</p>
        </div>
        
        <div class="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full filter blur-xl group-hover:scale-125 transition-all"></div>
          <div class="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-between">
            <span>Ya Votaron</span>
            <span class="text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-emerald-400 font-extrabold">${participationPct}%</span>
          </div>
          <div class="text-4xl font-black text-emerald-400 mt-2 tracking-tight">${votedVoters.toLocaleString()}</div>
          <p class="text-[10px] text-slate-500 mt-1 font-light">Votos registrados en las mesas</p>
        </div>
        
        <div class="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full filter blur-xl group-hover:scale-125 transition-all"></div>
          <div class="text-xs font-bold text-amber-400 uppercase tracking-widest">Faltan Votar</div>
          <div class="text-4xl font-black text-amber-400 mt-2 tracking-tight">${pendingVoters.toLocaleString()}</div>
          <p class="text-[10px] text-slate-500 mt-1 font-light">Electores habilitados pendientes</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Chart distribution -->
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl lg:col-span-1">
          <h3 class="text-xs font-bold text-slate-200 mb-4 tracking-wider uppercase">Gráfico de Participación</h3>
          <div class="relative h-[220px]">
            <canvas id="chartEstados"></canvas>
          </div>
        </div>
        
        <!-- Sector stats table breakdown -->
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl lg:col-span-2">
          <h3 class="text-xs font-bold text-slate-200 mb-4 tracking-wider uppercase">Resumen Estadístico por Sector (Distritos)</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
                  <th class="pb-3 pl-2">Sector / Distrito</th>
                  <th class="pb-3 text-center">Total Electores</th>
                  <th class="pb-3 text-center">Votaron</th>
                  <th class="pb-3 text-center">Faltan</th>
                  <th class="pb-3 text-right pr-2">Participación</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/40 text-slate-300">
                ${sectores.map(sec => {
                  const sPct = sec.total_electores > 0 ? Math.round((sec.votaron / sec.total_electores) * 100) : 0;
                  const sFaltan = sec.total_electores - sec.votaron;
                  return `
                    <tr class="hover:bg-slate-950/40 transition-colors">
                      <td class="py-3 pl-2 font-bold text-slate-200">${sec.nombre}</td>
                      <td class="py-3 text-center font-semibold">${sec.total_electores.toLocaleString()}</td>
                      <td class="py-3 text-center text-emerald-400 font-bold">${sec.votaron.toLocaleString()}</td>
                      <td class="py-3 text-center text-amber-500 font-semibold">${sFaltan.toLocaleString()}</td>
                      <td class="py-3 text-right pr-2 text-blue-400 font-bold">${sPct}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Quick Search Card -->
      <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl mt-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-bold text-slate-200 tracking-wider uppercase">Buscador de local y mesa del elector</h3>
            <p class="text-[10px] text-slate-500 mt-0.5">Consultar dónde vota y estado en tiempo real</p>
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input type="text" id="dashBuscar" placeholder="Ingrese nombre completo o N° de Cédula..." 
            class="flex-1 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
            onkeydown="if(event.key==='Enter')buscarRapido()">
          <button class="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all active:scale-[0.98]" onclick="buscarRapido()">
            Consultar
          </button>
        </div>
        <div id="dashResultados" class="space-y-2.5 mt-4"></div>
      </div>
    `;

    const labels = ['VOTARON', 'FALTAN VOTAR'];
    const data = [votedVoters, pendingVoters];
    const colors = ['#10b981', '#f59e0b'];
    
    const ctx = document.getElementById('chartEstados');
    if (ctx) {
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 1, borderColor: '#0f172a' }] },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, 
          plugins: { 
            legend: { 
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } }
            } 
          } 
        }
      });
    }
  } catch (e) {
    container.innerHTML = `
      <div class="bg-rose-950/40 border border-rose-900 rounded-2xl p-6 text-center text-rose-400">
        <p class="font-bold">Error de conexión con la base de datos real.</p>
        <p class="text-xs text-rose-300/80 mt-1">${e.message}</p>
      </div>
    `;
  }
}

window.buscarRapido = async function() {
  const q = document.getElementById('dashBuscar').value;
  if (!q) return;
  const resultDiv = document.getElementById('dashResultados');
  resultDiv.innerHTML = '<p class="text-slate-500 text-xs text-center py-4 animate-pulse">Buscando en base de datos real...</p>';
  
  try {
    const data = await api.electores({ buscar: q });
    if (data.length === 0) { 
      resultDiv.innerHTML = '<p class="text-slate-500 text-xs text-center py-4">No se encontraron electores con esos datos.</p>'; 
      return; 
    }
    
    // Cache search results
    allElectores = data;

    resultDiv.innerHTML = data.map(e => {
      let stateBadge = '';
      let textState = '';
      if (e.estado === 'ya_voto') {
        stateBadge = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
        textState = 'YA VOTÓ';
      } else {
        stateBadge = 'bg-amber-950 text-amber-400 border border-amber-800';
        textState = 'PENDIENTE';
      }

      return `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-slate-950/60 border border-slate-850 rounded-2xl hover:border-slate-800 transition-all duration-200">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2.5">
              <h4 class="font-bold text-slate-100 text-sm truncate">${e.nombre}</h4>
              <span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${stateBadge}">${textState}</span>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/40 text-[11px]">
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[9px]">Cédula N°</span>
                <span class="text-slate-200 font-semibold">${e.ci || '-'}</span>
              </div>
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[9px]">Local de Votación</span>
                <span class="text-slate-200 font-semibold truncate block max-w-[150px]" title="${e.mesa_local || '-'}">${e.mesa_local || '-'}</span>
              </div>
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[9px]">Mesa N°</span>
                <span class="text-slate-200 font-semibold">${e.mesa_numero || '-'}</span>
              </div>
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[9px]">Orden N°</span>
                <span class="text-slate-200 font-semibold">${e.orden || '-'}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 self-end md:self-center">
            ${e.estado !== 'ya_voto' ? `
              <button class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-emerald-950/20 active:scale-95 flex items-center gap-1.5" onclick="registrarVotoRapido(${e.id}, '${e.nombre.replace(/'/g, "\\'")}')">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                Registrar Voto
              </button>
            ` : ''}
            <button class="bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-200 px-3.5 py-2 rounded-xl text-xs transition-all active:scale-95" onclick="editarElector(${e.id})">Editar</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

// ===================== ELECTORES =====================
async function renderElectores(container) {
  if (!mesasData.length) { try { mesasData = await api.mesas(); } catch {} }
  if (!barriosData.length) { try { barriosData = await api.barrios(); } catch {} }

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Listado de Electores</h2>
        <p class="text-xs text-slate-400 mt-1">Administración del padrón general y descargas</p>
      </div>
      <button class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5" onclick="descargarPDFFiltrado()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
        Descargar PDF
      </button>
    </div>
    
    <div class="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl shadow-xl mb-6 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="text" id="buscarElector" placeholder="Buscar por nombre o CI..." oninput="filtrarElectores()"
          class="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-blue-500/20">
        
        <select id="filterBarrio" onchange="filtrarElectores(true)"
          class="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none transition-all">
          <option value="">Todos los Sectores</option>
          ${barriosData.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('')}
        </select>
        
        <select id="filterMesa" onchange="filtrarElectores(true)"
          class="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none transition-all">
          <option value="">Todas las Mesas</option>
          ${mesasData.map(m => `<option value="${m.id}">Mesa ${m.numero} - ${m.barrio_nombre}</option>`).join('')}
        </select>
      </div>
    </div>
    
    <div id="listaElectores" class="space-y-3">
      <div class="text-center py-8 text-slate-500 text-xs animate-pulse">Cargando electores de la base de datos...</div>
    </div>
  `;
  await cargarElectoresLista();
}

async function cargarElectoresLista() {
  const div = document.getElementById('listaElectores');
  if (!div) return;
  try {
    allElectores = await api.electores();
    renderListaElectores(allElectores);
  } catch (e) {
    const local = await localDB.getElectores();
    if (local.length) { 
      renderListaElectores(local); 
      showToast('Visualizando datos sin conexión', 'warning'); 
    } else {
      div.innerHTML = `
        <div class="bg-rose-950/40 border border-rose-900 rounded-2xl p-6 text-center text-rose-400 text-xs">
          Error al cargar lista: ${e.message}
        </div>
      `;
    }
  }
}

function renderListaElectores(lista) {
  const div = document.getElementById('listaElectores');
  if (!lista.length) { 
    div.innerHTML = '<p class="text-center py-8 text-slate-500 text-xs">No hay electores registrados que cumplan los filtros.</p>'; 
    return; 
  }
  
  div.innerHTML = lista.map(e => {
    const pred = calcularProbabilidadVoto(e);
    let stateBadge = '';
    let textState = '';
    if (e.estado === 'ya_voto') {
      stateBadge = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
      textState = 'YA VOTÓ';
    } else {
      stateBadge = 'bg-amber-950 text-amber-400 border border-amber-800';
      textState = 'PENDIENTE';
    }

    return `
      <div class="bg-slate-900/50 border border-slate-800/80 p-5 rounded-2xl shadow-lg hover:border-slate-700/60 transition-all duration-200">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2.5">
              <h4 class="font-bold text-slate-100 text-sm truncate">${e.nombre}</h4>
              <span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${stateBadge}">${textState}</span>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-950/40 p-3 rounded-xl border border-slate-850 text-xs">
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[8px]">Cédula N°</span>
                <span class="text-slate-300 font-semibold">${e.ci || '-'}</span>
              </div>
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[8px]">Local de Votación</span>
                <span class="text-slate-300 font-semibold truncate block max-w-[150px]" title="${e.mesa_local || '-'}">${e.mesa_local || '-'}</span>
              </div>
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[8px]">Mesa N°</span>
                <span class="text-slate-300 font-semibold">${e.mesa_numero || '-'}</span>
              </div>
              <div>
                <span class="text-slate-500 block uppercase font-bold text-[8px]">Orden N°</span>
                <span class="text-slate-300 font-semibold">${e.orden || '-'}</span>
              </div>
            </div>
            
            ${e.observaciones ? `<p class="text-xs text-rose-300 bg-rose-950/20 border border-rose-900/30 px-3 py-1.5 rounded-lg mt-2 inline-block"><strong>Nota:</strong> ${e.observaciones}</p>` : ''}
          </div>
          <div class="flex md:flex-col items-end gap-2 shrink-0">
            ${e.estado !== 'ya_voto' ? `
              <button class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5" onclick="registrarVotoRapido(${e.id}, '${e.nombre.replace(/'/g, "\\'")}')">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                Registrar Voto
              </button>
            ` : ''}
            <div class="flex gap-1.5">
              <button class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95" onclick="editarElector(${e.id})">Editar</button>
              ${currentUser.rol === 'admin' ? `<button class="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/40 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95" onclick="eliminarElector(${e.id})">Eliminar</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

let filtrarElectoresTimeout = null;
window.filtrarElectores = function(immediate = false) {
  if (filtrarElectoresTimeout) {
    clearTimeout(filtrarElectoresTimeout);
  }
  
  const runSearch = async () => {
    const q = document.getElementById('buscarElector') ? document.getElementById('buscarElector').value.trim() : '';
    const barrioId = document.getElementById('filterBarrio') ? document.getElementById('filterBarrio').value : '';
    const mesaIdVal = document.getElementById('filterMesa') ? document.getElementById('filterMesa').value : '';
    
    const params = {};
    if (q) params.buscar = q;
    if (barrioId) params.barrio_id = barrioId;
    
    if (mesaIdVal) {
      const id = parseInt(mesaIdVal);
      params.mesa_numero = Math.floor(id % 100);
      params.mesa_id = Math.floor((id % 100000) / 100);
      params.barrio_id = Math.floor(id / 100000);
    }
    
    const listDiv = document.getElementById('listaElectores');
    if (listDiv) {
      listDiv.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs animate-pulse">Buscando en base de datos real...</div>';
    }
    
    try {
      allElectores = await api.electores(params);
      renderListaElectores(allElectores);
    } catch (err) {
      showToast(err.message, 'error');
      // Fallback to local DB offline search
      let local = await localDB.getElectores();
      if (q) {
        local = local.filter(e => (e.nombre + ' ' + (e.ci || '')).toLowerCase().includes(q.toLowerCase()));
      }
      if (barrioId) {
        local = local.filter(e => e.barrio_id == barrioId);
      }
      if (mesaIdVal) {
        const id = parseInt(mesaIdVal);
        const mesa_num = Math.floor(id % 100);
        const sec_loc = Math.floor((id % 100000) / 100);
        const cod_sec = Math.floor(id / 100000);
        local = local.filter(e => e.barrio_id == cod_sec && e.mesa_id == sec_loc && e.mesa_numero == mesa_num);
      }
      renderListaElectores(local);
    }
  };
  
  if (immediate) {
    runSearch();
  } else {
    filtrarElectoresTimeout = setTimeout(runSearch, 300);
  }
};

window.editarElector = async function(id) {
  const e = allElectores.find(x => x.id === id);
  if (!e) return;
  if (!mesasData.length) { try { mesasData = await api.mesas(); } catch {} }
  if (!barriosData.length) { try { barriosData = await api.barrios(); } catch {} }
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]">
      <h3 class="text-lg font-bold text-slate-100 mb-4">Editar Elector</h3>
      <form id="editForm" class="space-y-4">
        <input type="hidden" name="id" value="${e.id}">
        
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Nombre Completo</label>
          <input name="nombre" value="${e.nombre}" required class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">CI N°</label>
          <input name="ci" value="${e.ci||''}" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Dirección</label>
          <input name="direccion" value="${e.direccion||''}" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Sector (Distrito)</label>
          <select name="barrio_id" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-400 outline-none">
            <option value="">Seleccionar...</option>
            ${barriosData.map(b => `<option value="${b.id}" ${b.id==e.barrio_id?'selected':''}>${b.nombre}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Mesa / Local</label>
          <select name="mesa_id" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-400 outline-none">
            <option value="">Seleccionar...</option>
            ${mesasData.map(m => `<option value="${m.barrio_id}" ${m.barrio_id==e.mesa_id?'selected':''}>Mesa ${m.numero} - ${m.local}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Estado</label>
          <select name="estado" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-400 outline-none">
            <option value="confirmado" ${e.estado==='no_voto'?'selected':''}>Pendiente</option>
            <option value="ya_voto" ${e.estado==='ya_voto'?'selected':''}>Ya voto</option>
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Observaciones</label>
          <textarea name="observaciones" rows="2" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none">${e.observaciones||''}</textarea>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <button type="button" class="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-300 text-sm font-semibold active:scale-[0.98] transition-all" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button type="submit" class="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.98] transition-all">Guardar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('editForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    body.barrio_id = body.barrio_id ? parseInt(body.barrio_id) : null;
    body.mesa_id = body.mesa_id ? parseInt(body.mesa_id) : null;
    try {
      await api.actualizarElector(body.id, body);
      showToast('Elector actualizado correctamente.');
      modal.remove();
      await cargarElectoresLista();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

window.eliminarElector = async function(id) {
  const confirmed = await window.confirmarAccion('Eliminar Elector', '¿Eliminar definitivamente este elector del padrón?');
  if (!confirmed) return;
  try {
    await api.eliminarElector(id);
    showToast('Elector eliminado.');
    await cargarElectoresLista();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.descargarPDFFiltrado = async function() {
  const barrioSelect = document.getElementById('filterBarrio');
  const mesaSelect = document.getElementById('filterMesa');
  const barrioId = barrioSelect ? barrioSelect.value : '';
  const mesaId = mesaSelect ? mesaSelect.value : '';

  const barrioNombre = (barrioSelect && barrioId) ? barrioSelect.options[barrioSelect.selectedIndex].text : 'Todos los Barrios';
  const mesaNombre = (mesaSelect && mesaId) ? mesaSelect.options[mesaSelect.selectedIndex].text : 'Todas las Mesas';

  let lista = allElectores.length ? allElectores : await api.electores();
  if (barrioId) lista = lista.filter(e => e.barrio_id == barrioId);
  if (mesaId) lista = lista.filter(e => e.mesa_id == mesaId);

  if (lista.length === 0) {
    showToast('No hay electores para el filtro seleccionado', 'warning');
    return;
  }

  const total = lista.length;
  const yaVotaron = lista.filter(e => e.estado === 'ya_voto').length;
  const confirmados = lista.filter(e => e.estado === 'confirmado').length;
  const dudosos = lista.filter(e => e.estado === 'dudoso').length;
  const ausentes = lista.filter(e => e.estado === 'ausente').length;
  const noVota = lista.filter(e => e.estado === 'no_vota').length;
  const participacion = total > 0 ? Math.round((yaVotaron / total) * 100) : 0;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFillColor(13, 110, 253);
  doc.rect(0, 0, 220, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PADRÓN ELECTORAL - REPORTE AVANZADO', 14, 16);
  
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(9);
  let y = 35;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Filtros Aplicados:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Barrio: ${barrioNombre} | Mesa: ${mesaNombre}`, 45, y);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 140, y);
  y += 6;

  doc.setFillColor(248, 249, 250);
  doc.rect(14, y, 182, 14, 'F');
  doc.setDrawColor(222, 226, 230);
  doc.rect(14, y, 182, 14);
  
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Electores: ${total}`, 18, y + 9);
  doc.text(`Votaron: ${yaVotaron} (${participacion}%)`, 60, y + 9);
  doc.text(`Confirmados: ${confirmados}`, 105, y + 9);
  doc.text(`Dudosos: ${dudosos}`, 145, y + 9);
  doc.text(`Faltan/No/Aus: ${ausentes + noVota}`, 170, y + 9);
  y += 20;

  doc.setFillColor(33, 37, 41);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('N°', 16, y + 5);
  doc.text('Nombre', 23, y + 5);
  doc.text('C.I. N°', 85, y + 5);
  doc.text('Barrio / Mesa', 115, y + 5);
  doc.text('Estado', 165, y + 5);
  y += 7;

  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'normal');

  lista.forEach((e, idx) => {
    if (y > 275) {
      doc.addPage();
      y = 15;
      doc.setFillColor(33, 37, 41);
      doc.rect(14, y, 182, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('N°', 16, y + 5);
      doc.text('Nombre', 23, y + 5);
      doc.text('C.I. N°', 85, y + 5);
      doc.text('Barrio / Mesa', 115, y + 5);
      doc.text('Estado', 165, y + 5);
      y += 7;
      doc.setTextColor(33, 37, 41);
      doc.setFont('helvetica', 'normal');
    }
    
    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(14, y, 182, 6, 'F');
    }
    
    doc.text(`${idx + 1}`, 16, y + 4.5);
    const shortName = e.nombre.length > 30 ? e.nombre.substring(0, 28) + '..' : e.nombre;
    doc.text(shortName, 23, y + 4.5);
    doc.text(e.ci || '-', 85, y + 4.5);
    
    const barrioShort = e.barrio_nombre || e.barrio || '-';
    const mesaShort = e.mesa_numero ? `Mesa ${e.mesa_numero}` : '-';
    doc.text(`${barrioShort} / ${mesaShort}`, 115, y + 4.5);
    
    doc.text(e.estado.toUpperCase(), 165, y + 4.5);
    y += 6;
  });

  const filename = `Reporte_${barrioNombre.replace(/\s+/g, '_')}_${mesaNombre.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
  showToast(`PDF '${filename}' descargado.`);
};

// ===================== CARGAR ELECTOR =====================
async function renderCargar(container) {
  if (!mesasData.length) { try { mesasData = await api.mesas(); } catch {} }
  if (!barriosData.length) { try { barriosData = await api.barrios(); } catch {} }

  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Cargar Nuevo Elector</h2>
      <p class="text-xs text-slate-400 mt-1">Registrar personas en la base de datos real con geolocalización</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
        
        <!-- OCR scan button -->
        <div class="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 class="font-bold text-slate-100 text-sm">Escaneo de Cédula (OCR)</h4>
            <p class="text-xs text-slate-500 mt-0.5">Captura datos automáticamente con la cámara móvil.</p>
          </div>
          <input type="file" id="ocrInput" accept="image/*" capture="environment" class="hidden">
          <button class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-3 rounded-xl text-xs shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5 shrink-0" onclick="document.getElementById('ocrInput').click()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /></svg>
            Escanear Cédula
          </button>
        </div>
        <div id="ocrStatus" class="text-xs text-indigo-400 font-semibold px-1 mt-1"></div>

        <!-- Form elector -->
        <form id="formElector" class="space-y-4 pt-2">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Nombre Completo</label>
              <input type="text" name="nombre" id="inpNombre" required placeholder="Nombre del elector"
                class="w-full bg-slate-950 border border-slate-800/80 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none">
            </div>
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">N° de Cédula</label>
              <input type="text" name="ci" id="inpCI" placeholder="4.523.112"
                class="w-full bg-slate-950 border border-slate-800/80 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Teléfono</label>
              <input type="text" name="telefono" placeholder="0981 123456"
                class="w-full bg-slate-950 border border-slate-800/80 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none">
            </div>
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Dirección</label>
              <input type="text" name="direccion" placeholder="Calle Ejemplo 123"
                class="w-full bg-slate-950 border border-slate-800/80 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Sector (Distrito)</label>
              <select name="barrio_id" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none">
                <option value="">Seleccionar...</option>
                ${barriosData.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Mesa / Local</label>
              <select name="mesa_id" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none">
                <option value="">Seleccionar...</option>
                ${mesasData.map(m => `<option value="${m.barrio_id}">${m.local}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Estado</label>
              <select name="estado" class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none">
                <option value="confirmado">Pendiente</option>
                <option value="ya_voto">Ya voto</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Observaciones</label>
            <textarea name="observaciones" rows="2" placeholder="Notas del veedor (ej: requiere transporte, etc.)"
              class="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"></textarea>
          </div>

          <div class="bg-slate-950 border border-slate-800/80 p-4.5 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h5 class="text-xs font-bold text-slate-200">Ubicación Geográfica (GPS)</h5>
              <div id="gpsText" class="text-[11px] text-slate-500 mt-0.5">Sin coordenadas asignadas.</div>
            </div>
            <input type="hidden" name="lat"><input type="hidden" name="lng">
            <button type="button" id="btnGPS" onclick="capturarGPS()"
              class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold px-4 py-2 rounded-xl text-xs active:scale-95 transition-all">
              Capturar GPS
            </button>
          </div>

          <div class="grid grid-cols-2 gap-4 pt-2">
            <button type="button" onclick="guardarOffline()"
              class="py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/60 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-all">
              Guardar Offline
            </button>
            <button type="submit"
              class="py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition-all">
              Guardar en Servidor
            </button>
          </div>
        </form>
      </div>

      <!-- Offline queue details -->
      <div class="space-y-6">
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl" id="pendientesCard" style="display:none">
          <h3 class="text-sm font-bold text-slate-200 mb-2 tracking-wider uppercase">Fila de Carga Pendiente</h3>
          <p class="text-[10px] text-slate-500 mb-4 font-light">Registros guardados en el móvil pendientes de sincronización.</p>
          <div id="pendientesList" class="space-y-2 max-h-[220px] overflow-y-auto pr-1"></div>
          <button class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold mt-4 shadow-md transition-all active:scale-95" onclick="syncIfOnline()">
            Sincronizar Cola
          </button>
        </div>
      </div>
    </div>
  `;

  // OCR Event Binding
  document.getElementById('ocrInput').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const status = document.getElementById('ocrStatus');
    status.textContent = 'Analizando imagen de cédula con OCR...';
    try {
      const result = await Tesseract.recognize(file, 'spa', { logger: m => { if(m.status==='recognizing text') status.textContent = 'Analizando OCR: ' + Math.round(m.progress*100) + '%'; } });
      const text = result.data.text;
      status.textContent = 'Procesamiento de Cédula finalizado.';
      
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      const nameLine = lines.find(l => l.length > 8 && /[a-zA-Z]{3,}/.test(l) && !/^\d/.test(l));
      if (nameLine) document.getElementById('inpNombre').value = nameLine.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').trim();
      
      const ciMatch = text.match(/(\d{1,3}[.,]?\d{3}[.,]?\d{3})/);
      if (ciMatch) document.getElementById('inpCI').value = ciMatch[1].replace(/\./g, '');
    } catch (err) {
      status.textContent = 'Error en el escáner OCR: ' + err.message;
    }
  });

  // Form submit
  document.getElementById('formElector').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.barrio_id = body.barrio_id ? parseInt(body.barrio_id) : null;
    body.mesa_id = body.mesa_id ? parseInt(body.mesa_id) : null;
    body.lat = body.lat ? parseFloat(body.lat) : null;
    body.lng = body.lng ? parseFloat(body.lng) : null;

    try {
      if (navigator.onLine) {
        await api.crearElector(body);
        showToast('Elector registrado con éxito en base de datos real.');
        e.target.reset();
        document.getElementById('gpsText').textContent = 'Sin coordenadas asignadas.';
      } else {
        await localDB.addElector(body);
        showToast('Registro guardado localmente (Offline).', 'warning');
        e.target.reset();
        document.getElementById('gpsText').textContent = 'Sin coordenadas asignadas.';
        mostrarPendientes();
      }
    } catch (err) {
      await localDB.addElector(body);
      showToast('Fallo de conexión. Almacenado localmente.', 'warning');
      mostrarPendientes();
    }
  });

  mostrarPendientes();
}

window.capturarGPS = function() {
  if (!navigator.geolocation) { showToast('Ubicación GPS no soportada.', 'error'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const form = document.getElementById('formElector');
    form.lat.value = pos.coords.latitude;
    form.lng.value = pos.coords.longitude;
    document.getElementById('gpsText').textContent = 'Capturado: ' + pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5);
    showToast('Coordenadas capturadas con éxito.');
  }, () => showToast('No se pudo acceder a la geolocalización.', 'error'));
};

window.guardarOffline = async function() {
  const form = document.getElementById('formElector');
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());
  body.barrio_id = body.barrio_id ? parseInt(body.barrio_id) : null;
  body.mesa_id = body.mesa_id ? parseInt(body.mesa_id) : null;
  body.lat = body.lat ? parseFloat(body.lat) : null;
  body.lng = body.lng ? parseFloat(body.lng) : null;
  
  await localDB.addElector(body);
  showToast('Carga offline completada.', 'warning');
  form.reset();
  document.getElementById('gpsText').textContent = 'Sin coordenadas asignadas.';
  mostrarPendientes();
};

async function mostrarPendientes() {
  const list = await localDB.getPendientes();
  const card = document.getElementById('pendientesCard');
  const div = document.getElementById('pendientesList');
  if (!card) return;
  if (list.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  div.innerHTML = list.map(e => `
    <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
      <div>
        <p class="font-bold text-slate-200">${e.nombre}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">Estado: ${e.estado}</p>
      </div>
      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
    </div>
  `).join('');
}

window.syncIfOnline = async function() {
  const pendientes = await localDB.getPendientes();
  if (!pendientes.length) { showToast('Nada pendiente para sincronizar.'); return; }
  if (!navigator.onLine) { showToast('Fallo de red. Sincronización aludida.', 'warning'); return; }
  try {
    const payload = pendientes.map(e => ({
      ...e,
      _localId: e._localId,
      _localStatus: e._localStatus || 'new'
    }));
    const res = await api.syncPush(payload);
    for (let i = 0; i < res.results.length; i++) {
      const r = res.results[i];
      if (r.serverId) await localDB.markSynced(pendientes[i]._localId, r.serverId);
    }
    showToast('Sincronización de registros offline completada.');
    mostrarPendientes();
  } catch (e) {
    showToast('Fallo al sincronizar: ' + e.message, 'error');
  }
};

// ===================== MESAS =====================
async function renderMesas(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Semáforo de Mesas</h2>
      <p class="text-xs text-slate-400 mt-1">Nivel de participación y control por mesa electoral</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      ${Array(3).fill('<div class="h-44 bg-slate-900 border border-slate-800 rounded-3xl"></div>').join('')}
    </div>
  `;
  
  try {
    const mesas = await api.mesas();
    container.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Semáforo de Mesas</h2>
        <p class="text-xs text-slate-400 mt-1 font-light">Nivel de participación y carga en tiempo real en la base de datos</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${mesas.map(m => {
          const pct = m.electores_esperados > 0 ? Math.round((m.votaron / m.electores_esperados) * 100) : 0;
          const sFaltan = m.electores_esperados - m.votaron;
          let semaforoClass = '';
          let semaforoText = '';
          let glowStyle = '';
          
          if (pct >= 70) {
            semaforoClass = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
            semaforoText = 'Alta';
            glowStyle = 'shadow-emerald-950/20';
          } else if (pct >= 40) {
            semaforoClass = 'bg-amber-950 text-amber-400 border border-amber-800';
            semaforoText = 'Media';
            glowStyle = 'shadow-amber-950/20';
          } else {
            semaforoClass = 'bg-rose-950 text-rose-400 border border-rose-800';
            semaforoText = 'Baja';
            glowStyle = 'shadow-rose-950/20';
          }

          return `
            <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl hover:border-slate-700/50 transition-all duration-300 flex flex-col justify-between ${glowStyle}">
              <div>
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="font-extrabold text-base text-slate-100">Mesa N° ${m.numero}</h3>
                    <p class="text-xs text-slate-400 mt-0.5 truncate max-w-[150px]">${m.local}</p>
                    <p class="text-[10px] text-slate-500 mt-0.5">Barrio: ${m.barrio_nombre || '-'}</p>
                  </div>
                  <div class="text-right">
                    <span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${semaforoClass}">${semaforoText}</span>
                  </div>
                </div>

                <div class="mt-4 flex items-baseline gap-1.5">
                  <span class="text-3xl font-extrabold tracking-tight text-slate-100">${pct}%</span>
                  <span class="text-xs text-slate-500">Participación</span>
                </div>
              </div>

              <div class="mt-6 border-t border-slate-800/80 pt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div class="bg-slate-950/60 border border-slate-800/50 p-2 rounded-xl">
                  <div class="font-bold text-emerald-400">${m.votaron || 0}</div>
                  <div class="text-[9px] text-slate-600 font-semibold uppercase mt-0.5">Votaron</div>
                </div>
                <div class="bg-slate-950/60 border border-slate-800/50 p-2 rounded-xl">
                  <div class="font-bold text-amber-400">${sFaltan}</div>
                  <div class="text-[9px] text-slate-600 font-semibold uppercase mt-0.5">Faltan</div>
                </div>
                <div class="bg-slate-950/60 border border-slate-800/50 p-2 rounded-xl">
                  <div class="font-bold text-slate-450">${m.electores_esperados}</div>
                  <div class="text-[9px] text-slate-600 font-semibold uppercase mt-0.5">Total</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `
      <div class="bg-rose-950/40 border border-rose-900 rounded-2xl p-6 text-center text-rose-400 text-xs">
        Fallo al conectar a la base de datos real: ${e.message}
      </div>
    `;
  }
}

// ===================== MAPA =====================
async function renderMapa(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Geolocalización Electoral</h2>
        <p class="text-xs text-slate-400 mt-1">Monitoreo territorial en tiempo real</p>
      </div>
      
      <div class="bg-slate-900 border border-slate-850 p-1.5 rounded-xl flex gap-1 shadow-inner">
        <button class="bg-slate-800 text-slate-100 font-bold px-3 py-1.5 rounded-lg text-xs transition-all" id="btnMapMarkers" onclick="switchMapMode('markers')">
          Marcadores
        </button>
        <button class="bg-transparent text-slate-400 hover:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-all" id="btnMapHeat" onclick="switchMapMode('heat')">
          Mapa de Calor
        </button>
      </div>
    </div>
    
    <div id="map" class="h-[60vh] md:h-[65vh] border border-slate-800 rounded-3xl shadow-2xl relative z-10"></div>
  `;
  
  setTimeout(() => {
    mapInstance = L.map('map').setView([-27.05, -55.60], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);
    window.currentMapMode = 'markers';
    cargarMarcadores();
  }, 100);
}

window.switchMapMode = function(mode) {
  window.currentMapMode = mode;
  const btnMarkers = document.getElementById('btnMapMarkers');
  const btnHeat = document.getElementById('btnMapHeat');
  if (!btnMarkers || !btnHeat) return;
  if (mode === 'markers') {
    btnMarkers.className = 'bg-slate-800 text-slate-100 font-bold px-3 py-1.5 rounded-lg text-xs transition-all';
    btnHeat.className = 'bg-transparent text-slate-400 hover:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-all';
  } else {
    btnMarkers.className = 'bg-transparent text-slate-400 hover:text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-all';
    btnHeat.className = 'bg-slate-800 text-slate-100 font-bold px-3 py-1.5 rounded-lg text-xs transition-all';
  }
  cargarMarcadores();
};

async function cargarMarcadores() {
  if (!mapInstance) return;
  try {
    mapMarkers.forEach(m => mapInstance.removeLayer(m));
    mapMarkers = [];

    if (window.currentMapMode === 'markers') {
      const [mesas, barrios] = await Promise.all([api.mesas(), api.barrios()]);
      mesas.forEach(m => {
        if (m.lat && m.lng) {
          const marker = L.marker([m.lat, m.lng]).addTo(mapInstance)
            .bindPopup(`
              <div class="font-sans">
                <h4 class="font-extrabold text-blue-400">Mesa N° ${m.numero}</h4>
                <p class="text-xs text-slate-300 font-light mt-0.5">${m.local}</p>
                <p class="text-[10px] text-slate-400 mt-1">Cargados: ${m.electores_cargados || 0} &bull; Votaron: ${m.votaron || 0}</p>
              </div>
            `);
          mapMarkers.push(marker);
        }
      });

      barrios.forEach(b => {
        if (b.lat && b.lng) {
          const circle = L.circle([b.lat, b.lng], {
            color: b.color_mapa || '#3b82f6',
            fillColor: b.color_mapa || '#3b82f6',
            fillOpacity: 0.15,
            radius: 800
          }).addTo(mapInstance)
            .bindPopup(`
              <div class="font-sans">
                <h4 class="font-extrabold text-slate-200">${b.nombre}</h4>
                <p class="text-xs text-slate-400 mt-0.5">Total Electores: ${b.total_electores || 0}</p>
              </div>
            `);
          mapMarkers.push(circle);
        }
      });
    } else {
      let list = allElectores;
      if (!list.length) {
        list = await api.electores();
      }
      const heatPoints = [];
      list.forEach(e => {
        if (e.lat && e.lng) {
          const weight = e.estado === 'ya_voto' ? 1.0 : e.estado === 'confirmado' ? 0.8 : e.estado === 'dudoso' ? 0.5 : 0.2;
          heatPoints.push([e.lat, e.lng, weight]);
        }
      });

      if (heatPoints.length === 0) {
        showToast('No hay electores con coordenadas GPS cargados.', 'warning');
      } else {
        const heatLayer = L.heatLayer(heatPoints, {
          radius: 25,
          blur: 15,
          maxZoom: 17
        }).addTo(mapInstance);
        mapMarkers.push(heatLayer);
      }
    }
  } catch (e) {
    showToast('Fallo al conectar mapa a base de datos real: ' + e.message, 'error');
  }
}

// ===================== LOGISTICA =====================
async function renderLogistica(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Logística y Traslados</h2>
      <p class="text-xs text-slate-400 mt-1">Monitoreo de móviles de apoyo electoral</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      <div class="h-60 bg-slate-900 border border-slate-800 rounded-3xl"></div>
      <div class="h-60 bg-slate-900 border border-slate-800 rounded-3xl"></div>
    </div>
  `;
  
  try {
    const [vehiculos, traslados] = await Promise.all([api.vehiculos(), api.traslados()]);
    
    container.innerHTML = `
      <div class="mb-6">
        <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Logística y Traslados</h2>
        <p class="text-xs text-slate-400 mt-1 font-light">Monitoreo en tiempo real de móviles e intención de transporte</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
          <h3 class="text-sm font-bold text-slate-200 mb-4 tracking-wider uppercase">Flota de Móviles</h3>
          <div class="space-y-3">
            ${vehiculos.length ? textVehicles(vehiculos) : '<p class="text-xs text-slate-500 text-center py-4">No hay vehículos registrados.</p>'}
          </div>
        </div>

        <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
          <h3 class="text-sm font-bold text-slate-200 mb-4 tracking-wider uppercase">Traslados Coordinados</h3>
          <div class="space-y-3">
            ${traslados.length ? textTransfers(traslados) : '<p class="text-xs text-slate-500 text-center py-4">No hay traslados cargados en la base de datos.</p>'}
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `
      <div class="bg-rose-950/40 border border-rose-900 rounded-2xl p-6 text-center text-rose-400 text-xs">
        Fallo de base de datos en sección logística: ${e.message}
      </div>
    `;
  }
}

function textVehicles(list) {
  return list.map(v => `
    <div class="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between hover:border-slate-800 transition-all duration-200">
      <div>
        <h4 class="font-bold text-sm text-slate-100">${v.chofer} <span class="text-[10px] text-slate-500 font-light lowercase">(${v.tipo})</span></h4>
        <p class="text-[11px] text-slate-400 mt-1">Placa: ${v.placa || '-'} &bull; Tel: ${v.telefono || '-'}</p>
        
        <div class="flex items-center gap-1.5 mt-2">
          <span class="text-[10px] text-slate-500 uppercase">Combustible:</span>
          <div class="w-20 bg-slate-850 h-2 rounded-full overflow-hidden">
            <div class="bg-blue-500 h-full rounded-full" style="width: ${v.combustible}%"></div>
          </div>
          <span class="text-[9px] font-bold text-blue-400">${v.combustible}%</span>
        </div>
      </div>
      <span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase tracking-wide">
        ${v.activo ? 'Activo' : 'Inactivo'}
      </span>
    </div>
  `).join('');
}

function textTransfers(list) {
  return list.map(t => {
    let badgeStyle = '';
    if (t.estado === 'completado') badgeStyle = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
    else if (t.estado === 'en_camino') badgeStyle = 'bg-amber-950 text-amber-400 border border-amber-800';
    else badgeStyle = 'bg-blue-950 text-blue-400 border border-blue-800';

    return `
      <div class="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between hover:border-slate-800 transition-all duration-200">
        <div>
          <h4 class="font-bold text-sm text-slate-100">${t.elector_nombre}</h4>
          <p class="text-[11px] text-slate-400 mt-1">Dirección: ${t.elector_direccion || '-'}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">Asignado a: <strong>${t.chofer}</strong> (${t.placa})</p>
        </div>
        <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${badgeStyle}">
          ${t.estado}
        </span>
      </div>
    `;
  }).join('');
}

// ===================== EMERGENCIA =====================
async function renderEmergencia(container) {
  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-2xl font-extrabold text-red-500 tracking-tight flex items-center gap-2">
        <span class="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
        Reporte de Incidencias
      </h2>
      <p class="text-xs text-slate-400 mt-1">Alertas críticas del centro de votación en tiempo real</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Create incident card -->
      <div class="bg-gradient-to-b from-rose-950/20 to-slate-900/60 border border-rose-900/30 rounded-3xl p-6 shadow-xl self-start">
        <h3 class="text-sm font-bold text-rose-400 mb-4 tracking-wider uppercase flex items-center gap-1.5">
          <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Nuevo Reporte de Incidente
        </h3>
        
        <form id="formEmergencia" class="space-y-4">
          <div>
            <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Tipo de Incidente</label>
            <select name="tipo" class="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-400 outline-none">
              <option value="incidente">Incidente general</option>
              <option value="violencia">Violencia / Amenaza</option>
              <option value="fraude">Sospecha de fraude</option>
              <option value="falta_materiales">Falta de materiales</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label class="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Descripción</label>
            <textarea name="descripcion" rows="3" required placeholder="Detalle lo sucedido..."
              class="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none placeholder-slate-700"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label class="block text-slate-500 text-[10px] uppercase font-bold mb-1">Foto evidencia</label>
              <input type="file" name="foto" id="emgFoto" accept="image/*" capture="environment"
                class="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200">
            </div>
            <div>
              <label class="block text-slate-500 text-[10px] uppercase font-bold mb-1">Audio evidencia</label>
              <input type="file" name="audio" id="emgAudio" accept="audio/*" capture
                class="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200">
            </div>
          </div>

          <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <p class="font-bold text-slate-300">Coordenadas GPS</p>
              <p id="gpsTextEmg" class="text-[10px] text-slate-500 mt-0.5">No capturado.</p>
            </div>
            <input type="hidden" name="lat"><input type="hidden" name="lng">
            <button type="button" onclick="capturarGPSEmg()"
              class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold px-3 py-1.5 rounded-xl text-[10px] active:scale-95 transition-all">
              Capturar GPS
            </button>
          </div>

          <button type="submit" class="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1">
            Emitir Alerta de Emergencia
          </button>
        </form>
      </div>

      <!-- list incidents -->
      <div class="lg:col-span-2 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
        <h3 class="text-sm font-bold text-slate-200 mb-4 tracking-wider uppercase">Alertas Activas</h3>
        <div id="listaIncidencias" class="space-y-3">
          <div class="text-center py-8 text-slate-500 text-xs animate-pulse">Cargando incidencias...</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('formEmergencia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData();
    fd.append('tipo', form.tipo.value);
    fd.append('descripcion', form.descripcion.value);
    fd.append('lat', form.lat.value || '');
    fd.append('lng', form.lng.value || '');
    fd.append('barrio_id', localStorage.getItem('selected_barrio_id') || '');
    const fotoFile = document.getElementById('emgFoto').files[0];
    const audioFile = document.getElementById('emgAudio').files[0];
    if (fotoFile) fd.append('foto', fotoFile);
    if (audioFile) fd.append('audio', audioFile);

    try {
      const res = await fetch(API_BASE + '/incidencias', {
        method: 'POST',
        headers: { ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
        body: fd
      });
      if (res.status === 401) { localStorage.clear(); window.location.href = '/index.html'; return; }
      if (!res.ok) throw new Error('Error ' + res.status);
      showToast('Incidencia reportada con éxito a la base de datos real.');
      form.reset();
      document.getElementById('gpsTextEmg').textContent = 'No capturado.';
      cargarIncidencias();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  cargarIncidencias();
}

window.capturarGPSEmg = function() {
  if (!navigator.geolocation) { showToast('GPS no disponible.', 'error'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const form = document.getElementById('formEmergencia');
    form.lat.value = pos.coords.latitude;
    form.lng.value = pos.coords.longitude;
    document.getElementById('gpsTextEmg').textContent = pos.coords.latitude.toFixed(5) + ', ' + pos.coords.longitude.toFixed(5);
    showToast('GPS capturado.');
  }, () => showToast('No se pudo acceder a la geolocalización.', 'error'));
};

async function cargarIncidencias() {
  const div = document.getElementById('listaIncidencias');
  if (!div) return;
  try {
    const data = await api.incidencias();
    if (!data.length) { 
      div.innerHTML = '<p class="text-center py-8 text-slate-500 text-xs">No hay alertas activas en este momento.</p>'; 
      return; 
    }
    
    div.innerHTML = data.map(i => {
      let photoLink = i.foto_url ? '<a href="' + i.foto_url + '" target="_blank" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs transition-all flex items-center gap-1">Ver Foto</a>' : '';
      let audioLink = i.audio_url ? '<a href="' + i.audio_url + '" target="_blank" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-xs transition-all flex items-center gap-1">Ver Audio</a>' : '';
      let gpsLocation = i.lat ? '<span>&bull;</span> <span class="text-slate-400">GPS: ' + i.lat + ', ' + i.lng + '</span>' : '';
      
      return `
        <div class="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-900/60 text-[9px] font-bold uppercase tracking-wider">${i.tipo}</span>
            <p class="text-xs text-slate-200 mt-2 font-medium">${i.descripcion}</p>
            
            <div class="flex items-center gap-1 text-[10px] text-slate-500 mt-2">
              <span>Por: <strong>${i.veedor_nombre || '-'}</strong></span>
              <span>&bull;</span>
              <span>${new Date(i.created_at).toLocaleString()}</span>
              ${gpsLocation}
            </div>
          </div>
          
          <div class="flex items-center gap-2 shrink-0">
            ${photoLink}
            ${audioLink}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    div.innerHTML = '<p class="text-center py-8 text-slate-500 text-xs">Error al cargar incidencias de base de datos.</p>';
  }
}

// ===================== ADMIN PANEL =====================
async function renderAdmin(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Gestión de Veedores</h2>
        <p class="text-xs text-slate-400 mt-1">Control de acceso, roles y permisos de módulos en tiempo real</p>
      </div>
      <button class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5" onclick="abrirCrearUsuario()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Nuevo Usuario
      </button>
    </div>

    <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 font-bold uppercase">
              <th class="pb-3 pl-2">Usuario</th>
              <th class="pb-3">Ciudad/Distrito</th>
              <th class="pb-3">Contacto</th>
              <th class="pb-3 text-center">Rol</th>
              <th class="pb-3 text-center">Módulos Permitidos</th>
              <th class="pb-3 text-center">Estado</th>
              <th class="pb-3 text-right pr-2">Acciones</th>
            </tr>
          </thead>
          <tbody id="adminUsersList" class="divide-y divide-slate-800/40 text-slate-300">
            <tr>
              <td colspan="7" class="text-center py-8 text-slate-500 text-xs animate-pulse">Cargando usuarios...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  cargarUsuariosAdminTable();
}

async function cargarUsuariosAdminTable() {
  const tbody = document.getElementById('adminUsersList');
  if (!tbody) return;
  try {
    const users = await api.usuarios.listar();
    window.allAdminUsers = users;
    
    tbody.innerHTML = users.map(u => {
      const avatarHtml = u.avatar
        ? `<img src="${u.avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-800 shadow-inner">`
        : `<div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xs uppercase shadow-sm border border-blue-500">${u.nombre.charAt(0)}</div>`;

      const modules = ['dashboard', 'electores', 'cargar', 'mesas', 'mapa', 'logistica', 'emergencia'];
      const allowedModules = u.rol === 'admin' 
        ? '<span class="text-emerald-400 font-bold text-[9px] uppercase bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">Acceso Total</span>'
        : modules.filter(m => u.permisos && u.permisos[m] === true).map(m => {
            let label = m;
            if (m === 'dashboard') label = 'Inicio';
            if (m === 'emergencia') label = 'Emergencia';
            return `<span class="bg-slate-950 border border-slate-800 text-slate-300 text-[9px] font-semibold px-2 py-0.5 rounded capitalize">${label}</span>`;
          }).join(' ') || '<span class="text-rose-450 text-[9px] font-bold uppercase">Ninguno</span>';

      const statusBadge = u.activo
        ? '<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-950 text-[10px] uppercase font-extrabold">Activo</span>'
        : '<span class="px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-850 text-[10px] uppercase font-bold">Inactivo</span>';

      const isSelfOrMainAdmin = u.id === currentUser.id || u.id === 1;
      const deleteBtn = isSelfOrMainAdmin 
        ? '' 
        : `<button class="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/40 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95" onclick="eliminarUsuarioAdmin(${u.id})">Eliminar</button>`;

      return `
        <tr class="hover:bg-slate-950/30 transition-colors">
          <td class="py-4 pl-2">
            <div class="flex items-center gap-3">
              ${avatarHtml}
              <div>
                <h4 class="font-bold text-slate-100 text-sm">${u.nombre}</h4>
                <p class="text-[10px] text-slate-500 font-light mt-0.5">${u.email}</p>
              </div>
            </div>
          </td>
          <td class="py-4 text-slate-300">
            <span class="px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-indigo-400 text-[10px] font-semibold uppercase tracking-wider">${u.distrito || 'TODOS'}</span>
          </td>
          <td class="py-4 text-slate-350">
            <p class="text-[11px] font-semibold">${u.telefono || '-'}</p>
            <p class="text-[9px] text-slate-500 truncate max-w-[150px]" title="${u.direccion || '-'}">${u.direccion || '-'}</p>
          </td>
          <td class="py-4 text-center">
            <span class="px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-blue-400 text-[10px] font-bold uppercase tracking-wider">${u.rol}</span>
          </td>
          <td class="py-4 text-center">
            <div class="flex flex-wrap justify-center gap-1 max-w-[280px] mx-auto">
              ${allowedModules}
            </div>
          </td>
          <td class="py-4 text-center">
            ${statusBadge}
          </td>
          <td class="py-4 text-right pr-2">
            <div class="flex justify-end gap-1.5">
              <button class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95" onclick="editarUsuarioAdmin(${u.id})">Editar</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-rose-400 text-xs font-semibold bg-rose-950/20 rounded-2xl border border-rose-900/30">
          Error al cargar usuarios de la base de datos: ${e.message}
        </td>
      </tr>
    `;
  }
}

window.abrirCrearUsuario = function() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm';
  
  const isSuperAdmin = !currentUser.distrito || currentUser.distrito === 'TODOS';
  const distritoSelectHtml = isSuperAdmin ? `
    <div>
      <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Distrito/Ciudad</label>
      <select name="distrito" class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 outline-none">
        <option value="">Ninguno (Superadmin)</option>
        <option value="BELLA VISTA">BELLA VISTA</option>
        <option value="HOHENAU">HOHENAU</option>
        <option value="OBLIGADO">OBLIGADO</option>
      </select>
    </div>
  ` : `
    <input type="hidden" name="distrito" value="${currentUser.distrito}">
  `;

  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]">
      <h3 class="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Crear Nuevo Usuario
      </h3>
      <form id="adminUserCreateForm" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Nombre Completo</label>
            <input type="text" name="nombre" required placeholder="Juan Perez"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Correo Electrónico</label>
            <input type="email" name="email" required placeholder="veedor2@padron.py"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Contraseña</label>
            <input type="password" name="password" required placeholder="******" minlength="4"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Rol de Sistema</label>
            <select name="rol" id="adminUserCreateRol" onchange="togglePermisosUI('create')"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 outline-none">
              <option value="veedor">Veedor</option>
              <option value="coordinador">Coordinador</option>
              <option value="logistica">Logística</option>
              <option value="candidato">Candidato</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        ${isSuperAdmin ? `<div class="grid grid-cols-1 gap-4">${distritoSelectHtml}</div>` : distritoSelectHtml}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Teléfono</label>
            <input type="text" name="telefono" placeholder="0981 123456"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Dirección</label>
            <input type="text" name="direccion" placeholder="Calle Falsa 123"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" name="activo" id="createActivo" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-4 h-4 text-blue-600">
          <label for="createActivo" class="text-xs text-slate-350 select-none">Usuario Activo (Permitir iniciar sesión)</label>
        </div>

        <div id="permisosSectionCreate" class="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl">
          <h4 class="text-slate-300 text-xs font-bold mb-3 uppercase tracking-wider">Permisos de Módulos (Acceso)</h4>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_dashboard" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Inicio (Dashboard)</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_electores" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Electores</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_cargar" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Cargar Elector</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_mesas" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Mesas</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_mapa" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Mapa</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_logistica" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Logística</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none col-span-2">
              <input type="checkbox" name="permiso_emergencia" checked class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Emergencia (Incidencias)</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <button type="button" class="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-300 text-sm font-semibold active:scale-[0.98] transition-all" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button type="submit" class="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.98] transition-all">Guardar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('adminUserCreateForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    
    body.activo = body.activo === 'on';
    
    if (body.rol === 'admin') {
      body.permisos = { dashboard: true, electores: true, cargar: true, mesas: true, mapa: true, logistica: true, emergencia: true };
    } else {
      body.permisos = {
        dashboard: body.permiso_dashboard === 'on',
        electores: body.permiso_electores === 'on',
        cargar: body.permiso_cargar === 'on',
        mesas: body.permiso_mesas === 'on',
        mapa: body.permiso_mapa === 'on',
        logistica: body.permiso_logistica === 'on',
        emergencia: body.permiso_emergencia === 'on'
      };
    }

    delete body.permiso_dashboard;
    delete body.permiso_electores;
    delete body.permiso_cargar;
    delete body.permiso_mesas;
    delete body.permiso_mapa;
    delete body.permiso_logistica;
    delete body.permiso_emergencia;

    try {
      await api.usuarios.crear(body);
      showToast('Usuario creado con éxito.');
      modal.remove();
      cargarUsuariosAdminTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

window.togglePermisosUI = function(prefix) {
  const select = document.getElementById(`adminUser` + (prefix === 'create' ? 'Create' : 'Edit') + `Rol`);
  const section = document.getElementById(`permisosSection` + (prefix === 'create' ? 'Create' : 'Edit'));
  if (select && section) {
    if (select.value === 'admin') {
      section.style.opacity = '0.4';
      section.querySelectorAll('input').forEach(i => i.disabled = true);
    } else {
      section.style.opacity = '1';
      section.querySelectorAll('input').forEach(i => i.disabled = false);
    }
  }
};

window.editarUsuarioAdmin = function(id) {
  const u = window.allAdminUsers.find(x => x.id === id);
  if (!u) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm';
  
  const isSelf = u.id === currentUser.id;
  const p = u.permisos || {};

  const isSuperAdmin = !currentUser.distrito || currentUser.distrito === 'TODOS';
  const distritoSelectHtml = isSuperAdmin ? `
    <div>
      <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Distrito/Ciudad</label>
      <select name="distrito" class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 outline-none">
        <option value="" ${!u.distrito?'selected':''}>Ninguno (Superadmin)</option>
        <option value="BELLA VISTA" ${u.distrito==='BELLA VISTA'?'selected':''}>BELLA VISTA</option>
        <option value="HOHENAU" ${u.distrito==='HOHENAU'?'selected':''}>HOHENAU</option>
        <option value="OBLIGADO" ${u.distrito==='OBLIGADO'?'selected':''}>OBLIGADO</option>
      </select>
    </div>
  ` : `
    <input type="hidden" name="distrito" value="${u.distrito || ''}">
  `;

  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]">
      <h3 class="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
        Editar Usuario: ${u.nombre}
      </h3>
      <form id="adminUserEditForm" class="space-y-4">
        <input type="hidden" name="id" value="${u.id}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Nombre Completo</label>
            <input type="text" name="nombre" value="${u.nombre}" required
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Correo Electrónico</label>
            <input type="email" name="email" value="${u.email}" required
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Contraseña (Dejar en blanco para mantener)</label>
            <input type="password" name="password" placeholder="Nueva contraseña opcional" minlength="4"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Rol de Sistema</label>
            <select name="rol" id="adminUserEditRol" onchange="togglePermisosUI('edit')" ${isSelf ? 'disabled' : ''}
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 outline-none">
              <option value="veedor" ${u.rol==='veedor'?'selected':''}>Veedor</option>
              <option value="coordinador" ${u.rol==='coordinador'?'selected':''}>Coordinador</option>
              <option value="logistica" ${u.rol==='logistica'?'selected':''}>Logística</option>
              <option value="candidato" ${u.rol==='candidato'?'selected':''}>Candidato</option>
              <option value="admin" ${u.rol==='admin'?'selected':''}>Administrador</option>
            </select>
            ${isSelf ? '<input type="hidden" name="rol" value="admin">' : ''}
          </div>
        </div>

        ${isSuperAdmin ? `<div class="grid grid-cols-1 gap-4">${distritoSelectHtml}</div>` : distritoSelectHtml}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Teléfono</label>
            <input type="text" name="telefono" value="${u.telefono||''}" placeholder="0981 123456"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Dirección</label>
            <input type="text" name="direccion" value="${u.direccion||''}" placeholder="Calle Falsa 123"
              class="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none">
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" name="activo" id="editActivo" ${u.activo ? 'checked' : ''} ${isSelf ? 'disabled' : ''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-4 h-4 text-blue-600">
          <label for="editActivo" class="text-xs text-slate-350 select-none">Usuario Activo (Permitir iniciar sesión)</label>
        </div>

        <div id="permisosSectionEdit" class="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl">
          <h4 class="text-slate-300 text-xs font-bold mb-3 uppercase tracking-wider">Permisos de Módulos (Acceso)</h4>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_dashboard" ${p.dashboard!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Inicio (Dashboard)</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_electores" ${p.electores!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Electores</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_cargar" ${p.cargar!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Cargar Elector</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_mesas" ${p.mesas!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Mesas</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_mapa" ${p.mapa!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Mapa</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input type="checkbox" name="permiso_logistica" ${p.logistica!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Logística</span>
            </label>
            <label class="flex items-center gap-2.5 text-slate-400 hover:text-slate-350 cursor-pointer select-none col-span-2">
              <input type="checkbox" name="permiso_emergencia" ${p.emergencia!==false?'checked':''} class="rounded border-slate-800 bg-slate-950 focus:ring-blue-500 w-3.5 h-3.5 text-blue-600">
              <span>Emergencia (Incidencias)</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <button type="button" class="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-xl text-slate-300 text-sm font-semibold active:scale-[0.98] transition-all" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button type="submit" class="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg active:scale-[0.98] transition-all">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  togglePermisosUI('edit');

  document.getElementById('adminUserEditForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    
    body.activo = isSelf ? u.activo : (body.activo === 'on');
    
    if (body.rol === 'admin') {
      body.permisos = { dashboard: true, electores: true, cargar: true, mesas: true, mapa: true, logistica: true, emergencia: true };
    } else {
      body.permisos = {
        dashboard: body.permiso_dashboard === 'on',
        electores: body.permiso_electores === 'on',
        cargar: body.permiso_cargar === 'on',
        mesas: body.permiso_mesas === 'on',
        mapa: body.permiso_mapa === 'on',
        logistica: body.permiso_logistica === 'on',
        emergencia: body.permiso_emergencia === 'on'
      };
    }

    delete body.permiso_dashboard;
    delete body.permiso_electores;
    delete body.permiso_cargar;
    delete body.permiso_mesas;
    delete body.permiso_mapa;
    delete body.permiso_logistica;
    delete body.permiso_emergencia;

    try {
      await api.usuarios.actualizar(body.id, body);
      showToast('Usuario actualizado con éxito.');
      modal.remove();
      cargarUsuariosAdminTable();
      
      if (parseInt(body.id) === currentUser.id) {
        const me = await api.me();
        localStorage.setItem('user', JSON.stringify(me));
        checkAuth();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

window.eliminarUsuarioAdmin = async function(id) {
  const confirmed = await window.confirmarAccion('Eliminar Usuario', '¿Eliminar definitivamente este usuario de la base de datos?');
  if (!confirmed) return;
  try {
    await api.usuarios.eliminar(id);
    showToast('Usuario eliminado.');
    cargarUsuariosAdminTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ===================== INIT =====================
if (!checkAuth()) {} else {
  // Sidebar Collapse state initialization
  if (localStorage.getItem('sidebar_collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    if (toggleIcon) toggleIcon.classList.add('rotate-180');
  }

  // Sidebar Toggle Button Click
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      const isCollapsed = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebar_collapsed', isCollapsed);
      
      const toggleIcon = document.getElementById('sidebarToggleIcon');
      if (toggleIcon) {
        if (isCollapsed) {
          toggleIcon.classList.add('rotate-180');
        } else {
          toggleIcon.classList.remove('rotate-180');
        }
      }
    });
  }

  // Mobile More Drawer toggle behavior
  const mobileMoreBtn = document.getElementById('mobileMoreBtn');
  const mobileMoreDrawer = document.getElementById('mobileMoreDrawer');
  if (mobileMoreBtn && mobileMoreDrawer) {
    mobileMoreBtn.addEventListener('click', () => {
      mobileMoreDrawer.classList.add('open');
    });

    mobileMoreDrawer.addEventListener('click', (e) => {
      if (e.target === mobileMoreDrawer) {
        mobileMoreDrawer.classList.remove('open');
      }
    });
  }

  // Drawer buttons navigation
  document.querySelectorAll('[data-drawer-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.drawerPage;
      if (page) {
        navigate(page);
        if (mobileMoreDrawer) {
          mobileMoreDrawer.classList.remove('open');
        }
      }
    });
  });

  // Fullscreen toggle logic
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.error(`Error enabling fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Logout Buttons logic
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => cerrarSesion());
  }
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', () => cerrarSesion());
  }
  const mobileProfileBtn = document.getElementById('mobileProfileBtn');
  if (mobileProfileBtn) {
    mobileProfileBtn.addEventListener('click', () => openProfileModal());
  }

  // PWA Custom Install Banner Event Handler
  let deferredPrompt;
  const pwaBanner = document.getElementById('pwaInstallBanner');
  const btnInstall = document.getElementById('btnPwaInstall');
  const btnClose = document.getElementById('btnPwaClose');

  if (pwaBanner && btnInstall && btnClose) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (sessionStorage.getItem('pwa_install_dismissed') !== 'true') {
        pwaBanner.classList.add('show');
      }
    });

    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA Install Choice: ${outcome}`);
        deferredPrompt = null;
      }
      pwaBanner.classList.remove('show');
    });

    btnClose.addEventListener('click', () => {
      pwaBanner.classList.remove('show');
      sessionStorage.setItem('pwa_install_dismissed', 'true');
    });
  }

  updateOfflineStatus();
  initSSE();
  navigate('dashboard');
}
