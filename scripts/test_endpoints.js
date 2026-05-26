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
  console.log('--- 1. Login as Admin ---');
  const adminLogin = await post('http://localhost:4000/api/auth/login', { email: 'admin@padron.py', password: '123456' });
  const token = adminLogin.data.token;
  console.log('Login status:', adminLogin.status);

  console.log('\n--- 2. Testing Electores Search (ILIKE case insensitivity) ---');
  const electoresRes = await get('http://localhost:4000/api/electores?buscar=juan', token);
  console.log('Search status:', electoresRes.status);
  console.log('Results returned:', Array.isArray(electoresRes.data) ? `${electoresRes.data.length} records found` : 'Error');
  if (Array.isArray(electoresRes.data) && electoresRes.data.length > 0) {
    console.log('First record sample:', {
      id: electoresRes.data[0].id,
      nombre: electoresRes.data[0].nombre,
      ci: electoresRes.data[0].ci,
      barrio_nombre: electoresRes.data[0].barrio_nombre,
      estado: electoresRes.data[0].estado
    });
  }

  console.log('\n--- 3. Testing Reportes Dashboard (COUNT DISTINCT and GROUP BY) ---');
  const dashboardRes = await get('http://localhost:4000/api/reportes/dashboard', token);
  console.log('Dashboard status:', dashboardRes.status);
  console.log('Dashboard stats:', dashboardRes.data);

  console.log('\n--- 4. Testing Mesas ---');
  const mesasRes = await get('http://localhost:4000/api/mesas', token);
  console.log('Mesas status:', mesasRes.status);
  console.log('Mesas returned:', Array.isArray(mesasRes.data) ? `${mesasRes.data.length} mesas found` : 'Error');
  if (Array.isArray(mesasRes.data) && mesasRes.data.length > 0) {
    console.log('First mesa sample:', mesasRes.data[0]);
  }

  console.log('\n--- 5. Testing Barrios ---');
  const barriosRes = await get('http://localhost:4000/api/barrios', token);
  console.log('Barrios status:', barriosRes.status);
  console.log('Barrios returned:', Array.isArray(barriosRes.data) ? `${barriosRes.data.length} barrios found` : 'Error');
  if (Array.isArray(barriosRes.data) && barriosRes.data.length > 0) {
    console.log('First barrio sample:', barriosRes.data[0]);
  }

  console.log('\n--- 6. Testing Logística Vehículos ---');
  const vehiculosRes = await get('http://localhost:4000/api/logistica/vehiculos', token);
  console.log('Vehículos status:', vehiculosRes.status);
  console.log('Vehículos returned:', Array.isArray(vehiculosRes.data) ? `${vehiculosRes.data.length} vehicles found` : 'Error');

  console.log('\n--- 7. Testing Incidencias ---');
  const incidenciasRes = await get('http://localhost:4000/api/incidencias', token);
  console.log('Incidencias status:', incidenciasRes.status);
  console.log('Incidencias returned:', Array.isArray(incidenciasRes.data) ? `${incidenciasRes.data.length} incidents found` : 'Error');
}

runTests().catch(console.error);
