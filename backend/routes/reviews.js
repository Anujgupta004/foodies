const express = require('express');
const router  = express.Router();
const Review  = require('../models/Review');
const { protect, adminOnly } = require('../middleware/auth');

// @POST /api/reviews — logged-in user submits review
router.post('/', protect, async (req, res) => {
  try {
    const { itemId, itemName, rating, comment } = req.body;
    if (!itemId || !rating) {
      return res.status(400).json({ success: false, message: 'itemId and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1–5' });
    }

    // Upsert — user can update their own review
    const review = await Review.findOneAndUpdate(
      { user: req.user._id, itemId },
      { userName: req.user.name, itemName: itemName || itemId, rating: Number(rating), comment: comment || '' },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const isNew = !review.createdAt || review.updatedAt - review.createdAt < 1000;
    res.status(201).json({
      success: true,
      message: isNew ? 'Review added! Thank you.' : 'Review updated!',
      review
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/reviews?itemId=xxx — get reviews for a specific item
router.get('/', async (req, res) => {
  try {
    const { itemId } = req.query;
    const filter = itemId ? { itemId } : {};
    const reviews = await Review.find(filter).sort({ createdAt: -1 });
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    res.json({ success: true, count: reviews.length, avg, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/admin/reviews — admin gets all reviews
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/admin/reviews/:id — admin deletes a review
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
