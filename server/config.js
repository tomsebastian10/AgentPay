import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  
  // Razorpay Test Mode Credentials
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_1234567890',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret_key_abcdef',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret_123',
    mode: process.env.PAYMENT_GATEWAY_MODE || (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && !process.env.RAZORPAY_KEY_ID.includes('placeholder') ? 'test' : 'mock')
  },

  // LLM API Keys (optional; agent has built-in robust rule-based + schema parser fallback)
  llm: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || ''
  },

  // AP2 Spend Authorization Secret
  authSecret: process.env.AUTH_TOKEN_SECRET || 'agentpay_dev_hmac_secret_2026',
  
  // Constraints & Safety Defaults
  safety: {
    maxSingleTransactionLimitINR: 50000,
    allowedCurrency: 'INR',
    spendTokenTTLSeconds: 300 // 5 minutes
  }
};
