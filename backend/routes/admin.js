const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Order      = require('../models/Order');
const MenuItem   = require('../models/MenuItem');
const Contact    = require('../models/Contact');
const PromoCode  = require('../models/PromoCode');
const Review     = require('../models/Review');
const { protect, adminOnly } = require('../middleware/auth');

// All routes here require admin access
router.use(protect, adminOnly);

// @GET /api/admin/dashboard — overview stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrders,
      totalRevenuePaid,
      totalRevenueCOD,
      totalItems,
      recentOrders,
      pendingOrders
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Order.countDocuments(),
      // Online paid orders
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      // COD delivered orders (revenue generated even if paymentStatus = pending)
      Order.aggregate([
        { $match: { paymentMethod: 'cod', status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      MenuItem.countDocuments({ isAvailable: true }),
      Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email'),
      Order.countDocuments({ status: 'placed' })
    ]);

    // Total revenue = paid online + COD delivered (avoid double counting)
    const paidTotal = totalRevenuePaid[0]?.total || 0;
    const codTotal  = totalRevenueCOD[0]?.total  || 0;
    // Subtract overlap: COD orders that are also marked paid
    const codPaidOverlap = await Order.aggregate([
      { $match: { paymentMethod: 'cod', status: 'delivered', paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const overlap = codPaidOverlap[0]?.total || 0;
    const totalRevenue = paidTotal + codTotal - overlap;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalOrders,
        totalRevenue: Math.round(totalRevenue),
        totalItems,
        pendingOrders
      },
      recentOrders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/admin/users — all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const users = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await User.countDocuments({ role: 'user' });
    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/admin/users/:id/toggle — activate/deactivate user
router.put('/users/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/admin/revenue — revenue by date range
router.get('/revenue', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    // Include both: online paid + COD delivered orders
    const revenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          $or: [
            { paymentStatus: 'paid' },
            { paymentMethod: 'cod', status: 'delivered' }
          ]
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, revenue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Contacts ──────────────────────────────────────────────────

// @GET /api/admin/contacts
router.get('/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, count: contacts.length, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/admin/contacts/:id/read
router.put('/contacts/:id/read', async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/admin/contacts/:id/reply
router.put('/contacts/:id/reply', async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ success: false, message: 'Reply text is required' });
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { reply, repliedAt: new Date(), isRead: true },
      { new: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Reply saved', contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/admin/contacts/:id
router.delete('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Promo Codes ───────────────────────────────────────────────

async function ensureDefaultPromos() {
  const count = await PromoCode.countDocuments();
  if (count === 0) {
    await PromoCode.insertMany([
      { code: 'FOODIES25', type: 'percent', value: 25, minOrder: 0,   isActive: true },
      { code: 'SAVE50',    type: 'flat',    value: 50, minOrder: 300, isActive: true },
      { code: 'WELCOME',   type: 'percent', value: 15, minOrder: 0,   isActive: true }
    ]);
  }
}

// @POST /api/admin/promos
router.post('/promos', async (req, res) => {
  try {
    const { code, type, value, minOrder } = req.body;
    if (!code || !type || !value) {
      return res.status(400).json({ success: false, message: 'Code, type, and value are required' });
    }
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Promo code already exists' });
    const promo = await PromoCode.create({
      code: code.toUpperCase(), type, value: Number(value), minOrder: Number(minOrder || 0)
    });
    res.status(201).json({ success: true, message: 'Promo created', promo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/admin/promos/:id/toggle
router.put('/promos/:id/toggle', async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promo not found' });
    promo.isActive = !promo.isActive;
    await promo.save();
    res.json({ success: true, message: promo.isActive ? 'Activated' : 'Deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/admin/promos/:id
router.delete('/promos/:id', async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promo not found' });
    res.json({ success: true, message: 'Promo deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Reviews ───────────────────────────────────────────────────

// @GET /api/admin/reviews
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
