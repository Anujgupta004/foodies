/* ===== ORDERS PAGE ===== */

const token = localStorage.getItem('foodies_token');
const user  = JSON.parse(localStorage.getItem('foodies_user') || 'null');
if (!token || !user) { window.location.href = 'login.html'; }

let allOrders    = [];
let currentFilter = 'all';

// ── Sidebar ───────────────────────────────────────────────────
const sidebarUser = document.getElementById('sidebarUser');
if (sidebarUser) sidebarUser.innerHTML = `<strong>${user.name}</strong>${user.email}`;

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('dashOverlay')?.classList.toggle('show');
}
function logout() {
  localStorage.removeItem('foodies_token');
  localStorage.removeItem('foodies_user');
  window.location.href = 'index.html';
}

// ── Review helpers (defined early so renderOrders can use them) ─
function hasReviewed(orderId) {
  return JSON.parse(localStorage.getItem('foodies_reviewed') || '[]').includes(orderId);
}
function markReviewed(orderId) {
  const list = JSON.parse(localStorage.getItem('foodies_reviewed') || '[]');
  if (!list.includes(orderId)) { list.push(orderId); localStorage.setItem('foodies_reviewed', JSON.stringify(list)); }
}
// Store items safely for review modal (avoid quote issues in onclick)
const _reviewCache = {};
function storeItemsForReview(orderId, items) {
  _reviewCache[orderId] = items;
}

// ── Status config ─────────────────────────────────────────────
const STATUS_STEPS  = ['placed','confirmed','preparing','out_for_delivery','delivered'];
const STATUS_LABELS = { placed:'Placed', confirmed:'Confirmed', preparing:'Preparing', out_for_delivery:'On The Way', delivered:'Delivered' };
const STATUS_ICONS  = { placed:'📋', confirmed:'✅', preparing:'👨‍🍳', out_for_delivery:'🚴', delivered:'🎉' };

// ── Load orders ───────────────────────────────────────────────
async function loadOrders() {
  const container = document.getElementById('ordersContainer');
  container.innerHTML = '<div class="dash-loader"><div class="loader-ring"></div></div>';
  try {
    const data = await apiFetch('/api/orders/my');
    if (!data.success) throw new Error(data.message);
    allOrders = data.orders;
    renderOrders(allOrders);

    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      const orderId = params.get('id');
      const banner  = document.createElement('div');
      banner.style.cssText = 'background:#d4edda;color:#155724;padding:14px 24px;border-radius:12px;margin-bottom:16px;font-weight:600;font-size:0.92rem;';
      banner.innerHTML = `🎉 Order placed! ID: <strong>#${orderId ? orderId.slice(-8).toUpperCase() : 'N/A'}</strong>`;
      container.prepend(banner);
      window.history.replaceState({}, '', 'orders.html');
    }
  } catch (err) {
    container.innerHTML = `
      <div class="orders-empty">
        <i class="bi bi-wifi-off" style="font-size:3rem;display:block;margin-bottom:14px;"></i>
        <h4>Cannot load orders</h4>
        <p>${err.message}</p>
        <a href="index.html">Go Home</a>
      </div>`;
  }
}

// ── Filter ────────────────────────────────────────────────────
function filterOrders(btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.status;
  const filtered = currentFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentFilter);
  renderOrders(filtered);
}

