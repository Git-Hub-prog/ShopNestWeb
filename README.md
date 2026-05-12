MyShopNest – Full-Stack E-Commerce Web Application
A full-stack e-commerce web application built as a hands-on project to demonstrate end-to-end shopping flows including product browsing, cart management, checkout, order tracking, and admin operations.

Live Demo
Frontend and backend are deployed on Render.
Database is hosted on Railway.
Images are stored and managed with Cloudinary.
Frontend: https://your-frontend-url.render.com
Backend API: https://your-backend-url.render.com

Key Features


Product listing, categories, and search


User registration and login with session token


Shopping cart (add/update/remove items)


Checkout and order creation with tax/shipping calculations


Order tracking and status updates


Admin dashboard for managing orders and users


Cloudinary image upload and management


REST API with JSON responses


Responsive frontend using HTML/CSS/JS



Tech Stack
Frontend: HTML, CSS, Vanilla JavaScript
Backend: Node.js, Express.js
Database: MySQL / Railway
Images: Cloudinary
Deployment: Render + Railway
Other Tools: Multer, mysql2, dotenv, cors

Project Structure
backend/  server.js      # Express server and API routes  db.js          # Database access layer  package.json   # Backend dependencies  data/          # Sample JSON demo datafrontend/  html/          # Web pages  css/           # Stylesheets  js/            # Frontend scriptsREADME.md

Environment Variables (.env)
DB_HOST=127.0.0.1DB_PORT=3306DB_USER=rootDB_PASSWORD=your_passwordDB_NAME=shopnestCLOUDINARY_CLOUD_NAME=your_cloud_nameCLOUDINARY_API_KEY=your_api_keyCLOUDINARY_API_SECRET=your_api_secret

Quick Local Setup
Install backend dependencies
cd backendnpm install
Start backend server
cd backendnpm start
The backend automatically serves the frontend.
Open in browser:
http://localhost:3000

Database Setup
USE shopnest;
The application automatically creates required tables if they do not already exist.

Useful SQL Query – Latest Ordered Product (All Users)
USE shopnest;SELECT  o.id AS order_id,  o.order_number,  o.user_id,  o.placed_at,  oi.product_id,  oi.product_name,  oi.product_price,  oi.quantityFROM orders oJOIN order_items oi ON oi.order_id = o.idORDER BY o.placed_at DESC, o.id DESC, oi.id DESCLIMIT 1;

Useful SQL Query – Latest Ordered Product (Single User)
USE shopnest;SELECT  o.id AS order_id,  o.order_number,  o.user_id,  o.placed_at,  oi.product_id,  oi.product_name,  oi.product_price,  oi.quantityFROM orders oJOIN order_items oi ON oi.order_id = o.idWHERE o.user_id = ?ORDER BY o.placed_at DESC, o.id DESC, oi.id DESCLIMIT 1;

API Endpoints Summary


GET /api/health — Health check


GET /api/categories — List categories


GET /api/products — List/search products


POST /api/auth/register — Register user


POST /api/auth/login — Login user


GET /api/cart?userId={id} — Get cart


POST /api/cart/items — Add cart item


GET /api/orders?userId={id} — User orders


GET /api/orders/:id — Specific order


POST /api/orders — Create order


PATCH /api/orders/:id/cancel — Cancel order



Deployment Notes
Render


Deploy frontend and backend services


Configure environment variables


Railway


Host MySQL database


Set DATABASE_URL or DB_* credentials


Cloudinary


Manage product image uploads and storage



Data & Migration


MySQL tables auto-create on startup


Local JSON seed data available for testing


Production deployment should use Railway DB with proper migrations



Screenshots
Add screenshots for:


Homepage


Product page


Cart page


Checkout flow


Admin dashboard


Store them in /docs or /assets folders.

Contributing


Fork the repository


Create a feature branch


Make changes


Submit a pull request



License
MIT License recommended.

Contact
LinkedIn: www.linkedin.com/in/faiyaj-ansari-293413366
