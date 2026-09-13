/**
 * ================================================
 *  FOODIES.COM — Standalone Server
 *  NO MongoDB needed. NO external setup.
 *  Uses local db.json as database.
 *
 *  RUN:  node backend/standalone.js
 *  OPEN: http://localhost:5000
 *
 *  Admin Login: admin@foodies.com / admin123
 * ================================================
 */

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const PORT    = 5000;
const ROOT    = path.join(__dirname, '..');
const DB_PATH = path.join(__dirname, 'db.json');
const JWT_SECRET = 'foodies_standalone_secret_2025';

// ── WhatsApp Notification (CallMeBot) ─────────────────────────
function sendWhatsAppNotification(order, user, method) {
  const phone  = process.env.WHATSAPP_PHONE;
  const apiKey = process.env.WHATSAPP_API_KEY;
  if (!phone || !apiKey || phone === 'YOUR_WHATSAPP_NUMBER') return;

  const addr  = order.deliveryAddress || {};
  const items = (order.items || []).map(i => `  • ${i.name} ×${i.qty} — ₹${(i.price * i.qty).toFixed(0)}`).join('\n');

  const msg = (
    `🍽️ *NEW ORDER — FOODIES.COM*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 Order ID : #${order._id.slice(-8).toUpperCase()}\n` +
    `👤 Customer : ${user.name}` + (user.phone ? ` | 📞 ${user.phone}` : '') + `\n` +
    `💳 Payment  : ${method}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *Items:*\n${items}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *TOTAL : ₹${order.total.toFixed(0)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *Deliver to:*\n` +
    `  ${addr.name}, ${addr.phone}\n` +
    `  ${addr.street}, ${addr.city} — ${addr.pincode}`
  );

  const encoded = encodeURIComponent(msg);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;

  https.get(url, (r) => {
    console.log(`[WhatsApp] Notification sent ✅ (${r.statusCode})`);
  }).on('error', (e) => {
    console.error('[WhatsApp] Notification failed:', e.message);
  });
}

// ── DB helpers ────────────────────────────────────────────────
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}
function uid() {
  return crypto.randomBytes(12).toString('hex');
}

// ── Simple JWT ────────────────────────────────────────────────
function signToken(payload) {
  const header  = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7*24*60*60*1000 })).toString('base64url');
  const sig     = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ── Simple bcrypt-compatible hash check ──────────────────────
// Uses real bcryptjs if available, else sha256 fallback
let bcrypt;
try { bcrypt = require('bcryptjs'); } catch { bcrypt = null; }

async function hashPassword(plain) {
  if (bcrypt) return bcrypt.hash(plain, 10);
  return crypto.createHash('sha256').update(plain + JWT_SECRET).digest('hex');
}
async function comparePassword(plain, hash) {
  if (bcrypt) return bcrypt.compare(plain, hash);
  return crypto.createHash('sha256').update(plain + JWT_SECRET).digest('hex') === hash;
}

// ── MIME types ────────────────────────────────────────────────
const MIME = {
  '.html':'.html', '.css':'text/css', '.js':'application/javascript',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf',
  '.webp':'image/webp', '.json':'application/json', '.map':'application/json'
};
function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'text/plain';
}

// ── Auth middleware ───────────────────────────────────────────
function authMiddleware(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;
  const db   = readDB();
  const user = db.users.find(u => u._id === payload.id);
  return user || null;
}

// ── Read request body ─────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Send JSON ─────────────────────────────────────────────────
function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(JSON.stringify(data));
}

// ── Serve static file ─────────────────────────────────────────
function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, '404.html'), (e, d) => {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(e ? '404 Not Found' : d);
      });
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = getMime(filePath);
    res.writeHead(200, {
      'Content-Type': mime.includes('html') ? 'text/html; charset=utf-8' : mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  });
}

// ═══════════════════════════════════════════════════
//  API ROUTE HANDLERS
// ═══════════════════════════════════════════════════

// ── POST /api/auth/register ───────────────────────
async function handleRegister(req, res) {
  const { name, email, password, phone } = await readBody(req);
  if (!name || !email || !password) return json(res, 400, { success:false, message:'Name, email and password required' });
  const db = readDB();
  if (db.users.find(u => u.email === email.toLowerCase())) return json(res, 400, { success:false, message:'Email already registered' });
  const hashed = await hashPassword(password);
  const user   = { _id: uid(), name, email: email.toLowerCase(), password: hashed, phone: phone||'', role:'user', isActive:true, createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDB(db);
  const token = signToken({ id: user._id });
  json(res, 201, { success:true, message:'Account created', token, user:{ id:user._id, name:user.name, email:user.email, role:user.role } });
}

// ── POST /api/auth/login ──────────────────────────
async function handleLogin(req, res) {
  const { email, password } = await readBody(req);
  if (!email || !password) return json(res, 400, { success:false, message:'Email and password required' });
  const db   = readDB();
  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user) return json(res, 401, { success:false, message:'Invalid email or password' });
  const ok = await comparePassword(password, user.password);
  if (!ok) return json(res, 401, { success:false, message:'Invalid email or password' });
  if (!user.isActive) return json(res, 403, { success:false, message:'Account deactivated' });
  const token = signToken({ id: user._id });
  json(res, 200, { success:true, message:'Login successful', token, user:{ id:user._id, name:user.name, email:user.email, role:user.role, phone:user.phone } });
}

