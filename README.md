# 🌙 Midnight Money Coach

A modern, Gen Z-friendly finance education SaaS for Indian users. Drop in your monthly numbers, get instant insights, unlock a full optimization plan for ₹99 via Razorpay.

**Stack:** HTML + Tailwind CSS + Vanilla JS · Node.js + Express · Razorpay

---

## ✨ Features

- **Instant budget analysis** — income vs expenses, health score (0-100), category breakdown with healthy-zone markers
- **Free insights** — savings summary + 3 smart suggestions
- **Premium unlock (₹99)** — full optimization plan, per-category savings targets, 4-bucket SIP split, 10-year wealth projection, 8 actionable tips
- **Demo mode** — one click auto-fills realistic ₹30,000 income + expenses
- **Server-side payment verification** — HMAC-SHA256 signature check before unlocking. Premium content is never sent to the client without verification.
- **Security baked in** — Helmet, CSP, CORS, rate limiting, input validation, timing-safe signature comparison

---

## 📁 File Structure

```
midnight-money-coach/
├── public/                    # Frontend (served as static files)
│   ├── index.html             # Single-page app, dark Gen Z UI
│   └── js/
│       └── app.js             # All client-side logic
├── server/                    # Backend
│   ├── server.js              # Express app, middleware, static serving
│   ├── routes/
│   │   └── api.js             # /api/analyze, /api/create-order, /api/verify-payment
│   └── utils/
│       └── analysis.js        # Pure budget analysis engine
├── .env.example               # Environment template (copy to .env)
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Quick Start (Local)

### 1. Prerequisites

- **Node.js 18+** ([download](https://nodejs.org))
- A **Razorpay account** ([signup](https://dashboard.razorpay.com/signup) — free, no KYC needed for test mode)

### 2. Install

```bash
git clone <your-repo-url> midnight-money-coach
cd midnight-money-coach
npm install
```

### 3. Set up environment

```bash
cp .env.example .env
```

Open `.env` and fill in your Razorpay test keys (see next section).

### 4. Run

```bash
npm start
# or for auto-reload during development:
npm run dev
```

Visit **http://localhost:3000**

---

## 🔑 Razorpay Integration — Step-by-Step

### Step 1 — Get your API keys

1. Sign up / log in at <https://dashboard.razorpay.com>
2. The dashboard opens in **Test Mode** by default (top-left toggle). Stay in Test Mode for development.
3. Go to **Account & Settings → API Keys → Generate Test Key**
4. Razorpay shows you two values:
   - `Key Id` — looks like `rzp_test_AbCdEfGhIjKlMn` *(public, safe in frontend)*
   - `Key Secret` — random 24-character string *(SECRET — server only, never expose)*
5. Copy both into your `.env`:

   ```env
   RAZORPAY_KEY_ID=rzp_test_AbCdEfGhIjKlMn
   RAZORPAY_KEY_SECRET=your_secret_here
   UNLOCK_PRICE_PAISE=9900
   ```

### Step 2 — How the flow works (under the hood)

```
[Browser]                  [Your Server]              [Razorpay]
   │                            │                         │
   │ click "Unlock Full Report" │                         │
   ├───────────────────────────►│                         │
   │                            │ create order (₹99)     │
   │                            ├────────────────────────►│
   │                            │◄────── order_id ───────│
   │◄───── order_id ────────────│                         │
   │                            │                         │
   │ open Razorpay Checkout     │                         │
   ├────────────────────────────┼────────────────────────►│
   │                            │                         │
   │ user pays (UPI/Card/etc)   │                         │
   │                            │                         │
   │◄── payment_id + signature ─┼─────────────────────────│
   │                            │                         │
   │ POST signature to backend  │                         │
   ├───────────────────────────►│                         │
   │                            │ HMAC verify (server)    │
   │                            │                         │
   │◄── premium insights ───────│                         │
