/* ===== CHECKOUT PAGE ===== */

const token = localStorage.getItem('foodies_token');
const user  = JSON.parse(localStorage.getItem('foodies_user') || 'null');
if (!token || !user) { window.location.href = 'login.html'; }

let cart          = JSON.parse(localStorage.getItem('foodies_cart') || '[]');
let discount      = 0;
let loyaltyDiscount = 0;
let couponApplied = false;
let loyaltyApplied = false;

// Pre-fill name + phone from saved user
if (user) {
  const nameEl  = document.getElementById('delName');
  const phoneEl = document.getElementById('delPhone');
  if (nameEl)  nameEl.value  = user.name  || '';
  if (phoneEl) phoneEl.value = user.phone || '';
}

// ── Init Loyalty Points Display ──────────────────────────────
function initLoyaltySection() {
  const pts     = parseInt(localStorage.getItem('foodies_points') || '0');
  const card    = document.getElementById('loyaltyCard');
  if (!card) return;

  if (pts >= 100) {
    card.style.display = 'block';
    const rupeesOff = Math.floor(pts / 10);

    // Update all elements (old + new IDs both covered)
    ['coLoyaltyPts'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = pts.toLocaleString();
    });
    ['coLoyaltyVal', 'redeemAmt', 'redeemAmt2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = rupeesOff;
    });
    const ptsCountEl = document.getElementById('loyaltyPtsCount');
    if (ptsCountEl) ptsCountEl.textContent = pts.toLocaleString();
  }
}

function toggleLoyaltyRedeem() {
  const pts       = parseInt(localStorage.getItem('foodies_points') || '0');
  const checkbox  = document.getElementById('redeemPoints');
  const rowEl     = document.getElementById('loyaltyDiscountRow');
  const discEl    = document.getElementById('coLoyaltyDiscount');

  if (checkbox && checkbox.checked && pts >= 100) {
    loyaltyDiscount = Math.floor(pts / 10);
    loyaltyApplied  = true;
    if (rowEl) rowEl.style.display = 'flex';
    if (discEl) discEl.textContent = `-₹${loyaltyDiscount.toFixed(2)}`;
  } else {
    loyaltyDiscount = 0;
    loyaltyApplied  = false;
    if (rowEl) rowEl.style.display = 'none';
  }
  renderSummary();
}

// ── Render cart summary ───────────────────────────────────────
function renderSummary() {
  const container = document.getElementById('coItems');
  if (!cart.length) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px 0;">Cart is empty. <a href="index.html">Browse Menu</a></p>';
    return;
  }
  let html = '', subtotal = 0;
  cart.forEach(item => {
    const t = item.price * item.qty;
    subtotal += t;
    html += `<div class="co-item-row">
      <div class="co-item-name">${item.name}</div>
      <div class="co-item-qty">×${item.qty}</div>
      <div class="co-item-price">₹${t.toFixed(2)}</div>
    </div>`;
  });
  container.innerHTML = html;

  const delivery = subtotal >= 500 ? 0 : 40;
  const total    = subtotal + delivery - discount - loyaltyDiscount;

  document.getElementById('coSubtotal').textContent     = `₹${subtotal.toFixed(2)}`;
  document.getElementById('coDelivery').textContent     = delivery === 0 ? 'FREE' : `₹${delivery.toFixed(2)}`;
  document.getElementById('coTotal').textContent        = `₹${Math.max(0, total).toFixed(2)}`;
  document.getElementById('placeOrderText').textContent = `Place Order — ₹${Math.max(0, total).toFixed(2)}`;

  // Keep loyalty row in sync
  const loyaltyRow  = document.getElementById('loyaltyDiscountRow');
  const loyaltyDisc = document.getElementById('coLoyaltyDiscount');
  if (loyaltyRow && loyaltyDisc) {
    loyaltyRow.style.display  = loyaltyApplied ? 'flex' : 'none';
    loyaltyDisc.textContent   = `-₹${loyaltyDiscount.toFixed(2)}`;
  }
}