// ── GET /api/auth/me ──────────────────────────────
function handleMe(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Not authorized' });
  const { password, ...u } = user;
  // Include loyalty points from DB (fallback 0)
  json(res, 200, { success:true, user: { ...u, loyaltyPoints: u.loyaltyPoints || 0 } });
}

// ── PUT /api/auth/profile ─────────────────────────
async function handleUpdateProfile(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Not authorized' });
  const { name, phone, address } = await readBody(req);
  const db  = readDB();
  const idx = db.users.findIndex(u => u._id === user._id);
  if (idx === -1) return json(res, 404, { success:false, message:'User not found' });
  if (name)    db.users[idx].name    = name;
  if (phone)   db.users[idx].phone   = phone;
  if (address) db.users[idx].address = address;
  writeDB(db);
  const { password, ...updated } = db.users[idx];
  json(res, 200, { success:true, message:'Profile updated', user: updated });
}

// ── PUT /api/auth/change-password ─────────────────
async function handleChangePassword(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Not authorized' });
  const { currentPassword, newPassword } = await readBody(req);
  const ok = await comparePassword(currentPassword, user.password);
  if (!ok) return json(res, 400, { success:false, message:'Current password incorrect' });
  const db  = readDB();
  const idx = db.users.findIndex(u => u._id === user._id);
  db.users[idx].password = await hashPassword(newPassword);
  writeDB(db);
  json(res, 200, { success:true, message:'Password changed' });
}

// ── PUT /api/auth/change-email ────────────────────
async function handleChangeEmail(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Not authorized' });
  const { newEmail, password } = await readBody(req);
  if (!newEmail || !password) return json(res, 400, { success:false, message:'New email and password required' });
  const ok = await comparePassword(password, user.password);
  if (!ok) return json(res, 400, { success:false, message:'Password is incorrect' });
  const db = readDB();
  if (db.users.find(u => u.email === newEmail.toLowerCase() && u._id !== user._id)) {
    return json(res, 400, { success:false, message:'Email already in use by another account' });
  }
  const idx = db.users.findIndex(u => u._id === user._id);
  db.users[idx].email = newEmail.toLowerCase().trim();
  writeDB(db);
  json(res, 200, { success:true, message:'Email updated successfully' });
}

// ── GET /api/menu ─────────────────────────────────
function handleGetMenu(req, res, urlObj) {
  const db       = readDB();
  const category = urlObj.searchParams.get('category');
  let items      = db.menuItems.filter(i => i.isAvailable);
  if (category && category !== 'all') items = items.filter(i => i.category === category);
  json(res, 200, { success:true, count: items.length, items });
}

// ── GET /api/menu/:id ─────────────────────────────
function handleGetMenuItem(req, res, id) {
  const db   = readDB();
  const item = db.menuItems.find(i => i._id === id);
  if (!item) return json(res, 404, { success:false, message:'Item not found' });
  json(res, 200, { success:true, item });
}

// ── POST /api/menu ────────────────────────────────
async function handleAddMenuItem(req, res) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const body = await readBody(req);
  const db   = readDB();
  const item = { _id: uid(), ...body, isAvailable: body.isAvailable !== false, isFeatured: !!body.isFeatured, createdAt: new Date().toISOString() };
  db.menuItems.push(item);
  writeDB(db);
  json(res, 201, { success:true, message:'Item added', item });
}

