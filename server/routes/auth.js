const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const db = await getDb();
  const result = db.exec("SELECT id, username, password FROM admins WHERE username = ?", [username]);
  if (!result.length || !result[0].values.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const [id, uname, hash] = result[0].values[0];
  const valid = await bcrypt.compare(password, hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id, username: uname }, process.env.JWT_SECRET || 'changeme', { expiresIn: '8h' });
  res
    .cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 })
    .json({ ok: true, username: uname });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token').json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ admin: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    res.json({ admin: true, username: payload.username });
  } catch {
    res.json({ admin: false });
  }
});

module.exports = router;
