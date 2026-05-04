const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const productSeeds = require('./data/products');

const dataDir = path.join(__dirname, 'data');
const legacyUsersFile = path.join(dataDir, 'users.json');
const legacyCartsFile = path.join(dataDir, 'carts.json');
const legacyOrdersFile = path.join(dataDir, 'orders.json');
const legacyProductsStateFile = path.join(dataDir, 'products_state.json');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'shopnest'
};

let pool = null;
let bootstrapPromise = null;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readJSON(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || 'null') || fallbackValue;
  } catch (_error) {
    return fallbackValue;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [salt, hash] = String(storedHash).split(':');
  if (!salt || !hash) {
    return false;
  }

  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

function serializeRating(rating) {
  const fullStars = Math.floor(Number(rating || 0));
  const emptyStars = 5 - fullStars;
  return `${'★'.repeat(fullStars)}${'☆'.repeat(emptyStars)}`;
}

function normalizeTrackingStageFromStatus(status, currentTrackingStage) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const normalizedCurrent = String(currentTrackingStage || '').trim().toLowerCase();

  const stageMap = {
    processing: 'Order Confirmed',
    'order confirmed': 'Order Confirmed',
    packed: 'Packed',
    shipped: 'Shipped',
    'out for delivery': 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    canceled: 'Cancelled'
  };

  return stageMap[normalizedStatus] || stageMap[normalizedCurrent] || currentTrackingStage || 'Order Confirmed';
}

function buildTrackingSteps(trackingStage, status) {
  const stage = String(trackingStage || 'Order Confirmed').trim().toLowerCase();
  const currentStatus = String(status || 'Processing').trim().toLowerCase();

  if (stage === 'cancelled' || currentStatus === 'cancelled') {
    return [
      { label: 'Order Confirmed', completed: true },
      { label: 'Cancelled', completed: true }
    ];
  }

  const stages = [
    { label: 'Order Confirmed', keys: ['order confirmed', 'processing'] },
    { label: 'Packed', keys: ['packed'] },
    { label: 'Shipped', keys: ['shipped'] },
    { label: 'Out for Delivery', keys: ['out for delivery'] },
    { label: 'Delivered', keys: ['delivered'] }
  ];

  let reached = 0;
  for (let i = 0; i < stages.length; i += 1) {
    const hit = stages[i].keys.some((key) => stage.includes(key) || currentStatus.includes(key));
    if (hit) {
      reached = i;
    }
  }

  return stages.map((item, index) => ({
    label: item.label,
    completed: index <= reached
  }));
}

function canCancelOrder(orderRow) {
  const status = String(orderRow.status || '').trim().toLowerCase();
  const trackingStage = String(orderRow.tracking_stage || '').trim().toLowerCase();
  const restricted = new Set(['shipped', 'out for delivery', 'delivered']);
  return !restricted.has(status) && !restricted.has(trackingStage) && status !== 'cancelled' && trackingStage !== 'cancelled';
}

function canDeleteOrder(orderRow) {
  const status = String(orderRow.status || '').trim().toLowerCase();
  const trackingStage = String(orderRow.tracking_stage || '').trim().toLowerCase();
  const restricted = new Set(['shipped', 'out for delivery', 'delivered']);
  return status === 'cancelled' || trackingStage === 'cancelled' || (!restricted.has(status) && !restricted.has(trackingStage));
}

async function createDatabaseIfMissing() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });

  try {
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }
}

