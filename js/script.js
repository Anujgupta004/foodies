/* =========================================
   FOODIES.COM — Modern Script
   ========================================= */

// ===== PRELOADER =====
window.addEventListener('load', () => {
  const preloader = document.getElementById('preloader');
  setTimeout(() => {
    preloader.classList.add('hidden');
    // Start AOS after preloader hides
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80
    });
  }, 1200);
});

// ===== NAVBAR SCROLL =====
const mainNav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    mainNav.classList.add('scrolled');
  } else {
    mainNav.classList.remove('scrolled');
  }

  // Back to top button
  const btn = document.getElementById('backToTop');
  if (window.scrollY > 400) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
});

// ===== SMOOTH SCROLL FOR NAV LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      // Close mobile menu if open
      const collapse = document.getElementById('navbarNav');
      if (collapse.classList.contains('show')) {
        new bootstrap.Collapse(collapse).hide();
      }
    }
  });
});

// ===== ACTIVE NAV LINK ON SCROLL =====
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
  const scrollPos = window.scrollY + 100;
  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const navLink = document.querySelector(`.nav-link[href="#${id}"]`);
    if (navLink) {
      if (scrollPos >= top && scrollPos < top + height) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        navLink.classList.add('active');
      }
    }
  });
});

// ===== LOAD MENU FROM API =====
let allMenuItems = [];
let currentMenuFilter = 'all';

async function loadMenuFromAPI() {
  try {
    const res  = await fetch('/api/menu');
    const data = await res.json();
    if (!data.success) throw new Error('Failed');
    allMenuItems = data.items;
    // Build lookup map for safe modal open
    if (!window._menuItemMap) window._menuItemMap = {};
    allMenuItems.forEach(item => { window._menuItemMap[item._id] = item; });
    renderMenuCards(allMenuItems);
    renderTrending(allMenuItems);
  } catch (e) {
    const loader = document.getElementById('menuLoader');
    if (loader) loader.style.display = 'none';
  }
}

function renderMenuCards(items) {
  const grid   = document.getElementById('menuGrid');
  const loader = document.getElementById('menuLoader');
  if (!grid) return;
  if (loader) loader.style.display = 'none';

  if (!items.length) {
    grid.innerHTML = '<div class="col-12 text-center py-5"><p style="color:#999;">No items found in this category.</p></div>';
    return;
  }

  const badgeColors = { Popular:'#c0392b', New:'#16a085', "Chef's Pick":'#8e44ad', Healthy:'#27ae60', Fresh:'#27ae60', 'Best Value':'#e67e22', 'Non-Veg':'#c0392b', Sweet:'#e74c3c', Trending:'#8e44ad' };

  let html = '';
  items.forEach((item, i) => {
    const delay    = (i % 3) * 100;
    const badgeHtml = item.badge
      ? `<div class="menu-badge" style="background:${badgeColors[item.badge]||'#c0392b'}">${item.badge}</div>`
      : '';
    const oldPrice = item.originalPrice
      ? `<span class="price-old">₹${item.originalPrice}</span>`
      : '';

    html += `
      <div class="col-12 col-sm-6 col-lg-4 menu-item" data-category="${item.category}" data-aos="fade-up" data-aos-delay="${delay}">
        <div class="menu-card" onclick="openItemDetailById('${item._id}')" style="cursor:pointer;">
          <div class="menu-card-img">
            <img src="${item.image}" alt="${item.name}" onerror="this.src='img/img/type1.jpg'" loading="lazy">
            ${badgeHtml}
            <button class="wishlist-btn" onclick="toggleWishlist(event,'${item._id}','${item.name.replace(/'/g,"\\'")}',${item.price},'${item.image}','${item.category}')" title="Add to Wishlist">
              <i class="bi bi-heart${isInWishlist(item._id) ? '-fill' : ''}" style="color:${isInWishlist(item._id)?'#e74c3c':'white'}"></i>
            </button>
            <div class="menu-overlay">
              <button class="quick-add" onclick="event.stopPropagation();addToCart('${item.name.replace(/'/g,"\\'")}', ${item.price})">
                <i class="bi bi-plus-lg"></i> Quick Add
              </button>
            </div>
          </div>
          <div class="menu-card-body">
            <div class="menu-card-top">
              <h5>${item.name}</h5>
              <div class="menu-rating"><i class="bi bi-star-fill"></i> ${item.rating}</div>
            </div>
            <p>${item.description}</p>
            <div class="menu-card-footer">
              <div class="menu-price">
                <span class="price-current">₹${item.price}</span>
                ${oldPrice}
              </div>
              <div class="menu-meta">
                <span><i class="bi bi-clock"></i> ${item.prepTime}</span>
                <span><i class="bi bi-person"></i> ${item.serves}</span>
              </div>
            </div>
            <button class="btn-add-cart w-100" onclick="event.stopPropagation();addToCart('${item.name.replace(/'/g,"\\'")}', ${item.price})">
              <i class="bi bi-bag-plus"></i> Add to Cart
            </button>
          </div>
        </div>
      </div>`;
  });

  grid.innerHTML = html;

  // Re-init AOS for new elements
  if (typeof AOS !== 'undefined') AOS.refresh();
}

