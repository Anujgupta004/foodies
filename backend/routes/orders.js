const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { protect, adminOnly } = require('../middleware/auth');

// @POST /api/orders — place new order
router.post('/', protect, async (req, res) => {
  try {
    const { items, deliveryAddress, paymentMethod, subtotal, discount, couponCode } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have at least one item' });
    }

    const deliveryCharge = subtotal >= 500 ? 0 : 40;
    let discountAmt = 0;

    // Coupon validation
    if (couponCode === 'FOODIES25' && discount === 0) {
      discountAmt = Math.round(subtotal * 0.25);
    } else {
      discountAmt = discount || 0;
    }

    const total = subtotal + deliveryCharge - discountAmt;

    const order = await Order.create({
      user: req.user._id,
      items,
      deliveryAddress,
      paymentMethod,
      subtotal,
      deliveryCharge,
      discount: discountAmt,
      total
    });

    res.status(201).json({ success: true, message: 'Order placed', order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @GET /api/orders/my — get logged-in user's orders
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders/:id — get single order (owner or admin)
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Only the owner or admin can view
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders — admin get all orders
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.json({ success: true, total, page: Number(page), orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/orders/:id/status — admin update order status
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Auto-mark COD as paid when delivered
    const updateData = { status };
    if (status === 'delivered') {
      updateData.paymentStatus = 'paid';
    }
    if (status === 'cancelled') {
      updateData.paymentStatus = 'failed';
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    res.json({ success: true, message: 'Order status updated', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/orders/:id/cancel — user cancel order
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (!['placed', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
    }

    order.status = 'cancelled';
    await order.save();
    res.json({ success: true, message: 'Order cancelled', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
