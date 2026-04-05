const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const productSeeds = require("./data/products");

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "store.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
const ADMIN_EMAIL = "admin@amazon-portfolio.local";
const ADMIN_PASSWORD = "Admin@12345";
const ADMIN_NAME = "Project Admin";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function setupDatabase() {
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      blocked_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      rating REAL NOT NULL,
      image TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  const categoryStmt = db.prepare(`
    INSERT INTO categories (id, name)
    VALUES (@id, @name)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name
  `);

  const productStmt = db.prepare(`
    INSERT INTO products (id, category_id, name, price, rating, image)
    VALUES (@id, @category_id, @name, @price, @rating, @image)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      name = excluded.name,
      price = excluded.price,
      rating = excluded.rating,
      image = excluded.image
  `);

  db.exec("BEGIN");
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const hasIsAdmin = userColumns.some((column) => column.name === "is_admin");
    const hasIsBlocked = userColumns.some((column) => column.name === "is_blocked");
    const hasBlockedAt = userColumns.some((column) => column.name === "blocked_at");
    if (!hasIsAdmin) {
      db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
    }
    if (!hasIsBlocked) {
      db.exec("ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0");
    }
    if (!hasBlockedAt) {
      db.exec("ALTER TABLE users ADD COLUMN blocked_at TEXT");
    }

    for (const category of productSeeds) {
      categoryStmt.run({ id: category.categoryId, name: category.categoryName });
      for (const item of category.items) {
        productStmt.run({
          id: item.id,
          category_id: category.categoryId,
          name: item.name,
          price: item.price,
          rating: item.rating,
          image: item.image
        });
      }
    }

    const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_EMAIL);
    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO users (name, email, password_hash, is_admin)
        VALUES (?, ?, ?, 1)
      `).run(ADMIN_NAME, ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD));
    } else {
      db.prepare(`
        UPDATE users
        SET name = ?, is_admin = 1, is_blocked = 0, blocked_at = NULL
        WHERE email = ?
      `).run(ADMIN_NAME, ADMIN_EMAIL);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

setupDatabase();

module.exports = {
  db,
  ADMIN_EMAIL,
  ADMIN_NAME,
  hashPassword,
  verifyPassword
};