// ── Apply coupon via API ──────────────────────────────────────
async function applyCoupon() {
  if (couponApplied) return;
  const code   = document.getElementById('couponInput').value.trim().toUpperCase();
  const msgEl  = document.getElementById('couponMsg');
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (!code) { msgEl.className='error'; msgEl.textContent='Enter a coupon code'; msgEl.style.display='block'; return; }
  try {
    const data = await apiFetch('/api/promos/validate', { method:'POST', body: JSON.stringify({ code, subtotal }) });
    if (!data.success) throw new Error(data.message);
    discount = data.discount; couponApplied = true;
    msgEl.className='success'; msgEl.textContent=data.message; msgEl.style.display='block';
    document.getElementById('discountRow').style.display='flex';
    document.getElementById('coDiscount').textContent=`-₹${discount.toFixed(2)}`;
    renderSummary();
  } catch (err) {
    msgEl.className='error'; msgEl.textContent='❌ '+err.message; msgEl.style.display='block'; discount=0;
  }
}

// ── Payment option toggle ─────────────────────────────────────
document.querySelectorAll('.payment-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    opt.querySelector('input[type="radio"]').checked = true;
  });
});

// ── Place order ───────────────────────────────────────────────
async function placeOrder() {
  if (!cart.length) { showCoAlert('error', 'Your cart is empty!'); return; }

  const name    = document.getElementById('delName').value.trim();
  const phone   = document.getElementById('delPhone').value.trim();
  const street  = document.getElementById('delStreet').value.trim();
  const city    = document.getElementById('delCity').value.trim();
  const state   = document.getElementById('delState').value.trim();
  const pincode = document.getElementById('delPincode').value.trim();

  if (!name || !phone || !street || !city || !state || !pincode) {
    showCoAlert('error', 'Please fill in all delivery address fields.');
    document.getElementById('deliverySection').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  // Save address if checkbox checked
  maybeSaveAddress(street, city, state, pincode);

  const paymentMethod  = document.querySelector('input[name="payment"]:checked').value;
  const subtotal       = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryCharge = subtotal >= 500 ? 0 : 40;
  const total          = subtotal + deliveryCharge - discount - loyaltyDiscount;

  setOrderLoading(true);
  try {
    // 1. Create order in DB
    const orderData = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: cart.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        deliveryAddress: { name, phone, street, city, state, pincode },
        paymentMethod,
        subtotal,
        discount: discount + loyaltyDiscount,
        couponCode: couponApplied ? document.getElementById('couponInput').value.trim().toUpperCase() : ''
      })
    });
    if (!orderData.success) throw new Error(orderData.message);
    const orderId = orderData.order._id;

    if (paymentMethod === 'razorpay') {
      // 2. Create Razorpay order
      const rpData = await apiFetch('/api/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ orderId })
      });
      if (!rpData.success) throw new Error(rpData.message);

      setOrderLoading(false);

      // If simulated (no real Razorpay keys), auto-complete
      if (rpData.simulated) {
        const vData = await apiFetch('/api/payment/verify', {
          method: 'POST',
          body: JSON.stringify({
            razorpay_order_id:   rpData.razorpayOrderId,
            razorpay_payment_id: 'sim_pay_' + Date.now(),
            razorpay_signature:  'simulated',
            orderId
          })
        });
        if (vData.success) {
          // Award loyalty points (1 point per ₹10 spent)
          const earnedPts = Math.floor(total / 10);
          const currentPts = parseInt(localStorage.getItem('foodies_points') || '0');
          const newPts = loyaltyApplied
            ? Math.max(0, currentPts - (loyaltyDiscount * 10) + earnedPts)
            : currentPts + earnedPts;
          localStorage.setItem('foodies_points', newPts);
          localStorage.removeItem('foodies_cart');
          window.location.href = `order-success.html?id=${orderId}&payment=razorpay&pts=${earnedPts}`;
        } else {
          showCoAlert('error', 'Payment failed. Try Cash on Delivery.');
        }
        return;
      }

      // 3. Open real Razorpay popup
      const rzp = new Razorpay({
        key:      rpData.key,
        amount:   rpData.amount,
        currency: rpData.currency,
        name:     'FOODIES.COM',
        description: 'Food Order',
        order_id: rpData.razorpayOrderId,
        prefill:  { name, contact: phone, email: user.email || '' },
        theme:    { color: '#c0392b' },
        handler: async (response) => {
          const vData = await apiFetch('/api/payment/verify', {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              orderId
            })
          });
          if (vData.success) {
            const earnedPts  = Math.floor(total / 10);
            const currentPts = parseInt(localStorage.getItem('foodies_points') || '0');
            const newPts = loyaltyApplied
              ? Math.max(0, currentPts - (loyaltyDiscount * 10) + earnedPts)
              : currentPts + earnedPts;
            localStorage.setItem('foodies_points', newPts);
            localStorage.removeItem('foodies_cart');
            window.location.href = `order-success.html?id=${orderId}&payment=razorpay&pts=${earnedPts}`;
          } else {
            showCoAlert('error', 'Payment verification failed. Contact support.');
          }
        },
        modal: { ondismiss: () => setOrderLoading(false) }
      });
      rzp.on('payment.failed', () => { showCoAlert('error', 'Payment failed. Try again.'); setOrderLoading(false); });
      rzp.open();

    } else {
      // COD
      await apiFetch('/api/payment/cod-confirm', { method: 'POST', body: JSON.stringify({ orderId }) });
      const earnedPts  = Math.floor(total / 10);
      const currentPts = parseInt(localStorage.getItem('foodies_points') || '0');
      const newPts = loyaltyApplied
        ? Math.max(0, currentPts - (loyaltyDiscount * 10) + earnedPts)
        : currentPts + earnedPts;
      localStorage.setItem('foodies_points', newPts);
      localStorage.removeItem('foodies_cart');
      window.location.href = `order-success.html?id=${orderId}&payment=cod&pts=${earnedPts}`;
    }

  } catch (err) {
    showCoAlert('error', err.message);
    setOrderLoading(false);
  }
}

