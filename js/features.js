/* ==========================================================
   FOODIES.COM — Modern Features Bundle
   Features: AI Chatbot, Push Notif, Reorder, Group Order,
             GPS Map, Referral, Flash Sale, Food Photos,
             Live Chat, Export CSV
   ========================================================== */

// ════════════════════════════════════════════════════════════
//  1. AI FOOD CHATBOT (Zomato AI inspired)
// ════════════════════════════════════════════════════════════
(function initChatbot() {
  const BOT_NAME = 'FoodieBot 🍽️';

  const KB = [
    { k: ['hello','hi','hey','helo'],        r: "Hey there! 😄 I'm FoodieBot. Ask me about our menu, offers, delivery time, or anything food-related!" },
    { k: ['menu','items','food','dish'],      r: "We have 5 categories: 🍔 Fast Food, 🥟 Snacks, 🍛 Meals, 🥤 Drinks & 🧁 Desserts. Scroll up to browse or type a dish name!" },
    { k: ['offer','discount','coupon','promo','deal'], r: "🎉 Use code <b>FOODIES25</b> for 25% off your first order! Also check <b>SAVE50</b> for ₹50 flat off on orders above ₹300." },
    { k: ['deliver','time','fast','quick','eta','minutes'], r: "⚡ We deliver in <b>20–45 minutes</b> on average. You can also schedule delivery for a specific time at checkout!" },
    { k: ['pay','payment','upi','card','cod','cash'],  r: "We accept 💳 Cards, 📱 UPI, 🏦 Net Banking, 💰 Cash on Delivery, and more via Razorpay. All payments are 100% secure." },
    { k: ['cancel','cancell'],               r: "Orders can be cancelled within 5 minutes of placing. Go to My Orders → Cancel. After that, call us at +91 7007575886." },
    { k: ['track','status','order'],         r: "Track your order in real-time on the <b>My Orders</b> page! It auto-refreshes every 30 seconds. 🔄" },
    { k: ['veg','vegetarian','vegan'],       r: "🥗 Over 40% of our menu is vegetarian/vegan friendly. Look for the 🟢 green tag on items!" },
    { k: ['points','loyalty','reward'],      r: "🏆 Earn 1 Loyalty Point for every ₹10 spent. 100 points = ₹10 off. Redeem at checkout!" },
    { k: ['refer','referral','friend'],      r: "🎁 Share your referral code from your profile and earn ₹50 credit when a friend places their first order!" },
    { k: ['group','share','friends'],        r: "👥 Use the Group Order feature! Click 'Share Cart' in your cart to let friends add items. Then checkout together!" },
    { k: ['schedule','later','time slot'],   r: "🕐 Yes! At checkout, choose 'Schedule Delivery' to pick a date & time up to 7 days ahead." },
    { k: ['pizza','burger','momos','noodles','biryani','pasta'], r: "Yummy choice! 😋 Add it from the menu section above. Click on any item card for full details." },
    { k: ['bye','goodbye','thanks','thank'], r: "Happy eating! 🍽️ Come back anytime. Use code FOODIES25 for 25% off your next order!" },
    { k: ['help','support','contact'],       r: "📞 Call us: <b>+91 7007575886</b> | ✉️ Email: <b>info@foodies.com</b> | Or visit our <a href='contact.html' style='color:#c0392b'>Contact Page</a>." },
  ];

  function getBotReply(msg) {
    const m = msg.toLowerCase();
    for (const item of KB) {
      if (item.k.some(k => m.includes(k))) return item.r;
    }
    return `Hmm, I'm not sure about that. 🤔 Try asking about our <b>menu</b>, <b>offers</b>, <b>delivery time</b>, or <b>payment methods</b>!`;
  }

  function appendMsg(html, who) {
    const box  = document.getElementById('chatMessages');
    if (!box) return;
    const wrap = document.createElement('div');
    wrap.className = `chat-msg chat-${who}`;
    wrap.innerHTML = `<div class="chat-bubble">${html}</div>`;
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
  }

  function sendChat() {
    const inp = document.getElementById('chatInput');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    appendMsg(msg, 'user');
    setTimeout(() => appendMsg(getBotReply(msg), 'bot'), 500);
  }

  window.toggleChatbot = function () {
    const box = document.getElementById('chatbotBox');
    if (!box) return;
    const isOpen = box.classList.toggle('open');
    if (isOpen && !box.dataset.greeted) {
      box.dataset.greeted = '1';
      setTimeout(() => appendMsg(`Hi! I'm <b>${BOT_NAME}</b> 👋 How can I help you today?`, 'bot'), 300);
    }
  };

  window.sendChat = sendChat;

  window.chatKeydown = function (e) {
    if (e.key === 'Enter') sendChat();
  };
})();


