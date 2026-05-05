const path = require('path');
require('dotenv').config(); // ✅ works for local + Render

const express = require('express');
const cors = require('cors');

const {
  ensureDatabaseReady,
  getCategories,
  getProductsList,
  registerUser,
  loginUser,
  getCartItems,
  addCartItem,
  updateCartItemQuantity,
  deleteCartItem,
  listOrdersForUser,
  getOrderForUser,
  createOrder,
  cancelOrder,
  deleteOrder,
  getAdminOrders,
  updateAdminOrderStatus,
  listUsers,
  updateUserBlockStatus,
  deleteUser,
  createProduct,
  getAdminUserFromToken
} = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// ✅ CORS (allow all for now)
app.use(cors({
  origin: "*",
}));

app.use(express.json());

// ✅ Helper
function sendError(res, error) {
  return res.status(error.status || 500).json({
    error: error.message || 'Request failed.'
  });
}

// ✅ Admin middleware
async function requireAdmin(req, res, next) {
  try {
    const token = req.headers['x-session-token'];
    const sessionToken = Array.isArray(token) ? token[0] : token;

    const adminUser = await getAdminUserFromToken(sessionToken);

    if (!adminUser) {
      return res.status(403).json({ error: 'Admin access is required.' });
    }

    req.adminUser = adminUser;
    next();
  } catch (error) {
    return sendError(res, error);
  }
}

// ✅ Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ✅ Categories
app.get('/api/categories', async (_req, res) => {
  try {
    res.json({ categories: await getCategories() });
  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let products = await getProductsList();

    if (category) {
      products = products.filter(p => String(p.category) === String(category));
    }

    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        String(p.feature || '').toLowerCase().includes(q) ||
        String(p.description || '').toLowerCase().includes(q)
      );
    }

    res.json({ products });
  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be 6+ chars' });
    }

    const result = await registerUser(name, email, password);
    res.status(201).json(result);

  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email & password required' });
    }

    const result = await loginUser(email, password);
    res.json(result);

  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Cart
app.get('/api/cart', async (req, res) => {
  const userId = Number(req.query.userId);

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    res.json({ items: await getCartItems(userId) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/cart/items', async (req, res) => {
  try {
    const { userId, productId, quantity = 1 } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({ error: 'Missing data' });
    }

    await addCartItem(userId, productId, quantity);
    res.status(201).json({ ok: true });

  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Orders
app.post('/api/orders', async (req, res) => {
  try {
    const userId = Number(req.body.userId);

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    const order = await createOrder(userId, req.body.delivery, req.body.payment);
    res.status(201).json({ order });

  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Admin routes
app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    res.json({ orders: await getAdminOrders() });
  } catch (error) {
    sendError(res, error);
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    await updateAdminOrderStatus(Number(req.params.id), req.body.status);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    res.json({ users: await listUsers() });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    await deleteUser(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    res.status(201).json(await createProduct(req.body));
  } catch (error) {
    sendError(res, error);
  }
});

// ✅ Start server
async function startServer() {
  try {
    await ensureDatabaseReady();

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📦 DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server');
    console.error(error);
    process.exit(1);
  }
}

startServer();