function setOrderLoading(on) {
  const btn    = document.getElementById('placeOrderBtn');
  const text   = document.getElementById('placeOrderText');
  const loader = document.getElementById('orderLoader');
  btn.disabled = on;
  text.style.display   = on ? 'none' : 'inline';
  loader.style.display = on ? 'inline-block' : 'none';
}

function showCoAlert(type, msg) {
  const el = document.getElementById('checkoutAlert');
  el.className = `co-alert ${type}`;
  el.textContent  = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

renderSummary();

initLoyaltySection();

// ── Scheduled Delivery ────────────────────────────────────────
function toggleSchedule(radio) {
  const wrap     = document.getElementById('scheduleInputWrap');
  const optNow   = document.getElementById('opt-now');
  const optLater = document.getElementById('opt-later');
  if (!wrap) return;

  if (radio.value === 'later') {
    wrap.style.display = 'block';
    if (optNow)   optNow.classList.remove('active');
    if (optLater) optLater.classList.add('active');
    const minDate = new Date(Date.now() + 60 * 60 * 1000);
    const dtInput = document.getElementById('scheduleDateTime');
    if (dtInput) {
      dtInput.min   = minDate.toISOString().slice(0, 16);
      if (!dtInput.value) dtInput.value = minDate.toISOString().slice(0, 16);
    }
  } else {
    wrap.style.display = 'none';
    if (optNow)   optNow.classList.add('active');
    if (optLater) optLater.classList.remove('active');
  }
}

// Click toggle on delivery time labels
document.querySelectorAll('.delivery-time-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.delivery-time-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    const radio = opt.querySelector('input[type="radio"]');
    if (radio) { radio.checked = true; toggleSchedule(radio); }
  });
});

// ── Save / Load Delivery Address ──────────────────────────────
function initSavedAddress() {
  const saved   = JSON.parse(localStorage.getItem('foodies_saved_address') || 'null');
  const bar     = document.getElementById('savedAddressBar');
  const preview = document.getElementById('savedAddrPreview');
  if (saved && bar && preview) {
    bar.style.display = 'flex';
    preview.textContent = `${saved.street}, ${saved.city} — ${saved.pincode}`;
  }
}

function fillSavedAddress() {
  const saved = JSON.parse(localStorage.getItem('foodies_saved_address') || 'null');
  if (!saved) return;
  const fields = { delStreet: 'street', delCity: 'city', delState: 'state', delPincode: 'pincode' };
  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && saved[key]) el.value = saved[key];
  });
  const bar = document.getElementById('savedAddressBar');
  if (bar) {
    bar.style.border = '2px solid #16a085';
    setTimeout(() => { bar.style.border = ''; }, 1500);
  }
}

function maybeSaveAddress(street, city, state, pincode) {
  const chk = document.getElementById('saveAddressChk');
  if (chk && chk.checked && street && city) {
    localStorage.setItem('foodies_saved_address', JSON.stringify({ street, city, state, pincode }));
  }
}

initSavedAddress();
