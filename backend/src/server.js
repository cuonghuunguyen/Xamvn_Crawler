const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Required when requests pass through a reverse proxy (nginx, dev tunnels, etc.).
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || 1 : 1);

// Middleware
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

// Rate limiting to prevent accidental hammering
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Routes
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Xamvn Crawler API running on http://localhost:${PORT}`);
});

module.exports = app;
