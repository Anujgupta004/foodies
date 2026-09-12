# 🍽️ FOODIES.COM — Full Stack Food Ordering Web App

> A complete food ordering platform with user authentication, menu browsing, cart, Razorpay payment integration, order tracking, promo codes, reviews, and a full admin dashboard.

**Built with:** HTML5 · CSS3 · Bootstrap 5 · Vanilla JS · Node.js · Express · JSON Database (no MongoDB setup needed)

---

## 🌐 Live Demo

> 🔗 **[foodies-demo.onrender.com](https://foodies-demo.onrender.com)** ← *(replace with your Render URL after deploy)*

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| 👤 User | Register any new account | — |
| 🔐 Admin | admin@foodies.com | admin123 |

---

## ✨ Features

### User-Facing
- 🔐 Register / Login with JWT authentication
- 🍔 Browse menu by category (Snacks, Fast Food, Meals, Drinks, Desserts)
- 🛒 Cart with quantity controls, delivery charge & subtotal
- 🎟️ Promo codes — `FOODIES25` (25% off), `SAVE50` (₹50 flat), `WELCOME` (15% off), `SUMMER18` (50% off)
- 💳 Online payment (Razorpay — simulated in demo) + Cash on Delivery
- 📦 Order tracking with live status (Placed → Confirmed → Out for Delivery → Delivered)
- 📝 Cancel orders, write reviews
- 👤 Profile management — update name, phone, address, change password
- 📧 Newsletter subscription
- 📩 Contact form

### Admin Panel *(admin@foodies.com only)*
- 📊 Dashboard — total users, orders, revenue, pending orders
- 📋 All orders with status management
- 👥 User management — activate / deactivate
- 🍽️ Menu management — add, edit, delete items
- 🎟️ Promo code management
- 📬 Contact messages with reply
- ⭐ Review moderation

---

## 🗂️ Project Structure

```
FOODIES.COM/
├── index.html              ← Homepage
├── login.html              ← User login
├── register.html           ← User registration
├── checkout.html           ← Cart + payment
├── orders.html             ← Order history + tracker
├── profile.html            ← User profile
├── admin.html              ← Admin dashboard (protected)
├── order-success.html      ← Order confirmation
├── 404.html                ← Error page
│
├── css/                    ← All stylesheets
├── js/                     ← All frontend JS
├── img/                    ← Images & assets
│
└── backend/
    ├── standalone.js       ← ⭐ Main server (no MongoDB needed)
    ├── db.json             ← JSON database (auto-updates on Render)
    ├── package.json        ← npm start → standalone.js
    ├── .env.render         ← Environment variable reference for Render
    ├── server.js           ← Express + MongoDB version
    ├── server-mongo.js     ← In-memory MongoDB version
    └── routes/ models/ middleware/ utils/
```

---

## 🚀 Run Locally

### Requirements
- [Node.js LTS](https://nodejs.org) installed

### Steps
```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/foodies.com.git
cd foodies.com

# 2. Install dependencies
cd backend
npm install

# 3. Start the server (no .env setup needed for standalone mode)
npm start

# 4. Open browser
# http://localhost:5000
```

That's it — no MongoDB, no Razorpay keys needed. Everything works out of the box.

---

## ☁️ Deploy to Render.com (Free Hosting)

### Step 1 — Push to GitHub

```bash
# In your project root (d:\Fergi Image\FOODIES.COM)
git init
git add .
git commit -m "feat: initial commit — FOODIES.COM full stack app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/foodies.com.git
git push -u origin main
```

### Step 2 — Create Render Service

1. Go to **[render.com](https://render.com)** → Sign up free (use GitHub login)
2. Click **New +** → **Web Service**
3. Connect your GitHub repo → Select `foodies.com`
4. Fill in these settings:

| Setting | Value |
|---------|-------|
| Name | `foodies-demo` *(or any name)* |
| Region | Singapore / Oregon *(closest to you)* |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node standalone.js` |
| Instance Type | **Free** |

### Step 3 — Add Environment Variables on Render

In Render → Your Service → **Environment** tab, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | any long random string (min 32 chars) |
| `CLIENT_URL` | `https://your-app-name.onrender.com` |
| `RAZORPAY_KEY_ID` | *(leave blank — uses simulation mode)* |

> ⚠️ Do NOT add `MONGO_URI` — standalone mode doesn't need it.

### Step 4 — Deploy

Click **Create Web Service** → Render builds and deploys automatically.

Your live URL will be: `https://your-app-name.onrender.com` 🎉

> **Note:** Free tier spins down after 15 min inactivity. First load may take 30–60 sec.
> Upgrade to Render Starter ($7/mo) to keep it always-on.

---

## 💼 LinkedIn Post Template

Once deployed, share on LinkedIn:

---

**Post idea:**

```
🚀 Excited to share my latest project — FOODIES.COM!

A full-stack food ordering web app I built from scratch:

🍔 Browse menu with category filters
🛒 Cart with promo codes & delivery calculation
💳 Razorpay payment integration + Cash on Delivery
📦 Real-time order tracking
👤 User auth (JWT), profile management
🔐 Admin dashboard — orders, users, revenue analytics

Tech Stack:
→ Frontend: HTML, CSS, Bootstrap 5, Vanilla JS
→ Backend: Node.js, Express.js
→ Auth: JWT + bcryptjs
→ Payment: Razorpay
→ Hosting: Render.com

🔗 Live Demo: https://your-app-name.onrender.com
💻 GitHub: https://github.com/YOUR_USERNAME/foodies.com

Try it yourself — register an account and place an order!
Admin panel is restricted to my access only.

#WebDevelopment #NodeJS #JavaScript #FullStack #Portfolio #OpenToWork
```

---

## 💳 Payment Testing

Payments run in **simulation mode** by default (no real money, no Razorpay keys needed).

To use real Razorpay test keys:
1. Get test keys from [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → API Keys
2. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to Render environment variables

Test card (Razorpay test mode):
- Card: `4111 1111 1111 1111` · CVV: any 3 digits · Expiry: any future date
- UPI: `success@razorpay`

---

## 🎟️ Promo Codes

| Code | Discount | Min Order |
|------|----------|-----------|
| `FOODIES25` | 25% off | None |
| `SAVE50` | ₹50 flat | ₹300 |
| `WELCOME` | 15% off | None |
| `SUMMER18` | 50% off | None |

---

## 🔑 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get profile |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/change-password` | Change password |

### Menu
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/menu` | Get all items |
| GET | `/api/menu?category=meals` | Filter by category |
| POST | `/api/menu` | Add item *(admin)* |
| PUT | `/api/menu/:id` | Update item *(admin)* |
| DELETE | `/api/menu/:id` | Delete item *(admin)* |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Place order |
| GET | `/api/orders/my` | My orders |
| GET | `/api/orders/:id` | Order detail |
| PUT | `/api/orders/:id/cancel` | Cancel order |
| PUT | `/api/orders/:id/status` | Update status *(admin)* |

### Payment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/create-order` | Initiate Razorpay payment |
| POST | `/api/payment/verify` | Verify payment |
| POST | `/api/payment/cod-confirm` | Confirm COD |

### Admin *(admin@foodies.com only)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Stats |
| GET | `/api/admin/users` | All users |
| GET | `/api/admin/orders` | All orders |
| GET | `/api/admin/contacts` | Contact messages |
| GET | `/api/admin/revenue` | Revenue by date |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| Animations | AOS (Animate on Scroll) |
| Icons | Bootstrap Icons, Font Awesome |
| Fonts | Google Fonts (Playfair Display + Inter) |
| Backend | Node.js, Express.js |
| Database | JSON flat-file (standalone) / MongoDB (optional) |
| Auth | JWT + bcryptjs |
| Payment | Razorpay (real or simulated) |
| Hosting | Render.com |

---

## 📱 Responsive Design

Works on all screen sizes — mobile, tablet, laptop, desktop.

---

## 👤 Admin Access

Admin panel (`/admin.html`) is restricted — only accessible with `admin@foodies.com` credentials.
All user registrations, orders, contacts, and reviews are visible in the admin dashboard.

---

*Built with ❤️ by **Anuj Gupta***
