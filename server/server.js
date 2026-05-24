'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
app.use((req, res, next) => {
  res.setHeader("Access-Control-Expose-Headers", "x-rtb-fingerprint-id, request-id");
  next();
});
// ---------- Security ----------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allows external assets to read cross-origin data safely
    crossOriginOpenerPolicy: { policy: "unsafe-none" },    // Fixes communication blocks with popups/iframes
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://checkout.razorpay.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "connect-src": ["'self'", "https://api.razorpay.com", "https://*.razorpay.com", "https://checkout.razorpay.com"],
        "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        "img-src": ["'self'", "data:", "https:"],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Rate limiting - protects analyze + payment endpoints from abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // max 30 requests/min/IP across all /api routes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again in a minute.' },
});
app.use('/api', apiLimiter);

// ---------- Routes ----------
app.use('/api', apiRouter);

// ---------- Static frontend ----------
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// SPA fallback - serve index.html for unknown non-api routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ---------- Error handling ----------
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║   Midnight Money Coach — running on :${String(PORT).padEnd(8)}  ║
║   Mode: ${(process.env.NODE_ENV || 'development').padEnd(38)} ║
║   Razorpay configured: ${(process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('xxxxxx') ? 'YES' : 'NO  - add keys to .env').padEnd(23)} ║
╚════════════════════════════════════════════════╝
  `);
});
