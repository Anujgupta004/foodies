const express = require('express');
const router  = require('express').Router();
const crypto  = require('crypto');
const Order   = require('../models/Order');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendWhatsApp, buildOrderMessage } = require('../utils/whatsapp');

// Initialize Razorpay lazily so missing keys don't crash on startup
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('XXXX')) {
    throw new Error('Razorpay keys not configured. Add them to backend/.env');
  }
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// @POST /api/payment/create-order
router.post('/create-order', protect, async (req, res) => {
  try {
    const razorpay  = getRazorpay();
    const { orderId } = req.body;

    const dbOrder = await Order.findById(orderId);
    if (!dbOrder) return res.status(404).json({ success: false, message: 'Order not found' });
    if (dbOrder.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(dbOrder.total * 100),  // paise
      currency: 'INR',
      receipt:  `order_${dbOrder._id}`,
      notes:    { orderId: dbOrder._id.toString() }
    });

    dbOrder.razorpayOrderId = razorpayOrder.id;
    await dbOrder.save();

    res.json({
      success:        true,
      razorpayOrderId: razorpayOrder.id,
      amount:          razorpayOrder.amount,
      currency:        razorpayOrder.currency,
      key:             process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/payment/verify
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed — signature mismatch' });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus:     'paid',
        status:            'confirmed',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      },
      { new: true }
    );

    // ── WhatsApp notification to restaurant ──────────────────
    try {
      const user = await User.findById(req.user._id).select('name email phone');
      const msg  = buildOrderMessage(order, user, 'Razorpay (Online) ✅');
      sendWhatsApp(msg); // fire-and-forget, non-blocking
    } catch (_) { /* never block order flow */ }

    res.json({ success: true, message: 'Payment verified', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/payment/cod-confirm
router.post('/cod-confirm', protect, async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: 'confirmed', paymentStatus: 'pending' },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // ── WhatsApp notification to restaurant ──────────────────
    try {
      const user = await User.findById(req.user._id).select('name email phone');
      const msg  = buildOrderMessage(order, user, 'Cash on Delivery 💵');
      sendWhatsApp(msg); // fire-and-forget, non-blocking
    } catch (_) { /* never block order flow */ }

    res.json({ success: true, message: 'COD order confirmed', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
