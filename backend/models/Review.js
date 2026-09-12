const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  itemId:   { type: String, required: true },   // menu item _id or name-based key
  itemName: { type: String, required: true },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  comment:  { type: String, default: '' }
}, { timestamps: true });

// One review per user per item
reviewSchema.index({ user: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
