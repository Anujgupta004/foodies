/* =============================================
   FOODIES.COM — Shared API Helper
   All pages include this file for safe fetch
   ============================================= */

const API_BASE = '';  // empty = relative (works on both :3000 proxy and :5000 direct)

// Safe JSON fetch — never crashes on HTML response
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('foodies_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let res;
  try {
    res = await fetch(API_BASE + endpoint, { ...options, headers });
  } catch (networkErr) {
    throw new Error('Cannot reach server. Start backend: cd backend && npm run dev');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Backend not running. Start it: cd backend && npm run dev');
  }

  const data = await res.json();
  return data;
}