function loadAllMenuItems() {
  renderMenuCards(allMenuItems);
}

// ===== MENU FILTER — works with dynamic API items =====
const filterBtns = document.querySelectorAll('.filter-btn');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMenuFilter = btn.getAttribute('data-filter');

    if (allMenuItems.length > 0) {
      // Dynamic: filter from API data
      const filtered = currentMenuFilter === 'all'
        ? allMenuItems
        : allMenuItems.filter(i => i.category === currentMenuFilter);
      renderMenuCards(filtered);
    } else {
      // Fallback: hide/show static items (if any)
      document.querySelectorAll('.menu-item').forEach(item => {
        const match = currentMenuFilter === 'all' || item.getAttribute('data-category') === currentMenuFilter;
        item.classList.toggle('hidden', !match);
        if (match) { item.classList.add('showing'); setTimeout(() => item.classList.remove('showing'), 400); }
      });
    }
  });
});

// ===== WISHLIST =====
function getWishlist() { return JSON.parse(localStorage.getItem('foodies_wishlist') || '[]'); }
function saveWishlist(list) { localStorage.setItem('foodies_wishlist', JSON.stringify(list)); }
function isInWishlist(id) { return getWishlist().some(i => i._id === id); }

function toggleWishlist(e, id, name, price, image, category) {
  e.stopPropagation();
  const list = getWishlist();
  const idx  = list.findIndex(i => i._id === id);
  const btn  = e.currentTarget;
  const icon = btn.querySelector('i');

  if (idx >= 0) {
    list.splice(idx, 1);
    saveWishlist(list);
    icon.className = 'bi bi-heart';
    icon.style.color = 'white';
    showToast(`💔 ${name} removed from wishlist`);
  } else {
    list.push({ _id:id, name, price, image, category });
    saveWishlist(list);
    icon.className = 'bi bi-heart-fill';
    icon.style.color = '#e74c3c';
    showToast(`❤️ ${name} added to wishlist!`);
  }
}

// ===== LOYALTY POINTS =====
function getLoyaltyPoints() { return parseInt(localStorage.getItem('foodies_points') || '0'); }
function addLoyaltyPoints(orderTotal) {
  const pts = Math.floor(orderTotal / 10); // 1 point per ₹10
  const current = getLoyaltyPoints();
  localStorage.setItem('foodies_points', current + pts);
  return pts;
}

// Show loyalty widget on homepage if user is logged in and has points
function initLoyaltyWidget() {
  const token  = localStorage.getItem('foodies_token');
  const pts    = getLoyaltyPoints();
  const widget = document.getElementById('loyaltyWidget');
  if (!widget) return;
  if (token && pts > 0) {
    document.getElementById('loyaltyPtsDisplay').textContent = pts.toLocaleString();
    document.getElementById('loyaltyValue').textContent = Math.floor(pts / 10);
    widget.style.display = 'block';
  }
}

