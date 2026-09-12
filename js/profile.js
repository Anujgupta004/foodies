/* ===== PROFILE PAGE ===== */

const token = localStorage.getItem('foodies_token');
const user  = JSON.parse(localStorage.getItem('foodies_user') || 'null');
if (!token || !user) { window.location.href = 'login.html'; }

const sidebarUser = document.getElementById('sidebarUser');
if (sidebarUser) sidebarUser.innerHTML = `<strong>${user.name}</strong>${user.email}`;

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('dashOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

function logout() {
  localStorage.removeItem('foodies_token');
  localStorage.removeItem('foodies_user');
  window.location.href = 'index.html';
}

function showAlert(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'co-alert ' + type;
  el.textContent = msg;
  el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── PROBLEM 2: Profile Image Upload — FIXED ──────────────────
function handleAvatarChange(input) {
  const file = input.files[0];
  if (!file) return;

  // Validate file type
  const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
  if (!allowed.includes(file.type)) {
    showAlertBox('❌ Only JPG, PNG, GIF or WebP images allowed', 'error');
    return;
  }
  // Validate size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    showAlertBox('❌ Image must be smaller than 2MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const avatarEl = document.getElementById('profileAvatar');
    if (!avatarEl) return;

    // Set as background-image (CSS class handles background-size:cover)
    avatarEl.style.backgroundImage = `url('${e.target.result}')`;
    avatarEl.style.backgroundColor = 'transparent';
    avatarEl.textContent = '';  // Remove letter

    // Persist in localStorage
    try {
      localStorage.setItem('foodies_avatar_' + (user._id || user.id || user.email), e.target.result);
    } catch(storageErr) {
      // localStorage full — compress slightly
      localStorage.setItem('foodies_avatar', e.target.result.substring(0, 50000));
    }
    showAlertBox('✅ Profile photo updated!', 'success');
  };
  reader.onerror = () => showAlertBox('❌ Failed to read image. Try again.', 'error');
  reader.readAsDataURL(file);
}

function showAlertBox(msg, type = 'success') {
  const old = document.getElementById('_alertBox');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = '_alertBox';
  box.style.cssText = `position:fixed;top:76px;right:20px;z-index:9999;padding:13px 22px;border-radius:12px;font-weight:600;font-size:0.88rem;box-shadow:0 6px 20px rgba(0,0,0,0.12);animation:slideInRight 0.3s ease;background:${type==='success'?'#d4edda':'#f8d7da'};color:${type==='success'?'#155724':'#721c24'};border:1px solid ${type==='success'?'#c3e6cb':'#f5c6cb'};`;
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => { if (box.parentNode) box.remove(); }, 3500);
}

function loadSavedAvatar() {
  const avatarEl = document.getElementById('profileAvatar');
  if (!avatarEl) return;
  // Try user-specific key first, then fallback
  const key   = 'foodies_avatar_' + ((user._id || user.id || user.email) || '');
  const saved = localStorage.getItem(key) || localStorage.getItem('foodies_avatar');
  if (saved) {
    avatarEl.style.backgroundImage = `url('${saved}')`;
    avatarEl.style.backgroundColor = 'transparent';
    avatarEl.textContent = '';
  }
}

// ── Load profile ──────────────────────────────────────────────
async function loadProfile() {
  try {
    const data = await apiFetch('/api/auth/me');
    if (!data.success) throw new Error(data.message);
    const u = data.user;

    const avatarEl = document.getElementById('profileAvatar');
    const key      = 'foodies_avatar_' + (u._id || u.id || u.email || '');
    const saved    = localStorage.getItem(key) || localStorage.getItem('foodies_avatar');
    if (saved && avatarEl) {
      avatarEl.style.backgroundImage = `url('${saved}')`;
      avatarEl.style.backgroundColor = 'transparent';
      avatarEl.textContent = '';
    } else if (avatarEl) {
      avatarEl.textContent = u.name[0].toUpperCase();
    }

    document.getElementById('profileName').textContent  = u.name;
    document.getElementById('profileEmail').textContent = u.email;
    document.getElementById('pName').value    = u.name             || '';
    document.getElementById('pPhone').value   = u.phone            || '';
    document.getElementById('pStreet').value  = u.address?.street  || '';
    document.getElementById('pCity').value    = u.address?.city    || '';
    document.getElementById('pState').value   = u.address?.state   || '';
    document.getElementById('pPincode').value = u.address?.pincode || '';
    // Pre-fill new email field with current email
    const newEmailEl = document.getElementById('newEmail');
    if (newEmailEl) newEmailEl.value = u.email;

    const oData = await apiFetch('/api/orders/my');
    if (oData.success) document.getElementById('profileOrderCount').textContent = oData.count;

    // Show loyalty points
    const pts = parseInt(localStorage.getItem('foodies_points') || '0');
    const ptsEl = document.getElementById('profilePoints');
    if (ptsEl) ptsEl.textContent = pts.toLocaleString();
  } catch (err) {
    showAlert('profileAlert', 'error', err.message);
  }
}

