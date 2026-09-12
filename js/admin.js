/* ===== ADMIN PANEL ===== */

const token = localStorage.getItem('foodies_token');
const user  = JSON.parse(localStorage.getItem('foodies_user') || 'null');
if (!token || !user || user.role !== 'admin') { window.location.href = 'login.html'; }

const adminUserInfo = document.getElementById('adminUserInfo');
if (adminUserInfo) adminUserInfo.innerHTML = `<strong>${user.name}</strong><span>Administrator</span>`;

function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('adminOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

// ── Admin alert toast ─────────────────────────────────────────
function showAdminAlert(msg, type = 'success') {
  // Remove existing
  const old = document.getElementById('adminAlertBox');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'adminAlertBox';
  box.style.cssText = `
    position:fixed; top:80px; right:24px; z-index:9999;
    padding:14px 24px; border-radius:12px; font-size:0.92rem;
    font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,0.15);
    max-width:340px; animation:slideIn 0.3s ease;
    background:${type==='success'?'#d4edda':'#f8d7da'};
    color:${type==='success'?'#155724':'#721c24'};
    border:1px solid ${type==='success'?'#c3e6cb':'#f5c6cb'};
  `;
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => { if (box.parentNode) box.remove(); }, 4000);
}

function logout() {
  localStorage.removeItem('foodies_token');
  localStorage.removeItem('foodies_user');
  window.location.href = 'login.html';
}

// ── Panel switching ───────────────────────────────────────────
function showPanel(name, el) {
  document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.style.display = 'block';
  document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  const titleEl = document.getElementById('panelTitle');
  if (titleEl) titleEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);

  if (name === 'dashboard') { loadDashboard(); loadRevenueChart(7); }
  if (name === 'orders')    loadAdminOrders();
  if (name === 'menu')      loadAdminMenu();
  if (name === 'users')     loadAdminUsers();
  if (name === 'contacts')  loadContacts();
  if (name === 'promos')    loadPromos();
  if (name === 'reviews')   loadReviews();
}

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/admin/dashboard');
    if (!data.success) throw new Error(data.message);
    const s = data.stats;

    document.getElementById('stat-orders').textContent  = s.totalOrders.toLocaleString();
    document.getElementById('stat-revenue').textContent = `₹${s.totalRevenue.toLocaleString()}`;
    document.getElementById('stat-users').textContent   = s.totalUsers.toLocaleString();
    document.getElementById('stat-pending').textContent = s.pendingOrders;
    const badge = document.getElementById('pendingBadge');
    if (badge) badge.textContent = s.pendingOrders;

    let rows = '';
    data.recentOrders.forEach(o => {
      const date = new Date(o.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      rows += `<tr>
        <td><strong>#${o._id.slice(-8).toUpperCase()}</strong></td>
        <td>${o.user?.name || 'Guest'}</td>
        <td>₹${o.total.toFixed(2)}</td>
        <td><span class="badge-status badge-${o.status}">${o.status.replace('_',' ')}</span></td>
        <td>${date}</td>
      </tr>`;
    });
    const tbody = document.getElementById('recentOrdersBody');
    if (tbody) tbody.innerHTML = rows || '<tr><td colspan="5" class="text-center py-3">No recent orders</td></tr>';
  } catch (err) {
    console.error('Dashboard:', err.message);
    ['stat-orders','stat-revenue','stat-users','stat-pending'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'N/A';
    });
  }
}

