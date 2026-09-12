/**
 * FOODIES.COM — Express Backend Server
 * Run: npm run dev (development) or npm start (production)
 */

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
require('dotenv').config();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== REQUEST LOGGER (dev only) =====
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path}`);
    }
    next();
  });
}

// ===== SERVE STATIC FRONTEND =====
// frontend files are one level up from /backend
app.use(express.static(path.join(__dirname, '..'), {
  index: 'index.html',
  extensions: ['html']
}));

// ===== API ROUTES =====
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/menu',            require('./routes/menu'));
app.use('/api/orders',          require('./routes/orders'));
app.use('/api/payment',         require('./routes/payment'));
app.use('/api/newsletter',      require('./routes/newsletter'));
app.use('/api/contact',         require('./routes/contact'));
app.use('/api/contacts',        require('./routes/contact'));   // /api/contacts/my
app.use('/api/reviews',         require('./routes/reviews'));
app.use('/api/promos',          require('./routes/promos'));
app.use('/api/admin',           require('./routes/admin'));     // must be after promos

// ===== CATCH-ALL for HTML pages =====
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  // Try the exact .html file, fall back to index
  const htmlPath = path.join(__dirname, '..', req.path.endsWith('.html') ? req.path : req.path + '.html');
  if (fs.existsSync(htmlPath)) {
    return res.sendFile(htmlPath);
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ===== GLOBAL ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// ===== CONNECT TO MONGODB & START =====
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(PORT, () => {
      console.log('╔════════════════════════════════════╗');
      console.log('║  🚀 FOODIES.COM Backend Running!   ║');
      console.log(`║  🌐 http://localhost:${PORT}          ║`);
      console.log('╚════════════════════════════════════╝');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Check your MONGO_URI in backend/.env');
    process.exit(1);
  });
