/**
 * ════════════════════════════════════════════════════════════
 *  FOODIES.COM — MongoDB Server
 *
 *  HOW IT WORKS:
 *  1. If MONGO_URI is set in .env → connects to MongoDB Atlas (cloud)
 *  2. If MONGO_URI is NOT set     → starts local MongoDB in-memory
 *     (uses mongodb-memory-server — no install needed, works offline!)
 *
 *  DATA: Automatically migrates all data from db.json on first run.
 *
 *  RUN: node backend/server-mongo.js
 *      OR: START-SERVER.bat (double-click)
 * ════════════════════════════════════════════════════════════
 */

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) console.log(`[API] ${req.method} ${req.path}`);
    next();
  });
}

// ── Serve Static Frontend ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '..'), {
  index: 'index.html',
  extensions: ['html']
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/menu',       require('./routes/menu'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/payment',    require('./routes/payment'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/contact',    require('./routes/contact'));
app.use('/api/contacts',   require('./routes/contact'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/promos',     require('./routes/promos'));
app.use('/api/admin',      require('./routes/admin'));

// ── Catch-all HTML ────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  const htmlPath = path.join(__dirname, '..', req.path.endsWith('.html') ? req.path : req.path + '.html');
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// ════════════════════════════════════════════════════════════
//  MONGODB CONNECTION — Atlas or In-Memory
// ════════════════════════════════════════════════════════════
async function getMongoURI() {
  const uri = process.env.MONGO_URI || '';

  // Check if Atlas URI is properly configured (not placeholder)
  const isAtlasConfigured = uri &&
    !uri.includes('<username>') &&
    !uri.includes('<password>') &&
    !uri.includes('XXXXX') &&
    uri.startsWith('mongodb');

  if (isAtlasConfigured) {
    console.log('☁️  Using MongoDB Atlas (cloud)...');
    return uri;
  }

  // Fallback: Start local in-memory MongoDB
  console.log('💾  Starting MongoDB In-Memory (local)...');
  console.log('    ℹ️  To use cloud Atlas, add MONGO_URI to backend/.env');

  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: 'foodiesDB', port: 27017 }
  });
  const memUri = mongod.getUri();
  console.log(`✅  In-Memory MongoDB started: ${memUri}`);

  // Keep server alive
  process.on('SIGINT',  async () => { await mongod.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await mongod.stop(); process.exit(0); });

  return memUri;
}