// ── Update profile ────────────────────────────────────────────
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name:    document.getElementById('pName').value.trim(),
        phone:   document.getElementById('pPhone').value.trim(),
        address: {
          street:  document.getElementById('pStreet').value.trim(),
          city:    document.getElementById('pCity').value.trim(),
          state:   document.getElementById('pState').value.trim(),
          pincode: document.getElementById('pPincode').value.trim()
        }
      })
    });
    if (!data.success) throw new Error(data.message);
    const stored = JSON.parse(localStorage.getItem('foodies_user'));
    stored.name  = data.user.name;
    localStorage.setItem('foodies_user', JSON.stringify(stored));
    document.getElementById('profileName').textContent = data.user.name;
    const av = document.getElementById('profileAvatar');
    if (av && !localStorage.getItem('foodies_avatar')) av.textContent = data.user.name[0].toUpperCase();
    showAlert('profileAlert', 'success', '✅ Profile updated successfully!');
  } catch (err) {
    showAlert('profileAlert', 'error', err.message);
  }
});

// ── PROBLEM 3: Change Email ───────────────────────────────────
const emailForm = document.getElementById('emailForm');
if (emailForm) {
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail   = document.getElementById('newEmail').value.trim();
    const password   = document.getElementById('emailConfirmPass').value;
    if (!newEmail)   { showAlert('emailAlert', 'error', 'Enter new email'); return; }
    if (!password)   { showAlert('emailAlert', 'error', 'Confirm with your password'); return; }
    try {
      const data = await apiFetch('/api/auth/change-email', {
        method: 'PUT',
        body: JSON.stringify({ newEmail, password })
      });
      if (!data.success) throw new Error(data.message);
      // Update localStorage
      const stored   = JSON.parse(localStorage.getItem('foodies_user'));
      stored.email   = newEmail;
      localStorage.setItem('foodies_user', JSON.stringify(stored));
      document.getElementById('profileEmail').textContent = newEmail;
      document.getElementById('emailConfirmPass').value   = '';
      showAlert('emailAlert', 'success', '✅ Email updated! Please login again.');
      setTimeout(() => {
        localStorage.removeItem('foodies_token');
        localStorage.removeItem('foodies_user');
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      showAlert('emailAlert', 'error', err.message);
    }
  });
}

// ── Change Password ───────────────────────────────────────────
document.getElementById('passForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPass  = document.getElementById('newPass').value;
  const confPass = document.getElementById('confPass').value;
  if (newPass !== confPass) { showAlert('passAlert', 'error', 'Passwords do not match'); return; }
  if (newPass.length < 6)   { showAlert('passAlert', 'error', 'Password must be 6+ characters'); return; }
  try {
    const data = await apiFetch('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: document.getElementById('curPass').value,
        newPassword: newPass
      })
    });
    if (!data.success) throw new Error(data.message);
    showAlert('passAlert', 'success', '✅ Password changed! Please login again.');
    document.getElementById('passForm').reset();
    setTimeout(() => {
      localStorage.removeItem('foodies_token');
      localStorage.removeItem('foodies_user');
      window.location.href = 'login.html';
    }, 2000);
  } catch (err) {
    showAlert('passAlert', 'error', err.message);
  }
});

loadProfile();