// ── Admin Orders ──────────────────────────────────────────────
async function loadAdminOrders() {
  const statusFilter = document.getElementById('orderStatusFilter');
  const status       = statusFilter ? statusFilter.value : '';
  const tbody        = document.getElementById('allOrdersBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Loading...</td></tr>';

  try {
    const data = await apiFetch(`/api/orders${status ? '?status=' + status : ''}`);
    if (!data.success) throw new Error(data.message);

    let rows = '';
    data.orders.forEach(o => {
      const items = o.items.map(i => `${i.name}×${i.qty}`).join(', ');
      rows += `<tr>
        <td><strong>#${o._id.slice(-8).toUpperCase()}</strong></td>
        <td>${o.user?.name || 'Guest'}<br><small style="color:#999">${o.user?.email || ''}</small></td>
        <td style="max-width:160px;white-space:normal;font-size:0.8rem;">${items}</td>
        <td><strong>₹${o.total.toFixed(2)}</strong></td>
        <td><span class="badge-status badge-${o.paymentStatus}">${o.paymentStatus}</span></td>
        <td>
          <select class="status-select" onchange="updateOrderStatus('${o._id}', this.value)">
            ${['placed','confirmed','preparing','out_for_delivery','delivered','cancelled'].map(s =>
              `<option value="${s}" ${o.status===s?'selected':''}>${s.replace('_',' ')}</option>`
            ).join('')}
          </select>
        </td>
        <td><button class="tbl-btn tbl-btn-primary" onclick="viewAdminOrder('${o._id}')">View</button></td>
      </tr>`;
    });
    if (tbody) tbody.innerHTML = rows || '<tr><td colspan="7" class="text-center py-4">No orders</td></tr>';
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">${err.message}</td></tr>`;
  }
}

// ── View Order Detail (Admin) ─────────────────────────────────
async function viewAdminOrder(orderId) {
  try {
    const data = await apiFetch(`/api/orders/${orderId}`);
    if (!data.success) throw new Error(data.message);
    const o = data.order;
    const itemsHtml = o.items.map(i => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:0.88rem;">
        <span>${i.name} × ${i.qty}</span>
        <strong>₹${(i.price * i.qty).toFixed(2)}</strong>
      </div>`).join('');

    const modal = document.getElementById('orderDetailModal');
    const body  = document.getElementById('orderDetailBody');
    if (!modal || !body) {
      // Fallback if modal not present
      showAdminAlert(`Order #${orderId.slice(-8).toUpperCase()} — Total: ₹${o.total}`, 'success');
      return;
    }
    body.innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <h6 style="font-weight:700;margin-bottom:10px;color:#c0392b;">📋 Order Items</h6>
          ${itemsHtml}
          <div style="margin-top:12px;font-size:0.85rem;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Subtotal</span><span>₹${o.subtotal?.toFixed(2)||0}</span></div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Delivery</span><span>₹${o.deliveryCharge?.toFixed(2)||0}</span></div>
            ${o.discount>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;color:#16a085;"><span>Discount</span><span>-₹${o.discount.toFixed(2)}</span></div>`:''}
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #eee;margin-top:4px;font-weight:800;font-size:0.95rem;"><span>Total</span><span>₹${o.total.toFixed(2)}</span></div>
          </div>
        </div>
        <div class="col-md-6">
          <h6 style="font-weight:700;margin-bottom:10px;color:#c0392b;">📍 Delivery Address</h6>
          <p style="font-size:0.87rem;color:#555;line-height:1.8;margin-bottom:14px;">
            <strong>${o.deliveryAddress?.name||''}</strong><br>
            ${o.deliveryAddress?.street||''}, ${o.deliveryAddress?.city||''}<br>
            ${o.deliveryAddress?.state||''} — ${o.deliveryAddress?.pincode||''}<br>
            📞 ${o.deliveryAddress?.phone||''}
          </p>
          <h6 style="font-weight:700;margin-bottom:8px;color:#c0392b;">💳 Payment</h6>
          <p style="font-size:0.87rem;color:#555;">
            Method: <strong>${o.paymentMethod==='razorpay'?'Online (Razorpay)':'Cash on Delivery'}</strong><br>
            Status: <span style="font-weight:800;color:${o.paymentStatus==='paid'?'#16a085':'#856404'};">${o.paymentStatus?.toUpperCase()}</span><br>
            Order Status: <span class="badge-status badge-${o.status}" style="display:inline-block;margin-top:4px;">${o.status?.replace('_',' ').toUpperCase()}</span>
          </p>
          <h6 style="font-weight:700;margin:12px 0 6px;color:#c0392b;">📅 Timeline</h6>
          <p style="font-size:0.82rem;color:#888;">
            Placed: ${new Date(o.createdAt).toLocaleString('en-IN')}<br>
            ${o.estimatedDelivery?'ETA: '+new Date(o.estimatedDelivery).toLocaleString('en-IN'):''}
          </p>
        </div>
      </div>`;
    new bootstrap.Modal(modal).show();
  } catch (err) {
    showAdminAlert('❌ Failed to load order: ' + err.message, 'error');
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const data = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PUT', body: JSON.stringify({ status })
    });
    if (!data.success) throw new Error(data.message);
    showAdminAlert(`✅ Order status updated to "${status.replace('_',' ')}"`, 'success');
  } catch (err) {
    showAdminAlert('❌ Update failed: ' + err.message, 'error');
    loadAdminOrders();
  }
}

// ── Admin Menu ────────────────────────────────────────────────
async function loadAdminMenu() {
  const tbody = document.getElementById('menuTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';
  try {
    const data = await apiFetch('/api/menu');
    if (!data.success) throw new Error(data.message);

    let rows = '';
    data.items.forEach(item => {
      rows += `<tr>
        <td><img src="${item.image}" class="table-img" alt="${item.name}" onerror="this.src='img/img/type1.jpg'"></td>
        <td><strong>${item.name}</strong>${item.badge ? `<br><small style="color:var(--primary)">${item.badge}</small>` : ''}</td>
        <td>${item.category}</td>
        <td><strong>₹${item.price}</strong>${item.originalPrice ? `<br><small style="text-decoration:line-through;color:#999">₹${item.originalPrice}</small>` : ''}</td>
        <td><span class="badge-status ${item.isAvailable?'badge-active':'badge-inactive'}">${item.isAvailable?'Yes':'No'}</span></td>
        <td>
          <button class="tbl-btn tbl-btn-primary me-1" onclick="editMenuItem('${item._id}')">Edit</button>
          <button class="tbl-btn tbl-btn-danger" onclick="deleteMenuItem('${item._id}','${item.name.replace(/'/g,'\\\'').replace(/"/g,'&quot;')}')">Delete</button>
        </td>
      </tr>`;
    });
    if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="text-center py-4">No items</td></tr>';
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${err.message}</td></tr>`;
  }
}