// ===== MENU SEARCH =====
function initMenuSearch() {
  const input = document.getElementById('menuSearchInput');
  const clear = document.getElementById('menuSearchClear');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    clear.style.display = q ? 'flex' : 'none';

    if (!allMenuItems.length) return;

    const filtered = q
      ? allMenuItems.filter(item =>
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        )
      : (currentMenuFilter === 'all' ? allMenuItems : allMenuItems.filter(i => i.category === currentMenuFilter));

    if (q && !filtered.length) {
      const grid = document.getElementById('menuGrid');
      if (grid) grid.innerHTML = `
        <div class="col-12 menu-no-results">
          <i class="bi bi-search"></i>
          <h5>No results for "${q}"</h5>
          <p style="color:#aaa;font-size:0.88rem;">Try a different name or category</p>
        </div>`;
    } else {
      renderMenuCards(filtered);
    }
    // Reset filter buttons if typing
    if (q) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    }
  });
}

function clearMenuSearch() {
  const input = document.getElementById('menuSearchInput');
  const clear = document.getElementById('menuSearchClear');
  if (!input) return;
  input.value = '';
  clear.style.display = 'none';
  input.focus();
  const active = document.querySelector('.filter-btn.active') || document.querySelector('.filter-btn');
  if (active) active.click();
}

// ===== FOOD ITEM DETAIL MODAL =====
let _detailItem = null;
let _detailQty  = 1;

function openItemDetail(item) {
  _detailItem = item;
  _detailQty  = 1;

  document.getElementById('itemDetailImg').src       = item.image || 'img/img/type1.jpg';
  document.getElementById('itemDetailImg').alt       = item.name;
  document.getElementById('itemDetailName').textContent = item.name;
  document.getElementById('itemDetailCat').textContent  = item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : '';
  document.getElementById('itemDetailDesc').textContent = item.description || '';
  document.getElementById('itemDetailRating').innerHTML = `<i class="bi bi-star-fill" style="color:#f39c12;"></i> ${item.rating || '4.5'}`;
  document.getElementById('itemDetailTime').innerHTML   = `<i class="bi bi-clock"></i> ${item.prepTime || '15 min'}`;
  document.getElementById('itemDetailServes').innerHTML = `<i class="bi bi-person"></i> Serves ${item.serves || 1}`;
  document.getElementById('itemDetailPrice').textContent = `₹${item.price}`;

  const origEl = document.getElementById('itemDetailOrig');
  origEl.textContent = item.originalPrice ? `₹${item.originalPrice}` : '';

  const badgeEl = document.getElementById('itemDetailBadge');
  badgeEl.textContent = item.badge || '';
  badgeEl.style.display = item.badge ? 'inline-block' : 'none';

  document.getElementById('idqNum').textContent = '1';
  document.getElementById('itemDetailTotal').textContent = `₹${item.price}`;

  // Wishlist heart state
  const heartIcon = document.getElementById('idmHeartIcon');
  if (heartIcon) {
    heartIcon.className = isInWishlist(item._id) ? 'bi bi-heart-fill' : 'bi bi-heart';
    heartIcon.style.color = isInWishlist(item._id) ? '#e74c3c' : '';
  }

  new bootstrap.Modal(document.getElementById('itemDetailModal')).show();

  // Load food photos for this item
  if (typeof FoodPhotos !== 'undefined') {
    setTimeout(() => FoodPhotos.render(item._id), 100);
  }
}

function idqChange(delta) {
  _detailQty = Math.max(1, _detailQty + delta);
  document.getElementById('idqNum').textContent = _detailQty;
  if (_detailItem) {
    document.getElementById('itemDetailTotal').textContent = `₹${(_detailItem.price * _detailQty).toFixed(0)}`;
  }
}

function addFromDetailModal() {
  if (!_detailItem) return;
  for (let i = 0; i < _detailQty; i++) addToCart(_detailItem.name, _detailItem.price);
  const btn = document.getElementById('itemDetailAddBtn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="bi bi-check-lg"></i> Added!';
  btn.style.background = 'linear-gradient(135deg,#16a085,#1abc9c)';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.background = '';
  }, 1500);
}

