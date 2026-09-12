/**
 * Public promo routes: GET /api/promos, POST /api/promos/validate
 * Admin promo routes are in routes/admin.js (/api/admin/promos/*)
 */
const express   = require('express');
const router    = express.Router();
const PromoCode = require('../models/PromoCode');

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

// @GET /api/promos — list all promos
router.get('/', async (req, res) => {
  try {
    await ensureDefaultPromos();
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ success: true, promos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/promos/validate — validate a coupon
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    await ensureDefaultPromos();
    const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) {
      return res.status(400).json({ success: false, message: 'Invalid or expired promo code' });
    }
    if (subtotal < promo.minOrder) {
      return res.status(400).json({ success: false, message: `Minimum order ₹${promo.minOrder} required for this code` });
    }

    const discount = promo.type === 'percent'
      ? Math.round(subtotal * promo.value / 100)
      : promo.value;

    res.json({
      success: true,
      discount,
      message: `✅ ${promo.code} applied! You saved ₹${discount}`,
      promo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
