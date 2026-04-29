const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { db, hashPassword, verifyPassword, ADMIN_EMAIL, ADMIN_NAME } = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Return a clean API error when request JSON is malformed.
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  return next(error);
});

app.use("/css", express.static(path.join(__dirname, "..", "frontend", "css")));
app.use("/js", express.static(path.join(__dirname, "..", "frontend", "js")));
app.use(express.static(path.join(__dirname, "..", "frontend", "html")));

function serializeRating(rating) {
  const full = Math.floor(rating);
  const empty = 5 - full;
  return `${"★".repeat(full)}${"☆".repeat(empty)}`;
}

function mapProduct(row) {
  return {
    id: row.id,
    category: row.category_id,
    name: row.name,
    price: Number(row.price),
    rating: serializeRating(row.rating),
    ratingValue: row.rating,
    stock: Number(row.stock || 0),
    inStock: Number(row.stock || 0) > 0,
    feature: row.feature || "",
    description: row.description || "",
    image: row.image
  };
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.is_admin),
    isBlocked: Boolean(row.is_blocked),
    blockedAt: row.blocked_at || null,
    created_at: row.created_at
  };
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(amount));
}

function getCancelableStages() {
  return new Set(["Order Confirmed", "Packed", "Shipped"]);
}

function canCancelOrder(row) {
  return row.status !== "Cancelled"
    && row.tracking_stage !== "Delivered"
    && getCancelableStages().has(row.tracking_stage);
}

function getTrackingSteps(currentStage) {
  if (currentStage === "Cancelled") {
    return [
      {
        label: "Order Cancelled",
        completed: true
      }
    ];
  }

  const baseSteps = [
    "Order Confirmed",
    "Packed",
    "Shipped",
    "Out for Delivery",
    "Delivered"
  ];

  return baseSteps.map((label) => ({
    label,
    completed: baseSteps.indexOf(label) <= baseSteps.indexOf(currentStage)
  }));
}

function mapOrder(row, items = []) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    trackingStage: row.tracking_stage,
    paymentMethod: row.payment_method,
    paymentLast4: row.payment_last4 || "",
    deliveryName: row.delivery_name,
    deliveryPhone: row.delivery_phone,
    deliveryAddress: row.delivery_address,
    deliveryCity: row.delivery_city,
    deliveryState: row.delivery_state,
    deliveryZip: row.delivery_zip,
    subtotal: formatCurrency(row.subtotal),
    shipping: formatCurrency(row.shipping),
    tax: formatCurrency(row.tax),
    total: formatCurrency(row.total),
    placedAt: row.placed_at,
    estimatedDelivery: row.estimated_delivery,
    canCancel: canCancelOrder(row),
    trackingSteps: getTrackingSteps(row.tracking_stage),
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      price: formatCurrency(item.product_price),
      image: item.product_image,
      qty: item.quantity
    }))
  };
}

function getRequestUser(req) {
  // Use a server-issued session token for identifying the user. Do not trust client-supplied user ids.
  const rawToken = req.headers["x-session-token"]; 
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!token) {
    return null;
  }

  return db.prepare(`
    SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at
    FROM users
    WHERE session_token = ?
  `).get(token);
}

function requireAdmin(req, res, next) {
  const user = getRequestUser(req);

  if (!user || !user.is_admin) {
    return res.status(403).json({ error: "Admin access is required." });
  }

  if (user.is_blocked) {
    return res.status(403).json({ error: "Blocked admin accounts cannot perform this action." });
  }

  req.currentUser = user;
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/admin", (_req, res) => {
  const admin = db.prepare(`
    SELECT id, name, email, is_admin, created_at
    FROM users
    WHERE email = ?
  `).get(ADMIN_EMAIL);

  res.json({
    user: admin ? mapUser(admin) : { id: 0, name: ADMIN_NAME, email: ADMIN_EMAIL, isAdmin: true }
  });
});

