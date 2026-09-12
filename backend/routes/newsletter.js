const express = require('express');
const router  = express.Router();
const Newsletter = require('../models/Newsletter');
const { protect, adminOnly } = require('../middleware/auth');

// @POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const existing = await Newsletter.findOne({ email });
    if (existing) {
      return res.status(200).json({ success: true, message: 'Already subscribed! Check your inbox for the discount code.' });
    }

    await Newsletter.create({ email });
    res.status(201).json({
      success: true,
      message: 'Subscribed! Use code FOODIES25 for 25% off your first order.',
      coupon: 'FOODIES25'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/newsletter/list — admin only
router.get('/list', protect, adminOnly, async (req, res) => {
  try {
    const subscribers = await Newsletter.find({ isActive: true }).sort({ subscribedAt: -1 });
    res.json({ success: true, count: subscribers.length, subscribers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
