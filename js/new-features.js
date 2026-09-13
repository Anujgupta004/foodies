/* ================================================================
   FOODIES.COM — New Trending Features Bundle v2
   Features:
     1. Advanced Menu Filters (Veg/Non-Veg, Price Range, Rating)
     2. Live Reviews on Homepage (from API)
     3. Recommended For You (order history personalization)
     4. Order Status Live Toast (background polling)
     5. Recently Viewed Items
     6. Smart Cart Upsell (suggests add-ons)
   ================================================================ */

// ═══════════════════════════════════════════════════════════════
//  1. ADVANCED MENU FILTERS
//  Veg / Non-Veg / Under ₹150 / Under ₹300 / 4★+ / 4.5★+
// ═══════════════════════════════════════════════════════════════
window.AdvancedFilter = (function () {
  const VEG_ITEMS   = ['Steamed Momos', 'Wood-Fire Pizza', 'Special Veg Thali', 'Crispy Snack Platter',
                       'Iced Peach Green Tea', 'Fresh Fruit Juice', 'Hakka Noodles', 'Gulab Jamun',
                       'Choco Lava Brownie', 'Penne Arrabbiata', 'Paneer Tikka', 'Jalebi',
                       'Samosa', 'Mango Shake', 'Ras Malai', 'Khasta Kachori'];
  const NON_VEG     = ['Chicken Biryani', 'Smash Burger'];

  let activeFilters = { diet: 'all', price: 'all', rating: 'all' };

  function isVeg(item) {
    if (item.category === 'drinks' || item.category === 'desserts') return true;
    return VEG_ITEMS.some(n => item.name.toLowerCase().includes(n.toLowerCase().split(' ')[0]));
  }
  function isNonVeg(item) {
    return NON_VEG.some(n => item.name.toLowerCase().includes(n.toLowerCase().split(' ')[0]));
  }

  function apply() {
    if (!window.allMenuItems || !window.allMenuItems.length) return;
    let items = [...window.allMenuItems];

    // Category filter (from existing filter tabs)
    if (window.currentMenuFilter && window.currentMenuFilter !== 'all') {
      items = items.filter(i => i.category === window.currentMenuFilter);
    }

    // Diet filter
    if (activeFilters.diet === 'veg')    items = items.filter(i => isVeg(i) && !isNonVeg(i));
    if (activeFilters.diet === 'nonveg') items = items.filter(i => isNonVeg(i));

    // Price filter
    if (activeFilters.price === 'u150') items = items.filter(i => i.price < 150);
    if (activeFilters.price === 'u300') items = items.filter(i => i.price < 300);
    if (activeFilters.price === 'u500') items = items.filter(i => i.price < 500);

    // Rating filter
    if (activeFilters.rating === '4')   items = items.filter(i => i.rating >= 4);
    if (activeFilters.rating === '4.5') items = items.filter(i => i.rating >= 4.5);

    if (typeof renderMenuCards === 'function') renderMenuCards(items);

    // Show active count badge
    const countEl = document.getElementById('advFilterCount');
    if (countEl) {
      const active = Object.values(activeFilters).filter(v => v !== 'all').length;
      countEl.textContent = active || '';
      countEl.style.display = active ? 'flex' : 'none';
    }
  }

  function setFilter(type, val) {
    activeFilters[type] = activeFilters[type] === val ? 'all' : val;
    // Update button states
    document.querySelectorAll(`[data-adv-filter="${type}"]`).forEach(btn => {
      btn.classList.toggle('adv-active', btn.dataset.advVal === activeFilters[type]);
    });
    apply();
  }

  function reset() {
    activeFilters = { diet: 'all', price: 'all', rating: 'all' };
    document.querySelectorAll('[data-adv-filter]').forEach(btn => btn.classList.remove('adv-active'));
    apply();
    const panel = document.getElementById('advFilterPanel');
    if (panel) panel.classList.remove('open');
  }

  function toggle() {
    const panel = document.getElementById('advFilterPanel');
    if (panel) panel.classList.toggle('open');
  }

  return { setFilter, reset, toggle, apply };
})();