// ── PUT /api/menu/:id ─────────────────────────────
async function handleUpdateMenuItem(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const body = await readBody(req);
  const db   = readDB();
  const idx  = db.menuItems.findIndex(i => i._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Item not found' });
  db.menuItems[idx] = { ...db.menuItems[idx], ...body };
  writeDB(db);
  json(res, 200, { success:true, message:'Item updated', item: db.menuItems[idx] });
}

// ── DELETE /api/menu/:id ──────────────────────────
function handleDeleteMenuItem(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db  = readDB();
  const idx = db.menuItems.findIndex(i => i._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Item not found' });
  db.menuItems.splice(idx, 1);
  writeDB(db);
  json(res, 200, { success:true, message:'Item deleted' });
}

// ── POST /api/orders ──────────────────────────────
async function handlePlaceOrder(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const { items, deliveryAddress, paymentMethod, subtotal, discount, couponCode, scheduledFor } = await readBody(req);
  if (!items || !items.length) return json(res, 400, { success:false, message:'Cart is empty' });

  let discountAmt = discount || 0;
  if (couponCode === 'FOODIES25' && discountAmt === 0) discountAmt = Math.round(subtotal * 0.25);
  const deliveryCharge = subtotal >= 500 ? 0 : 40;
  const total          = subtotal + deliveryCharge - discountAmt;

  // Scheduled delivery support
  let eta;
  if (scheduledFor) {
    try { eta = new Date(scheduledFor).toISOString(); } catch(_) { eta = new Date(Date.now() + 30 * 60000).toISOString(); }
  } else {
    eta = new Date(Date.now() + 30 * 60000).toISOString();
  }

  const order = {
    _id: uid(), user: user._id, userName: user.name,
    items, deliveryAddress, paymentMethod,
    subtotal, deliveryCharge, discount: discountAmt, total,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
    status: 'placed', estimatedDelivery: eta,
    scheduledFor: scheduledFor || null,
    isScheduled:  !!scheduledFor,
    createdAt: new Date().toISOString()
  };

  const db = readDB();
  db.orders.push(order);
  writeDB(db);
  json(res, 201, { success:true, message: scheduledFor ? `Order scheduled for ${new Date(scheduledFor).toLocaleString('en-IN')}` : 'Order placed', order });
}

// ── GET /api/orders/my ────────────────────────────
function handleMyOrders(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const db     = readDB();
  const orders = db.orders.filter(o => o.user === user._id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  json(res, 200, { success:true, count: orders.length, orders });
}

// ── GET /api/orders/:id ───────────────────────────
function handleGetOrder(req, res, id) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const db    = readDB();
  const order = db.orders.find(o => o._id === id);
  if (!order) return json(res, 404, { success:false, message:'Order not found' });
  if (order.user !== user._id && user.role !== 'admin') return json(res, 403, { success:false, message:'Not authorized' });
  json(res, 200, { success:true, order });
}

// ── GET /api/orders (admin) ───────────────────────
function handleAllOrders(req, res, urlObj) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db      = readDB();
  const status  = urlObj.searchParams.get('status');
  let orders    = db.orders.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status)   orders = orders.filter(o => o.status === status);
  // Attach user info
  orders = orders.map(o => ({ ...o, user: db.users.find(u => u._id === o.user) || { name:'Guest', email:'' } }));
  json(res, 200, { success:true, total: orders.length, orders });
}

// ── PUT /api/orders/:id/status ────────────────────
async function handleUpdateOrderStatus(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const { status } = await readBody(req);
  const db  = readDB();
  const idx = db.orders.findIndex(o => o._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Order not found' });
  db.orders[idx].status = status;
  if (status === 'delivered') db.orders[idx].paymentStatus = db.orders[idx].paymentMethod === 'cod' ? 'paid' : db.orders[idx].paymentStatus;
  writeDB(db);
  json(res, 200, { success:true, message:'Status updated', order: db.orders[idx] });
}

// ── PUT /api/orders/:id/cancel ────────────────────
async function handleCancelOrder(req, res, id) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const db  = readDB();
  const idx = db.orders.findIndex(o => o._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Order not found' });
  if (db.orders[idx].user !== user._id) return json(res, 403, { success:false, message:'Not authorized' });
  if (!['placed','confirmed'].includes(db.orders[idx].status)) return json(res, 400, { success:false, message:'Cannot cancel at this stage' });
  db.orders[idx].status = 'cancelled';
  writeDB(db);
  json(res, 200, { success:true, message:'Order cancelled', order: db.orders[idx] });
}

// ── POST /api/payment/create-order ───────────────
async function handleCreatePaymentOrder(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const { orderId } = await readBody(req);
  const db    = readDB();
  const order = db.orders.find(o => o._id === orderId);
  if (!order) return json(res, 404, { success:false, message:'Order not found' });

  // If real Razorpay keys are set, use them
  if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('XXXX')) {
    try {
      const Razorpay = require('razorpay');
      const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const rzpOrder = await rzp.orders.create({
        amount: Math.round(order.total * 100),
        currency: 'INR',
        receipt: `order_${order._id}`
      });
      const idx = db.orders.findIndex(o => o._id === orderId);
      db.orders[idx].razorpayOrderId = rzpOrder.id;
      writeDB(db);
      return json(res, 200, { success:true, razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, currency: 'INR', key: process.env.RAZORPAY_KEY_ID, simulated: false });
    } catch (e) {
      console.log('Razorpay error, using simulation:', e.message);
    }
  }

  // Simulation mode — auto-approve payment without real keys
  const simId = 'sim_' + uid();
  const idx = db.orders.findIndex(o => o._id === orderId);
  if (idx !== -1) {
    db.orders[idx].razorpayOrderId = simId;
    writeDB(db);
  }
  json(res, 200, {
    success: true,
    razorpayOrderId: simId,
    amount: Math.round(order.total * 100),
    currency: 'INR',
    key: 'rzp_test_simulation',
    simulated: true  // Frontend will auto-complete
  });
}

