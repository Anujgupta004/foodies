const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number
  },
  category: {
    type: String,
    required: true,
    enum: ['fastfood', 'snacks', 'drinks', 'desserts', 'meals'],
    lowercase: true
  },
  image: {
    type: String,
    default: 'img/img/type1.jpg'
  },
  badge: {
    type: String   // e.g. "Popular", "New", "Chef's Pick"
  },
  rating: {
    type: Number,
    default: 4.5,
    min: 0,
    max: 5
  },
  prepTime: {
    type: String,
    default: '15 min'
  },
  serves: {
    type: Number,
    default: 1
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
