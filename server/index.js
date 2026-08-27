import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { router as apiRouter } from './api/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Serve static frontend assets
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// Fallback to index.html for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start Server
app.listen(config.port, () => {
  console.log(`==================================================`);
  console.log(`🚀 AgentPay Server running at http://localhost:${config.port}`);
  console.log(`🔒 Gateway Mode: ${config.razorpay.mode.toUpperCase()}`);
  console.log(`📊 Audit Trail: Active`);
  console.log(`==================================================`);
});