function openMenuModal() {
  // Always reset form completely before opening for new item
  const form = document.getElementById('menuForm');
  if (form) form.reset();
  document.getElementById('menuItemId').value        = '';
  document.getElementById('mRating').value           = '4.5';
  document.getElementById('mServes').value           = '1';
  document.getElementById('mPrepTime').value         = '15 min';
  document.getElementById('mAvailable').value        = 'true';
  document.getElementById('mFeatured').value         = 'false';
  document.getElementById('mImage').value            = 'img/img/type1.jpg';
  document.getElementById('menuModalTitle').textContent  = 'Add New Menu Item';
  document.getElementById('menuSaveBtnText').textContent = 'Save Item';
  new bootstrap.Modal(document.getElementById('menuModal')).show();
}

async function editMenuItem(id) {
  try {
    const data = await apiFetch(`/api/menu/${id}`);
    if (!data.success) throw new Error(data.message);
    const item = data.item;
    document.getElementById('menuItemId').value  = id;
    document.getElementById('mName').value       = item.name;
    document.getElementById('mCategory').value   = item.category;
    document.getElementById('mDesc').value       = item.description;
    document.getElementById('mPrice').value      = item.price;
    document.getElementById('mOrigPrice').value  = item.originalPrice || '';
    document.getElementById('mPrepTime').value   = item.prepTime || '';
    document.getElementById('mBadge').value      = item.badge || '';
    document.getElementById('mRating').value     = item.rating;
    document.getElementById('mServes').value     = item.serves;
    document.getElementById('mImage').value      = item.image || '';
    document.getElementById('mAvailable').value  = item.isAvailable.toString();
    document.getElementById('mFeatured').value   = item.isFeatured.toString();
    document.getElementById('menuModalTitle').textContent  = 'Edit Menu Item';
    document.getElementById('menuSaveBtnText').textContent = 'Update Item';
    new bootstrap.Modal(document.getElementById('menuModal')).show();
  } catch (err) {
    alert('Load failed: ' + err.message);
  }
}