// Safe ID-based lookup — avoids JSON in onclick attributes
function openItemDetailById(id) {
  const item = window._menuItemMap && window._menuItemMap[id];
  if (item) openItemDetail(item);
}

function wishFromDetailModal() {
  if (!_detailItem) return;
  const item  = _detailItem;
  const list  = getWishlist();
  const idx   = list.findIndex(i => i._id === item._id);
  const heartIcon = document.getElementById('idmHeartIcon');
  if (idx >= 0) {
    list.splice(idx, 1);
    saveWishlist(list);
    showToast(`💔 ${item.name} removed from wishlist`);
    if (heartIcon) { heartIcon.className = 'bi bi-heart'; heartIcon.style.color = ''; }
  } else {
    list.push({ _id: item._id, name: item.name, price: item.price, image: item.image, category: item.category });
    saveWishlist(list);
    showToast(`❤️ ${item.name} added to wishlist!`);
    if (heartIcon) { heartIcon.className = 'bi bi-heart-fill'; heartIcon.style.color = '#e74c3c'; }
  }
}

// ===== WHATSAPP NOTIFICATION =====
function sendWhatsAppNotification(orderDetails) {
  const phone = '917007575886'; // Restaurant WhatsApp (country code + number)
  const msg   = encodeURIComponent(
    `🍽️ New Order at FOODIES.COM!\n\n` +
    `Order ID: #${orderDetails.id}\n` +
    `Items: ${orderDetails.items}\n` +
    `Total: ₹${orderDetails.total}\n` +
    `Payment: ${orderDetails.payment}\n` +
    `Customer: ${orderDetails.customer}\n` +
    `Address: ${orderDetails.address}`
  );
  // Opens WhatsApp — restaurant gets notified
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}
// ===== CATEGORY STRIP → scroll to menu + filter =====
function scrollToMenuFilter(category) {
  const menuSection = document.getElementById('menu');
  if (!menuSection) return;
  menuSection.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => {
    const btn = document.querySelector(`.filter-btn[data-filter="${category}"]`);
    if (btn) btn.click();
  }, 700);
}
// ===== AUTH STATE IN NAVBAR =====
function updateNavAuth() {
  const user  = JSON.parse(localStorage.getItem('foodies_user') || 'null');
  const token = localStorage.getItem('foodies_token');
  const nav   = document.querySelector('.navbar-nav');
  if (!nav) return;

  // Remove old auth items
  document.querySelectorAll('.nav-auth-item').forEach(el => el.remove());

  if (token && user) {
    // Logged in — show user name + orders link
    const userItem = document.createElement('li');
    userItem.className = 'nav-item nav-auth-item';
    userItem.innerHTML = `<a class="nav-link" href="${user.role === 'admin' ? 'admin.html' : 'orders.html'}"><i class="bi bi-person-circle"></i> ${user.name.split(' ')[0]}</a>`;
    nav.appendChild(userItem);

    const logoutItem = document.createElement('li');
    logoutItem.className = 'nav-item nav-auth-item';
    logoutItem.innerHTML = `<a class="nav-link" href="#" onclick="logoutUser()"><i class="bi bi-box-arrow-right"></i> Logout</a>`;
    nav.appendChild(logoutItem);
  } else {
    // Not logged in — show login link
    const loginItem = document.createElement('li');
    loginItem.className = 'nav-item nav-auth-item';
    loginItem.innerHTML = `<a class="nav-link" href="login.html"><i class="bi bi-person"></i> Login</a>`;
    nav.appendChild(loginItem);
  }
}

function logoutUser() {
  localStorage.removeItem('foodies_token');
  localStorage.removeItem('foodies_user');
  window.location.reload();
}

// ===== CART SYSTEM — with localStorage persistence =====
let cart = JSON.parse(localStorage.getItem('foodies_cart') || '[]');

function saveCart() {
  localStorage.setItem('foodies_cart', JSON.stringify(cart));
}

function toggleCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}

