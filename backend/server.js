const path = require('path');
require('dotenv').config(); // ✅ works for local + Render

const express = require('express');
const cors = require('cors');

const {
  ensureDatabaseReady,
  getCategories,
  getProductsList,
  registerUser,
  createAdminUser,
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
app.use(express.static(path.join(__dirname, '../frontend')));

// ✅ Helper
function sendError(res, error) {
  return res.status(error.status || 500).json({
    error: error.message || 'Request failed.'
  });
}

function getPublicBackendUrl() {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.PUBLIC_URL,
    process.env.APP_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
  ];

  return candidates.find((value) => String(value || '').trim()) || '';
}

function getDatabaseConnectionSummary() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '3306';
  const database = process.env.DB_NAME || 'shopnest';
  const user = process.env.DB_USER || 'root';
  return `mysql://${user}:***@${host}:${port}/${database}`;
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
app.get('/api/orders', async (req, res) => {
  try {
    const userId = Number(req.query.userId);

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    res.json({ orders: await listOrdersForUser(userId) });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.query.userId);

    if (!orderId) {
      return res.status(400).json({ error: 'order id required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const order = await getOrderForUser(orderId, userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
});

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

// Cancel an order (user)
app.patch('/api/orders/:id/cancel', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.body.userId || req.query.userId);

    if (!orderId) {
      return res.status(400).json({ error: 'order id required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const order = await cancelOrder(orderId, userId);
    res.json({ order, message: 'Order cancelled.' });
  } catch (error) {
    sendError(res, error);
  }
});

// Delete an order from user history
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const userId = Number(req.query.userId || req.body.userId);

    if (!orderId) {
      return res.status(400).json({ error: 'order id required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    await deleteOrder(orderId, userId);
    res.json({ ok: true });
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

// ✅ Setup endpoint to create admin user (one-time use)
app.post('/api/setup/create-admin', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing email, password, or name' });
    }

    const result = await createAdminUser(name, email, password);
    res.status(201).json({ 
      ok: true, 
      message: result.message,
      admin: result.user 
    });
  } catch (error) {
    console.error('Setup error:', error);
    sendError(res, error);
  }
});

// ✅ Start server
async function startServer() {
  try {
    await ensureDatabaseReady();

    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      const localUrl = `http://localhost:${port}`;
      const publicUrl = getPublicBackendUrl();
      console.log(`🌐 Local URL: ${localUrl}`);
      if (publicUrl) {
        console.log(`🔗 Public URL: ${publicUrl}`);
      }
      console.log(`📦 DB connection: ${getDatabaseConnectionSummary()}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Stop the existing server or change PORT in backend/.env.`);
        process.exit(1);
      }

      throw error;
    });

  } catch (error) {
    console.error('❌ Failed to start server');
    console.error(error);
    process.exit(1);
  }
}

startServer();