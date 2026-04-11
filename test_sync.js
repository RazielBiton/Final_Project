const fetch = require('node-fetch'); // wait, if not installed, use http module
const http = require('http');
// create a simple script to post via http request
const data = JSON.stringify({
  id: 1, 
  status: "פעיל",
  treatments: [{date: "12/12/2025", cost: 100}],
  insurance: {mandatory: {company: "Test", date: "10/10/2025", cost: 500}},
  fuelLog: [], expenses: [], accidents: [], alerts: [], reports: [], gallery: []
});

const req = http.request({
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/vehicles/sync/1',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', e => console.error('Req error:', e.message));
req.write(data);
req.end();