function addToCart(name, price) {
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, price, qty: 1 });
  }
  saveCart();
  renderCart();
  showToast(`✅ ${name} added to cart!`);
  updateCartCount();

  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  if (!sidebar.classList.contains('open')) {
    sidebar.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const footer    = document.getElementById('cartFooter');
  const totalEl   = document.getElementById('cartTotal');

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <i class="bi bi-bag-x"></i>
        <p>Your cart is empty</p>
        <a href="#menu" onclick="toggleCart()">Browse Menu</a>
      </div>`;
    footer.style.display = 'none';
    return;
  }

  let html  = '';
  let total = 0;
  cart.forEach((item, idx) => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    html += `
      <div class="cart-item-row">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        </div>
        <div class="cart-item-price">₹${itemTotal.toFixed(2)}</div>
      </div>`;
  });

  container.innerHTML = html;
  totalEl.textContent = `₹${total.toFixed(2)}`;
  footer.style.display = 'block';
}

function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  const el = document.querySelector('.cart-count');
  if (el) el.textContent = total;
}

function checkout() {
  if (cart.length === 0) return;
  const token = localStorage.getItem('foodies_token');
  if (!token) {
    showToast('Please login to checkout!');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }
  showToast('🔒 Redirecting to checkout...');
  setTimeout(() => { window.location.href = 'checkout.html'; }, 600);
}

// Make cart nav icon clickable
document.querySelector('.nav-cart').addEventListener('click', (e) => {
  e.preventDefault();
  toggleCart();
});

// Init auth state in nav
updateNavAuth();

// Restore cart count from localStorage on page load
updateCartCount();
renderCart();

// Load menu from API
loadMenuFromAPI();

// Init search + loyalty widget after a tick
setTimeout(() => {
  initMenuSearch();
  initLoyaltyWidget();
}, 100);

// ===== TOAST =====
function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  const toast = new bootstrap.Toast(document.getElementById('cartToast'), { delay: 2500 });
  toast.show();
}

// ===== COUNTER ANIMATION =====
function animateCounter(el) {
  const target = parseInt(el.getAttribute('data-target'));
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      el.textContent = target.toLocaleString() + '+';
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

// Trigger counter when stats section is in view
const counters = document.querySelectorAll('.counter');
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
counters.forEach(c => statsObserver.observe(c));

// ===== NEWSLETTER =====
async function handleNewsletter(e) {
  e.preventDefault();
  const form  = e.target;
  const input = form.querySelector('input[type="email"]');
  const btn   = form.querySelector('button');
  const email = input.value.trim();
  if (!email) return;

  const origText = btn.innerHTML;
  btn.innerHTML  = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;"></span>';
  btn.disabled   = true;

  try {
    const res  = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    showToast(data.message || '🎉 Subscribed successfully!');
    input.value = '';
  } catch (_) {
    // Fallback if backend not running
    showToast(`🎉 Subscribed! Use code FOODIES25 for 25% off!`);
    input.value = '';
  } finally {
    btn.innerHTML = origText;
    btn.disabled  = false;
  }
}

// ===== KEYBOARD CLOSE CART =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar.classList.contains('open')) toggleCart();
  }
});

// ===== TRENDING TODAY =====
function renderTrending(items) {
  const wrap = document.getElementById('trendingScroll');
  if (!wrap || !items.length) return;

  const sorted = [...items]
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0) || b.rating - a.rating)
    .slice(0, 8);

  const fireLabels = ['🔥 #1 Today', '🔥 Top Pick', '⭐ Popular', '💫 Trending', '🌟 Fan Fav', '🍽️ Must Try', '👑 Chef Pick', '✨ New Hit'];

  wrap.innerHTML = sorted.map((item, i) => `
    <div class="trending-card" onclick="openItemDetailById('${item._id}')">
      <img src="${item.image || 'img/img/type1.jpg'}" class="trending-card-img" alt="${item.name}" onerror="this.src='img/img/type1.jpg'">
      <div class="trending-rank">${i + 1}</div>
      <div class="trending-card-body">
        <div class="trending-card-name">${item.name}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <span class="trending-card-price">₹${item.price}</span>
          <span class="trending-fire">${fireLabels[i] || '🔥 Hot'}</span>
        </div>
      </div>
    </div>`).join('');
}