async function createPool() {
  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  await pool.execute('SELECT 1');
}

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(80) PRIMARY KEY,
      name VARCHAR(255) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT PRIMARY KEY,
      category_id VARCHAR(80) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      rating DECIMAL(3,1) NOT NULL DEFAULT 4.0,
      stock INT NOT NULL DEFAULT 0,
      feature TEXT,
      description TEXT,
      image LONGTEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      session_token VARCHAR(255),
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      blocked_at DATETIME NULL,
      created_at DATETIME NULL
    )`,
    `CREATE TABLE IF NOT EXISTS carts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      UNIQUE KEY unique_user_product (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      order_number VARCHAR(64) NOT NULL UNIQUE,
      status VARCHAR(64) NOT NULL DEFAULT 'Processing',
      tracking_stage VARCHAR(64) NOT NULL DEFAULT 'Order Confirmed',
      payment_method VARCHAR(32) NOT NULL,
      payment_last4 VARCHAR(32) NOT NULL DEFAULT '',
      delivery_name VARCHAR(255) NOT NULL,
      delivery_phone VARCHAR(64) NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_city VARCHAR(128) NOT NULL,
      delivery_state VARCHAR(128) NOT NULL,
      delivery_zip VARCHAR(64) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      shipping DECIMAL(10,2) NOT NULL,
      tax DECIMAL(10,2) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      estimated_delivery DATETIME NULL,
      placed_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NULL,
      product_name VARCHAR(255) NOT NULL,
      product_price DECIMAL(10,2) NOT NULL,
      product_image LONGTEXT,
      quantity INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`
  ];

  for (const statement of statements) {
    await pool.execute(statement);
  }
}

function toDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function seedIfNeeded() {
  const [countRows] = await pool.execute('SELECT COUNT(*) AS count FROM users');
  if (Number(countRows[0]?.count || 0) > 0) {
    return;
  }

  const productsState = readJSON(legacyProductsStateFile, {});
  const users = readJSON(legacyUsersFile, { users: [] });
  const carts = readJSON(legacyCartsFile, { items: [] });
  const orders = readJSON(legacyOrdersFile, { orders: [] });

  const categoryMap = new Map();
  for (const category of productSeeds) {
    categoryMap.set(category.categoryId, category.categoryName);
  }

  const productRows = Object.keys(productsState).length
    ? Object.values(productsState)
    : productSeeds.flatMap((category) => category.items.map((item) => ({ ...item, category_id: category.categoryId })));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const [id, name] of categoryMap.entries()) {
      await connection.execute(
        'INSERT INTO categories (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [String(id), String(name)]
      );
    }

    for (const product of productRows) {
      const categoryId = String(product.category_id || product.categoryId || 'misc');
      if (!categoryMap.has(categoryId)) {
        await connection.execute(
          'INSERT INTO categories (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [categoryId, categoryId]
        );
      }

      await connection.execute(
        `INSERT INTO products (id, category_id, name, price, rating, stock, feature, description, image)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           category_id = VALUES(category_id),
           name = VALUES(name),
           price = VALUES(price),
           rating = VALUES(rating),
           stock = VALUES(stock),
           feature = VALUES(feature),
           description = VALUES(description),
           image = VALUES(image)`,
        [
          Number(product.id),
          categoryId,
          String(product.name || ''),
          Number(product.price || 0),
          Number(product.rating || 4),
          Number(product.stock || 0),
          String(product.feature || ''),
          String(product.description || ''),
          String(product.image || '')
        ]
      );
    }

    for (const user of users.users || []) {
      await connection.execute(
        `INSERT INTO users (id, name, email, password_hash, session_token, is_admin, is_blocked, blocked_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           email = VALUES(email),
           password_hash = VALUES(password_hash),
           session_token = VALUES(session_token),
           is_admin = VALUES(is_admin),
           is_blocked = VALUES(is_blocked),
           blocked_at = VALUES(blocked_at),
           created_at = VALUES(created_at)`,
        [
          Number(user.id),
          String(user.name || ''),
          String(user.email || '').toLowerCase(),
          String(user.password_hash || ''),
          user.sessionToken ? String(user.sessionToken) : null,
          user.isAdmin ? 1 : 0,
          user.isBlocked ? 1 : 0,
          toDateTime(user.blockedAt),
          toDateTime(user.created_at)
        ]
      );
    }

    for (const cartItem of carts.items || []) {
      await connection.execute(
        `INSERT INTO carts (id, user_id, product_id, quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           product_id = VALUES(product_id),
           quantity = VALUES(quantity),
           created_at = VALUES(created_at),
           updated_at = VALUES(updated_at)`,
        [
          Number(cartItem.id),
          Number(cartItem.userId),
          Number(cartItem.productId),
          Number(cartItem.quantity || 1),
          toDateTime(cartItem.created_at || new Date()),
          toDateTime(cartItem.updated_at || cartItem.created_at || new Date())
        ]
      );
    }

    for (const order of orders.orders || []) {
      await connection.execute(
        `INSERT INTO orders (
          id, user_id, order_number, status, tracking_stage, payment_method, payment_last4,
          delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_zip,
          subtotal, shipping, tax, total, estimated_delivery, placed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          status = VALUES(status),
          tracking_stage = VALUES(tracking_stage),
          payment_method = VALUES(payment_method),
          payment_last4 = VALUES(payment_last4),
          delivery_name = VALUES(delivery_name),
          delivery_phone = VALUES(delivery_phone),
          delivery_address = VALUES(delivery_address),
          delivery_city = VALUES(delivery_city),
          delivery_state = VALUES(delivery_state),
          delivery_zip = VALUES(delivery_zip),
          subtotal = VALUES(subtotal),
          shipping = VALUES(shipping),
          tax = VALUES(tax),
          total = VALUES(total),
          estimated_delivery = VALUES(estimated_delivery),
          placed_at = VALUES(placed_at)`,
        [
          Number(order.id),
          Number(order.user_id),
          String(order.order_number || ''),
          String(order.status || 'Processing'),
          String(order.tracking_stage || 'Order Confirmed'),
          String(order.payment_method || 'cod'),
          String(order.payment_last4 || ''),
          String(order.delivery_name || ''),
          String(order.delivery_phone || ''),
          String(order.delivery_address || ''),
          String(order.delivery_city || ''),
          String(order.delivery_state || ''),
          String(order.delivery_zip || ''),
          Number(order.subtotal || 0),
          Number(order.shipping || 0),
          Number(order.tax || 0),
          Number(order.total || 0),
          toDateTime(order.estimated_delivery),
          toDateTime(order.placed_at || new Date())
        ]
      );

      for (const item of order.items || []) {
        await connection.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, product_price, product_image, quantity)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            Number(order.id),
            item.product_id != null ? Number(item.product_id) : null,
            String(item.product_name || item.name || ''),
            Number(item.product_price || item.price || 0),
            String(item.product_image || item.image || ''),
            Number(item.quantity || item.qty || 1)
          ]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function bootstrap() {
  await createDatabaseIfMissing();
  await createPool();
  await createTables();
  await seedIfNeeded();
}

async function ensureDatabaseReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap();
  }

  return bootstrapPromise;
}

function mapUserRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    isAdmin: Boolean(row.is_admin),
    isBlocked: Boolean(row.is_blocked),
    blockedAt: row.blocked_at || null,
    created_at: row.created_at || null,
    sessionToken: row.session_token || null
  };
}

function mapProductRow(row) {
  return {
    id: Number(row.id),
    category: row.category_id,
    name: row.name,
    price: Number(row.price),
    rating: serializeRating(row.rating),
    ratingValue: Number(row.rating),
    stock: Number(row.stock || 0),
    inStock: Number(row.stock || 0) > 0,
    feature: row.feature || '',
    description: row.description || '',
    image: row.image || ''
  };
}

async function getCategories() {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT id, name FROM categories ORDER BY name');
  return rows;
}

async function getProductsList() {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT * FROM products ORDER BY id');
  return rows.map(mapProductRow);
}

async function getUserBySessionToken(token) {
  if (!token) {
    return null;
  }

  await ensureDatabaseReady();
  const [rows] = await pool.execute(
    `SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at, session_token
     FROM users
     WHERE session_token = ?`,
    [String(token)]
  );

  return rows.length ? mapUserRow(rows[0]) : null;
}

async function getAdminUserFromToken(token) {
  const user = await getUserBySessionToken(token);
  if (!user || !user.isAdmin || user.isBlocked) {
    return null;
  }

  return user;
}

async function getUserById(userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute(
    `SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at, session_token
     FROM users
     WHERE id = ?`,
    [Number(userId)]
  );

  return rows.length ? mapUserRow(rows[0]) : null;
}

async function registerUser(name, email, password) {
  await ensureDatabaseReady();
  const normalizedEmail = String(email).trim().toLowerCase();

  const [existingRows] = await pool.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existingRows.length) {
    throw createHttpError(409, 'An account with this email already exists.');
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const passwordHash = hashPassword(password);
  const createdAt = new Date();

  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, session_token, is_admin, is_blocked, created_at)
     VALUES (?, ?, ?, ?, 0, 0, ?)`,
    [String(name).trim(), normalizedEmail, passwordHash, sessionToken, createdAt]
  );

  const user = await getUserById(result.insertId);
  return { user, sessionToken };
}

async function loginUser(email, password) {
  await ensureDatabaseReady();
  const normalizedEmail = String(email).trim().toLowerCase();

  const [rows] = await pool.execute(
    `SELECT id, name, email, password_hash, is_admin, is_blocked, blocked_at, created_at, session_token
     FROM users
     WHERE email = ?`,
    [normalizedEmail]
  );

  if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
    throw createHttpError(401, 'Invalid email or password.');
  }

  if (rows[0].is_blocked) {
    throw createHttpError(403, 'This account has been blocked.');
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  await pool.execute('UPDATE users SET session_token = ? WHERE id = ?', [sessionToken, Number(rows[0].id)]);
  const user = await getUserById(rows[0].id);

  return { user, sessionToken };
}

async function getCartItems(userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute(
    `SELECT
      c.id AS cart_item_id,
      c.product_id,
      c.quantity,
      p.name,
      p.price,
      p.image,
      p.stock
     FROM carts c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = ?
     ORDER BY c.id DESC`,
    [Number(userId)]
  );

  return rows.map((row) => ({
    cartItemId: Number(row.cart_item_id),
    id: Number(row.product_id),
    name: row.name,
    price: formatCurrency(row.price),
    image: row.image || '',
    stock: Number(row.stock || 0),
    maxQty: Number(row.stock || 0) + Number(row.quantity || 0),
    inStock: Number(row.stock || 0) + Number(row.quantity || 0) > 0,
    qty: Number(row.quantity || 0)
  }));
}

async function addCartItem(userId, productId, quantity = 1) {
  await ensureDatabaseReady();
  const reserveQuantity = Number(quantity);
  if (!Number.isFinite(reserveQuantity) || reserveQuantity < 1) {
    throw createHttpError(400, 'A valid quantity is required.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute('SELECT id FROM users WHERE id = ?', [Number(userId)]);
    const [productRows] = await connection.execute('SELECT id, stock FROM products WHERE id = ? FOR UPDATE', [Number(productId)]);

    if (!userRows.length || !productRows.length) {
      throw createHttpError(404, 'User or product not found.');
    }

    const availableStock = Number(productRows[0].stock || 0);
    if (availableStock < reserveQuantity) {
      throw createHttpError(400, 'Requested quantity exceeds available stock.');
    }

    await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [reserveQuantity, Number(productId)]);

    const [cartRows] = await connection.execute(
      'SELECT id FROM carts WHERE user_id = ? AND product_id = ? FOR UPDATE',
      [Number(userId), Number(productId)]
    );

    if (cartRows.length) {
      await connection.execute(
        'UPDATE carts SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
        [reserveQuantity, new Date(), Number(cartRows[0].id)]
      );
    } else {
      await connection.execute(
        'INSERT INTO carts (user_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [Number(userId), Number(productId), reserveQuantity, new Date(), new Date()]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error.status ? error : createHttpError(500, 'Unable to add item to cart right now.');
  } finally {
    connection.release();
  }

  return { ok: true };
}

async function updateCartItemQuantity(cartItemId, quantity) {
  await ensureDatabaseReady();
  const nextQuantity = Number(quantity);
  if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
    throw createHttpError(400, 'Valid cart item id and quantity are required.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT c.id, c.product_id, c.quantity, p.stock
       FROM carts c
       JOIN products p ON p.id = c.product_id
       WHERE c.id = ?
       FOR UPDATE`,
      [Number(cartItemId)]
    );

    if (!rows.length) {
      throw createHttpError(404, 'Cart item not found.');
    }

    const currentQuantity = Number(rows[0].quantity || 0);
    const delta = nextQuantity - currentQuantity;

    if (delta > 0) {
      if (Number(rows[0].stock || 0) < delta) {
        throw createHttpError(400, 'Requested quantity exceeds available stock.');
      }

      await connection.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [delta, Number(rows[0].product_id)]);
    } else if (delta < 0) {
      await connection.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [Math.abs(delta), Number(rows[0].product_id)]);
    }

    await connection.execute('UPDATE carts SET quantity = ?, updated_at = ? WHERE id = ?', [nextQuantity, new Date(), Number(cartItemId)]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error.status ? error : createHttpError(500, 'Unable to update cart quantity right now.');
  } finally {
    connection.release();
  }

  return { ok: true };
}

async function deleteCartItem(cartItemId) {
  await ensureDatabaseReady();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      'SELECT id, product_id, quantity FROM carts WHERE id = ? FOR UPDATE',
      [Number(cartItemId)]
    );

    if (!rows.length) {
      throw createHttpError(404, 'Cart item not found.');
    }

    await connection.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [Number(rows[0].quantity || 0), Number(rows[0].product_id)]);
    await connection.execute('DELETE FROM carts WHERE id = ?', [Number(cartItemId)]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error.status ? error : createHttpError(500, 'Unable to remove item from cart right now.');
  } finally {
    connection.release();
  }

  return { ok: true };
}

async function getOrderItems(orderId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT id, order_id, product_id, product_name, product_price, product_image, quantity
     FROM order_items
     WHERE order_id = ?
     ORDER BY id`,
    [Number(orderId)]
  );

  return rows;
}

function mapOrderForUser(orderRow, itemRows) {
  return {
    id: Number(orderRow.id),
    orderNumber: orderRow.order_number,
    status: orderRow.status,
    trackingStage: orderRow.tracking_stage,
    paymentMethod: orderRow.payment_method,
    paymentLast4: orderRow.payment_last4 || '',
    deliveryName: orderRow.delivery_name,
    deliveryPhone: orderRow.delivery_phone,
    deliveryAddress: orderRow.delivery_address,
    deliveryCity: orderRow.delivery_city,
    deliveryState: orderRow.delivery_state,
    deliveryZip: orderRow.delivery_zip,
    subtotal: formatCurrency(orderRow.subtotal),
    shipping: formatCurrency(orderRow.shipping),
    tax: formatCurrency(orderRow.tax),
    total: formatCurrency(orderRow.total),
    placedAt: orderRow.placed_at,
    estimatedDelivery: orderRow.estimated_delivery,
    canCancel: canCancelOrder(orderRow),
    canDelete: canDeleteOrder(orderRow),
    trackingSteps: buildTrackingSteps(orderRow.tracking_stage, orderRow.status),
    items: itemRows.map((item) => ({
      id: Number(item.id),
      productId: item.product_id != null ? Number(item.product_id) : null,
      name: item.product_name,
      price: formatCurrency(item.product_price),
      image: item.product_image || '',
      qty: Number(item.quantity || 0)
    }))
  };
}

function mapOrderForAdmin(orderRow, itemRows) {
  return {
    id: Number(orderRow.id),
    orderNumber: orderRow.order_number,
    userId: Number(orderRow.user_id),
    status: orderRow.status,
    trackingStage: orderRow.tracking_stage,
    paymentMethod: orderRow.payment_method,
    paymentLast4: orderRow.payment_last4 || '',
    deliveryName: orderRow.delivery_name,
    deliveryPhone: orderRow.delivery_phone,
    deliveryAddress: orderRow.delivery_address,
    deliveryCity: orderRow.delivery_city,
    deliveryState: orderRow.delivery_state,
    deliveryZip: orderRow.delivery_zip,
    subtotal: Number(orderRow.subtotal || 0),
    shipping: Number(orderRow.shipping || 0),
    tax: Number(orderRow.tax || 0),
    total: Number(orderRow.total || 0),
    placedAt: orderRow.placed_at,
    estimatedDelivery: orderRow.estimated_delivery,
    items: itemRows.map((item) => ({
      id: Number(item.id),
      productId: item.product_id != null ? Number(item.product_id) : null,
      name: item.product_name,
      price: Number(item.product_price || 0),
      image: item.product_image || '',
      qty: Number(item.quantity || 0)
    }))
  };
}

async function listOrdersForUser(userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute(
    `SELECT *
     FROM orders
     WHERE user_id = ?
     ORDER BY placed_at DESC, id DESC`,
    [Number(userId)]
  );

  const orders = [];
  for (const row of rows) {
    const items = await getOrderItems(row.id);
    orders.push(mapOrderForUser(row, items));
  }

  return orders;
}

async function getOrderForUser(orderId, userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?',
    [Number(orderId), Number(userId)]
  );

  if (!rows.length) {
    return null;
  }

  const items = await getOrderItems(orderId);
  return mapOrderForUser(rows[0], items);
}

async function getAdminOrders() {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT * FROM orders ORDER BY placed_at DESC, id DESC');

  const orders = [];
  for (const row of rows) {
    const items = await getOrderItems(row.id);
    orders.push(mapOrderForAdmin(row, items));
  }

  return orders;
}

async function createOrder(userId, delivery, payment) {
  await ensureDatabaseReady();
  const user = await getUserById(userId);

  if (!user) {
    throw createHttpError(404, 'User not found.');
  }

  if (user.isBlocked) {
    throw createHttpError(403, 'Blocked users cannot place orders.');
  }

  const requiredDeliveryFields = [
    ['fullName', 'Delivery name is required.'],
    ['phone', 'Phone number is required.'],
    ['address', 'Address is required.'],
    ['city', 'City is required.'],
    ['state', 'State is required.'],
    ['postalCode', 'Postal code is required.']
  ];

  for (const [field, errorMessage] of requiredDeliveryFields) {
    if (!String(delivery?.[field] || '').trim()) {
      throw createHttpError(400, errorMessage);
    }
  }

  const paymentMethod = String(payment?.method || '').trim();
  const allowedPaymentMethods = new Set(['upi', 'cod']);
  if (!allowedPaymentMethods.has(paymentMethod)) {
    throw createHttpError(400, 'Please select a valid payment method (UPI or Cash on Delivery).');
  }

  if (paymentMethod === 'upi') {
    const upiId = String(payment?.upiId || '').trim();
    if (!upiId || !upiId.includes('@')) {
      throw createHttpError(400, 'A valid UPI ID is required (e.g., yourname@paytm or yourname@okhdfcbank).');
    }
  }

  const paymentLast4 = paymentMethod === 'upi' ? String(payment?.upiId || '').trim().slice(-4) : '';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [cartRows] = await connection.execute(
      `SELECT c.id AS cart_item_id, c.quantity, p.id AS product_id, p.name, p.price, p.image
       FROM carts c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?
       ORDER BY c.id DESC`,
      [Number(userId)]
    );

    if (!cartRows.length) {
      throw createHttpError(400, 'Your cart is empty.');
    }

    const subtotal = cartRows.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    const shipping = 0;
    const tax = Number((subtotal * 0.18).toFixed(2));
    const total = Number((subtotal + shipping + tax).toFixed(2));
    const orderNumber = `SN-${Date.now().toString().slice(-8)}`;
    const estimatedDelivery = new Date(Date.now() + (4 * 24 * 60 * 60 * 1000));

    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
        user_id, order_number, status, tracking_stage, payment_method, payment_last4,
        delivery_name, delivery_phone, delivery_address, delivery_city, delivery_state, delivery_zip,
        subtotal, shipping, tax, total, estimated_delivery, placed_at
      ) VALUES (?, ?, 'Processing', 'Order Confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(userId),
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
        estimatedDelivery,
        new Date()
      ]
    );

    const orderId = Number(orderResult.insertId);

    for (const item of cartRows) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, product_price, product_image, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          Number(item.product_id),
          String(item.name || ''),
          Number(item.price || 0),
          String(item.image || ''),
          Number(item.quantity || 0)
        ]
      );
    }

    await connection.execute('DELETE FROM carts WHERE user_id = ?', [Number(userId)]);
    await connection.commit();

    const createdOrder = await getOrderForUser(orderId, userId);
    return createdOrder;
  } catch (error) {
    await connection.rollback();
    throw error.status ? error : createHttpError(500, 'Unable to place the order right now.');
  } finally {
    connection.release();
  }
}