app.get("/api/products", (req, res) => {
  const { category, search } = req.query;
  const clauses = [];
  const params = {};

  if (category) {
    const validCategory = db.prepare("SELECT id FROM categories WHERE id = ?").get(String(category));
    if (!validCategory) {
      return res.status(400).json({ error: "Invalid department category." });
    }
    clauses.push("category_id = @category");
    params.category = String(category);
  }

  if (search) {
    clauses.push("LOWER(name) LIKE LOWER(@search)");
    params.search = `%${search}%`;
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT id, category_id, name, price, rating, stock, image
    FROM products
    ${whereClause}
    ORDER BY id
  `).all(params);

  res.json({
    products: rows.map(mapProduct)
  });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `).run(String(name).trim(), normalizedEmail, hashPassword(password));

  // Create a session token for the new user
  const sessionToken = crypto.randomBytes(32).toString("hex");
  db.prepare("UPDATE users SET session_token = ? WHERE id = ?").run(sessionToken, info.lastInsertRowid);

  const user = db.prepare("SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at FROM users WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ user: mapUser(user), sessionToken });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (user.is_blocked) {
    return res.status(403).json({ error: "This account has been blocked. Please contact the administrator." });
  }

  // Issue a new session token for this login
  const sessionToken = crypto.randomBytes(32).toString("hex");
  db.prepare("UPDATE users SET session_token = ? WHERE id = ?").run(sessionToken, user.id);

  const updatedUser = db.prepare("SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at FROM users WHERE id = ?").get(user.id);

  res.json({
    user: mapUser(updatedUser),
    sessionToken
  });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at
    FROM users
    ORDER BY is_admin DESC, created_at DESC, id DESC
  `).all();

  res.json({
    users: rows.map(mapUser)
  });
});

app.patch("/api/admin/users/:userId/block", requireAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  const shouldBlock = Boolean(req.body.blocked);

  if (!userId) {
    return res.status(400).json({ error: "A valid user id is required." });
  }

  const targetUser = db.prepare(`
    SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  if (targetUser.is_admin) {
    return res.status(403).json({ error: "Admin accounts cannot be blocked." });
  }

  db.prepare(`
    UPDATE users
    SET is_blocked = ?, blocked_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ?
  `).run(shouldBlock ? 1 : 0, shouldBlock ? 1 : 0, userId);

  const updatedUser = db.prepare(`
    SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at
    FROM users
    WHERE id = ?
  `).get(userId);

  res.json({
    user: mapUser(updatedUser)
  });
});

app.delete("/api/admin/users/:userId", requireAdmin, (req, res) => {
  const userId = Number(req.params.userId);

  if (!userId) {
    return res.status(400).json({ error: "A valid user id is required." });
  }

  if (req.currentUser.id === userId) {
    return res.status(403).json({ error: "You cannot delete your own admin account." });
  }

  const targetUser = db.prepare(`
    SELECT id, is_admin
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  if (targetUser.is_admin) {
    return res.status(403).json({ error: "Admin accounts cannot be deleted." });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  res.json({ ok: true });
});

// ADMIN PRODUCT MANAGEMENT ENDPOINTS
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const { categoryId, name, price, stock, feature, description, rating, image } = req.body;

  if (!categoryId || !name) {
    return res.status(400).json({ error: "Category and product name are required." });
  }

  try {
    const info = db.prepare(`
      INSERT INTO products (category_id, name, price, stock, feature, description, rating, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      categoryId,
      name,
      price || 0,
      stock || 0,
      feature || "",
      description || "",
      rating || 4.0,
      image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800"
    );

    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid);
    return res.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/admin/products/:productId", requireAdmin, (req, res) => {
  const productId = Number(req.params.productId);

  if (!productId) {
    return res.status(400).json({ error: "A valid product id is required." });
  }

  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);

  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  db.prepare("DELETE FROM products WHERE id = ?").run(productId);
  res.json({ ok: true });
});