// ── POST /api/payment/verify ──────────────────────
async function handleVerifyPayment(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const { orderId, razorpay_order_id, razorpay_payment_id } = await readBody(req);

  const db  = readDB();
  const idx = db.orders.findIndex(o => o._id === orderId);
  if (idx === -1) return json(res, 404, { success:false, message:'Order not found' });

  db.orders[idx].paymentStatus     = 'paid';
  db.orders[idx].status            = 'confirmed';
  db.orders[idx].razorpayPaymentId = razorpay_payment_id || 'simulated';

  // ── Award Loyalty Points (1 point per ₹10 spent) ──
  const earnedPts = Math.floor((db.orders[idx].total || 0) / 10);
  const uIdx = db.users.findIndex(u => u._id === user._id);
  if (uIdx !== -1) {
    db.users[uIdx].loyaltyPoints = (db.users[uIdx].loyaltyPoints || 0) + earnedPts;
    db.orders[idx].loyaltyEarned = earnedPts;
  }

  writeDB(db);

  // WhatsApp notification
  sendWhatsAppNotification(db.orders[idx], user, 'Razorpay (Online) ✅');

  json(res, 200, { success:true, message:'Payment verified', order: db.orders[idx], loyaltyEarned: earnedPts });
}

// ── POST /api/payment/cod-confirm ────────────────
async function handleCodConfirm(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const { orderId } = await readBody(req);
  const db  = readDB();
  const idx = db.orders.findIndex(o => o._id === orderId);
  if (idx === -1) return json(res, 404, { success:false, message:'Order not found' });
  db.orders[idx].status = 'confirmed';

  // ── Award Loyalty Points for COD orders ──
  const earnedPts = Math.floor((db.orders[idx].total || 0) / 10);
  const uIdx = db.users.findIndex(u => u._id === user._id);
  if (uIdx !== -1) {
    db.users[uIdx].loyaltyPoints = (db.users[uIdx].loyaltyPoints || 0) + earnedPts;
    db.orders[idx].loyaltyEarned = earnedPts;
  }

  writeDB(db);

  // WhatsApp notification
  sendWhatsAppNotification(db.orders[idx], user, 'Cash on Delivery 💵');

  json(res, 200, { success:true, message:'COD confirmed', order: db.orders[idx], loyaltyEarned: earnedPts });
}

// ── GET /api/admin/dashboard ──────────────────────
function handleAdminDashboard(req, res) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db             = readDB();
  const totalOrders    = db.orders.length;
  // Revenue = online paid + COD delivered (no double-count)
  const paidOnline = db.orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((s, o) => s + o.total, 0);
  const codDelivered = db.orders
    .filter(o => o.paymentMethod === 'cod' && o.status === 'delivered' && o.paymentStatus !== 'paid')
    .reduce((s, o) => s + o.total, 0);
  const totalRevenue   = Math.round(paidOnline + codDelivered);
  const totalUsers     = db.users.filter(u => u.role === 'user').length;
  const totalItems     = db.menuItems.filter(i => i.isAvailable).length;
  const pendingOrders  = db.orders.filter(o => o.status === 'placed').length;
  const recentOrders   = db.orders
    .slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
    .map(o => ({ ...o, user: db.users.find(u => u._id === o.user) || { name:'Guest', email:'' } }));
  json(res, 200, { success:true, stats:{ totalOrders, totalRevenue, totalUsers, totalItems, pendingOrders }, recentOrders });
}

// ── GET /api/admin/users ──────────────────────────
function handleAdminUsers(req, res) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db    = readDB();
  const users = db.users.filter(u => u.role === 'user').map(({ password, ...u }) => u);
  json(res, 200, { success:true, total: users.length, users });
}

// ── PUT /api/admin/users/:id/toggle ──────────────
function handleToggleUser(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db  = readDB();
  const idx = db.users.findIndex(u => u._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'User not found' });
  db.users[idx].isActive = !db.users[idx].isActive;
  writeDB(db);
  json(res, 200, { success:true, message:`User ${db.users[idx].isActive ? 'activated' : 'deactivated'}` });
}

// ── POST /api/newsletter/subscribe ───────────────
async function handleNewsletterSubscribe(req, res) {
  const { email } = await readBody(req);
  if (!email) return json(res, 400, { success:false, message:'Email required' });
  const db = readDB();
  if (db.newsletter.find(n => n.email === email.toLowerCase())) {
    return json(res, 200, { success:true, message:'Already subscribed! Use code FOODIES25 for 25% off.' });
  }
  db.newsletter.push({ email: email.toLowerCase(), createdAt: new Date().toISOString() });
  writeDB(db);
  json(res, 201, { success:true, message:'Subscribed! Use code FOODIES25 for 25% off your first order.', coupon:'FOODIES25' });
}

