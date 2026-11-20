const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");
const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.post("/retailers", async (req, res, next) => {
  const { username, password, displayName, phone } = req.body || {};
  if (!username || !password || String(password).length < 10) {
    return res.status(400).json({ error: "Username and password (at least 10 characters) are required" });
  }
  try {
    const hash = await bcrypt.hash(String(password), 12);
    const result = await db.query(
      "INSERT INTO users (username, password_hash, role, display_name, phone) VALUES ($1,$2,'retailer',$3,$4) RETURNING id, username, role, display_name, phone, created_at",
      [String(username).trim(), hash, displayName || null, phone || null]
    );
    res.status(201).json({ retailer: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Username already exists" });
    next(err);
  }
});

router.get("/retailers", async (_req, res, next) => {
  try {
    const result = await db.query(
      "SELECT id, username, display_name, phone, is_active, created_at FROM users WHERE role='retailer' ORDER BY created_at DESC"
    );
    res.json({ retailers: result.rows });
  } catch (err) { next(err); }
});

router.post("/wallet/credit", async (req, res, next) => {
  const { retailerId, amount, note } = req.body || {};
  const value = Number(amount);
  if (!retailerId || !Number.isFinite(value) || value <= 0 || value > 1000000) {
    return res.status(400).json({ error: "Valid retailerId and positive amount are required" });
  }
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT id FROM users WHERE id=$1 AND role='retailer' FOR UPDATE", [retailerId]);
    if (!user.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Retailer not found" });
    }
    const wallet = await client.query(
      "INSERT INTO wallets (user_id, balance_paise) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET balance_paise = wallets.balance_paise + EXCLUDED.balance_paise RETURNING balance_paise",
      [retailerId, Math.round(value * 100)]
    );
    await client.query(
      "INSERT INTO wallet_ledger (user_id, entry_type, amount_paise, note, created_by) VALUES ($1,'credit',$2,$3,$4)",
      [retailerId, Math.round(value * 100), note || "Admin wallet credit", req.user.sub]
    );
    await client.query("COMMIT");
    res.json({ retailerId, balance: Number(wallet.rows[0].balance_paise) / 100 });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally { client.release(); }
});

module.exports = router;
