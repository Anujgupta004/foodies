/* =============================================
   FOODIES.COM — Shared Auth Helpers
   Used by login.html and register.html
   ============================================= */

// ── Redirect if already logged in ────────────────
(function () {
  const token = localStorage.getItem('foodies_token');
  const user  = JSON.parse(localStorage.getItem('foodies_user') || 'null');
  if (token && user) {
    const p = window.location.pathname;
    if (p.includes('login.html') || p.includes('register.html')) {
      window.location.href = user.role === 'admin' ? 'admin.html' : 'index.html';
    }
  }
})();

// ── Toggle password visibility ────────────────────
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon  = btn.querySelector('i');
  if (input.type === 'password') {
    input.type     = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    input.type     = 'password';
    icon.className = 'bi bi-eye';
  }
}

// ── Show alert banner ────────────────────────────
function showAlert(type, msg) {
  const el = document.getElementById('authAlert');
  if (!el) return;
  el.className   = 'auth-alert ' + type;
  el.textContent = msg;
  el.style.display = 'block';
  if (type === 'success') return; // keep success visible
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── Show field-level error ────────────────────────
function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ── Clear all errors ──────────────────────────────
function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  const alert = document.getElementById('authAlert');
  if (alert) alert.style.display = 'none';
}

// ── Button loading state ──────────────────────────
function setLoading(on) {
  const btn    = document.querySelector('.btn-auth');
  const span   = btn  && btn.querySelector('span');
  const loader = btn  && btn.querySelector('.btn-loader');
  if (!btn) return;
  btn.disabled = on;
  if (span)   span.style.display   = on ? 'none'         : 'inline';
  if (loader) loader.style.display = on ? 'inline-block' : 'none';
}

// ── Safe fetch — returns friendly error if backend offline ──
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    // If response is HTML (backend offline / wrong route), throw clear error
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Backend server is not running. Start it: cd backend && npm run dev');
    }
    return await res.json();
  } catch (err) {
    if (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Make sure backend is running on port 5000.');
    }
    throw err;
  }
}