// ── Render order cards ────────────────────────────────────────
function renderOrders(orders) {
  const container = document.getElementById('ordersContainer');
  if (!orders.length) {
    container.innerHTML = `
      <div class="orders-empty">
        <i class="bi bi-bag-x"></i>
        <h4>No orders found</h4>
        <p>You haven't placed any orders yet.</p>
        <a href="index.html">Browse Menu →</a>
      </div>`;
    return;
  }

  let html = '';
  orders.forEach(order => {
    const date        = new Date(order.createdAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const itemsStr    = order.items.map(i => `${i.name} ×${i.qty}`).join(', ');
    const canCancel   = ['placed','confirmed'].includes(order.status);
    const isCancelled = order.status === 'cancelled';
    const isDelivered = order.status === 'delivered';
    const reviewed    = hasReviewed(order._id);

    // Cache items so openReviewModal can read them
    storeItemsForReview(order._id, order.items);

    // Order tracker
    let trackerHtml = '';
    if (!isCancelled) {
      const curIdx = STATUS_STEPS.indexOf(order.status);
      trackerHtml  = '<div class="order-tracker">';
      STATUS_STEPS.forEach((step, idx) => {
        const done   = idx < curIdx;
        const active = idx === curIdx;
        trackerHtml += `
          <div class="tracker-step">
            <div class="tracker-dot ${done?'done':''} ${active?'active':''}">
              ${done ? '<i class="bi bi-check"></i>' : STATUS_ICONS[step]}
            </div>
            <div class="tracker-label">${STATUS_LABELS[step]}</div>
          </div>`;
        if (idx < STATUS_STEPS.length - 1)
          trackerHtml += `<div class="tracker-line ${done||active?'done':''}"></div>`;
      });
      trackerHtml += '</div>';
    }

    // Review button — shown only for delivered orders
    const reviewBtn = isDelivered
      ? `<button class="btn-review${reviewed ? ' reviewed' : ''}" onclick="openReviewModal('${order._id}')">
           ${reviewed ? '✅ Reviewed' : '⭐ Write Review'}
         </button>`
      : '';

    // Live track button for active orders
    const trackBtn = (!isCancelled && !isDelivered)
      ? `<button class="btn-live-track" onclick="DeliveryMap.open('${order._id}')"><i class="bi bi-geo-alt-fill"></i> Track Live</button>`
      : '';

    html += `
      <div class="order-card">
        <div class="order-card-top">
          <div>
            <div class="order-id">Order #${order._id.slice(-8).toUpperCase()}</div>
            <div class="order-date">${date}</div>
          </div>
          <span class="order-status-badge status-${order.status}">${order.status.replace('_',' ').toUpperCase()}</span>
        </div>
        <div class="order-items-list">${itemsStr}</div>
        ${trackerHtml}
        <div class="order-card-footer">
          <div class="order-total">₹${order.total.toFixed(2)}</div>
          <div class="order-card-btns">
            <button class="btn-view-order" onclick="viewOrderDetail('${order._id}')">View Details</button>
            ${trackBtn}
            ${canCancel ? `<button class="btn-cancel-order" onclick="cancelOrder('${order._id}')">Cancel</button>` : ''}
            ${reviewBtn}
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ── View order detail ─────────────────────────────────────────
async function viewOrderDetail(orderId) {
  try {
    const data = await apiFetch(`/api/orders/${orderId}`);
    if (!data.success) throw new Error(data.message);
    const o = data.order;
    const itemsHtml = o.items.map(i => `
      <div class="detail-item-row">
        <span>${i.name} × ${i.qty}</span>
        <span>₹${(i.price * i.qty).toFixed(2)}</span>
      </div>`).join('');
    document.getElementById('orderModalBody').innerHTML = `
      <div class="row g-4">
        <div class="col-md-6">
          <h6 style="font-weight:700;margin-bottom:10px;">Order Items</h6>
          <div class="order-detail-items">${itemsHtml}</div>
          <div class="detail-totals">
            <div class="detail-total-row"><span>Subtotal</span><span>₹${o.subtotal.toFixed(2)}</span></div>
            <div class="detail-total-row"><span>Delivery</span><span>₹${o.deliveryCharge.toFixed(2)}</span></div>
            ${o.discount > 0 ? `<div class="detail-total-row" style="color:#16a085"><span>Discount</span><span>-₹${o.discount.toFixed(2)}</span></div>` : ''}
            <div class="detail-total-row grand"><span>Total Paid</span><span>₹${o.total.toFixed(2)}</span></div>
          </div>
        </div>
        <div class="col-md-6">
          <h6 style="font-weight:700;margin-bottom:10px;">Delivery Address</h6>
          <p style="font-size:0.88rem;color:#666;line-height:1.8;">
            <strong>${o.deliveryAddress.name}</strong><br>
            ${o.deliveryAddress.street}<br>
            ${o.deliveryAddress.city}, ${o.deliveryAddress.state} — ${o.deliveryAddress.pincode}<br>
            📞 ${o.deliveryAddress.phone}
          </p>
          <h6 style="font-weight:700;margin:14px 0 8px;">Payment</h6>
          <p style="font-size:0.88rem;color:#666;">
            Method: <strong>${o.paymentMethod === 'razorpay' ? 'Online (Razorpay)' : 'Cash on Delivery'}</strong><br>
            Status: <span style="font-weight:700;color:${o.paymentStatus==='paid'?'#16a085':'#856404'}">${o.paymentStatus.toUpperCase()}</span>
          </p>
          ${o.estimatedDelivery ? `
          <h6 style="font-weight:700;margin:14px 0 6px;">Estimated Delivery</h6>
          <p style="font-size:0.88rem;color:#666;">${new Date(o.estimatedDelivery).toLocaleString('en-IN')}</p>` : ''}
        </div>
      </div>`;
    new bootstrap.Modal(document.getElementById('orderModal')).show();
  } catch (err) {
    alert('Failed to load details: ' + err.message);
  }
}

// ── Cancel order ──────────────────────────────────────────────
async function cancelOrder(orderId) {
  if (!confirm('Cancel this order?')) return;
  try {
    const data = await apiFetch(`/api/orders/${orderId}/cancel`, { method:'PUT' });
    if (!data.success) throw new Error(data.message);
    loadOrders();
  } catch (err) { alert('Cancel failed: ' + err.message); }
}

// ── Init ──────────────────────────────────────────────────────
loadOrders();

// ── Auto-refresh active orders every 30 seconds ──────────────
let _refreshInterval = null;
function startAutoRefresh() {
  _refreshInterval = setInterval(async () => {
    // Only refresh if there are non-delivered/non-cancelled orders
    const hasActive = allOrders.some(o => !['delivered','cancelled'].includes(o.status));
    if (!hasActive) {
      clearInterval(_refreshInterval);
      const badge = document.getElementById('autoRefreshBadge');
      if (badge) badge.style.display = 'none';
      return;
    }
    try {
      const data = await apiFetch('/api/orders/my');
      if (!data.success) return;
      const prev = JSON.stringify(allOrders.map(o => o.status));
      const next = JSON.stringify(data.orders.map(o => o.status));
      if (prev !== next) {
        allOrders = data.orders;
        const filtered = currentFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentFilter);
        renderOrders(filtered);
        showStatusChangeToast(data.orders);
      }
    } catch (_) {}
  }, 30000);
}

function showStatusChangeToast(orders) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#d4edda;color:#155724;padding:13px 20px;border-radius:12px;font-weight:600;font-size:0.87rem;box-shadow:0 6px 20px rgba(0,0,0,0.12);border:1px solid #c3e6cb;animation:slideInRight 0.3s ease;';
  box.innerHTML = '🔄 Order status updated!';
  document.body.appendChild(box);
  setTimeout(() => { if (box.parentNode) box.remove(); }, 3000);
}

startAutoRefresh();

// =============================================
//  REVIEW SYSTEM
// =============================================
let currentRating      = 0;
let currentReviewItems = [];
let currentOrderId     = '';
const RATING_LABELS    = { 1:'😞 Poor', 2:'😐 Fair', 3:'🙂 Good', 4:'😊 Very Good', 5:'🤩 Excellent!' };

function openReviewModal(orderId) {
  currentOrderId     = orderId;
  currentReviewItems = _reviewCache[orderId] || [];
  currentRating      = 0;

  const nameEl = document.getElementById('reviewItemName');
  if (!nameEl) return;

  if (currentReviewItems.length === 1) {
    nameEl.innerHTML = `<strong>🍽️ ${currentReviewItems[0].name}</strong>`;
    document.getElementById('reviewItemId').value = 'item_' + currentReviewItems[0].name.replace(/\s+/g,'_');
  } else if (currentReviewItems.length > 1) {
    nameEl.innerHTML = `
      <label class="co-label">Select item to review</label>
      <select class="co-input mt-1" id="reviewItemSelect">
        ${currentReviewItems.map(i =>
          `<option value="item_${i.name.replace(/\s+/g,'_')}">${i.name}</option>`
        ).join('')}
      </select>`;
    document.getElementById('reviewItemId').value = 'item_' + currentReviewItems[0].name.replace(/\s+/g,'_');
    setTimeout(() => {
      const sel = document.getElementById('reviewItemSelect');
      if (sel) sel.onchange = () => { document.getElementById('reviewItemId').value = sel.value; };
    }, 100);
  } else {
    nameEl.innerHTML = '<strong>🍽️ Food Item</strong>';
    document.getElementById('reviewItemId').value = 'general';
  }

  setRating(0);
  document.getElementById('reviewComment').value  = '';
  document.getElementById('reviewAlert').style.display = 'none';
  document.getElementById('reviewBtnText').innerHTML = '<i class="bi bi-star-fill"></i> Submit Review';

  new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

function setRating(val) {
  currentRating = val;
  document.querySelectorAll('#starRating span').forEach((s, i) => {
    s.textContent = i < val ? '★' : '☆';
    s.classList.toggle('filled', i < val);
  });
  const textEl = document.getElementById('ratingText');
  if (textEl) textEl.textContent = val > 0 ? RATING_LABELS[val] : 'Click a star to rate';
}

async function submitReview() {
  if (currentRating === 0) { showReviewAlert('⚠️ Please select a star rating', 'error'); return; }
  const itemId   = document.getElementById('reviewItemId').value;
  const itemName = currentReviewItems.find(i => 'item_'+i.name.replace(/\s+/g,'_') === itemId)?.name || 'Food Item';
  const comment  = document.getElementById('reviewComment').value.trim();
  const btnText  = document.getElementById('reviewBtnText');
  btnText.textContent = 'Submitting...';
  try {
    const data = await apiFetch('/api/reviews', {
      method:'POST',
      body: JSON.stringify({ itemId, itemName, rating: currentRating, comment })
    });
    if (!data.success) throw new Error(data.message);
    markReviewed(currentOrderId);
    showReviewAlert('🎉 ' + data.message, 'success');
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('reviewModal'))?.hide();
      loadOrders();
    }, 1500);
  } catch (err) {
    showReviewAlert('❌ ' + err.message, 'error');
    btnText.innerHTML = '<i class="bi bi-star-fill"></i> Submit Review';
  }
}

function showReviewAlert(msg, type) {
  const el = document.getElementById('reviewAlert');
  if (!el) return;
  el.style.cssText = `display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:500;background:${type==='success'?'#d4edda':'#f8d7da'};color:${type==='success'?'#155724':'#721c24'};border:1px solid ${type==='success'?'#c3e6cb':'#f5c6cb'}`;
  el.textContent = msg;
}

// Star hover effects
document.addEventListener('DOMContentLoaded', () => {
  const sr = document.getElementById('starRating');
  if (!sr) return;
  sr.addEventListener('mouseover', e => {
    if (e.target.tagName === 'SPAN' && e.target.dataset.val) {
      const v = parseInt(e.target.dataset.val);
      sr.querySelectorAll('span').forEach((s,i) => { s.textContent = i < v ? '★' : '☆'; });
    }
  });
  sr.addEventListener('mouseleave', () => setRating(currentRating));
});