// ── POST /api/contact ─────────────────────────────
async function handleContact(req, res) {
  const body = await readBody(req);
  const { name, email, subject, message } = body;
  if (!name || !email || !subject || !message) return json(res, 400, { success:false, message:'All fields required' });
  const db = readDB();
  if (!db.contacts) db.contacts = [];
  const contact = {
    _id: uid(),
    name, email, subject, message,
    phone: body.phone || '',
    isRead: false,
    reply: '',
    repliedAt: null,
    createdAt: new Date().toISOString()
  };
  db.contacts.push(contact);
  writeDB(db);
  json(res, 201, { success:true, message:'Message sent! We will reply within 24 hours.' });
}

// ── GET /api/admin/contacts ───────────────────────
function handleGetContacts(req, res) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db = readDB();
  const contacts = (db.contacts || []).slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  json(res, 200, { success:true, count: contacts.length, contacts });
}

// ── GET /api/contacts/my — user sees their own queries ────────
function handleMyContacts(req, res) {
  const body = req.headers['x-user-email'] || '';
  // Get email from query param or auth
  const urlObj  = new URL(req.url, `http://localhost:${PORT}`);
  const email   = urlObj.searchParams.get('email');
  const db      = readDB();
  let contacts  = (db.contacts || []);
  if (email) {
    contacts = contacts.filter(c => c.email.toLowerCase() === email.toLowerCase());
  } else {
    // Try from auth
    const user = authMiddleware(req);
    if (!user) return json(res, 401, { success:false, message:'Login or provide email' });
    contacts = contacts.filter(c => c.email.toLowerCase() === user.email.toLowerCase());
  }
  contacts = contacts.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  json(res, 200, { success:true, count: contacts.length, contacts });
}

