/**
 * FOODIES.COM — WhatsApp Notification Utility
 *
 * Uses CallMeBot API (free, no charges).
 * Setup (one-time):
 *   1. Save +34 644 97 79 16 in your contacts as "CallMeBot"
 *   2. Send this WhatsApp message to that number:
 *      I allow callmebot to send me messages
 *   3. You will receive an API key in reply — add it to .env as WHATSAPP_API_KEY
 *   4. Add your WhatsApp number (with country code, no +) as WHATSAPP_PHONE
 *      Example: 919876543210  (91 = India country code)
 *
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */

const https = require('https');

/**
 * Send a WhatsApp message via CallMeBot
 * @param {string} message - Plain text message to send
 * @returns {Promise<void>}
 */
async function sendWhatsApp(message) {
  const phone  = process.env.WHATSAPP_PHONE;
  const apiKey = process.env.WHATSAPP_API_KEY;

  // Silently skip if not configured — won't crash the app
  if (!phone || !apiKey || phone === 'YOUR_WHATSAPP_NUMBER') {
    console.log('[WhatsApp] Not configured — skipping notification');
    return;
  }

  const encoded = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        console.log(`[WhatsApp] Notification sent ✅ (status: ${res.statusCode})`);
        resolve();
      });
    }).on('error', (err) => {
      // Non-fatal — log but don't crash order flow
      console.error('[WhatsApp] Notification failed:', err.message);
      resolve();
    });
  });
}

/**
 * Build WhatsApp message for a confirmed order
 * @param {object} order  - Mongoose Order document
 * @param {object} user   - User info { name, email, phone }
 * @param {string} method - 'Razorpay (Online)' | 'Cash on Delivery'
 */
function buildOrderMessage(order, user, method) {
  const items = order.items
    .map(i => `  • ${i.name} ×${i.qty} — ₹${(i.price * i.qty).toFixed(0)}`)
    .join('\n');

  const addr = order.deliveryAddress;

  return (
    `🍽️ *NEW ORDER — FOODIES.COM*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 Order ID : #${order._id.toString().slice(-8).toUpperCase()}\n` +
    `👤 Customer : ${user.name}` +
    (user.phone ? ` | 📞 ${user.phone}` : '') + `\n` +
    `💳 Payment  : ${method}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛒 *Items:*\n${items}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️  Subtotal   : ₹${order.subtotal.toFixed(0)}\n` +
    (order.discount > 0 ? `🎟️  Discount   : -₹${order.discount.toFixed(0)}\n` : '') +
    `🚚 Delivery   : ${order.deliveryCharge === 0 ? 'FREE' : '₹' + order.deliveryCharge}\n` +
    `💰 *TOTAL     : ₹${order.total.toFixed(0)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *Deliver to:*\n` +
    `  ${addr.name}, ${addr.phone}\n` +
    `  ${addr.street}, ${addr.city}\n` +
    `  ${addr.state} — ${addr.pincode}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏰ ETA: ~30–40 minutes`
  );
}

module.exports = { sendWhatsApp, buildOrderMessage };
