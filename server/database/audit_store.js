import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_log.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class AuditStore {
  constructor() {
    this.logs = [];
    this.usedNonces = new Set();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(AUDIT_FILE)) {
        const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
        this.logs = JSON.parse(raw);
        for (const log of this.logs) {
          if (log.details?.nonce) {
            this.usedNonces.add(log.details.nonce);
          }
        }
      }
    } catch (err) {
      console.warn('Could not read existing audit log, initializing fresh in-memory store:', err.message);
      this.logs = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(AUDIT_FILE, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write audit log to disk:', err.message);
    }
  }

  /**
   * Append an immutable audit event
   */
  logEvent({ intentId, eventType, status, details = {} }) {
    const event = {
      id: `audit_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      intentId: intentId || 'global',
      eventType,
      status, // SUCCESS | VIOLATION_BLOCKED | PAYMENT_FAILED | PENDING | INFO
      details
    };

    if (details.consumedNonce) {
      this.usedNonces.add(details.consumedNonce);
    }

    this.logs.unshift(event); // most recent first
    this.save();
    return event;
  }

  consumeNonce(nonce) {
    if (nonce) {
      this.usedNonces.add(nonce);
      this.save();
    }
  }

  isNonceUsed(nonce) {
    return this.usedNonces.has(nonce);
  }

  getLogsByIntent(intentId) {
    return this.logs.filter(l => l.intentId === intentId);
  }

  getAllLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  clear() {
    this.logs = [];
    this.usedNonces.clear();
    this.save();
  }
}

export const auditStore = new AuditStore();