```

### Step 3 — Signature verification (the critical part)

The backend computes:

```
expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
```

and compares it with `razorpay_signature` using **`crypto.timingSafeEqual`** (prevents timing attacks). Only on a match does the server return the premium payload. This logic lives in `server/routes/api.js → /verify-payment`.

### Step 4 — Test cards & UPI (Test Mode)

Use any of these in the Razorpay checkout while in test mode (full list: <https://razorpay.com/docs/payments/payments/test-card-upi-details/>):

| Method     | Value                              | Result   |
|------------|------------------------------------|----------|
| UPI ID     | `success@razorpay`                 | success  |
| UPI ID     | `failure@razorpay`                 | failure  |
| Card       | `4111 1111 1111 1111`              | success  |
| Card CVV   | any 3 digits                       | —        |
| Card expiry| any future date                    | —        |
| Card OTP   | `1234` (in the test OTP screen)    | —        |

No real money moves in test mode.

### Step 5 — Go live

1. Complete Razorpay KYC (Activate Account on the dashboard).
2. Generate **Live Keys** (the toggle switches from Test → Live).
3. Replace the test keys in your production `.env` with the live ones (`rzp_live_...`).
4. **Never commit live keys.** Use your VPS environment variables or a secrets manager.

---

## 🧪 Local Testing — Full Manual Run-through

After `npm start`:

1. **Open** http://localhost:3000
2. **Click "Try Demo (no signup)"** — should auto-fill ₹30,000 income + realistic expenses and immediately scroll to results.
3. **Check the free results show:**
   - 4 KPI cards (Income / Total spent / Savings / Red flags)
   - Health score with grade label
   - Donut chart with category legend
   - Category breakdown bars with healthy markers
   - 3 free insight cards
   - Locked premium section with a blurred preview and "Unlock Full Report" button
4. **Click "Unlock Full Report"** — Razorpay checkout should slide in.
5. **Pay with test UPI** `success@razorpay`.
6. **Verify:**
   - Status modal shows "Verifying payment..." then "Payment verified!"
   - Locked section is replaced by the full premium playbook (banner + optimization plan + emergency fund card + SIP split + 8 action tips)
   - Browser DevTools → Network → `/api/verify-payment` returned `200` with `verified: true`
7. **Tamper test** (security check):
   - Open DevTools Console while paying with `success@razorpay`, but BEFORE the verify request finishes, modify the request body or use a fake signature — backend should respond `400 Invalid payment signature`.

### Quick API tests with curl

```bash
# Health check
curl http://localhost:3000/api/health

# Free analysis
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"income":30000,"expenses":{"rent":8000,"food":6500,"travel":2500,"utilities":1800,"entertainment":2200,"shopping":3000,"emi":4500,"other":1000}}'

# Create order
curl -X POST http://localhost:3000/api/create-order
```

---

## 🛰️ Deploy to a VPS (Hostinger / DigitalOcean / Any Linux box)

These steps assume an Ubuntu 22.04 / 24.04 VPS.

### 1. SSH into your server

```bash
ssh root@your.server.ip
```

### 2. Install Node.js, Nginx, and PM2

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# PM2 (process manager — keeps your app running after you log out)
sudo npm install -g pm2
```

### 3. Upload your code

Either `git clone` directly on the server or use `scp` / `rsync` to upload the project folder.

```bash
cd /var/www
git clone https://github.com/yourname/midnight-money-coach.git
cd midnight-money-coach
npm install --omit=dev
```

### 4. Create the production `.env`

```bash
nano .env
```

Paste your **LIVE** Razorpay keys (or test keys if you are still testing), set `NODE_ENV=production`, and set `CLIENT_ORIGIN` to your domain:

```env
PORT=3000
NODE_ENV=production
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
UNLOCK_PRICE_PAISE=9900
CLIENT_ORIGIN=https://yourdomain.com
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

### 5. Start the app with PM2

```bash
pm2 start server/server.js --name midnight-money-coach
pm2 save
pm2 startup    # follow the printed instructions so PM2 starts on server reboot
```

Check it's running: `pm2 logs midnight-money-coach`

### 6. Configure Nginx as a reverse proxy

```bash
sudo nano /etc/nginx/sites-available/midnight-money-coach
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/midnight-money-coach /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Point your domain

In Hostinger DNS panel (or your registrar), add an **A record** pointing `yourdomain.com` → your VPS IP. Wait for DNS to propagate (usually <5 min).

### 8. Add HTTPS (free, via Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will auto-edit your Nginx config and set up auto-renewal.

### 9. Firewall (optional but recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 10. Done!

Open `https://yourdomain.com`. You should see your live app.

#### Updating the app later

```bash
cd /var/www/midnight-money-coach
git pull
npm install --omit=dev
pm2 restart midnight-money-coach
```

---

## 🔒 Security Notes

- **Premium content is gated server-side.** The free `/api/analyze` endpoint never returns `premiumInsights`. The full report is only sent after `crypto.timingSafeEqual` confirms the Razorpay signature.
- **Inputs are validated** — income and each expense must be a finite, non-negative number under 1,000,000,000. Unknown keys are ignored.
- **Rate limiting**: 30 requests/min/IP across all `/api` routes.
- **Helmet CSP** restricts script sources to self + Razorpay + Tailwind CDN.
- **No data persistence.** The server is stateless; nothing about a user's finances is logged or stored.
- **Secret hygiene** — only `RAZORPAY_KEY_ID` (public) is sent to the browser. `RAZORPAY_KEY_SECRET` never leaves the server.

---

## ⚙️ Tweaking

- **Change the price**: edit `UNLOCK_PRICE_PAISE` in `.env` (in paise — `9900` = ₹99).
- **Adjust healthy spending ratios**: edit `HEALTHY_RATIOS` in `server/utils/analysis.js`.
- **Add a new expense category**: add it to `HEALTHY_RATIOS` + `CATEGORY_META` in `analysis.js`, and add a matching input field in `public/index.html`.
- **Change accent colors**: edit the `colors` block in the Tailwind config inside `public/index.html`.

---

## 📝 License

MIT — do whatever you want with it.