// ── PUT /api/admin/contacts/:id/read ─────────────
async function handleMarkContactRead(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db  = readDB();
  const idx = (db.contacts || []).findIndex(c => c._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Contact not found' });
  db.contacts[idx].isRead = true;
  writeDB(db);
  json(res, 200, { success:true, message:'Marked as read' });
}

// ── PUT /api/admin/contacts/:id/reply ────────────
async function handleReplyContact(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const { reply } = await readBody(req);
  if (!reply) return json(res, 400, { success:false, message:'Reply text required' });
  const db  = readDB();
  const idx = (db.contacts || []).findIndex(c => c._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Contact not found' });
  db.contacts[idx].reply     = reply;
  db.contacts[idx].repliedAt = new Date().toISOString();
  db.contacts[idx].isRead    = true;
  writeDB(db);
  json(res, 200, { success:true, message:'Reply saved', contact: db.contacts[idx] });
}

// ── DELETE /api/admin/contacts/:id ───────────────
function handleDeleteContact(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db  = readDB();
  const idx = (db.contacts || []).findIndex(c => c._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Contact not found' });
  db.contacts.splice(idx, 1);
  writeDB(db);
  json(res, 200, { success:true, message:'Deleted' });
}

// ═══════════ LOYALTY POINTS ═══════════
function handleLoyaltyBalance(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const db   = readDB();
  const u    = db.users.find(x => x._id === user._id);
  const pts  = u ? (u.loyaltyPoints || 0) : 0;
  json(res, 200, { success:true, points: pts, rupeesValue: Math.floor(pts / 10) });
}

async function handleLoyaltyRedeem(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const { pointsToRedeem } = await readBody(req);
  if (!pointsToRedeem || pointsToRedeem < 100) return json(res, 400, { success:false, message:'Minimum 100 points required to redeem' });
  const db  = readDB();
  const idx = db.users.findIndex(u => u._id === user._id);
  if (idx === -1) return json(res, 404, { success:false, message:'User not found' });
  const current = db.users[idx].loyaltyPoints || 0;
  if (current < pointsToRedeem) return json(res, 400, { success:false, message:`Insufficient points. You have ${current} points.` });
  db.users[idx].loyaltyPoints = current - pointsToRedeem;
  writeDB(db);
  const rupeesOff = Math.floor(pointsToRedeem / 10);
  json(res, 200, { success:true, message:`Redeemed ${pointsToRedeem} points = ₹${rupeesOff} off!`, rupeesOff, remaining: db.users[idx].loyaltyPoints });
}

// ═══════════ PROMO CODES ═══════════
function getDefaultPromos() {
  return [
    { _id:'promo001', code:'FOODIES25', type:'percent', value:25, minOrder:0,   isActive:true, createdAt:new Date().toISOString() },
    { _id:'promo002', code:'SAVE50',    type:'flat',    value:50, minOrder:300, isActive:true, createdAt:new Date().toISOString() },
    { _id:'promo003', code:'WELCOME',   type:'percent', value:15, minOrder:0,   isActive:true, createdAt:new Date().toISOString() }
  ];
}
function handleGetPromos(req, res) {
  const db = readDB();
  if (!db.promoCodes) { db.promoCodes = getDefaultPromos(); writeDB(db); }
  json(res, 200, { success:true, promos: db.promoCodes });
}
async function handleValidatePromo(req, res) {
  const { code, subtotal } = await readBody(req);
  if (!code) return json(res, 400, { success:false, message:'Code required' });
  const db = readDB();
  const promos = db.promoCodes || getDefaultPromos();
  const promo  = promos.find(p => p.code === code.toUpperCase() && p.isActive);
  if (!promo) return json(res, 400, { success:false, message:'Invalid or expired promo code' });
  if ((subtotal||0) < promo.minOrder) return json(res, 400, { success:false, message:`Minimum order ₹${promo.minOrder} required` });
  const discount = promo.type === 'percent' ? Math.round((subtotal||0) * promo.value / 100) : promo.value;
  json(res, 200, { success:true, discount, message:`✅ ${promo.code} applied! You saved ₹${discount}`, promo });
}
async function handleAddPromo(req, res) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const { code, type, value, minOrder } = await readBody(req);
  if (!code || !type || !value) return json(res, 400, { success:false, message:'Code, type and value required' });
  const db = readDB();
  if (!db.promoCodes) db.promoCodes = getDefaultPromos();
  if (db.promoCodes.find(p => p.code === code.toUpperCase())) return json(res, 400, { success:false, message:'Code already exists' });
  const promo = { _id: uid(), code: code.toUpperCase(), type, value: Number(value), minOrder: Number(minOrder||0), isActive:true, createdAt: new Date().toISOString() };
  db.promoCodes.push(promo);
  writeDB(db);
  json(res, 201, { success:true, message:'Promo created', promo });
}
function handleTogglePromo(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db = readDB();
  if (!db.promoCodes) db.promoCodes = getDefaultPromos();
  const idx = db.promoCodes.findIndex(p => p._id === id);
  if (idx === -1) return json(res, 404, { success:false, message:'Not found' });
  db.promoCodes[idx].isActive = !db.promoCodes[idx].isActive;
  writeDB(db);
  json(res, 200, { success:true, message:`${db.promoCodes[idx].isActive?'Activated':'Deactivated'}` });
}
function handleDeletePromo(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db = readDB();
  if (!db.promoCodes) return json(res, 404, { success:false, message:'Not found' });
  db.promoCodes = db.promoCodes.filter(p => p._id !== id);
  writeDB(db);
  json(res, 200, { success:true, message:'Deleted' });
}

// ═══════════ FOOD REVIEWS ═══════════
async function handleAddReview(req, res) {
  const user = authMiddleware(req);
  if (!user) return json(res, 401, { success:false, message:'Login required' });
  const { itemId, itemName, rating, comment } = await readBody(req);
  if (!rating || rating < 1 || rating > 5) return json(res, 400, { success:false, message:'Rating 1-5 required' });
  const db = readDB();
  if (!db.reviews) db.reviews = [];
  const existing = db.reviews.find(r => r.userId === user._id && r.itemId === itemId);
  if (existing) {
    existing.rating = rating; existing.comment = comment||''; existing.updatedAt = new Date().toISOString();
    writeDB(db); return json(res, 200, { success:true, message:'Review updated!' });
  }
  const review = { _id: uid(), userId: user._id, userName: user.name, itemId, itemName, rating: Number(rating), comment: comment||'', createdAt: new Date().toISOString() };
  db.reviews.push(review); writeDB(db);
  json(res, 201, { success:true, message:'Review added! Thank you.', review });
}
function handleGetReviews(req, res, urlObj) {
  const db = readDB();
  const itemId = urlObj.searchParams.get('itemId');
  let reviews = db.reviews || [];
  if (itemId) reviews = reviews.filter(r => r.itemId === itemId);
  reviews = reviews.slice().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const avg = reviews.length ? (reviews.reduce((s,r) => s+r.rating, 0)/reviews.length).toFixed(1) : 0;
  json(res, 200, { success:true, count: reviews.length, avg, reviews });
}
function handleAdminReviews(req, res) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db = readDB();
  const reviews = (db.reviews||[]).slice().sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  json(res, 200, { success:true, count: reviews.length, reviews });
}
function handleDeleteReview(req, res, id) {
  const user = authMiddleware(req);
  if (!user || user.role !== 'admin') return json(res, 403, { success:false, message:'Admin only' });
  const db = readDB();
  if (db.reviews) db.reviews = db.reviews.filter(r => r._id !== id);
  writeDB(db);
  json(res, 200, { success:true, message:'Deleted' });
}

// ── POST /api/auth/forgot-password ───────────────
async function handleForgotPassword(req, res) {
  const { email } = await readBody(req);
  if (!email) return json(res, 400, { success:false, message:'Email required' });
  const db   = readDB();
  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user) {
    // Return same message even if not found (security best practice)
    return json(res, 200, { success:true, message:'If this email exists, a reset code has been sent.' });
  }
  // Generate 6-digit OTP
  const otp     = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
  if (!db.resetTokens) db.resetTokens = [];
  // Remove old tokens for this email
  db.resetTokens = db.resetTokens.filter(t => t.email !== email.toLowerCase());
  db.resetTokens.push({ email: email.toLowerCase(), otp, expires });
  writeDB(db);
  // In production you'd email this — for now return it in response (dev mode)
  console.log(`🔑 Password Reset OTP for ${email}: ${otp}`);
  json(res, 200, {
    success: true,
    message: 'Reset code generated.',
    // Show OTP in dev mode so user can test without email setup
    otp: process.env.NODE_ENV === 'production' ? undefined : otp,
    devNote: 'In production, this OTP would be emailed. For demo, it is shown here.'
  });
}

