# 🛍️ MyShopNest

A modern **full-stack e-commerce web application** built with **Node.js, Express.js, SQLite, and Vanilla JavaScript**.

MyShopNest delivers a complete online shopping experience with secure authentication, product browsing, cart management, checkout, payments, and admin controls.

---

## 🌟 Key Features

### 👤 User Features

* Secure user registration & login
* Password hashing for enhanced security
* Browse products by categories
* Shopping cart functionality
* Seamless checkout process
* Razorpay payment integration
* View order history & order details
* Responsive mobile-friendly UI

### 🛠️ Admin Features

* Admin dashboard access
* Product management
* Order management
* Secure admin-only routes

### 🗄️ Technical Features

* SQLite database integration
* RESTful API architecture
* Environment variable configuration
* Clean project structure
* Local lightweight deployment

---

## 📋 Prerequisites

Before running the project, ensure you have:

* **Node.js** (v14 or higher)
* **npm** (comes with Node.js)

---

## 🚀 Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone <repository-url>
cd MyShopNest
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 4️⃣ Start the Application

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm start
```

### 🌐 Access the App

```bash
http://localhost:3000
```

---

## 📁 Project Structure

```bash
MyShopNest/
├── backend/
│   ├── server.js
│   ├── db.js
│   └── data/
│       └── products.js
│
├── frontend/
│   ├── index.html
│   ├── html/
│   │   ├── products.html
│   │   ├── cart.html
│   │   ├── checkout.html
│   │   ├── login.html
│   │   ├── register.html
│   │   ├── orders.html
│   │   └── admin.html
│   ├── css/
│   └── js/
│
├── scripts/
│   ├── start-backend.js
│   └── generate_project_report.py
│
├── package.json
└── README.md
```

---

## 🔐 Default Admin Credentials

> ⚠️ **For testing purposes only**

* **Email:** `admin@amazon-portfolio.local`
* **Password:** `Admin@12345`

### ⚠️ Important:

Change these credentials before deploying to production.

---

## 🔗 API Endpoints

### Authentication

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/login`    | User login        |
| POST   | `/api/auth/register` | User registration |
| POST   | `/api/auth/logout`   | User logout       |

### Products

| Method | Endpoint            | Description         |
| ------ | ------------------- | ------------------- |
| GET    | `/api/products`     | Get all products    |
| GET    | `/api/products/:id` | Get product details |
| GET    | `/api/categories`   | Get categories      |

### Cart

| Method | Endpoint        | Description     |
| ------ | --------------- | --------------- |
| GET    | `/api/cart`     | View cart       |
| POST   | `/api/cart/add` | Add item        |
| DELETE | `/api/cart/:id` | Remove item     |
| PUT    | `/api/cart/:id` | Update quantity |

### Orders

| Method | Endpoint          | Description   |
| ------ | ----------------- | ------------- |
| GET    | `/api/orders`     | Get orders    |
| POST   | `/api/orders`     | Create order  |
| GET    | `/api/orders/:id` | Order details |

### Payments

| Method | Endpoint                        | Description          |
| ------ | ------------------------------- | -------------------- |
| GET    | `/api/payments/razorpay/config` | Razorpay config      |
| POST   | `/api/payments/razorpay/order`  | Create payment order |
| POST   | `/api/payments/razorpay/verify` | Verify payment       |

### Admin

| Method | Endpoint              | Description       |
| ------ | --------------------- | ----------------- |
| GET    | `/api/admin/orders`   | View all orders   |
| GET    | `/api/admin/products` | View all products |
| POST   | `/api/admin/products` | Add product       |

---

## 🗄️ Database Schema

### Main Tables:

* **users** → User authentication data
* **products** → Product listings
* **categories** → Product categories
* **cart** → User shopping cart
* **orders** → Order records
* **order_items** → Items within each order

---

## 🔄 Application Workflow

```bash
User Registration/Login
        ↓
Browse Products
        ↓
Add to Cart
        ↓
Checkout
        ↓
Razorpay Payment
        ↓
Order Confirmation
        ↓
Order History
```

---

## 🔒 Security Features

* Password hashing with `crypto.scryptSync`
* Protected admin routes
* Environment variable security
* CORS protection
* Secure payment verification

---

## 🚨 Troubleshooting

### Port Already in Use

```bash
Change PORT in .env
```

### Reset Database

```bash
Delete backend/data/store.db
```

### Razorpay Issues

```bash
GET /api/payments/razorpay/config
```

Ensure your credentials are correct.

---

## 📦 Major Dependencies

* **express** → Backend framework
* **cors** → Security middleware
* **dotenv** → Environment configuration
* **sqlite** → Database engine

---

## 📝 Future Enhancements

* [ ] Email notifications
* [ ] Wishlist system
* [ ] Product reviews & ratings
* [ ] Advanced search filters
* [ ] Multiple payment gateways
* [ ] Inventory management
* [ ] User profile customization
* [ ] Real-time order tracking

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 👨‍💻 Author

Developed as a professional **e-commerce portfolio project**.

---

## 🤝 Support

If you encounter any issues or have suggestions:

### 📌 Open an Issue on GitHub

Your feedback is always welcome.

---

# ⭐ If you like this project, consider giving it a star on GitHub!

**Happy Shopping! 🛒**
