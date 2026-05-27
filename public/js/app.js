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
        <div class="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-xl lg:col-span-1">
          <h3 class="text-xs font-bold text-slate-200 mb-3 tracking-wider uppercase">Gráfico de Participación</h3>
          <div class="relative h-[200px] overflow-hidden">
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
          layout: { padding: { bottom: 4 } },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#94a3b8',
                font: { family: 'Outfit', size: 9 },
                boxWidth: 10,
                padding: 8
              }
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
        <p class="text-xs text-slate-400 mt-1">Seleccioná una mesa para ver su lista completa</p>
      </div>
      <div class="relative" id="pdfDropdownWrapper">
        <button onclick="togglePdfDropdown()"
          class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Exportar PDF
          <svg class="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
        </button>
        <div id="pdfDropdown" class="hidden absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden py-1">
          <button onclick="descargarPDFFiltrado('todos');togglePdfDropdown(false)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 flex items-center gap-2.5 transition-colors">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>
            Lista Completa
          </button>
          <button onclick="descargarPDFFiltrado('ya_voto');togglePdfDropdown(false)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-slate-800 flex items-center gap-2.5 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Solo Votaron
          </button>
          <button onclick="descargarPDFFiltrado('no_voto');togglePdfDropdown(false)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-amber-400 hover:bg-slate-800 flex items-center gap-2.5 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Solo Pendientes
          </button>
          <div class="border-t border-slate-700/60 my-1"></div>
          <button onclick="imprimirLista();togglePdfDropdown(false)" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 flex items-center gap-2.5 transition-colors">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"/></svg>
            Imprimir Lista
          </button>
        </div>
      </div>
    </div>

    <div class="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl shadow-xl mb-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="text" id="buscarElector" placeholder="Buscar por nombre o CI..." oninput="filtrarElectores()"
          class="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-blue-500/20">

        <select id="filterBarrio" onchange="filtrarElectores(true)"
          class="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-400 outline-none transition-all">
          <option value="">Todos los Sectores</option>
          ${barriosData.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('')}
        </select>

        <select id="filterMesa" onchange="filtrarElectores(true)"
          class="bg-slate-950 border border-red-800/60 focus:border-red-500 rounded-xl px-4 py-2.5 text-sm text-slate-300 outline-none transition-all font-semibold">
          <option value="">— Seleccionar Mesa —</option>
          ${mesasData.map(m => `<option value="${m.barrio_id}:${m.numero}">Mesa ${m.numero} · ${m.barrio_nombre}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Mesa summary bar (hidden until mesa is selected) -->
    <div id="mesaSummary" class="hidden mb-3 bg-slate-900/70 border border-red-900/40 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 text-xs"></div>

    <!-- Sub-buscador dentro de la mesa (hidden until mesa is selected) -->
    <div id="mesaSubSearch" class="hidden mb-4">
      <div class="relative">
        <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          id="buscarEnMesa"
          placeholder="Buscar por nombre, CI o N° de orden..."
          oninput="filtrarMesaLocal()"
          class="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
        >
      </div>
    </div>

    <div id="listaElectores" class="space-y-3">
      <!-- Placeholder inicial -->
      <div class="flex flex-col items-center justify-center py-20 text-slate-600 gap-3 select-none">
        <svg class="w-12 h-12 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <p class="text-sm font-semibold text-slate-500">Seleccioná una mesa para ver su lista</p>
        <p class="text-xs text-slate-600">También podés buscar por nombre o número de cédula</p>
      </div>
    </div>
  `;
  // No auto-load: espera que el usuario seleccione mesa o escriba búsqueda
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
  if (filtrarElectoresTimeout) clearTimeout(filtrarElectoresTimeout);

  const runSearch = async () => {
    const q         = (document.getElementById('buscarElector')?.value || '').trim();
    const barrioId  = document.getElementById('filterBarrio')?.value || '';
    const mesaIdVal = document.getElementById('filterMesa')?.value   || '';
    const listDiv   = document.getElementById('listaElectores');
    const summaryEl = document.getElementById('mesaSummary');

    // Nada seleccionado → mostrar placeholder
    if (!q && !barrioId && !mesaIdVal) {
      if (summaryEl) summaryEl.classList.add('hidden');
      const subSearch = document.getElementById('mesaSubSearch');
      if (subSearch) subSearch.classList.add('hidden');
      if (listDiv) listDiv.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-600 gap-3 select-none">
          <svg class="w-12 h-12 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          <p class="text-sm font-semibold text-slate-500">Seleccioná una mesa para ver su lista</p>
          <p class="text-xs text-slate-600">También podés buscar por nombre o número de cédula</p>
        </div>`;
      allElectores = [];
      return;
    }

    // Spinner de carga
    if (listDiv) listDiv.innerHTML = `
      <div class="text-center py-12">
        <div class="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-slate-500 text-xs animate-pulse">${mesaIdVal ? 'Cargando electores de la mesa...' : 'Buscando...'}</p>
      </div>`;

    const params = {};
    if (q) params.buscar = q;
    if (mesaIdVal) {
      // value format = "SEC_LOC:MESA_NUMERO" (e.g. "2761:4")
      const [sec_loc, mesa_num] = mesaIdVal.split(':');
      params.mesa_id     = sec_loc;   // → AND e.SEC_LOC = ?
      params.mesa_numero = mesa_num;  // → AND e.MESA = ?
    } else if (barrioId) {
      params.barrio_id = barrioId;    // → AND e.CODIGO_SEC = ?
    }

    try {
      allElectores = await api.electores(params);

      // Barra de resumen cuando hay mesa seleccionada
      if (summaryEl && mesaIdVal) {
        const mesaOpt = document.getElementById('filterMesa');
        const mesaLabel = mesaOpt ? mesaOpt.options[mesaOpt.selectedIndex].text : '';
        const total     = allElectores.length;
        const votaron   = allElectores.filter(e => e.estado === 'ya_voto').length;
        const pendientes = total - votaron;
        const pct = total > 0 ? Math.round(votaron / total * 100) : 0;
        summaryEl.classList.remove('hidden');
        summaryEl.innerHTML = `
          <div class="flex items-center gap-2 text-red-400 font-bold">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>${mesaLabel}</span>
          </div>
          <div class="flex gap-4 ml-auto flex-wrap">
            <span class="text-slate-400">Total: <strong class="text-slate-200">${total}</strong></span>
            <span class="text-emerald-400">Votaron: <strong>${votaron}</strong> <span class="text-slate-500">(${pct}%)</span></span>
            <span class="text-amber-400">Pendientes: <strong>${pendientes}</strong></span>
          </div>`;
        // Mostrar sub-buscador y limpiar texto previo
        const subSearch = document.getElementById('mesaSubSearch');
        const subInput  = document.getElementById('buscarEnMesa');
        if (subSearch) subSearch.classList.remove('hidden');
        if (subInput)  subInput.value = '';
      } else if (summaryEl) {
        summaryEl.classList.add('hidden');
        const subSearch = document.getElementById('mesaSubSearch');
        if (subSearch) subSearch.classList.add('hidden');
      }

      renderListaElectores(allElectores);
    } catch (err) {
      showToast(err.message, 'error');
      if (summaryEl) summaryEl.classList.add('hidden');
      // Fallback offline
      let local = await localDB.getElectores();
      if (q) local = local.filter(e => (e.nombre + ' ' + (e.ci || '')).toLowerCase().includes(q.toLowerCase()));
      if (mesaIdVal) {
        const [sec_loc, mesa_num] = mesaIdVal.split(':');
        local = local.filter(e => String(e.mesa_id) === sec_loc && String(e.mesa_numero) === mesa_num);
      } else if (barrioId) {
        local = local.filter(e => e.barrio_id == barrioId);
      }
      renderListaElectores(local);
    }
  };

  if (immediate) {
    runSearch();
  } else {
    filtrarElectoresTimeout = setTimeout(runSearch, 350);
  }
};

// Filtro local dentro de la mesa ya cargada (sin nueva llamada al servidor)
window.filtrarMesaLocal = function() {
  const q = (document.getElementById('buscarEnMesa')?.value || '').trim();
  if (!allElectores.length) return;

  if (!q) {
    renderListaElectores(allElectores);
    return;
  }

  const isNumeric = /^\d+$/.test(q);
  const qLower    = q.toLowerCase();

  const filtered = allElectores.filter(e => {
    if (isNumeric) {
      // Numérico → exacto: orden O cédula completa
      const ci    = String(e.ci    || '').trim();
      const orden = String(e.orden || '').trim();
      return ci === q || orden === q;
    } else {
      // Texto → parcial por nombre
      return (e.nombre || '').toLowerCase().includes(qLower);
    }
  });

  renderListaElectores(filtered);
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

// Toggle dropdown PDF
window.togglePdfDropdown = function(forceClose) {
  const dd = document.getElementById('pdfDropdown');
  if (!dd) return;
  if (forceClose === false || dd.classList.contains('hidden')) {
    dd.classList.toggle('hidden');
  } else {
    dd.classList.add('hidden');
  }
};
// Cierra dropdown al hacer click fuera
document.addEventListener('click', (ev) => {
  const wrap = document.getElementById('pdfDropdownWrapper');
  if (wrap && !wrap.contains(ev.target)) {
    const dd = document.getElementById('pdfDropdown');
    if (dd) dd.classList.add('hidden');
  }
});

window.descargarPDFFiltrado = async function(filtro = 'todos') {
  const mesaSelect   = document.getElementById('filterMesa');
  const mesaNombre   = (mesaSelect && mesaSelect.value)
    ? mesaSelect.options[mesaSelect.selectedIndex].text
    : 'Todas las Mesas';

  let lista = allElectores.length ? [...allElectores] : await api.electores();

  // Aplicar filtro de estado
  if (filtro === 'ya_voto') {
    lista = lista.filter(e => e.estado === 'ya_voto');
  } else if (filtro === 'no_voto') {
    lista = lista.filter(e => e.estado !== 'ya_voto');
  }

  if (lista.length === 0) {
    showToast('No hay electores para exportar con ese filtro', 'warning');
    return;
  }

  // Colores y títulos según filtro
  const cfg = {
    todos:   { r: 30,  g: 41,  b: 59,  titulo: 'LISTADO COMPLETO',  subtitulo: 'Todos los electores de la mesa' },
    ya_voto: { r: 20,  g: 83,  b: 45,  titulo: 'ELECTORES QUE VOTARON', subtitulo: 'Solo quienes ya emitieron su voto' },
    no_voto: { r: 120, g: 53,  b: 15,  titulo: 'ELECTORES PENDIENTES',  subtitulo: 'Quienes aún no han votado' },
  }[filtro];

  const total      = lista.length;
  const yaVotaron  = allElectores.filter(e => e.estado === 'ya_voto').length;
  const totalMesa  = allElectores.length;
  const pct        = totalMesa > 0 ? Math.round(yaVotaron / totalMesa * 100) : 0;
  const pendientes = totalMesa - yaVotaron;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── ENCABEZADO ──────────────────────────────────────────────
  doc.setFillColor(cfg.r, cfg.g, cfg.b);
  doc.rect(0, 0, 210, 28, 'F');

  // Franja roja ANR
  doc.setFillColor(185, 28, 28);
  doc.rect(0, 28, 210, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PADRÓN ELECTORAL  ·  A.N.R.', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(cfg.titulo, 14, 19);
  doc.text(mesaNombre, 14, 25);
  doc.setFontSize(8);
  doc.text(`Generado: ${new Date().toLocaleString('es-PY')}`, 140, 25);

  let y = 37;

  // ── RESUMEN ESTADÍSTICO ──────────────────────────────────────
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 12, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, y, 182, 12);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Registros en este PDF: ${total}`, 18, y + 7.5);
  doc.setTextColor(22, 101, 52);
  doc.text(`Votaron: ${yaVotaron} (${pct}%)`, 75, y + 7.5);
  doc.setTextColor(146, 64, 14);
  doc.text(`Pendientes: ${pendientes}`, 130, y + 7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total mesa: ${totalMesa}`, 170, y + 7.5);
  y += 17;

  // ── CABECERA DE TABLA ────────────────────────────────────────
  const drawTableHeader = (yPos) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(14, yPos, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('ORDEN', 16, yPos + 5);
    doc.text('NOMBRE COMPLETO', 30, yPos + 5);
    doc.text('C.I. N°', 100, yPos + 5);
    doc.text('LOCAL DE VOTACIÓN', 127, yPos + 5);
    doc.text('ESTADO', 183, yPos + 5);
    return yPos + 7;
  };
  y = drawTableHeader(y);

  // ── FILAS ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  lista.forEach((e, idx) => {
    if (y > 272) {
      doc.addPage();
      y = 15;
      // Mini header en páginas siguientes
      doc.setFillColor(cfg.r, cfg.g, cfg.b);
      doc.rect(0, 0, 210, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`PADRÓN ANR  ·  ${cfg.titulo}  ·  ${mesaNombre}`, 14, 7);
      doc.setFillColor(185, 28, 28);
      doc.rect(0, 10, 210, 1.5, 'F');
      y = 17;
      y = drawTableHeader(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    // Fila alternada
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 6, 'F');
    }

    // Color de estado
    if (e.estado === 'ya_voto') {
      doc.setTextColor(21, 128, 61);
    } else {
      doc.setTextColor(30, 41, 59);
    }

    doc.text(String(e.orden || '-'), 17, y + 4.2);

    doc.setTextColor(30, 41, 59);
    const nombreCorto = (e.nombre || '-').length > 34 ? (e.nombre).substring(0, 32) + '..' : (e.nombre || '-');
    doc.text(nombreCorto, 30, y + 4.2);
    doc.text(String(e.ci || '-'), 100, y + 4.2);

    const local = (e.mesa_local || '-').length > 22 ? (e.mesa_local).substring(0, 20) + '..' : (e.mesa_local || '-');
    doc.text(local, 127, y + 4.2);

    // Badge estado
    if (e.estado === 'ya_voto') {
      doc.setFillColor(220, 252, 231);
      doc.setDrawColor(134, 239, 172);
      doc.roundedRect(181, y + 0.8, 14, 4.5, 1, 1, 'FD');
      doc.setTextColor(21, 128, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('VOTÓ', 183, y + 4);
    } else {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(181, y + 0.8, 14, 4.5, 1, 1, 'FD');
      doc.setTextColor(146, 64, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('PEND.', 182.5, y + 4);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    y += 6;
  });

  // ── PIE DE PÁGINA ─────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${pageCount}  ·  Padrón Electoral A.N.R.`, 14, 292);
    doc.text(new Date().toLocaleDateString('es-PY'), 175, 292);
  }

  const sufijo = filtro === 'ya_voto' ? 'Votaron' : filtro === 'no_voto' ? 'Pendientes' : 'Completo';
  const filename = `ANR_${mesaNombre.replace(/[^a-zA-Z0-9]/g, '_')}_${sufijo}.pdf`;
  doc.save(filename);
  showToast(`📄 PDF "${sufijo}" descargado (${total} electores).`);
};

// Imprimir lista actual usando ventana de impresión del navegador
window.imprimirLista = function() {
  const mesaSelect  = document.getElementById('filterMesa');
  const mesaNombre  = (mesaSelect && mesaSelect.value)
    ? mesaSelect.options[mesaSelect.selectedIndex].text : 'Lista de Electores';
  const lista = allElectores.length ? allElectores : [];
  if (!lista.length) { showToast('Seleccioná una mesa primero', 'warning'); return; }

  const total     = lista.length;
  const votaron   = lista.filter(e => e.estado === 'ya_voto').length;
  const pendientes = total - votaron;
  const pct       = total > 0 ? Math.round(votaron / total * 100) : 0;

  const filas = lista.map((e, i) => `
    <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
      <td style="padding:3px 6px;text-align:center;font-weight:bold;color:#374151">${e.orden || '-'}</td>
      <td style="padding:3px 6px;font-weight:600;color:#111827">${e.nombre || '-'}</td>
      <td style="padding:3px 6px;color:#374151">${e.ci || '-'}</td>
      <td style="padding:3px 6px;color:#6b7280;font-size:0.72em">${e.mesa_local || '-'}</td>
      <td style="padding:3px 6px;text-align:center">
        <span style="padding:2px 7px;border-radius:9999px;font-size:0.7em;font-weight:700;
          background:${e.estado === 'ya_voto' ? '#dcfce7' : '#fef3c7'};
          color:${e.estado === 'ya_voto' ? '#166534' : '#92400e'}">
          ${e.estado === 'ya_voto' ? 'VOTÓ' : 'PENDIENTE'}
        </span>
      </td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>${mesaNombre} — Padrón ANR</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#1e293b}
      h1{font-size:1.1em;margin:0;color:#fff}
      .header{background:#1e293b;color:#fff;padding:12px 16px;border-radius:8px 8px 0 0}
      .stripe{background:#b91c1c;height:4px}
      .stats{display:flex;gap:20px;padding:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;font-size:0.82em}
      .stats span{font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:0.78em;margin-top:0}
      th{background:#1e293b;color:#fff;padding:5px 6px;text-align:left;font-size:0.75em}
      td{border-bottom:1px solid #f1f5f9}
      .bg-gray-50{background:#f9fafb}
      .footer{text-align:center;font-size:0.7em;color:#94a3b8;margin-top:12px}
      @media print{body{padding:0}.no-print{display:none}}
    </style>
  </head><body>
    <div class="header">
      <h1>PADRÓN ELECTORAL  ·  A.N.R.</h1>
      <div style="font-size:0.82em;opacity:0.85;margin-top:2px">${mesaNombre}</div>
    </div>
    <div class="stripe"></div>
    <div class="stats">
      <div>Total: <span>${total}</span></div>
      <div style="color:#166534">Votaron: <span>${votaron} (${pct}%)</span></div>
      <div style="color:#92400e">Pendientes: <span>${pendientes}</span></div>
      <div style="color:#64748b">Generado: <span>${new Date().toLocaleString('es-PY')}</span></div>
      <button class="no-print" onclick="window.print()" style="margin-left:auto;background:#1e293b;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-weight:bold">🖨️ Imprimir</button>
    </div>
    <table>
      <thead><tr>
        <th style="width:50px">ORDEN</th>
        <th>NOMBRE COMPLETO</th>
        <th style="width:90px">C.I. N°</th>
        <th>LOCAL DE VOTACIÓN</th>
        <th style="width:80px;text-align:center">ESTADO</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="footer">Padrón Electoral A.N.R. · Página generada el ${new Date().toLocaleDateString('es-PY')}</div>
    <script>setTimeout(()=>window.print(),400)</script>
  </body></html>`);
  win.document.close();
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

// ===================== LOGISTICA / PRESUPUESTO DE CAMPAÑA =====================

// Formato Guaraníes
function formatGs(n) {
  const num = parseInt(n) || 0;
  return 'Gs. ' + num.toLocaleString('es-PY');
}

// Categorías predefinidas
const CATEGORIAS_GASTO = [
  'Combustible','Peaje','Pago de chofer','Flete','Reparación de vehículo',
  'Alimentación','Agua / Bebidas','Viáticos','Movilización',
  'Impresiones / Publicidad','Instalación de carpas','Coordinación territorial',
  'Transporte de veedores','Emergencias','Otros'
];

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-950/60',   border: 'border-blue-800/60',   text: 'text-blue-400',   bar: 'bg-blue-500' },
  green:  { bg: 'bg-emerald-950/60',border: 'border-emerald-800/60',text: 'text-emerald-400',bar: 'bg-emerald-500' },
  red:    { bg: 'bg-red-950/60',    border: 'border-red-800/60',    text: 'text-red-400',    bar: 'bg-red-500' },
  amber:  { bg: 'bg-amber-950/60',  border: 'border-amber-800/60',  text: 'text-amber-400',  bar: 'bg-amber-500' },
  purple: { bg: 'bg-purple-950/60', border: 'border-purple-800/60', text: 'text-purple-400', bar: 'bg-purple-500' },
  teal:   { bg: 'bg-teal-950/60',   border: 'border-teal-800/60',   text: 'text-teal-400',   bar: 'bg-teal-500' },
};

let campTab = 'balance'; // balance | gastos | presupuesto | caja

async function renderLogistica(container) {
  campTab = campTab || 'balance';
  container.innerHTML = `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-extrabold text-slate-100 tracking-tight">Presupuesto de Campaña</h2>
        <p class="text-xs text-slate-400 mt-1">Control financiero y logístico en tiempo real</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1.5 mb-6 bg-slate-900/70 border border-slate-800/60 p-1.5 rounded-2xl w-fit flex-wrap">
      ${[
        ['balance',     'Balance',     'M3 3h6l2 2h6a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2z'],
        ['gastos',      'Gastos',      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
        ['presupuesto', 'Presupuesto', 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'],
        ['caja',        'Caja',        'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'],
        ['vehiculos',   'Vehículos',   'M8 17H5a2 2 0 01-2-2V9m2-4h12l2 4v6a2 2 0 01-2 2h-3M9 7h6M9 17h.01M17 17h.01M3 9h18'],
        ['tareas',      'Tareas',      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'],
        ['actividades', 'Actividades', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'],
        ['alertas',     'Alertas',     'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'],
      ].map(([id, label, icon]) => `
        <button onclick="campSetTab('${id}')" id="campTab_${id}"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
            ${campTab === id ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-100'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="${icon}"/>
          </svg>
          ${label}
        </button>`).join('')}
    </div>

    <div id="campContent" class="min-h-[300px]">
      <div class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  `;

  await campLoadTab();
}

window.campSetTab = async function(tab) {
  campTab = tab;
  document.querySelectorAll('[id^="campTab_"]').forEach(btn => {
    const isActive = btn.id === `campTab_${tab}`;
    btn.className = btn.className
      .replace(/bg-red-600 text-white shadow-lg|text-slate-400 hover:text-slate-100/g, '')
      .trim() + (isActive ? ' bg-red-600 text-white shadow-lg' : ' text-slate-400 hover:text-slate-100');
  });
  await campLoadTab();
};

async function campLoadTab() {
  const content = document.getElementById('campContent');
  if (!content) return;
  content.innerHTML = `<div class="flex items-center justify-center py-16"><div class="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>`;
  try {
    if      (campTab === 'balance')      await campRenderBalance(content);
    else if (campTab === 'gastos')       await campRenderGastos(content);
    else if (campTab === 'presupuesto')  await campRenderPresupuesto(content);
    else if (campTab === 'caja')         await campRenderCaja(content);
    else if (campTab === 'vehiculos')    await campRenderVehiculos(content);
    else if (campTab === 'tareas')       await campRenderTareas(content);
    else if (campTab === 'actividades')  await campRenderActividades(content);
    else if (campTab === 'alertas')      await campRenderAlertas(content);
  } catch (e) {
    content.innerHTML = `<div class="bg-rose-950/40 border border-rose-800 rounded-2xl p-6 text-rose-400 text-sm text-center">${e.message}</div>`;
  }
}

// ─────────────────────── BALANCE ────────────────────────────────
async function campRenderBalance(container) {
  const d = await api.camp.balance();
  const disponible = d.total_presupuesto - d.total_gastado;
  const pct = d.total_presupuesto > 0 ? Math.min(100, Math.round(d.total_gastado / d.total_presupuesto * 100)) : 0;
  const pctColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textPct  = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400';

  container.innerHTML = `
    <!-- KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      ${[
        { label: 'Presupuesto Total', val: formatGs(d.total_presupuesto), color: 'text-slate-100',   icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
        { label: 'Total Gastado',     val: formatGs(d.total_gastado),     color: 'text-red-400',     icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'Disponible',        val: formatGs(disponible),          color: disponible >= 0 ? 'text-emerald-400' : 'text-red-400', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: '% Ejecutado',       val: pct + '%',                     color: textPct,            icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z' },
      ].map(k => `
        <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-4 shadow-sm">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="${k.icon}"/>
            </svg>
            <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider leading-tight">${k.label}</span>
          </div>
          <div class="text-lg font-extrabold ${k.color} leading-none">${k.val}</div>
        </div>`).join('')}
    </div>

    <!-- Barra de ejecución global -->
    <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-slate-300">Ejecución del Presupuesto</span>
        <span class="text-xs font-extrabold ${textPct}">${pct}%</span>
      </div>
      <div class="h-3 bg-slate-800 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700 ${pctColor}" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-slate-600 mt-1.5">
        <span>Gs. 0</span><span>${formatGs(d.total_presupuesto)}</span>
      </div>
    </div>

    <!-- Presupuestos por categoría -->
    ${d.presupuestos.length ? `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      ${d.presupuestos.map(p => {
        const g = parseInt(p.gastado) || 0;
        const t = parseInt(p.monto_total) || 0;
        const pc = t > 0 ? Math.min(100, Math.round(g / t * 100)) : 0;
        const c = COLOR_MAP[p.color] || COLOR_MAP.blue;
        const barCol = pc >= 90 ? 'bg-red-500' : pc >= 70 ? 'bg-amber-500' : c.bar;
        return `
        <div class="border ${c.border} ${c.bg} rounded-2xl p-4">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-sm text-slate-100">${p.nombre}</span>
            <span class="text-[10px] font-bold ${pc >= 90 ? 'text-red-400' : pc >= 70 ? 'text-amber-400' : c.text}">${pc}%</span>
          </div>
          ${p.descripcion ? `<p class="text-[10px] text-slate-500 mb-2">${p.descripcion}</p>` : ''}
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div class="h-full rounded-full ${barCol}" style="width:${pc}%"></div>
          </div>
          <div class="flex justify-between text-[10px]">
            <span class="text-red-400">Gastado: <strong>${formatGs(g)}</strong></span>
            <span class="text-slate-500">/ ${formatGs(t)}</span>
          </div>
          <div class="text-[10px] text-emerald-400 mt-0.5">Disponible: <strong>${formatGs(t - g)}</strong></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Gastos por categoría -->
    ${d.categorias.length ? `
    <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 mb-6">
      <h4 class="text-xs font-bold text-slate-300 uppercase mb-4 tracking-wider">Distribución por Categoría</h4>
      <div class="space-y-2.5">
        ${d.categorias.map(c => {
          const pca = d.total_gastado > 0 ? Math.round(parseInt(c.total) / d.total_gastado * 100) : 0;
          return `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-300 font-semibold">${c.categoria}</span>
              <span class="text-xs text-slate-400">${formatGs(c.total)} <span class="text-slate-600">(${pca}%)</span></span>
            </div>
            <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-red-500 rounded-full" style="width:${pca}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Últimos gastos -->
    ${d.recientes.length ? `
    <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Últimos Movimientos</h4>
        <button onclick="campSetTab('gastos')" class="text-[10px] text-red-400 hover:text-red-300 font-semibold">Ver todos →</button>
      </div>
      <div class="space-y-2">
        ${d.recientes.map(g => `
        <div class="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-slate-200 truncate">${g.categoria}</p>
              <p class="text-[10px] text-slate-500 truncate">${g.responsable_nombre || '-'} · ${g.fecha || ''}</p>
            </div>
          </div>
          <span class="text-xs font-bold text-red-400 shrink-0 ml-2">${formatGs(g.monto)}</span>
        </div>`).join('')}
      </div>
    </div>` : `
    <div class="text-center py-12 text-slate-600">
      <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
      <p class="text-sm font-semibold text-slate-500">Sin movimientos aún</p>
      <p class="text-xs text-slate-600 mt-1">Cargá el presupuesto y empezá a registrar gastos</p>
      <button onclick="campSetTab('presupuesto')" class="mt-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-5 py-2 rounded-xl transition-all">
        Configurar Presupuesto
      </button>
    </div>`}
  `;
}

// ─────────────────────── GASTOS ─────────────────────────────────
async function campRenderGastos(container) {
  const [gastos, presupuestos] = await Promise.all([api.camp.gastos(), api.camp.presupuestos()]);

  container.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <button onclick="campAbrirFormGasto()" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Registrar Gasto
      </button>
      <select id="campFiltroPresu" onchange="campFiltrarGastos()" class="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none">
        <option value="">Todos los presupuestos</option>
        ${presupuestos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
      </select>
      <span class="text-xs text-slate-500 ml-auto">${gastos.length} registro${gastos.length !== 1 ? 's' : ''}</span>
    </div>

    <div id="campListaGastos" class="space-y-2.5">
      ${campRenderListaGastos(gastos, presupuestos)}
    </div>
  `;

  // Guardar en window para filtrar
  window._campGastos = gastos;
  window._campPresupuestos = presupuestos;
}

function campRenderListaGastos(lista, presupuestos) {
  if (!lista.length) return `
    <div class="text-center py-16 text-slate-600">
      <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75"/></svg>
      <p class="text-sm font-semibold text-slate-500">Sin gastos registrados</p>
    </div>`;

  return lista.map(g => {
    const c = COLOR_MAP[g.presupuesto_color] || COLOR_MAP.blue;
    return `
    <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-4 flex flex-wrap items-start gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-bold text-slate-100">${g.categoria}</span>
          ${g.presupuesto_nombre ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${c.border} ${c.text} ${c.bg}">${g.presupuesto_nombre}</span>` : ''}
        </div>
        ${g.descripcion ? `<p class="text-xs text-slate-400 mt-0.5 truncate">${g.descripcion}</p>` : ''}
        <div class="flex items-center gap-3 mt-1.5 flex-wrap text-[10px] text-slate-500">
          <span>📅 ${g.fecha || ''}</span>
          <span>👤 ${g.responsable_nombre || '-'}</span>
          ${g.lat ? `<span>📍 GPS</span>` : ''}
          ${g.observaciones ? `<span class="truncate max-w-[160px]">💬 ${g.observaciones}</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-base font-extrabold text-red-400">${formatGs(g.monto)}</span>
        <button onclick="campEliminarGasto(${g.id})" class="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

window.campFiltrarGastos = function() {
  const presuId = document.getElementById('campFiltroPresu')?.value;
  const lista = presuId
    ? (window._campGastos || []).filter(g => String(g.presupuesto_id) === presuId)
    : (window._campGastos || []);
  const div = document.getElementById('campListaGastos');
  if (div) div.innerHTML = campRenderListaGastos(lista, window._campPresupuestos || []);
};

window.campAbrirFormGasto = async function() {
  let presupuestos = window._campPresupuestos;
  if (!presupuestos) presupuestos = await api.camp.presupuestos().catch(() => []);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-end md:items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 class="text-base font-bold text-slate-100 mb-5 flex items-center gap-2">
        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Registrar Gasto
      </h3>
      <form id="formCampGasto" class="space-y-4">

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Monto (Gs.)</label>
            <input name="monto" type="number" min="0" step="1000" required placeholder="500000"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Fecha</label>
            <input name="fecha" type="date" value="${new Date().toISOString().split('T')[0]}"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
        </div>

        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Categoría</label>
          <select name="categoria" required class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-300 outline-none">
            <option value="">Seleccionar categoría...</option>
            ${CATEGORIAS_GASTO.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Presupuesto Asociado</label>
          <select name="presupuesto_id" class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-300 outline-none">
            <option value="">Sin asignar</option>
            ${presupuestos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Descripción</label>
          <input name="descripcion" type="text" placeholder="Ej: Carga de combustible vehículo 3"
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>

        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Observaciones</label>
          <textarea name="observaciones" rows="2" placeholder="Notas adicionales..."
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none resize-none placeholder-slate-700"></textarea>
        </div>

        <div class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-slate-400 text-[10px] uppercase">GPS (opcional)</p>
            <p id="gpsGastoCamp" class="text-[10px] text-slate-600 mt-0.5">No capturado</p>
          </div>
          <input type="hidden" name="lat"><input type="hidden" name="lng">
          <button type="button" onclick="campCapturarGPS()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold px-3 py-1.5 rounded-lg text-[10px] active:scale-95 transition-all">
            Capturar GPS
          </button>
        </div>

        <div class="flex gap-3 pt-1">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all">Cancelar</button>
          <button type="submit" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all">Guardar Gasto</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('formCampGasto').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    if (!body.monto || parseInt(body.monto) <= 0) return showToast('Ingresá un monto válido', 'warning');
    try {
      await api.camp.crearGastoCamp(body);
      showToast('Gasto registrado correctamente.');
      modal.remove();
      await campLoadTab();
    } catch (err) { showToast(err.message, 'error'); }
  });
};

window.campCapturarGPS = function() {
  navigator.geolocation?.getCurrentPosition(pos => {
    const form = document.getElementById('formCampGasto');
    if (form) {
      form.lat.value = pos.coords.latitude.toFixed(6);
      form.lng.value = pos.coords.longitude.toFixed(6);
    }
    const el = document.getElementById('gpsGastoCamp');
    if (el) el.textContent = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
  }, () => showToast('No se pudo obtener la ubicación', 'warning'));
};

window.campEliminarGasto = async function(id) {
  const ok = await window.confirmarAccion('Eliminar Gasto', '¿Eliminar este gasto del registro?');
  if (!ok) return;
  try {
    await api.camp.borrarGasto(id);
    showToast('Gasto eliminado.');
    await campLoadTab();
  } catch (e) { showToast(e.message, 'error'); }
};

// ─────────────────────── PRESUPUESTO ────────────────────────────
async function campRenderPresupuesto(container) {
  const presupuestos = await api.camp.presupuestos();
  const colores = ['blue','green','red','amber','purple','teal'];

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <p class="text-xs text-slate-400">Configurá los rubros del presupuesto de campaña</p>
      <button onclick="campAbrirFormPresupuesto()" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Nuevo Rubro
      </button>
    </div>

    <div id="campListaPresu" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${presupuestos.length ? presupuestos.map(p => {
        const g = parseInt(p.gastado) || 0;
        const t = parseInt(p.monto_total) || 0;
        const pc = t > 0 ? Math.min(100, Math.round(g / t * 100)) : 0;
        const c = COLOR_MAP[p.color] || COLOR_MAP.blue;
        return `
        <div class="border ${c.border} ${c.bg} rounded-2xl p-5 relative group">
          <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="campEditarPresupuesto(${p.id},'${p.nombre}',${p.monto_total},'${p.color || 'blue'}','${p.descripcion || ''}')"
              class="w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
            </button>
            <button onclick="campBorrarPresupuesto(${p.id})"
              class="w-7 h-7 bg-slate-800 hover:bg-red-900/50 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-bold text-slate-100">${p.nombre}</h4>
          </div>
          ${p.descripcion ? `<p class="text-[11px] text-slate-500 mb-2">${p.descripcion}</p>` : ''}
          <div class="text-lg font-extrabold ${c.text} mb-1">${formatGs(p.monto_total)}</div>
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
            <div class="h-full rounded-full ${pc>=90?'bg-red-500':pc>=70?'bg-amber-500':c.bar}" style="width:${pc}%"></div>
          </div>
          <div class="flex justify-between text-[10px]">
            <span class="text-red-400">Gastado: <strong>${formatGs(g)}</strong></span>
            <span class="text-emerald-400">Libre: <strong>${formatGs(t-g)}</strong></span>
          </div>
        </div>`;
      }).join('') : `
      <div class="col-span-2 text-center py-16 text-slate-600">
        <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        <p class="text-sm font-semibold text-slate-500">No hay rubros cargados</p>
        <p class="text-xs text-slate-600 mt-1">Hacé clic en "Nuevo Rubro" para empezar</p>
      </div>`}
    </div>
  `;
}

window.campAbrirFormPresupuesto = function(id = null, nombre = '', monto = '', color = 'blue', descripcion = '') {
  const colores = ['blue','green','red','amber','purple','teal'];
  const esEdicion = !!id;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-end md:items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
      <h3 class="text-base font-bold text-slate-100 mb-5">${esEdicion ? 'Editar Rubro' : 'Nuevo Rubro de Presupuesto'}</h3>
      <form id="formCampPresu" class="space-y-4">
        ${id ? `<input type="hidden" name="id" value="${id}">` : ''}
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Nombre del Rubro</label>
          <input name="nombre" value="${nombre}" required placeholder="Ej: Combustible"
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Monto Asignado (Gs.)</label>
          <input name="monto_total" value="${monto}" type="number" min="0" step="100000" required placeholder="20000000"
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Descripción (opcional)</label>
          <input name="descripcion" value="${descripcion}" placeholder="Descripción breve..."
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Color</label>
          <div class="flex gap-2 flex-wrap">
            ${colores.map(col => {
              const c = COLOR_MAP[col];
              return `<label class="cursor-pointer">
                <input type="radio" name="color" value="${col}" ${col===color?'checked':''} class="sr-only">
                <div class="w-8 h-8 rounded-xl border-2 ${c.bar.replace('bg-','border-')} ${c.bg} transition-all peer-checked:scale-110" style="outline:${col===color?'2px solid white':'none'};outline-offset:2px"
                  onclick="this.parentElement.querySelector('input').checked=true; document.querySelectorAll('#formCampPresu .color-dot').forEach(d=>d.style.outline='none'); this.style.outline='2px solid white';"
                  class="color-dot w-8 h-8 rounded-xl ${c.bg} border-2 ${c.border}"
                  ${col===color?'style="outline:2px solid white;outline-offset:2px"':''}></div>
              </label>`;
            }).join('')}
          </div>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all">Cancelar</button>
          <button type="submit" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all">${esEdicion ? 'Guardar' : 'Crear Rubro'}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('formCampPresu').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    try {
      if (esEdicion) {
        await api.camp.editarPresupuesto(id, body);
        showToast('Rubro actualizado.');
      } else {
        await api.camp.crearPresupuesto(body);
        showToast('Rubro creado correctamente.');
      }
      modal.remove();
      await campLoadTab();
    } catch (err) { showToast(err.message, 'error'); }
  });
};

window.campEditarPresupuesto = function(id, nombre, monto, color, descripcion) {
  campAbrirFormPresupuesto(id, nombre, monto, color, descripcion);
};

window.campBorrarPresupuesto = async function(id) {
  const ok = await window.confirmarAccion('Eliminar Rubro', '¿Eliminar este rubro de presupuesto? Los gastos asociados quedarán sin asignar.');
  if (!ok) return;
  try {
    await api.camp.borrarPresupuesto(id);
    showToast('Rubro eliminado.');
    await campLoadTab();
  } catch (e) { showToast(e.message, 'error'); }
};

// ─────────────────────── CAJA ────────────────────────────────────
async function campRenderCaja(container) {
  const movimientos = await api.camp.caja();
  const ingresos  = movimientos.filter(m => m.tipo === 'ingreso')   .reduce((s, m) => s + parseInt(m.monto), 0);
  const egresos   = movimientos.filter(m => ['egreso','entrega'].includes(m.tipo)).reduce((s, m) => s + parseInt(m.monto), 0);
  const saldo     = ingresos - egresos;

  const TIPOS_CAJA = ['ingreso','egreso','entrega','rendicion'];
  const tipoLabel = { ingreso: '💰 Ingreso', egreso: '💸 Egreso', entrega: '🤝 Entrega', rendicion: '📋 Rendición' };
  const tipoBadge = {
    ingreso:   'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60',
    egreso:    'bg-red-950/60 text-red-400 border border-red-800/60',
    entrega:   'bg-amber-950/60 text-amber-400 border border-amber-800/60',
    rendicion: 'bg-blue-950/60 text-blue-400 border border-blue-800/60',
  };

  container.innerHTML = `
    <!-- KPIs Caja -->
    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-4 text-center">
        <p class="text-[10px] text-emerald-500 uppercase font-bold mb-1">Ingresos</p>
        <p class="text-base font-extrabold text-emerald-400">${formatGs(ingresos)}</p>
      </div>
      <div class="bg-red-950/40 border border-red-800/50 rounded-2xl p-4 text-center">
        <p class="text-[10px] text-red-500 uppercase font-bold mb-1">Egresos</p>
        <p class="text-base font-extrabold text-red-400">${formatGs(egresos)}</p>
      </div>
      <div class="bg-slate-900/70 border ${saldo >= 0 ? 'border-emerald-800/40' : 'border-red-800/40'} rounded-2xl p-4 text-center">
        <p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Saldo</p>
        <p class="text-base font-extrabold ${saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}">${formatGs(saldo)}</p>
      </div>
    </div>

    <div class="flex items-center justify-between mb-4">
      <p class="text-xs text-slate-500">${movimientos.length} movimiento${movimientos.length !== 1 ? 's' : ''}</p>
      <button onclick="campAbrirFormCaja()" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Nuevo Movimiento
      </button>
    </div>

    <div class="space-y-2.5">
      ${movimientos.length ? movimientos.map(m => `
        <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${tipoBadge[m.tipo] || tipoBadge.egreso}">${tipoLabel[m.tipo] || m.tipo}</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-slate-200 truncate">${m.descripcion || '-'}</p>
            <div class="text-[10px] text-slate-500 mt-0.5 flex gap-3 flex-wrap">
              <span>👤 ${m.responsable_nombre || '-'}</span>
              ${m.destinatario_nombre ? `<span>→ ${m.destinatario_nombre}</span>` : ''}
              <span>📅 ${m.fecha ? new Date(m.fecha).toLocaleString('es-PY', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-extrabold text-sm ${['ingreso'].includes(m.tipo) ? 'text-emerald-400' : 'text-red-400'}">${formatGs(m.monto)}</span>
          </div>
        </div>`).join('') : `
        <div class="text-center py-14 text-slate-600">
          <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
          <p class="text-sm font-semibold text-slate-500">Sin movimientos de caja</p>
        </div>`}
    </div>
  `;
}

window.campAbrirFormCaja = function() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-end md:items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
      <h3 class="text-base font-bold text-slate-100 mb-5">Nuevo Movimiento de Caja</h3>
      <form id="formCampCaja" class="space-y-4">
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Tipo</label>
          <select name="tipo" required class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-300 outline-none">
            <option value="ingreso">💰 Ingreso (fondos recibidos)</option>
            <option value="egreso">💸 Egreso (gasto directo)</option>
            <option value="entrega">🤝 Entrega (fondos a persona)</option>
            <option value="rendicion">📋 Rendición (devolución/cierre)</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Monto (Gs.)</label>
            <input name="monto" type="number" min="0" step="1000" required placeholder="500000"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Destinatario</label>
            <input name="destinatario_nombre" type="text" placeholder="Nombre persona"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Descripción</label>
          <input name="descripcion" type="text" placeholder="Ej: Entrega a Juan para combustible zona norte"
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Observaciones</label>
          <textarea name="observaciones" rows="2" placeholder="Notas adicionales..."
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none resize-none placeholder-slate-700"></textarea>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all">Cancelar</button>
          <button type="submit" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all">Guardar</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('formCampCaja').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    if (!body.monto || parseInt(body.monto) <= 0) return showToast('Ingresá un monto válido', 'warning');
    try {
      await api.camp.crearMovCaja(body);
      showToast('Movimiento registrado.');
      modal.remove();
      await campLoadTab();
    } catch (err) { showToast(err.message, 'error'); }
  });
};

// ─────────────────────── VEHÍCULOS ──────────────────────────────
async function campRenderVehiculos(container) {
  const vehiculos = await api.camp.vehiculosCamp();
  const estadoStyle = {
    disponible:  'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50',
    en_ruta:     'bg-blue-950/60 text-blue-400 border border-blue-800/50',
    sin_combustible: 'bg-amber-950/60 text-amber-400 border border-amber-800/50',
    en_reparacion: 'bg-red-950/60 text-red-400 border border-red-800/50',
    inactivo:    'bg-slate-900 text-slate-500 border border-slate-800',
  };

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <p class="text-xs text-slate-400">${vehiculos.length} vehículo${vehiculos.length !== 1 ? 's' : ''} en la flota</p>
      <button onclick="campAbrirFormVehiculo()" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Agregar Vehículo
      </button>
    </div>

    ${vehiculos.length ? `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${vehiculos.map(v => {
        const fuelColor = v.combustible < 20 ? 'bg-red-500' : v.combustible < 50 ? 'bg-amber-500' : 'bg-emerald-500';
        const st = estadoStyle[v.estado] || estadoStyle.disponible;
        return `
        <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-5 group relative">
          <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="campEditarVehiculo(${v.id})" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
            </button>
            <button onclick="campBorrarVehiculo(${v.id})" class="w-7 h-7 bg-slate-800 hover:bg-red-900/50 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          <div class="flex items-start gap-3 mb-3">
            <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17H5a2 2 0 01-2-2V9m2-4h12l2 4v6a2 2 0 01-2 2h-3M9 7h6M9 17h.01M17 17h.01M3 9h18"/></svg>
            </div>
            <div>
              <h4 class="font-bold text-slate-100 leading-tight">${v.nombre}</h4>
              <p class="text-[11px] text-slate-500 mt-0.5">${v.modelo || '-'} · Placa: <strong class="text-slate-400">${v.placa || '-'}</strong></p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-[11px] mb-3">
            <div><span class="text-slate-600">Chofer:</span> <span class="text-slate-300 font-semibold">${v.chofer || '-'}</span></div>
            <div><span class="text-slate-600">Tel:</span> <span class="text-slate-300">${v.telefono || '-'}</span></div>
            <div><span class="text-slate-600">Capacidad:</span> <span class="text-slate-300">${v.capacidad} personas</span></div>
            <div><span class="text-slate-600">Tareas activas:</span> <span class="font-bold ${parseInt(v.tareas_activas)>0?'text-amber-400':'text-slate-400'}">${v.tareas_activas}</span></div>
          </div>
          <div class="mb-3">
            <div class="flex justify-between text-[10px] mb-1">
              <span class="text-slate-500 uppercase font-bold">Combustible</span>
              <span class="font-bold ${v.combustible < 20 ? 'text-red-400' : v.combustible < 50 ? 'text-amber-400' : 'text-emerald-400'}">${v.combustible}%</span>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all ${fuelColor}" style="width:${v.combustible}%"></div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${st}">${v.estado.replace('_',' ').toUpperCase()}</span>
            <div class="flex gap-1">
              ${['disponible','en_ruta','sin_combustible','en_reparacion'].map(est => `
                <button onclick="campCambiarEstadoVehiculo(${v.id},'${est}')" title="${est}"
                  class="w-6 h-6 rounded-lg ${v.estado===est?'bg-red-600 text-white':'bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-slate-200'} flex items-center justify-center text-[9px] font-bold transition-all">
                  ${est==='disponible'?'✓':est==='en_ruta'?'▶':est==='sin_combustible'?'⛽':'🔧'}
                </button>`).join('')}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>` : `
    <div class="text-center py-16 text-slate-600">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17H5a2 2 0 01-2-2V9m2-4h12l2 4v6a2 2 0 01-2 2h-3M9 7h6M9 17h.01M17 17h.01M3 9h18"/></svg>
      <p class="text-sm font-semibold text-slate-500">Sin vehículos registrados</p>
      <p class="text-xs text-slate-600 mt-1">Agregá la flota para asignar tareas y actividades</p>
    </div>`}
  `;
  window._campVehiculos = vehiculos;
}

window.campAbrirFormVehiculo = function(v = {}) {
  const esEdicion = !!v.id;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-end md:items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 class="text-base font-bold text-slate-100 mb-5">${esEdicion ? 'Editar Vehículo' : 'Agregar Vehículo'}</h3>
      <form id="formCampVehiculo" class="space-y-4">
        ${v.id ? `<input type="hidden" name="id" value="${v.id}">` : ''}
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Nombre / ID</label>
            <input name="nombre" value="${v.nombre||''}" required placeholder="Ej: Hilux 01"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Placa</label>
            <input name="placa" value="${v.placa||''}" placeholder="ABC 123"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Modelo</label>
          <input name="modelo" value="${v.modelo||''}" placeholder="Ej: Toyota Hilux 4x4"
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Chofer</label>
            <input name="chofer" value="${v.chofer||''}" placeholder="Nombre del chofer"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Teléfono</label>
            <input name="telefono" value="${v.telefono||''}" placeholder="0981 123456"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Capacidad</label>
            <input name="capacidad" type="number" value="${v.capacidad||5}" min="1" max="60"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Combustible %</label>
            <input name="combustible" type="number" value="${v.combustible||100}" min="0" max="100"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Estado</label>
            <select name="estado" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2.5 text-xs text-slate-300 outline-none">
              <option value="disponible" ${v.estado==='disponible'?'selected':''}>Disponible</option>
              <option value="en_ruta" ${v.estado==='en_ruta'?'selected':''}>En Ruta</option>
              <option value="sin_combustible" ${v.estado==='sin_combustible'?'selected':''}>Sin Combustible</option>
              <option value="en_reparacion" ${v.estado==='en_reparacion'?'selected':''}>En Reparación</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Observaciones</label>
          <input name="observaciones" value="${v.observaciones||''}" placeholder="Notas..."
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all">Cancelar</button>
          <button type="submit" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all">${esEdicion ? 'Guardar' : 'Agregar'}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('formCampVehiculo').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    try {
      if (esEdicion) { await api.camp.editarVehiculo(v.id, body); showToast('Vehículo actualizado.'); }
      else           { await api.camp.crearVehiculo(body);         showToast('Vehículo agregado.'); }
      modal.remove();
      await campLoadTab();
    } catch (err) { showToast(err.message, 'error'); }
  });
};

window.campEditarVehiculo = async function(id) {
  const vehiculos = window._campVehiculos || await api.camp.vehiculosCamp();
  const v = vehiculos.find(x => x.id === id);
  if (v) campAbrirFormVehiculo(v);
};

window.campBorrarVehiculo = async function(id) {
  const ok = await window.confirmarAccion('Eliminar Vehículo', '¿Eliminar este vehículo de la flota?');
  if (!ok) return;
  try { await api.camp.borrarVehiculo(id); showToast('Vehículo eliminado.'); await campLoadTab(); }
  catch (e) { showToast(e.message, 'error'); }
};

window.campCambiarEstadoVehiculo = async function(id, estado) {
  try { await api.camp.editarVehiculo(id, { estado }); await campLoadTab(); }
  catch (e) { showToast(e.message, 'error'); }
};

// ─────────────────────── TAREAS ──────────────────────────────────
async function campRenderTareas(container) {
  const [tareas, vehiculos] = await Promise.all([api.camp.tareas(), api.camp.vehiculosCamp()]);
  window._campVehiculos = vehiculos;

  const pendientes   = tareas.filter(t => t.estado === 'pendiente');
  const enCamino     = tareas.filter(t => t.estado === 'en_camino');
  const completadas  = tareas.filter(t => t.estado === 'completado');

  const prioStyle = { urgente: 'bg-red-900/60 text-red-400 border-red-800/60', alta: 'bg-amber-900/60 text-amber-400 border-amber-800/60', normal: 'bg-slate-800 text-slate-400 border-slate-700' };

  const tarjeta = (t) => `
    <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 group">
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="text-xs font-bold text-slate-100 leading-tight flex-1">${t.titulo}</p>
        <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${prioStyle[t.prioridad]||prioStyle.normal}">${t.prioridad?.toUpperCase()}</span>
      </div>
      ${t.descripcion ? `<p class="text-[10px] text-slate-500 mb-2 line-clamp-2">${t.descripcion}</p>` : ''}
      <div class="text-[10px] text-slate-600 space-y-0.5">
        ${t.tipo ? `<p>📌 ${t.tipo}</p>` : ''}
        ${t.asignado_nombre ? `<p>👤 ${t.asignado_nombre}</p>` : ''}
        ${t.vehiculo_nombre ? `<p>🚗 ${t.vehiculo_nombre}${t.vehiculo_placa?' ('+t.vehiculo_placa+')':''}</p>` : ''}
        ${t.tiempo_estimado ? `<p>⏱ ${t.tiempo_estimado} min</p>` : ''}
      </div>
      <div class="flex gap-1 mt-2.5 flex-wrap">
        ${t.estado !== 'pendiente'  ? `<button onclick="campMoverTarea(${t.id},'pendiente')"   class="text-[9px] font-bold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-all">← Pendiente</button>` : ''}
        ${t.estado !== 'en_camino'  ? `<button onclick="campMoverTarea(${t.id},'en_camino')"   class="text-[9px] font-bold px-2 py-1 bg-blue-900/60 hover:bg-blue-800/60 text-blue-400 rounded-lg transition-all">▶ En Camino</button>` : ''}
        ${t.estado !== 'completado' ? `<button onclick="campMoverTarea(${t.id},'completado')"  class="text-[9px] font-bold px-2 py-1 bg-emerald-900/60 hover:bg-emerald-800/60 text-emerald-400 rounded-lg transition-all">✓ Completar</button>` : ''}
        <button onclick="campEliminarTarea(${t.id})" class="ml-auto text-[9px] font-bold px-2 py-1 bg-slate-900 hover:bg-red-900/40 text-slate-600 hover:text-red-400 rounded-lg transition-all">✕</button>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <p class="text-xs text-slate-400">${tareas.length} tarea${tareas.length !== 1 ? 's' : ''} en total</p>
      <button onclick="campAbrirFormTarea()" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Nueva Tarea
      </button>
    </div>

    <!-- Kanban 3 columnas -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendiente</span>
          <span class="ml-auto text-xs font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">${pendientes.length}</span>
        </div>
        <div class="space-y-2.5">
          ${pendientes.length ? pendientes.map(tarjeta).join('') : '<p class="text-[11px] text-slate-600 text-center py-4">Sin tareas pendientes</p>'}
        </div>
      </div>
      <div class="bg-blue-950/20 border border-blue-900/30 rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span class="text-xs font-bold text-blue-400 uppercase tracking-wider">En Camino</span>
          <span class="ml-auto text-xs font-bold bg-blue-950/60 text-blue-400 px-2 py-0.5 rounded-full">${enCamino.length}</span>
        </div>
        <div class="space-y-2.5">
          ${enCamino.length ? enCamino.map(tarjeta).join('') : '<p class="text-[11px] text-slate-600 text-center py-4">Ninguna en curso</p>'}
        </div>
      </div>
      <div class="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider">Completado</span>
          <span class="ml-auto text-xs font-bold bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded-full">${completadas.length}</span>
        </div>
        <div class="space-y-2.5">
          ${completadas.length ? completadas.map(tarjeta).join('') : '<p class="text-[11px] text-slate-600 text-center py-4">Ninguna completada aún</p>'}
        </div>
      </div>
    </div>
  `;
}

window.campMoverTarea = async function(id, estado) {
  try { await api.camp.actualizarTarea(id, { estado }); await campLoadTab(); }
  catch (e) { showToast(e.message, 'error'); }
};
window.campEliminarTarea = async function(id) {
  const ok = await window.confirmarAccion('Eliminar Tarea', '¿Eliminar esta tarea?');
  if (!ok) return;
  try { await api.camp.borrarTarea(id); showToast('Tarea eliminada.'); await campLoadTab(); }
  catch (e) { showToast(e.message, 'error'); }
};

window.campAbrirFormTarea = function() {
  const vehiculos = window._campVehiculos || [];
  const TIPOS_TAREA = [
    'Buscar votantes','Llevar personas al local','Traslado de adultos mayores',
    'Traslado de coordinadores','Reparto de materiales','Transporte de veedores',
    'Carga de combustible','Reparación de vehículo','Compra de agua/alimentos',
    'Impresión de padrones','Instalación de carpas','Supervisión de mesas',
    'Coordinación territorial','Resolución de incidentes','Otro'
  ];
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-end md:items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 class="text-base font-bold text-slate-100 mb-5">Nueva Tarea</h3>
      <form id="formCampTarea" class="space-y-4">
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Título de la Tarea</label>
          <input name="titulo" required placeholder="Ej: Buscar 15 votantes en Barrio San Miguel"
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Tipo de Actividad</label>
            <select name="tipo" class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none">
              <option value="">Sin tipo</option>
              ${TIPOS_TAREA.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Prioridad</label>
            <select name="prioridad" class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none">
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Asignado a</label>
            <input name="asignado_nombre" placeholder="Nombre del coordinador"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
          <div>
            <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Tiempo Est. (min)</label>
            <input name="tiempo_estimado" type="number" min="1" placeholder="20"
              class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none">
          </div>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Vehículo Asignado</label>
          <select name="vehiculo_id" class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none">
            <option value="">Sin vehículo</option>
            ${vehiculos.map(v => `<option value="${v.id}">${v.nombre}${v.placa?' ('+v.placa+')':''} — ${v.chofer||'Sin chofer'}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Descripción</label>
          <textarea name="descripcion" rows="2" placeholder="Detalles de la tarea..."
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none resize-none placeholder-slate-700"></textarea>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all">Cancelar</button>
          <button type="submit" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all">Crear Tarea</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('formCampTarea').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    try { await api.camp.crearTarea(body); showToast('Tarea creada.'); modal.remove(); await campLoadTab(); }
    catch (err) { showToast(err.message, 'error'); }
  });
};

// ─────────────────────── ACTIVIDADES ─────────────────────────────
const ACT_CATEGORIAS = {
  movilizacion: { label: 'Movilización', color: 'text-blue-400', tipos: ['Buscar votantes','Llevar personas al local','Traslado de adultos mayores','Traslado de coordinadores','Reparto de materiales','Transporte de veedores','Transporte de comida','Reubicación logística'] },
  operativa:    { label: 'Operativa',    color: 'text-amber-400', tipos: ['Carga de combustible','Reparación de vehículo','Cambio de chofer','Compra de agua/alimentos','Impresión de padrones','Instalación de carpas','Instalación de equipos'] },
  electoral:    { label: 'Electoral',    color: 'text-emerald-400', tipos: ['Supervisión de mesas','Reporte de participación','Control de veedores','Monitoreo de locales','Resolución de incidentes','Coordinación territorial'] },
};

async function campRenderActividades(container) {
  const [actividades, vehiculos] = await Promise.all([api.camp.actividades(), api.camp.vehiculosCamp()]);
  window._campVehiculos = vehiculos;

  const catBadge = { movilizacion: 'bg-blue-950/60 text-blue-400 border-blue-800/50', operativa: 'bg-amber-950/60 text-amber-400 border-amber-800/50', electoral: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' };

  container.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <p class="text-xs text-slate-400">${actividades.length} actividad${actividades.length !== 1 ? 'es' : ''} registrada${actividades.length !== 1 ? 's' : ''}</p>
      <button onclick="campAbrirFormActividad()" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
        Registrar Actividad
      </button>
    </div>

    <div class="space-y-2.5">
      ${actividades.length ? actividades.map(a => `
        <div class="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-4 flex flex-wrap items-start gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-sm font-bold text-slate-100">${a.tipo}</span>
              ${a.categoria ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${catBadge[a.categoria]||'bg-slate-800 text-slate-400 border-slate-700'}">${ACT_CATEGORIAS[a.categoria]?.label||a.categoria}</span>` : ''}
            </div>
            ${a.descripcion ? `<p class="text-xs text-slate-400 mb-1">${a.descripcion}</p>` : ''}
            <div class="flex gap-3 flex-wrap text-[10px] text-slate-500">
              <span>👤 ${a.responsable_nombre||'-'}</span>
              ${a.vehiculo_nombre ? `<span>🚗 ${a.vehiculo_nombre}</span>` : ''}
              <span>📅 ${a.fecha ? new Date(a.fecha).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</span>
              ${a.lat ? `<span>📍 GPS</span>` : ''}
            </div>
          </div>
          <button onclick="campEliminarActividad(${a.id})" class="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>`).join('') : `
      <div class="text-center py-16 text-slate-600">
        <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        <p class="text-sm font-semibold text-slate-500">Sin actividades registradas</p>
      </div>`}
    </div>
  `;
}

window.campAbrirFormActividad = function() {
  const vehiculos = window._campVehiculos || [];
  const modal = document.createElement('div');
  modal.className = 'modal-overlay fixed inset-0 z-50 flex items-end md:items-center justify-center p-4';
  modal.innerHTML = `
    <div class="modal-card bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
      <h3 class="text-base font-bold text-slate-100 mb-5">Registrar Actividad</h3>
      <form id="formCampActividad" class="space-y-4">
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Categoría</label>
          <select id="actCatSelect" name="categoria" onchange="campActualizarTipos()" class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none">
            <option value="">Seleccionar categoría...</option>
            ${Object.entries(ACT_CATEGORIAS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Tipo de Actividad</label>
          <select id="actTipoSelect" name="tipo" required class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none">
            <option value="">Seleccioná primero la categoría</option>
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Vehículo (opcional)</label>
          <select name="vehiculo_id" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 outline-none">
            <option value="">Sin vehículo</option>
            ${vehiculos.map(v=>`<option value="${v.id}">${v.nombre}${v.placa?' ('+v.placa+')':''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-slate-400 text-[10px] font-bold uppercase mb-1.5">Descripción</label>
          <textarea name="descripcion" rows="2" placeholder="Detalle de la actividad..."
            class="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none resize-none placeholder-slate-700"></textarea>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-slate-400 text-[10px] uppercase">GPS (opcional)</p>
            <p id="gpsActCamp" class="text-[10px] text-slate-600 mt-0.5">No capturado</p>
          </div>
          <input type="hidden" name="lat"><input type="hidden" name="lng">
          <button type="button" onclick="campCapturarGPSActividad()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold px-3 py-1.5 rounded-lg text-[10px] active:scale-95 transition-all">GPS</button>
        </div>
        <div class="flex gap-3 pt-1">
          <button type="button" onclick="this.closest('.modal-overlay').remove()" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all">Cancelar</button>
          <button type="submit" class="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all">Registrar</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('formCampActividad').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(ev.target).entries());
    if (!body.tipo) return showToast('Seleccioná el tipo de actividad', 'warning');
    try { await api.camp.crearActividad(body); showToast('Actividad registrada.'); modal.remove(); await campLoadTab(); }
    catch (err) { showToast(err.message, 'error'); }
  });
};

window.campActualizarTipos = function() {
  const cat = document.getElementById('actCatSelect')?.value;
  const sel = document.getElementById('actTipoSelect');
  if (!sel) return;
  const tipos = ACT_CATEGORIAS[cat]?.tipos || [];
  sel.innerHTML = tipos.length
    ? tipos.map(t => `<option value="${t}">${t}</option>`).join('')
    : '<option value="">Seleccioná primero la categoría</option>';
};

window.campCapturarGPSActividad = function() {
  navigator.geolocation?.getCurrentPosition(pos => {
    const form = document.getElementById('formCampActividad');
    if (form) { form.lat.value = pos.coords.latitude.toFixed(6); form.lng.value = pos.coords.longitude.toFixed(6); }
    const el = document.getElementById('gpsActCamp');
    if (el) el.textContent = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
  }, () => showToast('No se pudo obtener ubicación', 'warning'));
};

window.campEliminarActividad = async function(id) {
  const ok = await window.confirmarAccion('Eliminar Actividad', '¿Eliminar este registro de actividad?');
  if (!ok) return;
  try { await api.camp.borrarActividad(id); showToast('Actividad eliminada.'); await campLoadTab(); }
  catch (e) { showToast(e.message, 'error'); }
};

// ─────────────────────── ALERTAS ─────────────────────────────────
async function campRenderAlertas(container) {
  const alertas = await api.camp.alertas();
  const nivelStyle = {
    critico: { bg: 'bg-red-950/60 border-red-800/60',    icon: 'text-red-400',    badge: 'bg-red-600' },
    alto:    { bg: 'bg-amber-950/60 border-amber-800/60', icon: 'text-amber-400',  badge: 'bg-amber-500' },
    medio:   { bg: 'bg-blue-950/60 border-blue-800/60',   icon: 'text-blue-400',   badge: 'bg-blue-500' },
  };
  const tipoIcon = { presupuesto: '💰', vehiculo: '🚗', gasto: '💸', tarea: '✅' };

  container.innerHTML = `
    <div class="flex items-center gap-3 mb-5">
      ${alertas.length > 0
        ? `<div class="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center font-extrabold text-white text-sm">${alertas.length}</div>`
        : `<div class="w-8 h-8 rounded-xl bg-emerald-900/60 flex items-center justify-center text-emerald-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>`}
      <div>
        <p class="text-sm font-bold text-slate-100">${alertas.length > 0 ? `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} activa${alertas.length !== 1 ? 's' : ''}` : 'Todo en orden'}</p>
        <p class="text-[10px] text-slate-500">Monitoreo automático de presupuesto, vehículos y tareas</p>
      </div>
      <button onclick="campLoadTab()" class="ml-auto text-xs text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all font-semibold">↻ Actualizar</button>
    </div>

    <div class="space-y-3">
      ${alertas.length ? alertas.map(a => {
        const st = nivelStyle[a.nivel] || nivelStyle.medio;
        return `
        <div class="border ${st.bg} rounded-2xl p-4 flex items-start gap-3">
          <span class="text-xl shrink-0">${tipoIcon[a.tipo]||'⚠️'}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <p class="text-sm font-bold text-slate-100">${a.mensaje}</p>
              <span class="text-[8px] font-extrabold px-2 py-0.5 rounded-full text-white uppercase shrink-0 ${st.badge}">${a.nivel}</span>
            </div>
            <p class="text-xs text-slate-400">${a.detalle}</p>
          </div>
        </div>`;
      }).join('') : `
      <div class="bg-emerald-950/30 border border-emerald-900/40 rounded-2xl p-8 text-center">
        <svg class="w-12 h-12 mx-auto mb-3 text-emerald-500 opacity-60" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
        <p class="text-sm font-semibold text-emerald-400">Sin alertas activas</p>
        <p class="text-xs text-slate-500 mt-1">El presupuesto y la flota están dentro de los límites normales</p>
      </div>`}
    </div>

    <div class="mt-5 bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4">
      <p class="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-wider">Condiciones de alerta</p>
      <ul class="text-[10px] text-slate-500 space-y-1">
        <li>🔴 <strong class="text-slate-400">Crítico:</strong> Rubro de presupuesto agotado (100%), combustible &lt;10%</li>
        <li>🟠 <strong class="text-slate-400">Alto:</strong> Rubro ≥90%, combustible &lt;25%, tarea urgente &gt;2h sin iniciar</li>
        <li>🔵 <strong class="text-slate-400">Medio:</strong> Rubro ≥75%, gasto individual &gt;Gs. 5.000.000 en últimas 24h</li>
      </ul>
    </div>
  `;
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