// ── POST /api/auth/verify-otp ─────────────────────
async function handleVerifyOtp(req, res) {
  const { email, otp } = await readBody(req);
  if (!email || !otp) return json(res, 400, { success:false, message:'Email and OTP required' });
  const db    = readDB();
  const token = (db.resetTokens || []).find(t =>
    t.email === email.toLowerCase() && t.otp === otp && t.expires > Date.now()
  );
  if (!token) return json(res, 400, { success:false, message:'Invalid or expired OTP' });
  // Issue a short-lived reset token
  const resetToken = signToken({ id: 'reset_' + email.toLowerCase(), type: 'reset' });
  json(res, 200, { success:true, message:'OTP verified', resetToken });
}

// ── POST /api/auth/reset-password ────────────────
async function handleResetPassword(req, res) {
  const { email, otp, newPassword } = await readBody(req);
  if (!email || !otp || !newPassword) return json(res, 400, { success:false, message:'All fields required' });
  if (newPassword.length < 6) return json(res, 400, { success:false, message:'Password must be at least 6 characters' });
  const db     = readDB();
  const token  = (db.resetTokens || []).find(t =>
    t.email === email.toLowerCase() && t.otp === otp && t.expires > Date.now()
  );
  if (!token) return json(res, 400, { success:false, message:'Invalid or expired OTP. Request a new one.' });
  const idx = db.users.findIndex(u => u.email === email.toLowerCase());
  if (idx === -1) return json(res, 404, { success:false, message:'User not found' });
  db.users[idx].password = await hashPassword(newPassword);
  // Remove used token
  db.resetTokens = db.resetTokens.filter(t => t.email !== email.toLowerCase());
  writeDB(db);
  json(res, 200, { success:true, message:'Password reset successfully! You can now login.' });
}

