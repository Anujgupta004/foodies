const express = require('express');
const router  = express.Router();
const Contact = require('../models/Contact');
const { protect, adminOnly } = require('../middleware/auth');

// @POST /api/contact — submit a contact query
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, subject and message are required' });
    }
    await Contact.create({ name, email, phone, subject, message });
    res.status(201).json({ success: true, message: 'Message sent! We will get back to you within 24 hours.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/contacts/my — user sees their own queries by email
router.get('/my', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ success: false, message: 'Email query param required' });
    const contacts = await Contact.find({ email: email.toLowerCase() }).sort({ createdAt: -1 });
    res.json({ success: true, count: contacts.length, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin routes ──────────────────────────────────────────────

// @GET /api/admin/contacts — get all contacts
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, count: contacts.length, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/admin/contacts/:id/read — mark as read
router.put('/admin/:id/read', protect, adminOnly, async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/admin/contacts/:id/reply — admin replies to query
router.put('/admin/:id/reply', protect, adminOnly, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ success: false, message: 'Reply text is required' });
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { reply, repliedAt: new Date(), isRead: true },
      { new: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Reply saved', contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/admin/contacts/:id — delete contact
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
