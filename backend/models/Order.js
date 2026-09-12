const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  },
  name:  { type: String, required: true },
  price: { type: Number, required: true },
  qty:   { type: Number, required: true, min: 1 }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],

  deliveryAddress: {
    name:    { type: String, required: true },
    phone:   { type: String, required: true },
    street:  { type: String, required: true },
    city:    { type: String, required: true },
    state:   { type: String, required: true },
    pincode: { type: String, required: true }
  },

  subtotal:       { type: Number, required: true },
  deliveryCharge: { type: Number, default: 40 },
  discount:       { type: Number, default: 0 },
  total:          { type: Number, required: true },

  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod'],
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },

  razorpayOrderId:   String,
  razorpayPaymentId: String,
  razorpaySignature: String,

  status: {
    type: String,
    enum: ['placed', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'placed'
  },

  estimatedDelivery: {
    type: Date
  },

  notes: String

}, { timestamps: true });

// Set estimated delivery on creation
orderSchema.pre('save', function (next) {
  if (this.isNew) {
    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + 30);
    this.estimatedDelivery = eta;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
