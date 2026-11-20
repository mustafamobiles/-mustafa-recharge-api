const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth } = require("../auth");
const router = express.Router();

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    const result = await db.query(
      "SELECT id, username, password_hash, role, is_active FROM users WHERE username = $1",
      [String(username).trim()]
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(String(password), user.password_hash))) {
      return res.status(401).json({ error: "Invalid login details" });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) { next(err); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT id, username, role, is_active, created_at FROM users WHERE id = $1",
      [req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