// Make buttons work via onclick
window.advFilter    = (type, val) => AdvancedFilter.setFilter(type, val);
window.advFilterReset = () => AdvancedFilter.reset();
window.toggleAdvFilter = () => AdvancedFilter.toggle();


// ═══════════════════════════════════════════════════════════════
//  2. LIVE REVIEWS FROM API — replaces hardcoded review section
// ═══════════════════════════════════════════════════════════════
async function loadLiveReviews() {
  const section = document.getElementById('liveReviewsGrid');
  if (!section) return;

  try {
    const res  = await fetch('/api/reviews');
    const data = await res.json();

    if (!data.success || !data.reviews || data.reviews.length < 2) {
      // Fallback — keep static
      return;
    }

    const reviews = data.reviews.slice(0, 6);
    const stars   = r => Array.from({length: 5}, (_, i) =>
      `<i class="bi bi-star${i < Math.floor(r) ? '-fill' : (i < r ? '-half' : '')}" style="color:#f39c12;font-size:0.85rem;"></i>`
    ).join('');

    const avatarColors = ['#c0392b','#8e44ad','#16a085','#d35400','#2980b9','#27ae60'];

    section.innerHTML = reviews.map((rev, i) => `
      <div class="col-md-4 col-sm-6" data-aos="fade-up" data-aos-delay="${i * 100}">
        <div class="review-card ${i === 1 ? 'featured' : ''}">
          <div class="review-stars">${stars(rev.rating)}</div>
          <p class="review-text">"${rev.comment || 'Great food! Really enjoyed it.'}"</p>
          <div class="review-author">
            <div class="review-avatar-initials" style="background:${avatarColors[i % 6]};">
              ${rev.userName ? rev.userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <strong>${rev.userName || 'Customer'}</strong>
              <span>${rev.itemName || 'Food Item'} · ${rev.rating}★</span>
            </div>
          </div>
        </div>
      </div>`).join('');

    // Update avg rating
    const avgEl = document.getElementById('reviewsAvgRating');
    if (avgEl && data.avg) avgEl.textContent = `${data.avg}★ average from ${data.count} reviews`;

  } catch (_) {
    // silently keep static reviews
  }
}


// ═══════════════════════════════════════════════════════════════
//  3. RECOMMENDED FOR YOU — personalized from order history
// ═══════════════════════════════════════════════════════════════
async function loadRecommendations() {
  const section = document.getElementById('recommendSection');
  if (!section) return;

  const token = localStorage.getItem('foodies_token');
  if (!token) { section.style.display = 'none'; return; }

  try {
    // Get past orders
    const res   = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token } });
    const data  = await res.json();
    if (!data.success || !data.orders.length) { section.style.display = 'none'; return; }

    // Count frequency of each item
    const freq = {};
    data.orders.forEach(order => {
      (order.items || []).forEach(item => {
        freq[item.name] = (freq[item.name] || 0) + (item.qty || 1);
      });
    });

    // Get top 3 ordered item names
    const topNames = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name.toLowerCase());

    if (!topNames.length || !window.allMenuItems || !window.allMenuItems.length) {
      section.style.display = 'none'; return;
    }

    // Find same-category items not recently ordered
    const orderedNames = new Set(Object.keys(freq).map(n => n.toLowerCase()));
    const topCats      = new Set();
    window.allMenuItems.forEach(item => {
      if (topNames.some(n => item.name.toLowerCase().includes(n.split(' ')[0]))) {
        topCats.add(item.category);
      }
    });

    // Recommend: same category + not already ordered, sorted by rating
    let recs = window.allMenuItems.filter(item =>
      topCats.has(item.category) &&
      !orderedNames.has(item.name.toLowerCase()) &&
      item.isAvailable !== false
    ).sort((a, b) => b.rating - a.rating).slice(0, 4);

    // If not enough, add top-rated from any category
    if (recs.length < 2) {
      recs = window.allMenuItems
        .filter(i => !orderedNames.has(i.name.toLowerCase()))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4);
    }

    if (!recs.length) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    const grid = document.getElementById('recommendGrid');
    if (!grid) return;

    grid.innerHTML = recs.map(item => `
      <div class="col-6 col-md-3">
        <div class="rec-card" onclick="openItemDetailById('${item._id}')">
          <div class="rec-card-img-wrap">
            <img src="${item.image || 'img/img/type1.jpg'}" alt="${item.name}"
                 onerror="this.src='img/img/type1.jpg'" loading="lazy">
            <span class="rec-badge">For You</span>
          </div>
          <div class="rec-card-body">
            <p class="rec-name">${item.name}</p>
            <div class="rec-meta">
              <span class="rec-price">₹${item.price}</span>
              <span class="rec-rating"><i class="bi bi-star-fill"></i> ${item.rating}</span>
            </div>
            <button class="rec-add-btn" onclick="event.stopPropagation();addToCart('${item.name.replace(/'/g,"\\'")}',${item.price})">
              <i class="bi bi-bag-plus"></i> Add
            </button>
          </div>
        </div>
      </div>`).join('');

  } catch (_) {
    section.style.display = 'none';
  }
}


