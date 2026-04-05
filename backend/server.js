const path = require("path");
const express = require("express");
const cors = require("cors");
const { db, hashPassword, verifyPassword, ADMIN_EMAIL, ADMIN_NAME } = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
    price: `$${Number(row.price).toFixed(2)}`,
    rating: serializeRating(row.rating),
    ratingValue: row.rating,
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

function getRequestUser(req) {
  const rawUserId = req.headers["x-user-id"];
  const userId = Number(Array.isArray(rawUserId) ? rawUserId[0] : rawUserId);

  if (!userId) {
    return null;
  }

  return db.prepare(`
    SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at
    FROM users
    WHERE id = ?
  `).get(userId);
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
    clauses.push("category_id = @category");
    params.category = category;
  }

  if (search) {
    clauses.push("LOWER(name) LIKE LOWER(@search)");
    params.search = `%${search}%`;
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT id, category_id, name, price, rating, image
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

  const user = db.prepare("SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at FROM users WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ user: mapUser(user) });
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

  res.json({
    user: mapUser(user)
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
      p.image
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
      price: `$${Number(row.price).toFixed(2)}`,
      image: row.image,
      qty: row.quantity
    }))
  });
});

app.post("/api/cart/items", (req, res) => {
  const { userId, productId, quantity = 1 } = req.body;
  if (!userId || !productId) {
    return res.status(400).json({ error: "userId and productId are required." });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (!user || !product) {
    return res.status(404).json({ error: "User or product not found." });
  }

  const existing = db.prepare(`
    SELECT id, quantity
    FROM cart_items
    WHERE user_id = ? AND product_id = ?
  `).get(userId, productId);

  if (existing) {
    db.prepare(`
      UPDATE cart_items
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existing.quantity + Number(quantity), existing.id);
  } else {
    db.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (?, ?, ?)
    `).run(userId, productId, Number(quantity));
  }

  res.status(201).json({ ok: true });
});

app.patch("/api/cart/items/:cartItemId", (req, res) => {
  const cartItemId = Number(req.params.cartItemId);
  const quantity = Number(req.body.quantity);

  if (!cartItemId || !quantity || quantity < 1) {
    return res.status(400).json({ error: "Valid cart item id and quantity are required." });
  }

  const result = db.prepare(`
    UPDATE cart_items
    SET quantity = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(quantity, cartItemId);

  if (!result.changes) {
    return res.status(404).json({ error: "Cart item not found." });
  }

  res.json({ ok: true });
});

app.delete("/api/cart/items/:cartItemId", (req, res) => {
  const cartItemId = Number(req.params.cartItemId);
  const result = db.prepare("DELETE FROM cart_items WHERE id = ?").run(cartItemId);

  if (!result.changes) {
    return res.status(404).json({ error: "Cart item not found." });
  }

  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "html", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