// ADMIN ORDER MANAGEMENT ENDPOINTS
app.get("/api/admin/orders", requireAdmin, (_req, res) => {
  try {
    const orderRows = db.prepare(`
      SELECT id, user_id, order_number, status, tracking_stage, payment_method, 
             payment_last4, delivery_name, delivery_phone, delivery_address, 
             delivery_city, delivery_state, delivery_zip, 
             subtotal, tax, shipping, total, placed_at
      FROM orders
      ORDER BY placed_at DESC
      LIMIT 100
    `).all();

    const orders = orderRows.map((orderRow) => {
      const itemRows = db.prepare(`
        SELECT product_name as name, quantity as qty, product_price as price
        FROM order_items
        WHERE order_id = ?
      `).all(orderRow.id);

      const items = itemRows.map((item) => ({
        name: item.name,
        qty: item.qty,
        price: item.price
      }));

      return {
        id: orderRow.id,
        orderNumber: orderRow.order_number,
        userId: orderRow.user_id,
        status: orderRow.status,
        trackingStage: orderRow.tracking_stage,
        deliveryName: orderRow.delivery_name,
        deliveryPhone: orderRow.delivery_phone,
        deliveryAddress: orderRow.delivery_address,
        deliveryCity: orderRow.delivery_city,
        deliveryState: orderRow.delivery_state,
        deliveryZip: orderRow.delivery_zip,
        paymentMethod: orderRow.payment_method,
        subtotal: orderRow.subtotal,
        tax: orderRow.tax,
        shipping: orderRow.shipping,
        total: orderRow.total,
        items: items,
        createdAt: orderRow.placed_at
      };
    });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/admin/orders/:orderId", requireAdmin, (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "A valid order id is required." });
  }

  if (!status) {
    return res.status(400).json({ error: "Status is required." });
  }

  const validStatuses = ["pending", "packed", "shipped", "out-for-delivery", "delivered"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }

  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);

  if (!order) {
    return res.status(404).json({ error: "Order not found." });
  }

  // Map frontend statuses to database tracking_stages
  const trackingMap = {
    "pending": "Order Confirmed",
    "packed": "Packed",
    "shipped": "Shipped",
    "out-for-delivery": "Out for Delivery",
    "delivered": "Delivered"
  };

  const trackingStage = trackingMap[status] || status;

  db.prepare(`
    UPDATE orders 
    SET status = ?, tracking_stage = ?
    WHERE id = ?
  `).run(status, trackingStage, orderId);

  const updatedOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  
  if (!updatedOrder) {
    return res.status(404).json({ error: "Order not found." });
  }
  
  res.json({
    order: mapOrder(updatedOrder)
  });
});

app.get("/api/cart", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  const rows = db.prepare(`
    SELECT
      ci.id AS cart_item_id,
      ci.quantity,
      p.id AS product_id,
      p.name,
      p.price,
      p.image,
      p.stock AS remaining_stock,
      (p.stock + ci.quantity) AS max_qty
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ?
    ORDER BY ci.id DESC
  `).all(userId);

  res.json({
    items: rows.map((row) => ({
      cartItemId: row.cart_item_id,
      id: row.product_id,
      name: row.name,
      price: new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
      }).format(Number(row.price)),
      image: row.image,
      stock: Number(row.remaining_stock || 0),
      maxQty: Number(row.max_qty || 0),
      inStock: Number(row.max_qty || 0) > 0,
      qty: row.quantity
    }))
  });
});

app.post("/api/cart/items", (req, res) => {
  const { userId, productId, quantity = 1 } = req.body;
  const reserveQty = Number(quantity);

  if (!userId || !productId) {
    return res.status(400).json({ error: "userId and productId are required." });
  }

  if (!reserveQty || reserveQty < 1) {
    return res.status(400).json({ error: "A valid quantity is required." });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  const product = db.prepare("SELECT id, stock FROM products WHERE id = ?").get(productId);
  if (!user || !product) {
    return res.status(404).json({ error: "User or product not found." });
  }

  if (Number(product.stock || 0) < reserveQty) {
    return res.status(400).json({ error: "Requested quantity exceeds available stock." });
  }

  const existing = db.prepare(`
    SELECT id, quantity
    FROM cart_items
    WHERE user_id = ? AND product_id = ?
  `).get(userId, productId);

  try {
    db.exec("BEGIN");

    const stockUpdate = db.prepare(`
      UPDATE products
      SET stock = stock - ?
      WHERE id = ? AND stock >= ?
    `).run(reserveQty, productId, reserveQty);

    if (!stockUpdate.changes) {
      db.exec("ROLLBACK");
      return res.status(400).json({ error: "Requested quantity exceeds available stock." });
    }

    if (existing) {
      db.prepare(`
        UPDATE cart_items
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(existing.quantity + reserveQty, existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart_items (user_id, product_id, quantity)
        VALUES (?, ?, ?)
      `).run(userId, productId, reserveQty);
    }

    db.exec("COMMIT");
    res.status(201).json({ ok: true });
  } catch (_error) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: "Unable to add item to cart right now." });
  }
});

