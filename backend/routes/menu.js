const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const { protect, adminOnly } = require('../middleware/auth');

// @GET /api/menu — get all available items
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isAvailable: true };
    if (category && category !== 'all') filter.category = category;

    const items = await MenuItem.find(filter).sort({ isFeatured: -1, createdAt: -1 });
    res.json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/menu/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/menu — admin add item
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const item = await MenuItem.create(req.body);
    res.status(201).json({ success: true, message: 'Item added', item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/menu/:id — admin update item
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item updated', item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/menu/:id — admin delete item
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
