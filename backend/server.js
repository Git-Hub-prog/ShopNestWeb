const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
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

app.use(cors());
app.use(express.json());

app.use('/html', express.static(path.join(__dirname, '..', 'frontend', 'html')));
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'frontend', 'js')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'html')));

function sendError(res, error) {
  return res.status(error.status || 500).json({ error: error.message || 'Request failed.' });
}

async function requireAdmin(req, res, next) {
  try {
    const token = req.headers['x-session-token'];
    const sessionToken = Array.isArray(token) ? token[0] : token;
    const adminUser = await getAdminUserFromToken(sessionToken);

    if (!adminUser) {
      return res.status(403).json({ error: 'Admin access is required.' });
    }

    req.adminUser = adminUser;
    return next();
  } catch (error) {
    return sendError(res, error);
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/categories', async (_req, res) => {
  try {
    return res.json({ categories: await getCategories() });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let products = await getProductsList();

    if (category) {
      products = products.filter((product) => String(product.category) === String(category));
    }

    if (search) {
      const query = String(search).toLowerCase();
      products = products.filter((product) => {
        return product.name.toLowerCase().includes(query)
          || String(product.feature || '').toLowerCase().includes(query)
          || String(product.description || '').toLowerCase().includes(query);
      });
    }

    return res.json({ products });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/auth/admin', async (req, res) => {
  try {
    const token = req.headers['x-session-token'];
    const sessionToken = Array.isArray(token) ? token[0] : token;
    const adminUser = await getAdminUserFromToken(sessionToken);

    if (!adminUser) {
      return res.status(403).json({ error: 'Admin access is required.' });
    }

    return res.json({ user: adminUser });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const result = await registerUser(name, email, password);
    return res.status(201).json({ user: result.user, sessionToken: result.sessionToken });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await loginUser(email, password);
    return res.json({ user: result.user, sessionToken: result.sessionToken });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/cart', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    return res.json({ items: await getCartItems(userId) });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/cart/items', async (req, res) => {
  try {
    const { userId, productId, quantity = 1 } = req.body || {};
    if (!userId || !productId) {
      return res.status(400).json({ error: 'userId and productId are required.' });
    }

    await addCartItem(Number(userId), Number(productId), Number(quantity));
    return res.status(201).json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/api/cart/items/:cartItemId', async (req, res) => {
  try {
    await updateCartItemQuantity(Number(req.params.cartItemId), Number(req.body?.quantity));
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.delete('/api/cart/items/:cartItemId', async (req, res) => {
  try {
    await deleteCartItem(Number(req.params.cartItemId));
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!userId) {
      return res.status(400).json({ error: 'A valid user is required.' });
    }

    const order = await createOrder(userId, req.body?.delivery || {}, req.body?.payment || {});
    return res.status(201).json({ order });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/orders', async (req, res) => {
  const userId = Number(req.query.userId || req.headers['x-user-id']);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  try {
    return res.json({ orders: await listOrdersForUser(userId) });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/orders/:orderId', async (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number(req.query.userId || req.headers['x-user-id']);

  if (!orderId || !userId) {
    return res.status(400).json({ error: 'A valid orderId and userId are required.' });
  }

  try {
    const order = await getOrderForUser(orderId, userId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    return res.json({ order });
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/api/orders/:orderId/cancel', async (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number(req.body?.userId || req.query.userId || req.headers['x-user-id']);

  if (!orderId || !userId) {
    return res.status(400).json({ error: 'A valid orderId and userId are required.' });
  }

  try {
    const order = await cancelOrder(orderId, userId);
    return res.json({ ok: true, order, message: 'Order cancelled successfully.' });
  } catch (error) {
    return sendError(res, error);
  }
});

app.delete('/api/orders/:orderId', async (req, res) => {
  const orderId = Number(req.params.orderId);
  const userId = Number(req.query.userId || req.headers['x-user-id'] || req.body?.userId);

  if (!orderId || !userId) {
    return res.status(400).json({ error: 'A valid orderId and userId are required.' });
  }

  try {
    await deleteOrder(orderId, userId);
    return res.json({ ok: true, message: 'Order deleted from history.' });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    return res.json({ orders: await getAdminOrders() });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/admin/orders', requireAdmin, async (_req, res) => {
  try {
    return res.json({ orders: await getAdminOrders() });
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    await updateAdminOrderStatus(Number(req.params.id), req.body?.status);
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    await updateAdminOrderStatus(Number(req.params.id), req.body?.status);
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  try {
    return res.json({ users: await listUsers() });
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/admin/users', requireAdmin, async (_req, res) => {
  try {
    return res.json({ users: await listUsers() });
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/api/admin/users/:id/block', requireAdmin, async (req, res) => {
  try {
    const user = await updateUserBlockStatus(Number(req.params.id), Boolean(req.body?.blocked));
    return res.json({ user });
  } catch (error) {
    return sendError(res, error);
  }
});

app.patch('/admin/users/:id/block', requireAdmin, async (req, res) => {
  try {
    const user = await updateUserBlockStatus(Number(req.params.id), Boolean(req.body?.blocked));
    return res.json({ user });
  } catch (error) {
    return sendError(res, error);
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    await deleteUser(Number(req.params.id));
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    await deleteUser(Number(req.params.id));
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    return res.status(201).json(await createProduct(req.body));
  } catch (error) {
    return sendError(res, error);
  }
});

app.post('/admin/products', requireAdmin, async (req, res) => {
  try {
    return res.status(201).json(await createProduct(req.body));
  } catch (error) {
    return sendError(res, error);
  }
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'html', 'index.html')));

async function startServer() {
  try {
    await ensureDatabaseReady();

    const server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log(`MySQL connected: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'shopnest'}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing server before starting a new one.`);
        return;
      }

      throw error;
    });
  } catch (error) {
    console.error('Failed to start backend with MySQL.');
    console.error(error.message || error);
    process.exit(1);
  }
}

startServer();