async function cancelOrder(orderId, userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT * FROM orders WHERE id = ? AND user_id = ?', [Number(orderId), Number(userId)]);

  if (!rows.length) {
    throw createHttpError(404, 'Order not found.');
  }

  if (!canCancelOrder(rows[0])) {
    throw createHttpError(400, 'Cannot cancel order that is already shipped or delivered.');
  }

  await pool.execute(
    "UPDATE orders SET status = 'Cancelled', tracking_stage = 'Cancelled' WHERE id = ? AND user_id = ?",
    [Number(orderId), Number(userId)]
  );

  return getOrderForUser(orderId, userId);
}

async function deleteOrder(orderId, userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT * FROM orders WHERE id = ? AND user_id = ?', [Number(orderId), Number(userId)]);

  if (!rows.length) {
    throw createHttpError(404, 'Order not found.');
  }

  if (!canDeleteOrder(rows[0])) {
    throw createHttpError(400, 'Cannot delete order that is already shipped or delivered.');
  }

  await pool.execute('DELETE FROM orders WHERE id = ? AND user_id = ?', [Number(orderId), Number(userId)]);
  return { ok: true };
}

async function updateAdminOrderStatus(orderId, status) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT id, tracking_stage FROM orders WHERE id = ?', [Number(orderId)]);

  if (!rows.length) {
    throw createHttpError(404, 'Order not found.');
  }

  const normalizedStatus = String(status || '').trim();
  if (!normalizedStatus) {
    return { ok: true };
  }

  const trackingStage = normalizeTrackingStageFromStatus(normalizedStatus, rows[0].tracking_stage);
  await pool.execute('UPDATE orders SET status = ?, tracking_stage = ? WHERE id = ?', [normalizedStatus, trackingStage, Number(orderId)]);
  return { ok: true };
}

