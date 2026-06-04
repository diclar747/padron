const http = require('http');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
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
      path: urlObj.pathname + urlObj.search,
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
  console.log('--- Logueando como admin de Encarnación ---');
  const loginRes = await post('http://localhost:4000/api/auth/login', { 
    email: 'admin_encarnacion@padron.py', 
    password: '123456' 
  });
  
  if (loginRes.status !== 200) {
    console.error('Error al iniciar sesión:', loginRes.data);
    return;
  }
  
  const token = loginRes.data.token;
  console.log('Token obtenido con éxito.');

  console.log('\n--- 1. Probando Dashboard de Encarnación (barrio_id=165) ---');
  const dashboardRes = await get('http://localhost:4000/api/reportes/dashboard?barrio_id=165', token);
  console.log('Status Dashboard:', dashboardRes.status);
  console.log('Total Electores:', dashboardRes.data.total_electores);
  console.log('Total Mesas:', dashboardRes.data.total_mesas);
  console.log('Total Barrios/Secciones:', dashboardRes.data.total_barrios);
  console.log('Data completa del Dashboard:', dashboardRes.data);

  console.log('\n--- 2. Probando Lista de Electores para Encarnación (barrio_id=165) ---');
  const electoresRes = await get('http://localhost:4000/api/electores?barrio_id=165', token);
  console.log('Status Electores:', electoresRes.status);
  console.log('Cantidad de Electores devueltos:', Array.isArray(electoresRes.data) ? electoresRes.data.length : 'Error');

  console.log('\n--- 3. Probando Lista de Mesas para Encarnación (barrio_id=165) ---');
  const mesasRes = await get('http://localhost:4000/api/mesas?barrio_id=165', token);
  console.log('Status Mesas:', mesasRes.status);
  console.log('Cantidad de Mesas devueltas:', Array.isArray(mesasRes.data) ? mesasRes.data.length : 'Error');
  if (Array.isArray(mesasRes.data) && mesasRes.data.length > 0) {
    console.log('Mesa de muestra:', {
      numero: mesasRes.data[0].numero,
      local: mesasRes.data[0].local,
      lat: mesasRes.data[0].lat,
      lng: mesasRes.data[0].lng,
      electores: mesasRes.data[0].electores_esperados
    });
  }
}

runTests().catch(console.error);
