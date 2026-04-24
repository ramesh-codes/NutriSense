/**
 * NutriSense – Express Server
 * ----------------------------
 * Lightweight static file server.
 * All AI API calls are made client-side; this server
 * never touches API keys or user data (zero-trust architecture).
 *
 * PORT: Configurable via process.env.PORT (default: 8080)
 * Compatible with Google Cloud Run and any container runtime.
 */

'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Static Assets ──────────────────────────────────────────────────────────
// Serve everything in /public as-is.
// No API routes needed — Gemini is called directly from the browser.
app.use(
  express.static(path.join(__dirname, 'public'), {
    // Cache static files for 1 hour in production
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  })
);

// ── Catch-All → index.html (SPA-friendly) ──────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  NutriSense server running → http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Security    : API keys are handled CLIENT-SIDE only.`);
});