async function listUsers() {
  await ensureDatabaseReady();
  const [rows] = await pool.execute(
    `SELECT id, name, email, is_admin, is_blocked, blocked_at, created_at, session_token
     FROM users
     ORDER BY is_admin DESC, created_at DESC, id DESC`
  );

  return rows.map(mapUserRow);
}

async function updateUserBlockStatus(userId, blocked) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT id, is_admin FROM users WHERE id = ?', [Number(userId)]);

  if (!rows.length) {
    throw createHttpError(404, 'User not found.');
  }

  if (rows[0].is_admin) {
    throw createHttpError(400, 'Cannot modify admin account.');
  }

  await pool.execute(
    'UPDATE users SET is_blocked = ?, blocked_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?',
    [blocked ? 1 : 0, blocked ? 1 : 0, Number(userId)]
  );

  return getUserById(userId);
}

async function deleteUser(userId) {
  await ensureDatabaseReady();
  const [rows] = await pool.execute('SELECT id, is_admin FROM users WHERE id = ?', [Number(userId)]);

  if (!rows.length) {
    throw createHttpError(404, 'User not found.');
  }

  if (rows[0].is_admin) {
    throw createHttpError(400, 'Cannot delete admin account.');
  }

  await pool.execute('DELETE FROM users WHERE id = ?', [Number(userId)]);
  return { ok: true };
}

