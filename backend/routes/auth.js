const express = require('express');
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

// In-memory OTP store (works without extra DB collection)
const otpStore = new Map(); // key: email → { otp, expires }

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, phone });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/auth/me — get logged-in user profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/auth/profile — update profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, address },
      { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Profile updated', user: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/auth/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/auth/change-email
router.put('/change-email', protect, async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    if (!newEmail || !password) {
      return res.status(400).json({ success: false, message: 'New email and password are required' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(password))) {
      return res.status(400).json({ success: false, message: 'Password is incorrect' });
    }
    const existing = await User.findOne({ email: newEmail.toLowerCase().trim() });
    if (existing && existing._id.toString() !== user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Email already in use by another account' });
    }
    user.email = newEmail.toLowerCase().trim();
    await user.save();
    res.json({ success: true, message: 'Email updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/forgot-password — generate OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always return success for security — don't reveal if email exists
    if (!user) {
      return res.json({ success: true, message: 'If this email exists, a reset code has been sent.' });
    }

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    otpStore.set(email.toLowerCase(), { otp, expires });

    // Log OTP in dev mode (in production you'd send email via Nodemailer)
    console.log(`🔑 Password Reset OTP for ${email}: ${otp}`);

    res.json({
      success: true,
      message: 'Reset code generated.',
      // Return OTP in dev mode so it's usable without email setup
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      devNote: process.env.NODE_ENV !== 'production'
        ? 'Dev mode: OTP shown here. In production, it would be emailed.'
        : undefined
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/verify-otp — verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const record = otpStore.get(email.toLowerCase());
    if (!record || record.otp !== otp || record.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.json({ success: true, message: 'OTP verified. Enter your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/reset-password — set new password after OTP verified
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const record = otpStore.get(email.toLowerCase());
    if (!record || record.otp !== otp || record.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    // Remove used OTP
    otpStore.delete(email.toLowerCase());

    res.json({ success: true, message: 'Password reset successfully! You can now login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