// ═══════════════════════════════════════════════════════════════
//  4. ORDER STATUS LIVE TOAST (background polling)
//  Polls /api/orders/my every 45s, notifies if status changed
// ═══════════════════════════════════════════════════════════════
window.OrderStatusWatcher = (function () {
  let _timer    = null;
  let _last     = {};  // { orderId: status }
  const LABELS  = {
    placed:          '📋 Order Received',
    confirmed:       '✅ Order Confirmed!',
    preparing:       '👨‍🍳 Kitchen is cooking!',
    out_for_delivery:'🚴 Out for Delivery!',
    delivered:       '🎉 Order Delivered!'
  };

  async function poll() {
    const token = localStorage.getItem('foodies_token');
    if (!token) return;
    try {
      const res  = await fetch('/api/orders/my', { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (!data.success) return;

      const active = data.orders.filter(o => !['delivered','cancelled'].includes(o.status)).slice(0, 3);
      active.forEach(order => {
        const prev = _last[order._id];
        if (prev && prev !== order.status) {
          showStatusToast(order, LABELS[order.status] || `Status: ${order.status}`);
        }
        _last[order._id] = order.status;
      });

      // First init — populate _last without showing toast
      if (!Object.keys(_last).length) {
        active.forEach(o => { _last[o._id] = o.status; });
      }

    } catch (_) { /* silent */ }
  }

  function showStatusToast(order, msg) {
    // Remove old status toast
    document.querySelectorAll('.order-status-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'order-status-toast';
    toast.innerHTML = `
      <div class="ost-content">
        <div class="ost-icon">🍽️</div>
        <div class="ost-text">
          <strong>${msg}</strong>
          <span>Order #${order._id.slice(-6).toUpperCase()}</span>
        </div>
        <a href="orders.html" class="ost-link">Track →</a>
        <button class="ost-close" onclick="this.closest('.order-status-toast').remove()">✕</button>
      </div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 7000);

    // Also send browser notification if permission granted
    if (window.FoodieNotif) FoodieNotif.send('FOODIES.COM', msg);
  }

  function start() {
    const token = localStorage.getItem('foodies_token');
    if (!token) return;
    poll(); // immediate first poll
    _timer = setInterval(poll, 45000);
  }

  function stop() {
    if (_timer) clearInterval(_timer);
  }

  return { start, stop, poll };
})();


// ═══════════════════════════════════════════════════════════════
//  5. RECENTLY VIEWED ITEMS
// ═══════════════════════════════════════════════════════════════
window.RecentlyViewed = {
  KEY: 'foodies_recent',
  MAX: 6,

  add(item) {
    let list = this.get();
    list = list.filter(i => i._id !== item._id);
    list.unshift({ _id: item._id, name: item.name, price: item.price, image: item.image, rating: item.rating });
    localStorage.setItem(this.KEY, JSON.stringify(list.slice(0, this.MAX)));
  },

  get() {
    return JSON.parse(localStorage.getItem(this.KEY) || '[]');
  },

  render() {
    const section = document.getElementById('recentlyViewedSection');
    if (!section) return;
    const list = this.get();
    if (list.length < 2) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    const wrap = document.getElementById('recentlyViewedWrap');
    if (!wrap) return;
    wrap.innerHTML = list.map(item => `
      <div class="recent-chip" onclick="openItemDetailById('${item._id}')">
        <img src="${item.image || 'img/img/type1.jpg'}" alt="${item.name}"
             onerror="this.src='img/img/type1.jpg'" loading="lazy">
        <div class="recent-chip-info">
          <span class="recent-chip-name">${item.name}</span>
          <span class="recent-chip-price">₹${item.price}</span>
        </div>
      </div>`).join('');
  }
};

// Hook into openItemDetail to track views
const _origOpenItemDetail = window.openItemDetail;
window.openItemDetail = function (item) {
  if (item) RecentlyViewed.add(item);
  if (_origOpenItemDetail) _origOpenItemDetail(item);
};


// ═══════════════════════════════════════════════════════════════
//  6. SMART CART UPSELL
//  When user adds a meal, suggest a drink or dessert
// ═══════════════════════════════════════════════════════════════
window.CartUpsell = {
  PAIRS: {
    meals:    'drinks',
    fastfood: 'drinks',
    snacks:   'drinks',
    drinks:   'desserts',
    desserts: 'snacks'
  },
  _shown: new Set(),

  suggest(addedItemName) {
    if (!window.allMenuItems || !window.allMenuItems.length) return;
    const item = window.allMenuItems.find(i => i.name === addedItemName);
    if (!item || this._shown.has(item._id)) return;

    const suggestCat = this.PAIRS[item.category];
    if (!suggestCat) return;

    const inCart = new Set((JSON.parse(localStorage.getItem('foodies_cart') || '[]')).map(i => i.name));
    const suggest = window.allMenuItems
      .filter(i => i.category === suggestCat && !inCart.has(i.name))
      .sort((a, b) => b.rating - a.rating)[0];

    if (!suggest) return;
    this._shown.add(item._id);
    this._showBubble(suggest);
  },

  _showBubble(item) {
    document.querySelectorAll('.upsell-bubble').forEach(el => el.remove());
    const bubble = document.createElement('div');
    bubble.className = 'upsell-bubble';
    bubble.innerHTML = `
      <button class="upsell-close" onclick="this.closest('.upsell-bubble').remove()">✕</button>
      <div class="upsell-img-wrap">
        <img src="${item.image || 'img/img/type1.jpg'}" alt="${item.name}"
             onerror="this.src='img/img/type1.jpg'">
      </div>
      <div class="upsell-info">
        <p class="upsell-label">🎯 Pairs well with</p>
        <p class="upsell-name">${item.name}</p>
        <p class="upsell-price">₹${item.price}</p>
        <button class="upsell-add" onclick="addToCart('${item.name.replace(/'/g,"\\'")}',${item.price});this.closest('.upsell-bubble').remove()">
          <i class="bi bi-plus-lg"></i> Add ₹${item.price}
        </button>
      </div>`;
    document.body.appendChild(bubble);
    setTimeout(() => bubble.classList.add('show'), 50);
    setTimeout(() => { bubble.classList.remove('show'); setTimeout(() => bubble.remove(), 400); }, 6000);
  }
};

// Hook into addToCart for upsell
const _origAddToCart = window.addToCart;
window.addToCart = function (name, price) {
  if (_origAddToCart) _origAddToCart(name, price);
  setTimeout(() => CartUpsell.suggest(name), 800);
};


// ═══════════════════════════════════════════════════════════════
//  INIT — run all features on DOMContentLoaded
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Live Reviews
  loadLiveReviews();

  // Recently Viewed (render on homepage)
  if (document.getElementById('recentlyViewedSection')) {
    RecentlyViewed.render();
  }

  // Order Status Watcher — start on any page if logged in
  const token = localStorage.getItem('foodies_token');
  if (token) {
    OrderStatusWatcher.start();
  }

  // Recommendations — load after menu loaded (wait for allMenuItems)
  const waitForMenu = setInterval(() => {
    if (window.allMenuItems && window.allMenuItems.length) {
      clearInterval(waitForMenu);
      loadRecommendations();
    }
  }, 300);

  // Advanced filter — re-apply when category filter changes
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => AdvancedFilter.apply(), 50);
    });
  });
});
