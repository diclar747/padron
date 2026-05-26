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

function put(url, data, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'PUT',
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

function del(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('--- 1. Login as Admin Bella Vista ---');
  const bvAdminLogin = await post('http://localhost:4000/api/auth/login', { email: 'admin_bellavista@padron.py', password: '123456' });
  const bvToken = bvAdminLogin.data.token;
  console.log('Login status:', bvAdminLogin.status);
  console.log('Admin distrito:', bvAdminLogin.data.user.distrito);

  console.log('\n--- 2. List users as Admin Bella Vista (should only see Bella Vista users) ---');
  const bvUsersRes = await get('http://localhost:4000/api/usuarios', bvToken);
  console.log('Users list status:', bvUsersRes.status);
  const bvUsers = bvUsersRes.data;
  console.log('Number of users seen:', bvUsers.length);
  const otherDistricts = bvUsers.filter(u => u.distrito !== 'BELLA VISTA');
  console.log('Users from other districts seen (should be 0):', otherDistricts.length);

  console.log('\n--- 3. Create a veedor as Admin Bella Vista (should inherit BELLA VISTA district) ---');
  const newVeedorEmail = 'test_veedor_bv_' + Date.now() + '@padron.py';
  const createRes = await post('http://localhost:4000/api/usuarios', {
    nombre: 'Test Veedor Bella Vista',
    email: newVeedorEmail,
    password: 'password123',
    rol: 'veedor',
    activo: true,
    permisos: { dashboard: true, electores: true }
  }, bvToken);
  console.log('Create status (200):', createRes.status);
  const createdUserId = createRes.data.id;
  console.log('Created user ID:', createdUserId);

  console.log('\n--- 4. Verify created veedor belongs to Bella Vista ---');
  const bvUsersUpdated = await get('http://localhost:4000/api/usuarios', bvToken);
  const createdUser = bvUsersUpdated.data.find(u => u.id === createdUserId);
  console.log('Created user distrito in DB:', createdUser ? createdUser.distrito : 'Not found');

  console.log('\n--- 5. Login as Admin Hohenau ---');
  const hAdminLogin = await post('http://localhost:4000/api/auth/login', { email: 'admin_hohenau@padron.py', password: '123456' });
  const hToken = hAdminLogin.data.token;
  console.log('Login status:', hAdminLogin.status);
  console.log('Admin distrito:', hAdminLogin.data.user.distrito);

  console.log('\n--- 6. Admin Hohenau attempts to edit the Bella Vista veedor (should get 403) ---');
  const editRes = await put(`http://localhost:4000/api/usuarios/${createdUserId}`, {
    nombre: 'Hack Name',
    email: newVeedorEmail,
    rol: 'veedor',
    activo: true
  }, hToken);
  console.log('Edit status (should be 403):', editRes.status);
  console.log('Response message:', editRes.data);

  console.log('\n--- 7. Admin Hohenau attempts to delete the Bella Vista veedor (should get 403) ---');
  const deleteRes = await del(`http://localhost:4000/api/usuarios/${createdUserId}`, hToken);
  console.log('Delete status (should be 403):', deleteRes.status);
  console.log('Response message:', deleteRes.data);

  console.log('\n--- 8. Login as Superadmin ---');
  const superLogin = await post('http://localhost:4000/api/auth/login', { email: 'admin@padron.py', password: '123456' });
  const superToken = superLogin.data.token;
  console.log('Login status:', superLogin.status);

  console.log('\n--- 9. Superadmin lists all users (should see all 14+ users) ---');
  const superUsersRes = await get('http://localhost:4000/api/usuarios', superToken);
  console.log('Superadmin users count:', superUsersRes.data.length);

  console.log('\n--- 10. Superadmin cleans up (deletes) the created Bella Vista veedor (should succeed 200) ---');
  const superDeleteRes = await del(`http://localhost:4000/api/usuarios/${createdUserId}`, superToken);
  console.log('Superadmin delete status (should be 200):', superDeleteRes.status);

  if (bvUsersRes.status === 200 && otherDistricts.length === 0 && editRes.status === 403 && deleteRes.status === 403 && superDeleteRes.status === 200) {
    console.log('\n✅ TEST EXITOSO: La segregación de distritos y la seguridad cruzada funcionan perfectamente.');
  } else {
    console.log('\n❌ TEST FALLIDO: Fallaron algunas restricciones de distrito o de seguridad.');
    process.exit(1);
  }
}

runTests().catch(console.error);
