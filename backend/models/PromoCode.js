const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema({
  code:     { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:     { type: String, enum: ['percent', 'flat'], required: true },
  value:    { type: Number, required: true, min: 1 },
  minOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('PromoCode', promoSchema);