async function createProduct(body) {
  await ensureDatabaseReady();

  const name = String(body?.name || '').trim();
  const categoryId = String(body?.categoryId || '').trim();
  if (!name || !categoryId) {
    throw createHttpError(400, 'Name and category are required.');
  }

  await pool.execute('INSERT INTO categories (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [categoryId, categoryId]);

  const [rows] = await pool.execute('SELECT MAX(id) AS maxId FROM products');
  const nextId = Number(rows[0]?.maxId || 99) + 1;

  await pool.execute(
    `INSERT INTO products (id, category_id, name, price, rating, stock, feature, description, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextId,
      categoryId,
      name,
      Number(body?.price || 0),
      Number(body?.rating || 4),
      Number(body?.stock || 0),
      String(body?.feature || ''),
      String(body?.description || ''),
      String(body?.image || '')
    ]
  );

  return { ok: true, id: nextId };
}

module.exports = {
  ensureDatabaseReady,
  formatCurrency,
  serializeRating,
  buildTrackingSteps,
  normalizeTrackingStageFromStatus,
  getCategories,
  getProductsList,
  getUserBySessionToken,
  getAdminUserFromToken,
  registerUser,
  loginUser,
  getCartItems,
  addCartItem,
  updateCartItemQuantity,
  deleteCartItem,
  listOrdersForUser,
  getOrderForUser,
  getAdminOrders,
  createOrder,
  cancelOrder,
  deleteOrder,
  updateAdminOrderStatus,
  listUsers,
  updateUserBlockStatus,
  deleteUser,
  createProduct
};
