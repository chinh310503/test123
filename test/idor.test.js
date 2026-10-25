const http = require('http');
const BASE = process.env.TARGET || 'http://localhost:3000';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body: body }));
    }).on('error', reject);
  });
}

(async () => {
  try {
    const res = await get('/profile/1');
    const leaked = res.status === 200 && /admin@demo\.local/.test(res.body);
    if (leaked) {
      console.error('FAIL: IDOR - truy cap duoc ho so admin ma khong co quyen.');
      process.exit(1);
    }
    console.log('PASS: khong lo ho so nguoi khac (status ' + res.status + ').');
    process.exit(0);
  } catch (e) {
    console.error('Khong ket noi duoc toi app:', e.message);
    process.exit(2);
  }
})();