app.patch("/api/cart/items/:cartItemId", (req, res) => {
  const cartItemId = Number(req.params.cartItemId);
  const nextQuantity = Number(req.body.quantity);

  if (!cartItemId || !nextQuantity || nextQuantity < 1) {
    return res.status(400).json({ error: "Valid cart item id and quantity are required." });
  }

  const cartItem = db.prepare(`
    SELECT ci.id, ci.product_id, ci.quantity, p.stock
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.id = ?
  `).get(cartItemId);

  if (!cartItem) {
    return res.status(404).json({ error: "Cart item not found." });
  }

  const quantityDelta = nextQuantity - Number(cartItem.quantity || 0);

  if (!quantityDelta) {
    return res.json({ ok: true });
  }

  try {
    db.exec("BEGIN");

    if (quantityDelta > 0) {
      const reserveMore = db.prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ? AND stock >= ?
      `).run(quantityDelta, cartItem.product_id, quantityDelta);

      if (!reserveMore.changes) {
        db.exec("ROLLBACK");
        return res.status(400).json({ error: "Requested quantity exceeds available stock." });
      }
    } else {
      db.prepare(`
        UPDATE products
        SET stock = stock + ?
        WHERE id = ?
      `).run(Math.abs(quantityDelta), cartItem.product_id);
    }

    const result = db.prepare(`
      UPDATE cart_items
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextQuantity, cartItemId);

    if (!result.changes) {
      db.exec("ROLLBACK");
      return res.status(404).json({ error: "Cart item not found." });
    }

    db.exec("COMMIT");
  } catch (_error) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: "Unable to update cart quantity right now." });
  }

  res.json({ ok: true });
});

app.delete("/api/cart/items/:cartItemId", (req, res) => {
  const cartItemId = Number(req.params.cartItemId);
  const cartItem = db.prepare(`
    SELECT id, product_id, quantity
    FROM cart_items
    WHERE id = ?
  `).get(cartItemId);

  if (!cartItem) {
    return res.status(404).json({ error: "Cart item not found." });
  }

  try {
    db.exec("BEGIN");

    db.prepare(`
      UPDATE products
      SET stock = stock + ?
      WHERE id = ?
    `).run(Number(cartItem.quantity || 0), cartItem.product_id);

    const result = db.prepare("DELETE FROM cart_items WHERE id = ?").run(cartItemId);

    if (!result.changes) {
      db.exec("ROLLBACK");
      return res.status(404).json({ error: "Cart item not found." });
    }

    db.exec("COMMIT");
  } catch (_error) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: "Unable to remove item from cart right now." });
  }

  res.json({ ok: true });
});

app.post("/api/orders", (req, res) => {
  const userId = Number(req.body.userId);
  const delivery = req.body.delivery || {};
  const payment = req.body.payment || {};

  if (!userId) {
    return res.status(400).json({ error: "A valid user is required." });
  }

  const user = db.prepare(`
    SELECT id, name, email, is_blocked
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  if (user.is_blocked) {
    return res.status(403).json({ error: "Blocked users cannot place orders." });
  }

  const requiredDeliveryFields = [
    ["fullName", "Delivery name is required."],
    ["phone", "Phone number is required."],
    ["address", "Address is required."],
    ["city", "City is required."],
    ["state", "State is required."],
    ["postalCode", "Postal code is required."]
  ];

  for (const [field, errorMessage] of requiredDeliveryFields) {
    if (!String(delivery[field] || "").trim()) {
      return res.status(400).json({ error: errorMessage });
    }
  }

  const paymentMethod = String(payment.method || "").trim();
  const allowedPaymentMethods = new Set(["upi", "cod"]);
  if (!allowedPaymentMethods.has(paymentMethod)) {
    return res.status(400).json({ error: "Please select a valid payment method (UPI or Cash on Delivery)." });
  }

  let paymentLast4 = "";
  if (paymentMethod === "upi") {
    const upiId = String(payment.upiId || "").trim();
    if (!upiId || !upiId.includes("@")) {
      return res.status(400).json({ error: "A valid UPI ID is required (e.g., yourname@paytm or yourname@okhdfcbank)." });
    }
    paymentLast4 = upiId.slice(-4);
  }

  const cartItems = db.prepare(`
    SELECT
      ci.id AS cart_item_id,
      ci.quantity,
      p.id AS product_id,
      p.name,
      p.price,
      p.image
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ?
    ORDER BY ci.id DESC
  `).all(userId);

  if (!cartItems.length) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  const shipping = 0;
  const tax = Number((subtotal * 0.18).toFixed(2));
  const total = Number((subtotal + shipping + tax).toFixed(2));
  const orderNumber = `SN-${Date.now().toString().slice(-8)}`;
  const estimatedDelivery = new Date(Date.now() + (4 * 24 * 60 * 60 * 1000)).toISOString();

  try {
    db.exec("BEGIN");

    const orderInfo = db.prepare(`
      INSERT INTO orders (
        user_id, order_number, status, tracking_stage, payment_method, payment_last4,
        delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_zip,
        subtotal, shipping, tax, total, estimated_delivery
      )
      VALUES (?, ?, 'Processing', 'Order Confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      orderNumber,
      paymentMethod,
      paymentLast4,
      String(delivery.fullName).trim(),
      String(delivery.phone).trim(),
      String(delivery.address).trim(),
      String(delivery.city).trim(),
      String(delivery.state).trim(),
      String(delivery.postalCode).trim(),
      subtotal,
      shipping,
      tax,
      total,
      estimatedDelivery
    );

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, product_price, product_image, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of cartItems) {
      insertOrderItem.run(
        orderInfo.lastInsertRowid,
        item.product_id,
        item.name,
        item.price,
        item.image,
        item.quantity
      );
    }

    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);
    db.exec("COMMIT");

    const orderRow = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderInfo.lastInsertRowid);
    const orderItems = db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id").all(orderInfo.lastInsertRowid);

    return res.status(201).json({
      order: mapOrder(orderRow, orderItems)
    });
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(500).json({
      error: "Unable to place the order right now."
    });
  }
});