async function saveMenuItem() {
  const nameVal  = document.getElementById('mName').value.trim();
  const catVal   = document.getElementById('mCategory').value;
  const descVal  = document.getElementById('mDesc').value.trim();
  const priceVal = parseFloat(document.getElementById('mPrice').value);

  // Clear validation
  if (!nameVal)           { alert('❌ Item Name is required');    return; }
  if (!catVal)            { alert('❌ Category is required');     return; }
  if (!descVal)           { alert('❌ Description is required');  return; }
  if (!priceVal || priceVal <= 0) { alert('❌ Valid Price is required'); return; }

  const payload = {
    name:          nameVal,
    category:      catVal,
    description:   descVal,
    price:         priceVal,
    originalPrice: parseFloat(document.getElementById('mOrigPrice').value) || undefined,
    prepTime:      document.getElementById('mPrepTime').value.trim()  || '15 min',
    badge:         document.getElementById('mBadge').value.trim()     || undefined,
    rating:        parseFloat(document.getElementById('mRating').value)  || 4.5,
    serves:        parseInt(document.getElementById('mServes').value)    || 1,
    image:         document.getElementById('mImage').value.trim()     || 'img/img/type1.jpg',
    isAvailable:   document.getElementById('mAvailable').value === 'true',
    isFeatured:    document.getElementById('mFeatured').value  === 'true'
  };

  const id     = document.getElementById('menuItemId').value.trim();
  const apiUrl = id ? `/api/menu/${id}` : '/api/menu';
  const method = id ? 'PUT' : 'POST';

  // Disable button during save
  const saveBtn = document.getElementById('menuSaveBtnText');
  const origText = saveBtn.textContent;
  saveBtn.textContent = 'Saving...';

  try {
    const data = await apiFetch(apiUrl, { method, body: JSON.stringify(payload) });
    if (!data.success) throw new Error(data.message);

    // Close modal — try both ways Bootstrap 5 supports
    const modalEl = document.getElementById('menuModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modalInstance.hide();

    // Wait for modal animation then reload table
    setTimeout(async () => {
      await loadAdminMenu();
    }, 300);

    // Show success toast/alert
    const action = id ? 'updated' : 'added';
    showAdminAlert(`✅ "${payload.name}" ${action} successfully!`, 'success');

  } catch (err) {
    showAdminAlert('❌ ' + err.message, 'error');
  } finally {
    saveBtn.textContent = origText;
  }
}

async function deleteMenuItem(id, name) {
  if (!confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;
  try {
    const data = await apiFetch(`/api/menu/${id}`, { method: 'DELETE' });
    if (!data.success) throw new Error(data.message);
    await loadAdminMenu();
    showAdminAlert(`🗑️ "${name}" deleted successfully!`, 'success');
  } catch (err) {
    showAdminAlert('❌ Delete failed: ' + err.message, 'error');
  }
}

// ── Admin Users ───────────────────────────────────────────────
async function loadAdminUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';
  try {
    const data = await apiFetch('/api/admin/users');
    if (!data.success) throw new Error(data.message);

    let rows = '';
    data.users.forEach(u => {
      const joined = new Date(u.createdAt).toLocaleDateString('en-IN');
      rows += `<tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${u.phone || '—'}</td>
        <td>${joined}</td>
        <td><span class="badge-status ${u.isActive?'badge-active':'badge-inactive'}">${u.isActive?'Active':'Inactive'}</span></td>
        <td>
          <button class="tbl-btn ${u.isActive?'tbl-btn-warning':'tbl-btn-success'}" onclick="toggleUser('${u._id}')">
            ${u.isActive?'Deactivate':'Activate'}
          </button>
        </td>
      </tr>`;
    });
    if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="text-center py-4">No users found</td></tr>';
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${err.message}</td></tr>`;
  }
}

async function toggleUser(id) {
  try {
    const data = await apiFetch(`/api/admin/users/${id}/toggle`, { method: 'PUT' });
    if (!data.success) throw new Error(data.message);
    loadAdminUsers();
  } catch (err) {
    alert('Action failed: ' + err.message);
  }
}

// Init
loadDashboard();
loadRevenueChart(7);

// ── Contacts / Queries ────────────────────────────────────────
let currentReplyId = '';

async function loadContacts() {
  const container = document.getElementById('contactsList');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-4" style="color:#999;">Loading...</div>';
  try {
    const data = await apiFetch('/api/admin/contacts');
    if (!data.success) throw new Error(data.message);

    // Update unread badge
    const unread = data.contacts.filter(c => !c.isRead).length;
    const badge  = document.getElementById('unreadBadge');
    if (badge) badge.textContent = unread;

    if (!data.contacts.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#999;">
          <i class="bi bi-chat-square-dots" style="font-size:3rem;display:block;margin-bottom:12px;"></i>
          <h5>No queries yet</h5>
          <p>User messages will appear here.</p>
        </div>`;
      return;
    }

    let html = '';
    data.contacts.forEach(c => {
      const date    = new Date(c.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
      const isUnread = !c.isRead;
      const hasReply = !!c.reply;
      html += `
        <div style="padding:20px 24px;border-bottom:1px solid #e8e0d8;background:${isUnread ? '#fffbf0' : '#fff'};transition:background 0.3s;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                ${isUnread ? '<span style="background:#c0392b;color:white;font-size:0.68rem;font-weight:700;padding:2px 10px;border-radius:50px;">NEW</span>' : ''}
                <strong style="font-size:0.97rem;">${c.name}</strong>
                <span style="color:#999;font-size:0.82rem;">${c.email}</span>
                ${c.phone ? `<span style="color:#999;font-size:0.82rem;">📞 ${c.phone}</span>` : ''}
              </div>
              <div style="margin-top:4px;">
                <span style="background:#e2d9f3;color:#6f42c1;font-size:0.75rem;font-weight:700;padding:2px 10px;border-radius:50px;">${c.subject}</span>
                <span style="color:#aaa;font-size:0.78rem;margin-left:8px;">${date}</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${!hasReply ? `<button class="tbl-btn tbl-btn-primary" onclick="openReplyModal('${c._id}','${c.name.replace(/'/g,"\\'")}','${c.subject}','${c.message.replace(/'/g,"\\'").replace(/\n/g,' ')}')">Reply</button>` : '<span style="color:#16a085;font-size:0.8rem;font-weight:700;">✅ Replied</span>'}
              ${isUnread ? `<button class="tbl-btn" style="border-color:#999;color:#999;" onclick="markRead('${c._id}')">Mark Read</button>` : ''}
              <button class="tbl-btn tbl-btn-danger" onclick="deleteContact('${c._id}')">Delete</button>
            </div>
          </div>
          <p style="font-size:0.9rem;color:#555;line-height:1.6;background:#f8f5f0;padding:12px 14px;border-radius:10px;margin:0;">${c.message}</p>
          ${hasReply ? `
          <div style="margin-top:10px;padding:10px 14px;background:#d4edda;border-radius:10px;border-left:3px solid #16a085;">
            <strong style="font-size:0.78rem;color:#155724;">ADMIN REPLY</strong>
            <p style="font-size:0.88rem;color:#155724;margin:4px 0 0;">${c.reply}</p>
            <small style="color:#20c997;">${c.repliedAt ? new Date(c.repliedAt).toLocaleString('en-IN') : ''}</small>
          </div>` : ''}
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="text-center py-4" style="color:red;">${err.message}</div>`;
  }
}

function openReplyModal(id, name, subject, message) {
  currentReplyId = id;
  document.getElementById('replyQueryInfo').innerHTML = `
    <strong>${name}</strong> — ${subject}<br>
    <span style="color:#666;font-size:0.85rem;">"${message.substring(0, 120)}${message.length > 120 ? '...' : ''}"</span>`;
  document.getElementById('replyText').value = '';
  new bootstrap.Modal(document.getElementById('replyModal')).show();
  // Mark as read when opened
  markRead(id, false);
}

async function submitReply() {
  const reply = document.getElementById('replyText').value.trim();
  if (!reply) { alert('Please enter a reply.'); return; }
  try {
    const data = await apiFetch(`/api/admin/contacts/${currentReplyId}/reply`, {
      method: 'PUT', body: JSON.stringify({ reply })
    });
    if (!data.success) throw new Error(data.message);
    bootstrap.Modal.getInstance(document.getElementById('replyModal')).hide();
    showAdminAlert('✅ Reply saved successfully!', 'success');
    loadContacts();
  } catch (err) {
    showAdminAlert('❌ ' + err.message, 'error');
  }
}

async function markRead(id, reload = true) {
  try {
    await apiFetch(`/api/admin/contacts/${id}/read`, { method: 'PUT' });
    if (reload) loadContacts();
  } catch (_) {}
}

async function deleteContact(id) {
  if (!confirm('Delete this query? This cannot be undone.')) return;
  try {
    const data = await apiFetch(`/api/admin/contacts/${id}`, { method: 'DELETE' });
    if (!data.success) throw new Error(data.message);
    loadContacts();
  } catch (err) {
    showAdminAlert('❌ ' + err.message, 'error');
  }
}

// ── Promo Codes ───────────────────────────────────────────────
async function loadPromos() {
  const tbody = document.getElementById('promosTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';
  try {
    const data = await apiFetch('/api/promos');
    if (!data.success) throw new Error(data.message);
    if (!data.promos.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No promo codes yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.promos.map(p => `
      <tr>
        <td><strong style="font-size:1rem;letter-spacing:1px;">${p.code}</strong></td>
        <td>${p.type === 'percent' ? p.value + '%' : '₹' + p.value}</td>
        <td><span class="badge-status ${p.type==='percent'?'badge-confirmed':'badge-placed'}">${p.type}</span></td>
        <td>${p.minOrder > 0 ? '₹' + p.minOrder : 'No minimum'}</td>
        <td><span class="badge-status ${p.isActive?'badge-active':'badge-inactive'}">${p.isActive?'Active':'Inactive'}</span></td>
        <td>
          <button class="tbl-btn ${p.isActive?'tbl-btn-warning':'tbl-btn-success'} me-1" onclick="togglePromo('${p._id}')">
            ${p.isActive?'Disable':'Enable'}
          </button>
          <button class="tbl-btn tbl-btn-danger" onclick="deletePromo('${p._id}','${p.code}')">Delete</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${err.message}</td></tr>`;
  }
}

function openPromoModal() {
  // Reset form
  ['promoCode','promoValue','promoMinOrder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const typeEl = document.getElementById('promoType');
  if (typeEl) typeEl.value = 'percent';
  new bootstrap.Modal(document.getElementById('promoModal')).show();
}

async function savePromo() {
  const code     = document.getElementById('promoCode')?.value.trim().toUpperCase();
  const type     = document.getElementById('promoType')?.value;
  const value    = parseFloat(document.getElementById('promoValue')?.value);
  const minOrder = parseFloat(document.getElementById('promoMinOrder')?.value || '0');

  if (!code)              { showAdminAlert('❌ Promo code is required', 'error'); return; }
  if (!type)              { showAdminAlert('❌ Select a discount type', 'error'); return; }
  if (!value || value<=0) { showAdminAlert('❌ Enter a valid discount value', 'error'); return; }

  try {
    const d = await apiFetch('/api/admin/promos', {
      method: 'POST',
      body: JSON.stringify({ code, type, value, minOrder })
    });
    if (!d.success) throw new Error(d.message);
    bootstrap.Modal.getInstance(document.getElementById('promoModal'))?.hide();
    showAdminAlert(`✅ Promo "${code}" created!`, 'success');
    loadPromos();
  } catch (e) {
    showAdminAlert('❌ ' + e.message, 'error');
  }
}

async function togglePromo(id) {
  try {
    const d = await apiFetch(`/api/admin/promos/${id}/toggle`, { method:'PUT' });
    if (!d.success) throw new Error(d.message);
    loadPromos();
  } catch (e) { showAdminAlert('❌ ' + e.message, 'error'); }
}

async function deletePromo(id, code) {
  if (!confirm(`Delete promo "${code}"?`)) return;
  try {
    const d = await apiFetch(`/api/admin/promos/${id}`, { method:'DELETE' });
    if (!d.success) throw new Error(d.message);
    showAdminAlert(`🗑️ Promo "${code}" deleted`, 'success');
    loadPromos();
  } catch (e) { showAdminAlert('❌ ' + e.message, 'error'); }
}

// ── Reviews ───────────────────────────────────────────────────
async function loadReviews() {
  const container = document.getElementById('reviewsList');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-4" style="color:#999;">Loading...</div>';
  try {
    const data = await apiFetch('/api/admin/reviews');
    if (!data.success) throw new Error(data.message);
    if (!data.reviews.length) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#aaa;"><i class="bi bi-star" style="font-size:3rem;display:block;margin-bottom:12px;"></i><h5>No reviews yet</h5></div>';
      return;
    }
    const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5-Math.round(n));
    container.innerHTML = data.reviews.map(r => `
      <div style="padding:18px 24px;border-bottom:1px solid #e8e0d8;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;">
            <strong style="font-size:0.95rem;">${r.userName}</strong>
            <span style="color:#f39c12;font-size:1rem;">${stars(r.rating)}</span>
            <span style="background:#fff8e1;color:#856404;font-size:0.72rem;font-weight:700;padding:2px 10px;border-radius:50px;">${r.rating}/5</span>
            <span style="color:#aaa;font-size:0.77rem;">${new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
          </div>
          <p style="font-size:0.88rem;color:#555;margin:0 0 4px;">${r.comment || '<em style="color:#bbb">No comment</em>'}</p>
          <small style="color:#aaa;font-size:0.75rem;">Item: ${r.itemName || r.itemId}</small>
        </div>
        <button class="tbl-btn tbl-btn-danger" onclick="deleteReview('${r._id}')">Delete</button>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<div class="text-center py-4" style="color:red;">${err.message}</div>`;
  }
}

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  try {
    const d = await apiFetch(`/api/admin/reviews/${id}`, { method:'DELETE' });
    if (!d.success) throw new Error(d.message);
    loadReviews();
  } catch (e) { showAdminAlert('❌ ' + e.message, 'error'); }
}


// ── Revenue Chart ─────────────────────────────────────────────
let revenueChartInstance = null;

async function loadRevenueChart(days = 7) {
  // Update active button state
  [7, 14, 30].forEach(d => {
    const btn = document.getElementById(`rev${d}btn`);
    if (btn) btn.classList.toggle('active-range', d === days);
  });

  const canvas = document.getElementById('revenueChart');
  const msg    = document.getElementById('revenueChartMsg');
  if (!canvas) return;

  try {
    const data = await apiFetch(`/api/admin/revenue?days=${days}`);
    if (!data.success) throw new Error(data.message);

    if (!data.revenue || data.revenue.length === 0) {
      canvas.style.display = 'none';
      if (msg) msg.style.display = 'block';
      return;
    }

    canvas.style.display = 'block';
    if (msg) msg.style.display = 'none';

    const labels   = data.revenue.map(r => {
      const d = new Date(r._id);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    });
    const revenues = data.revenue.map(r => r.total);
    const counts   = data.revenue.map(r => r.count);

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#aaa' : '#666';

    if (revenueChartInstance) {
      revenueChartInstance.destroy();
      revenueChartInstance = null;
    }

    revenueChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue (₹)',
            data: revenues,
            backgroundColor: 'rgba(192,57,43,0.18)',
            borderColor: '#c0392b',
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
            yAxisID: 'y',
          },
          {
            label: 'Orders',
            data: counts,
            type: 'line',
            borderColor: '#16a085',
            backgroundColor: 'rgba(22,160,133,0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#16a085',
            pointRadius: 4,
            tension: 0.4,
            fill: true,
            yAxisID: 'y1',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: textColor,
              font: { family: 'Inter', size: 12 },
              usePointStyle: true,
              pointStyleWidth: 10,
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#2a2a2a' : '#fff',
            titleColor: isDark ? '#eee' : '#0d0d0d',
            bodyColor: isDark ? '#aaa' : '#666',
            borderColor: isDark ? '#444' : '#e8e0d8',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: ctx => ctx.dataset.label === 'Revenue (₹)'
                ? ` ₹${ctx.parsed.y.toLocaleString()}`
                : ` ${ctx.parsed.y} orders`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor, font: { size: 11 },
              callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)
            },
            position: 'left',
          },
          y1: {
            grid: { drawOnChartArea: false },
            ticks: { color: '#16a085', font: { size: 11 } },
            position: 'right',
          }
        }
      }
    });
  } catch (err) {
    if (canvas) canvas.style.display = 'none';
    if (msg) { msg.style.display = 'block'; msg.textContent = 'Revenue data unavailable'; }
  }
}