// ════════════════════════════════════════════════════════════
//  DATA MIGRATION — db.json → MongoDB
// ════════════════════════════════════════════════════════════
async function migrateFromJSON() {
  const DB_PATH = path.join(__dirname, 'db.json');
  const MIGRATED_FLAG = path.join(__dirname, '.migrated');

  // Skip if already migrated
  if (fs.existsSync(MIGRATED_FLAG)) return;

  if (!fs.existsSync(DB_PATH)) return;

  console.log('\n📦 Migrating data from db.json → MongoDB...');

  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    console.error('⚠️  Could not read db.json:', e.message);
    return;
  }

  // Load models
  const User       = require('./models/User');
  const MenuItem   = require('./models/MenuItem');
  const Order      = require('./models/Order');
  const Newsletter = require('./models/Newsletter');
  const Contact    = require('./models/Contact');
  const PromoCode  = require('./models/PromoCode');

  let counts = { users: 0, menu: 0, orders: 0, newsletter: 0, contacts: 0, promos: 0 };

  // ── Users ──
  if (db.users?.length) {
    for (const u of db.users) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        await User.create({
          name: u.name,
          email: u.email,
          password: u.password,  // already hashed — store directly
          phone: u.phone || '',
          role: u.role || 'user',
          isActive: u.isActive !== false,
          address: u.address || {},
          createdAt: new Date(u.createdAt || Date.now())
        }).catch(() => null); // skip duplicates
        counts.users++;
      }
    }
  }

  // ── Menu Items ──
  if (db.menuItems?.length) {
    for (const item of db.menuItems) {
      const exists = await MenuItem.findOne({ name: item.name });
      if (!exists) {
        await MenuItem.create({
          name: item.name,
          description: item.description || '',
          price: item.price || 0,
          originalPrice: item.originalPrice,
          category: item.category || 'snacks',
          image: item.image || 'img/img/type1.jpg',
          badge: item.badge,
          rating: item.rating || 4.5,
          prepTime: item.prepTime || '15 min',
          serves: item.serves || 1,
          isFeatured: item.isFeatured || false,
          isAvailable: item.isAvailable !== false,
        }).catch(() => null);
        counts.menu++;
      }
    }
  }

  // ── Newsletter ──
  if (db.newsletter?.length) {
    for (const n of db.newsletter) {
      await Newsletter.findOneAndUpdate(
        { email: n.email },
        { email: n.email, createdAt: new Date(n.createdAt || Date.now()) },
        { upsert: true }
      ).catch(() => null);
      counts.newsletter++;
    }
  }

  // ── Contacts ──
  if (db.contacts?.length) {
    for (const c of db.contacts) {
      await Contact.findOneAndUpdate(
        { email: c.email, subject: c.subject, createdAt: new Date(c.createdAt || Date.now()) },
        {
          name: c.name, email: c.email, phone: c.phone || '',
          subject: c.subject, message: c.message,
          isRead: c.isRead || false, reply: c.reply || '',
          repliedAt: c.repliedAt ? new Date(c.repliedAt) : null,
          createdAt: new Date(c.createdAt || Date.now())
        },
        { upsert: true }
      ).catch(() => null);
      counts.contacts++;
    }
  }

  // ── Promo Codes ──
  const defaultPromos = [
    { code: 'FOODIES25', type: 'percent', value: 25, minOrder: 0,   isActive: true },
    { code: 'SAVE50',    type: 'flat',    value: 50, minOrder: 300, isActive: true },
    { code: 'WELCOME',   type: 'percent', value: 15, minOrder: 0,   isActive: true },
  ];
  if (db.promoCodes?.length) {
    for (const p of db.promoCodes) {
      await PromoCode.findOneAndUpdate(
        { code: p.code },
        { code: p.code, type: p.type, value: p.value, minOrder: p.minOrder || 0, isActive: p.isActive !== false },
        { upsert: true }
      ).catch(() => null);
      counts.promos++;
    }
  } else {
    // Seed default promos
    for (const p of defaultPromos) {
      await PromoCode.findOneAndUpdate({ code: p.code }, p, { upsert: true }).catch(() => null);
      counts.promos++;
    }
  }

  // NOTE: Orders are NOT migrated (they reference user IDs that differ between db.json and MongoDB)
  // New orders will be created fresh in MongoDB.

  // Mark as migrated
  fs.writeFileSync(MIGRATED_FLAG, new Date().toISOString());

  console.log(`✅ Migration complete:`);
  console.log(`   👤 Users:      ${counts.users}`);
  console.log(`   🍽️  Menu items: ${counts.menu}`);
  console.log(`   📧 Newsletter: ${counts.newsletter}`);
  console.log(`   💬 Contacts:   ${counts.contacts}`);
  console.log(`   🎟️  Promos:     ${counts.promos}`);
  console.log('   📦 Orders:     skipped (will be created fresh)\n');
}

// ════════════════════════════════════════════════════════════
//  SEED ADMIN (if no admin exists)
// ════════════════════════════════════════════════════════════
async function seedAdmin() {
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    await User.create({
      name:     'Admin',
      email:    'admin@foodies.com',
      password: await bcrypt.hash('admin123', 10),
      phone:    '+91 7007575886',
      role:     'admin',
      isActive: true
    });
    console.log('✅ Admin seeded: admin@foodies.com / admin123');
  }
}

// ════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════
async function start() {
  try {
    const mongoURI = await getMongoURI();

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    console.log('✅  MongoDB Connected');

    // Migrate existing data
    await migrateFromJSON();

    // Seed admin if needed
    await seedAdmin();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════╗');
      console.log('║   🍽️  FOODIES.COM — MongoDB Edition        ║');
      console.log('╠═══════════════════════════════════════════╣');
      console.log(`║   🌐  http://localhost:${PORT}               ║`);
      console.log('║                                           ║');
      console.log('║   👤 Admin: admin@foodies.com             ║');
      console.log('║   🔑 Pass:  admin123                      ║');
      console.log('║                                           ║');
      const dbType = (process.env.MONGO_URI && !process.env.MONGO_URI.includes('<username>'))
        ? '☁️   Atlas (Cloud)'
        : '💾  In-Memory (Local)';
      console.log(`║   🗄️  DB:    ${dbType}           ║`);
      console.log('║   🛑  Ctrl+C to stop                      ║');
      console.log('╚═══════════════════════════════════════════╝');
      console.log('');
    });

  } catch (err) {
    console.error('❌ Server failed to start:', err.message);
    console.error('   Try running: node backend/standalone.js (no MongoDB needed)');
    process.exit(1);
  }
}

start();