app.get("/api/orders", (req, res) => {
  const userId = Number(req.query.userId || req.headers["x-user-id"]);

  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  const orderRows = db.prepare(`
    SELECT *
    FROM orders
    WHERE user_id = ?
    ORDER BY datetime(placed_at) DESC, id DESC
  `).all(userId);

  const itemStmt = db.prepare(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `);

  res.json({
    orders: orderRows.map((row) => mapOrder(row, itemStmt.all(row.id)))
  });
});

app.get("/api/orders/:orderId", (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number(req.query.userId || req.headers["x-user-id"]);

  if (!orderId || !userId) {
    return res.status(400).json({ error: "A valid orderId and userId are required." });
  }

  const row = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ? AND user_id = ?
  `).get(orderId, userId);

  if (!row) {
    return res.status(404).json({ error: "Order not found." });
  }

  const items = db.prepare(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `).all(orderId);

  res.json({
    order: mapOrder(row, items)
  });
});

app.patch("/api/orders/:orderId/cancel", (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number(req.body.userId || req.query.userId || req.headers["x-user-id"]);

  if (!orderId || !userId) {
    return res.status(400).json({ error: "A valid order and user are required." });
  }

  const row = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ? AND user_id = ?
  `).get(orderId, userId);

  if (!row) {
    return res.status(404).json({ error: "Order not found." });
  }

  if (!canCancelOrder(row)) {
    return res.status(400).json({ error: "This order can no longer be cancelled." });
  }

  db.prepare(`
    UPDATE orders
    SET status = 'Cancelled',
        tracking_stage = 'Cancelled'
    WHERE id = ? AND user_id = ?
  `).run(orderId, userId);

  db.prepare(`
    UPDATE products
    SET stock = stock + (
      SELECT quantity
      FROM order_items
      WHERE order_items.order_id = ? AND order_items.product_id = products.id
    )
    WHERE id IN (
      SELECT product_id
      FROM order_items
      WHERE order_id = ? AND product_id IS NOT NULL
    )
  `).run(orderId, orderId);

  const updatedRow = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ? AND user_id = ?
  `).get(orderId, userId);

  if (!updatedRow) {
    return res.status(404).json({ error: "Order not found." });
  }

  const items = db.prepare(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
    ORDER BY id
  `).all(orderId);

  res.json({
    message: updatedRow.payment_method === "cod"
      ? "Order cancelled successfully. No payment was collected for this Cash on Delivery order."
      : "Order cancelled successfully. Your payment will be treated as cancelled for this order.",
    order: mapOrder(updatedRow, items)
  });
});

app.delete("/api/orders/:orderId", (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number(req.query.userId || req.headers["x-user-id"] || req.body.userId);

  if (!orderId || !userId) {
    return res.status(400).json({ error: "A valid order and user are required." });
  }

  const row = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ? AND user_id = ?
  `).get(orderId, userId);

  if (!row) {
    return res.status(404).json({ error: "Order not found." });
  }

  // Block deletion only while the order is actively out for delivery.
  if (row.tracking_stage === "Out for Delivery") {
    return res.status(400).json({ error: "Orders out for delivery cannot be removed from history yet." });
  }

  try {
    db.exec("BEGIN");

    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    const result = db.prepare("DELETE FROM orders WHERE id = ? AND user_id = ?").run(orderId, userId);

    if (!result.changes) {
      db.exec("ROLLBACK");
      return res.status(404).json({ error: "Order not found." });
    }

    db.exec("COMMIT");
    res.json({ ok: true });
  } catch (_error) {
    db.exec("ROLLBACK");
    res.status(500).json({ error: "Unable to remove order right now." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "html", "index.html"));
});

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the existing server before starting a new one.`);
    return;
  }

  throw error;
});