// ════════════════════════════════════════════════════════════
//  2. BROWSER PUSH NOTIFICATIONS
// ════════════════════════════════════════════════════════════
window.FoodieNotif = {
  _permission: 'default',

  async request() {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    this._permission = perm;
    return perm === 'granted';
  },

  send(title, body, icon) {
    if (this._permission !== 'granted') return;
    if (document.visibilityState === 'visible') return; // only when tab is in bg
    try {
      new Notification(title, {
        body,
        icon: icon || 'img/logo/logo.png',
        badge: 'img/logo/logo.png',
        tag: 'foodies-notif'
      });
    } catch (_) {}
  },

  async init() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      this._permission = 'granted';
    } else if (Notification.permission !== 'denied') {
      // Ask once, non-intrusively, after 5s
      setTimeout(() => this.request(), 5000);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('foodies_token');
  if (token) FoodieNotif.init();
});


// ════════════════════════════════════════════════════════════
//  3. REORDER LAST ORDER (1-click)
// ════════════════════════════════════════════════════════════
window.reorderLast = async function () {
  const btn = document.getElementById('reorderBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Loading...'; }

  try {
    const data = await apiFetch('/api/orders/my');
    if (!data.success || !data.orders.length) throw new Error('No previous orders found');

    const lastOrder = data.orders[0];
    let cart = JSON.parse(localStorage.getItem('foodies_cart') || '[]');

    lastOrder.items.forEach(item => {
      const existing = cart.find(c => c.name === item.name);
      if (existing) existing.qty += item.qty;
      else cart.push({ name: item.name, price: item.price, qty: item.qty });
    });

    localStorage.setItem('foodies_cart', JSON.stringify(cart));

    // Show success feedback
    const toast = document.getElementById('reorderToast');
    if (toast) {
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    // Update cart count on homepage if present
    if (typeof updateCartCount === 'function') {
      updateCartCount();
      if (typeof renderCart === 'function') renderCart();
    }
  } catch (err) {
    alert('Could not reorder: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Reorder'; }
  }
};


// ════════════════════════════════════════════════════════════
//  4. GROUP ORDER — share cart via link
// ════════════════════════════════════════════════════════════
window.GroupOrder = {
  _groupId: null,

  generate() {
    // Create a unique group session ID stored in localStorage
    const id = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this._groupId = id;
    localStorage.setItem('foodies_group_id', id);
    return id;
  },

  getShareURL() {
    const id = this._groupId || localStorage.getItem('foodies_group_id') || this.generate();
    const cart = localStorage.getItem('foodies_cart') || '[]';
    const encoded = encodeURIComponent(btoa(cart));
    return `${window.location.origin}/index.html?group=${id}&cart=${encoded}`;
  },

  async copyLink() {
    const url = this.getShareURL();
    try {
      await navigator.clipboard.writeText(url);
      FoodieToast.show('🔗 Group order link copied! Share with friends.');
    } catch (_) {
      prompt('Copy this link to share your group order:', url);
    }
  },

  joinFromURL() {
    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get('cart');
    if (!cartParam) return;
    try {
      const items = JSON.parse(atob(decodeURIComponent(cartParam)));
      const existing = JSON.parse(localStorage.getItem('foodies_cart') || '[]');
      // Merge: add items not already in cart
      items.forEach(item => {
        if (!existing.find(e => e.name === item.name)) {
          existing.push(item);
        }
      });
      localStorage.setItem('foodies_cart', JSON.stringify(existing));
      FoodieToast.show('👥 Group order cart loaded! Add your items and checkout.');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (_) {}
  }
};

// Check for group order on page load
document.addEventListener('DOMContentLoaded', () => {
  GroupOrder.joinFromURL();
});


// ════════════════════════════════════════════════════════════
//  5. FLASH SALE TIMER
// ════════════════════════════════════════════════════════════
window.FlashSale = {
  _timer: null,

  init(endTimeMs) {
    const banner = document.getElementById('flashSaleBanner');
    if (!banner) return;

    const update = () => {
      const remaining = endTimeMs - Date.now();
      if (remaining <= 0) {
        banner.style.display = 'none';
        clearInterval(this._timer);
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      const timerEl = document.getElementById('flashTimer');
      if (timerEl) timerEl.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      banner.style.display = 'flex';
    };

    update();
    this._timer = setInterval(update, 1000);
  },

  start() {
    // Flash sale runs for 4 hours from page load; stored in session
    let endTime = parseInt(sessionStorage.getItem('foodies_flash_end') || '0');
    if (!endTime || endTime < Date.now()) {
      endTime = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
      sessionStorage.setItem('foodies_flash_end', endTime);
    }
    this.init(endTime);
  }
};

document.addEventListener('DOMContentLoaded', () => FlashSale.start());


// ════════════════════════════════════════════════════════════
//  6. REFERRAL SYSTEM
// ════════════════════════════════════════════════════════════
window.ReferralSystem = {
  getCode() {
    const user = JSON.parse(localStorage.getItem('foodies_user') || 'null');
    if (!user) return null;
    // Deterministic code from user ID/email
    const base = (user._id || user.id || user.email || 'user').toString();
    return 'REF' + base.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  },

  async copyCode() {
    const code = this.getCode();
    if (!code) { alert('Please login to get your referral code'); return; }
    try {
      await navigator.clipboard.writeText(code);
      FoodieToast.show(`🎁 Referral code ${code} copied! Share it to earn ₹50 credit.`);
    } catch (_) {
      prompt('Your referral code:', code);
    }
  },

  async copyLink() {
    const code = this.getCode();
    if (!code) return;
    const url = `${window.location.origin}/register.html?ref=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      FoodieToast.show(`🔗 Referral link copied! Earn ₹50 when friend orders.`);
    } catch (_) {
      prompt('Your referral link:', url);
    }
  }
};


// ════════════════════════════════════════════════════════════
//  7. LIVE GPS DELIVERY MAP (simulated)
// ════════════════════════════════════════════════════════════
window.DeliveryMap = {
  _map: null,
  _marker: null,
  _interval: null,
  _step: 0,

  // Simulate a delivery route from restaurant to customer
  _route: [
    [26.8505, 80.9494],  // Restaurant (Lucknow)
    [26.8490, 80.9510],
    [26.8470, 80.9530],
    [26.8450, 80.9550],
    [26.8430, 80.9570],
    [26.8410, 80.9590],
    [26.8390, 80.9610],  // Customer
  ],

  open(orderId) {
    const modal = document.getElementById('deliveryMapModal');
    if (!modal) return;

    new bootstrap.Modal(modal).show();

    modal.addEventListener('shown.bs.modal', () => {
      this._initMap();
    }, { once: true });
  },

  _initMap() {
    const mapEl = document.getElementById('deliveryMapEl');
    if (!mapEl || this._map) return;

    // Use Leaflet.js (loaded lazily)
    if (typeof L === 'undefined') {
      mapEl.innerHTML = `
        <div style="text-align:center;padding:40px;color:#666;">
          <div style="font-size:3rem;margin-bottom:12px;">🗺️</div>
          <h5>Live Tracking</h5>
          <p style="font-size:0.85rem;">Your delivery partner is on the way!</p>
          <div class="map-eta-badge">
            <i class="bi bi-clock"></i> ETA: <strong id="mapEta">25 min</strong>
          </div>
          <div class="map-route-animation">
            <div class="map-bike">🚴</div>
            <div class="map-road"></div>
            <div class="map-home">🏠</div>
          </div>
        </div>`;
      this._startEtaCountdown();
      return;
    }

    const start = this._route[0];
    this._map = L.map(mapEl).setView(start, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this._map);

    const bikeIcon = L.divIcon({ html: '🚴', className: '', iconSize: [30, 30] });
    this._marker = L.marker(start, { icon: bikeIcon }).addTo(this._map);

    L.marker(this._route[this._route.length - 1]).bindPopup('📍 Your Location').addTo(this._map);

    this._step = 0;
    this._interval = setInterval(() => {
      if (this._step >= this._route.length - 1) {
        clearInterval(this._interval);
        return;
      }
      this._step++;
      const pos = this._route[this._step];
      this._marker.setLatLng(pos);
      this._map.panTo(pos);
    }, 3000);
  },

  _startEtaCountdown() {
    let eta = 25;
    const el = document.getElementById('mapEta');
    if (!el) return;
    const t = setInterval(() => {
      if (eta <= 0) { clearInterval(t); if (el) el.textContent = 'Arriving!'; return; }
      eta--;
      if (el) el.textContent = eta + ' min';
    }, 10000); // update every 10s
  },

  destroy() {
    if (this._interval) clearInterval(this._interval);
    if (this._map) { this._map.remove(); this._map = null; }
    this._step = 0;
  }
};


// ════════════════════════════════════════════════════════════
//  8. USER FOOD PHOTOS (in Item Detail Modal)
// ════════════════════════════════════════════════════════════
window.FoodPhotos = {
  _photos: {},   // itemId → [{ user, src, time }]

  get(itemId) {
    return JSON.parse(localStorage.getItem('foodies_photos_' + itemId) || '[]');
  },

  save(itemId, photos) {
    localStorage.setItem('foodies_photos_' + itemId, JSON.stringify(photos));
  },

  add(itemId, user, src) {
    const list = this.get(itemId);
    list.unshift({ user, src, time: new Date().toLocaleDateString('en-IN') });
    this.save(itemId, list.slice(0, 10)); // keep last 10
  },

  render(itemId) {
    const container = document.getElementById('itemPhotosGrid');
    if (!container) return;
    const list = this.get(itemId);
    if (!list.length) {
      container.innerHTML = `<p style="color:#aaa;font-size:0.82rem;text-align:center;padding:12px 0;">No photos yet. Be the first to add one! 📸</p>`;
      return;
    }
    container.innerHTML = list.map(p => `
      <div class="food-photo-item">
        <img src="${p.src}" alt="Food photo by ${p.user}" onerror="this.parentElement.remove()">
        <span>${p.user}</span>
      </div>`).join('');
  },

  handleUpload(e, itemId) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Only image files allowed'); return; }
    if (file.size > 3 * 1024 * 1024) { alert('Max 3MB'); return; }

    const user = JSON.parse(localStorage.getItem('foodies_user') || '{}').name || 'You';
    const reader = new FileReader();
    reader.onload = ev => {
      this.add(itemId, user, ev.target.result);
      this.render(itemId);
      e.target.value = '';
      FoodieToast.show('📸 Photo added!');
    };
    reader.readAsDataURL(file);
  }
};


// ════════════════════════════════════════════════════════════
//  9. ADMIN EXPORT ORDERS CSV
// ════════════════════════════════════════════════════════════
window.exportOrdersCSV = async function () {
  try {
    const data = await apiFetch('/api/orders');
    if (!data.success) throw new Error(data.message);

    const headers = ['Order ID', 'Customer', 'Email', 'Items', 'Total (₹)', 'Payment', 'Status', 'Date'];
    const rows = data.orders.map(o => [
      '#' + o._id.slice(-8).toUpperCase(),
      o.user?.name || 'Guest',
      o.user?.email || '',
      o.items.map(i => `${i.name}×${i.qty}`).join(' | '),
      o.total.toFixed(2),
      o.paymentMethod,
      o.status,
      new Date(o.createdAt).toLocaleDateString('en-IN')
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `foodies_orders_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    if (typeof showAdminAlert === 'function') showAdminAlert('✅ Orders exported to CSV!', 'success');
  } catch (err) {
    if (typeof showAdminAlert === 'function') showAdminAlert('❌ Export failed: ' + err.message, 'error');
    else alert('Export failed: ' + err.message);
  }
};


// ════════════════════════════════════════════════════════════
//  SHARED TOAST (used by features above)
// ════════════════════════════════════════════════════════════
window.FoodieToast = {
  show(msg, duration = 3000) {
    // Try existing toast system first
    const toastMsg = document.getElementById('toastMsg');
    const cartToast = document.getElementById('cartToast');
    if (toastMsg && cartToast && typeof bootstrap !== 'undefined') {
      toastMsg.textContent = msg;
      new bootstrap.Toast(cartToast, { delay: duration }).show();
      return;
    }
    // Fallback floating toast
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:#0d0d0d;color:#fff;padding:12px 24px;border-radius:50px;font-size:0.88rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.25);animation:slideUp 0.3s ease;white-space:nowrap;';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }
};
