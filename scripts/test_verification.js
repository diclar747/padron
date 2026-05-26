const http = require('http');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Iniciando sesión como Veedor (Juan Veedor) ---');
  const veedorLogin = await post('http://localhost:4000/api/auth/login', { email: 'veedor1@padron.py', password: '123456' });
  console.log('Login Status:', veedorLogin.status);
  const veedorToken = veedorLogin.data.token;
  console.log('Veedor Rol:', veedorLogin.data.user.rol);
  console.log('Veedor Permisos:', veedorLogin.data.user.permisos);

  console.log('\n--- 2. Probando acceso a Logística (Privado para este Veedor) ---');
  const logisticaRes = await get('http://localhost:4000/api/logistica/vehiculos', veedorToken);
  console.log('Status esperado (403):', logisticaRes.status);
  console.log('Respuesta:', logisticaRes.data);

  console.log('\n--- 3. Probando acceso a Usuarios (Exclusivo de Admin) ---');
  const usuariosRes = await get('http://localhost:4000/api/usuarios', veedorToken);
  console.log('Status esperado (403):', usuariosRes.status);
  console.log('Respuesta:', usuariosRes.data);

  console.log('\n--- 4. Iniciando sesión como Administrador (Admin General) ---');
  const adminLogin = await post('http://localhost:4000/api/auth/login', { email: 'admin@padron.py', password: '123456' });
  console.log('Login Status:', adminLogin.status);
  const adminToken = adminLogin.data.token;

  console.log('\n--- 5. Probando acceso a Usuarios desde Admin ---');
  const adminUsuariosRes = await get('http://localhost:4000/api/usuarios', adminToken);
  console.log('Status esperado (200):', adminUsuariosRes.status);
  console.log('Usuarios listados:', Array.isArray(adminUsuariosRes.data) ? `Sí (${adminUsuariosRes.data.length} usuarios)` : 'No');

  if (logisticaRes.status === 403 && usuariosRes.status === 403 && adminUsuariosRes.status === 200) {
    console.log('\n✅ VERIFICACIÓN EXITOSA: Los controles de acceso y roles funcionan correctamente.');
  } else {
    console.log('\n❌ VERIFICACIÓN FALLIDA: Algunos controles de acceso no funcionaron como se esperaba.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
