'use strict';

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { validateInput, analyze } = require('../utils/analysis');

const router = express.Router();

// Lazy-initialise Razorpay so the server can boot even before keys are set
// (helps in CI / first-run); endpoints will error clearly if keys are missing.
let razorpayClient = null;
function getRazorpay() {
  if (razorpayClient) return razorpayClient;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret || key_id.includes('xxxxxx')) {
    throw new Error('Razorpay keys are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
  }
  razorpayClient = new Razorpay({ key_id, key_secret });
  return razorpayClient;
}

/**
 * Returns the public Razorpay key id so the browser checkout can initialise.
 * Never exposes the secret.
 */
router.get('/config', (req, res) => {
  res.json({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    unlockPricePaise: Number(process.env.UNLOCK_PRICE_PAISE) || 9900,
  });
});

/**
 * POST /api/analyze
 * Free endpoint - returns summary, breakdown, and free insights only.
 * Premium insights are NEVER sent here.
 */
router.post('/analyze', (req, res) => {
  const validation = validateInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }
  const result = analyze(validation.data);
  // Strip premium content for the free response
  const { premiumInsights, ...freeOnly } = result;
  res.json(freeOnly);
});

/**
 * POST /api/create-order
 * Creates a Razorpay order on the server. The amount is fixed server-side
 * so the client cannot manipulate the price.
 */
router.post('/create-order', async (req, res) => {
  try {
    const amount = Number(process.env.UNLOCK_PRICE_PAISE) || 9900; // ₹99 default
    const rzp = getRazorpay();

    const order = await rzp.orders.create({
      amount,
      currency: 'INR',
      receipt: `mmc_${Date.now()}`,
      notes: {
        product: 'Midnight Money Coach - Premium Unlock',
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[create-order] error:', err.message);
    res.status(500).json({ error: 'Could not create payment order. Please try again.' });
  }
});

/**
 * POST /api/verify-payment
 * MANDATORY server-side signature verification.
 * If verification passes, we run the analysis and return premium insights.
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, income, expenses }
 */
router.post('/verify-payment', (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    income,
    expenses,
  } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields.' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || secret.includes('xxxxxx')) {
    return res.status(500).json({ error: 'Server misconfigured: missing Razorpay secret.' });
  }

  // Razorpay signature scheme:
  // HMAC_SHA256(order_id + "|" + payment_id, key_secret) === razorpay_signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const sigBuffer = Buffer.from(razorpay_signature, 'utf8');
  const expBuffer = Buffer.from(expectedSignature, 'utf8');
  const valid =
    sigBuffer.length === expBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expBuffer);

  if (!valid) {
    console.warn('[verify-payment] invalid signature for order', razorpay_order_id);
    return res.status(400).json({ error: 'Invalid payment signature. Payment was not verified.' });
  }

  // Verified! Now run the full analysis and return premium insights.
  const validation = validateInput({ income, expenses });
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }
  const full = analyze(validation.data);

  res.json({
    verified: true,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    ...full,
  });
});

/**
 * Simple health check
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = router;