// ═══════════════════════════════════════════════════
//  MAIN REQUEST ROUTER
// ═══════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    res.end(); return;
  }

  const urlObj   = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(urlObj.pathname);
  const method   = req.method;

  // ── API Routes ──────────────────────────────────
  if (pathname.startsWith('/api/')) {

    // Auth
    if (pathname === '/api/auth/register'        && method === 'POST') return handleRegister(req, res);
    if (pathname === '/api/auth/login'            && method === 'POST') return handleLogin(req, res);
    if (pathname === '/api/auth/me'               && method === 'GET')  return handleMe(req, res);
    if (pathname === '/api/auth/profile'          && method === 'PUT')  return handleUpdateProfile(req, res);
    if (pathname === '/api/auth/change-password'  && method === 'PUT')  return handleChangePassword(req, res);
    if (pathname === '/api/auth/change-email'      && method === 'PUT')  return handleChangeEmail(req, res);
    if (pathname === '/api/auth/forgot-password'  && method === 'POST') return handleForgotPassword(req, res);
    if (pathname === '/api/auth/verify-otp'       && method === 'POST') return handleVerifyOtp(req, res);
    if (pathname === '/api/auth/reset-password'   && method === 'POST') return handleResetPassword(req, res);

    // Menu
    if (pathname === '/api/menu'                  && method === 'GET')    return handleGetMenu(req, res, urlObj);
    if (pathname === '/api/menu'                  && method === 'POST')   return handleAddMenuItem(req, res);
    if (pathname.match(/^\/api\/menu\/[^/]+$/)    && method === 'GET')    return handleGetMenuItem(req, res, pathname.split('/')[3]);
    if (pathname.match(/^\/api\/menu\/[^/]+$/)    && method === 'PUT')    return handleUpdateMenuItem(req, res, pathname.split('/')[3]);
    if (pathname.match(/^\/api\/menu\/[^/]+$/)    && method === 'DELETE') return handleDeleteMenuItem(req, res, pathname.split('/')[3]);

    // Orders
    if (pathname === '/api/orders'                && method === 'POST')  return handlePlaceOrder(req, res);
    if (pathname === '/api/orders/my'             && method === 'GET')   return handleMyOrders(req, res);
    if (pathname === '/api/orders'                && method === 'GET')   return handleAllOrders(req, res, urlObj);
    if (pathname.match(/^\/api\/orders\/[^/]+$/)  && method === 'GET')   return handleGetOrder(req, res, pathname.split('/')[3]);
    if (pathname.match(/\/api\/orders\/[^/]+\/status$/) && method === 'PUT') return handleUpdateOrderStatus(req, res, pathname.split('/')[3]);
    if (pathname.match(/\/api\/orders\/[^/]+\/cancel$/) && method === 'PUT') return handleCancelOrder(req, res, pathname.split('/')[3]);

    // Payment
    if (pathname === '/api/payment/create-order'  && method === 'POST')  return handleCreatePaymentOrder(req, res);
    if (pathname === '/api/payment/verify'        && method === 'POST')  return handleVerifyPayment(req, res);
    if (pathname === '/api/payment/cod-confirm'   && method === 'POST')  return handleCodConfirm(req, res);

    // Admin
    if (pathname === '/api/admin/dashboard'       && method === 'GET')   return handleAdminDashboard(req, res);
    if (pathname === '/api/admin/users'           && method === 'GET')   return handleAdminUsers(req, res);
    if (pathname.match(/\/api\/admin\/users\/[^/]+\/toggle$/) && method === 'PUT') return handleToggleUser(req, res, pathname.split('/')[4]);
    if (pathname === '/api/admin/contacts'        && method === 'GET')   return handleGetContacts(req, res);
    if (pathname.match(/\/api\/admin\/contacts\/[^/]+\/read$/)  && method === 'PUT') return handleMarkContactRead(req, res, pathname.split('/')[4]);
    if (pathname.match(/\/api\/admin\/contacts\/[^/]+\/reply$/) && method === 'PUT') return handleReplyContact(req, res, pathname.split('/')[4]);
    if (pathname.match(/\/api\/admin\/contacts\/[^/]+$/) && method === 'DELETE') return handleDeleteContact(req, res, pathname.split('/')[4]);

    // Newsletter + Contact
    if (pathname === '/api/newsletter/subscribe'  && method === 'POST')  return handleNewsletterSubscribe(req, res);
    if (pathname === '/api/contact'               && method === 'POST')  return handleContact(req, res);
    if (pathname === '/api/contacts/my'           && method === 'GET')   return handleMyContacts(req, res);

    // Loyalty Points
    if (pathname === '/api/loyalty/balance'       && method === 'GET')   return handleLoyaltyBalance(req, res);
    if (pathname === '/api/loyalty/redeem'        && method === 'POST')  return handleLoyaltyRedeem(req, res);

    // Promo codes
    if (pathname === '/api/promos'                     && method === 'GET')    return handleGetPromos(req, res);
    if (pathname === '/api/promos/validate'            && method === 'POST')   return handleValidatePromo(req, res);
    if (pathname === '/api/admin/promos'               && method === 'POST')   return handleAddPromo(req, res);
    if (pathname.match(/\/api\/admin\/promos\/[^/]+\/toggle$/) && method === 'PUT') return handleTogglePromo(req, res, pathname.split('/')[4]);
    if (pathname.match(/\/api\/admin\/promos\/[^/]+$/) && method === 'DELETE') return handleDeletePromo(req, res, pathname.split('/')[4]);

    // Reviews
    if (pathname === '/api/reviews'               && method === 'POST') return handleAddReview(req, res);
    if (pathname === '/api/reviews'               && method === 'GET')  return handleGetReviews(req, res, urlObj);
    if (pathname === '/api/admin/reviews'         && method === 'GET')  return handleAdminReviews(req, res);
    if (pathname.match(/\/api\/admin\/reviews\/[^/]+$/) && method === 'DELETE') return handleDeleteReview(req, res, pathname.split('/')[4]);

    return json(res, 404, { success:false, message:'API route not found' });
  }

  // ── Static Files ────────────────────────────────
  let filePath = path.join(ROOT, pathname === '/' ? '/index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('403 Forbidden'); return;
  }

  // If no extension, try .html
  if (!path.extname(filePath)) {
    filePath = filePath + '.html';
  }

  serveFile(res, filePath);
});

// ── Start Server ──────────────────────────────────
server.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   🍽️  FOODIES.COM — Ready!                ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║   🌐  http://localhost:${PORT}               ║`);
  console.log('║                                           ║');
  console.log('║   👤 Admin Login:                         ║');
  console.log('║      admin@foodies.com / admin123         ║');
  console.log('║                                           ║');
  console.log('║   🎟️  Coupon: FOODIES25 (25% off)         ║');
  console.log('║   🛑  Ctrl+C to stop                      ║');
  console.log('╚═══════════════════════════════════════════╝\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is busy. Close other servers first.\n`);
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
});
