const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, save } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../public/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// Public: get active elections (no vote counts)
router.get('/active', async (req, res) => {
  const db = await getDb();
  const elections = db.exec("SELECT id, title FROM elections WHERE status = 'active'");
  if (!elections.length) return res.json({ elections: [] });

  const rows = elections[0].values.map(([id, title]) => {
    const cands = db.exec("SELECT id, name, role, photo FROM candidates WHERE election_id = ?", [id]);
    const candidates = cands.length ? cands[0].values.map(([cid, name, role, photo]) => ({
      id: cid, name, role, photo: photo || null
    })) : [];
    return { id, title, candidates };
  });

  res.json({ elections: rows });
});

// Public: cast a vote (kiosk mode, no auth needed)
router.post('/:elId/vote/:candId', async (req, res) => {
  const { elId, candId } = req.params;
  const db = await getDb();

  const el = db.exec("SELECT status FROM elections WHERE id = ?", [elId]);
  if (!el.length || !el[0].values.length) return res.status(404).json({ error: 'Election not found' });
  if (el[0].values[0][0] !== 'active') return res.status(400).json({ error: 'Election is not active' });

  const cand = db.exec("SELECT id, name FROM candidates WHERE id = ? AND election_id = ?", [candId, elId]);
  if (!cand.length || !cand[0].values.length) return res.status(404).json({ error: 'Candidate not found' });

  db.run("UPDATE candidates SET votes = votes + 1 WHERE id = ?", [candId]);
  save();

  res.json({ ok: true, candidate: cand[0].values[0][1] });
});

// Admin: get all elections with vote counts
router.get('/', requireAdmin, async (req, res) => {
  const db = await getDb();
  const elections = db.exec("SELECT id, title, status, created_at FROM elections ORDER BY created_at DESC");
  if (!elections.length) return res.json({ elections: [] });

  const rows = elections[0].values.map(([id, title, status, created_at]) => {
    const cands = db.exec("SELECT id, name, role, photo, votes FROM candidates WHERE election_id = ?", [id]);
    const candidates = cands.length ? cands[0].values.map(([cid, name, role, photo, votes]) => ({
      id: cid, name, role, photo, votes
    })) : [];
    return { id, title, status, created_at, candidates, totalVotes: candidates.reduce((s, c) => s + c.votes, 0) };
  });

  res.json({ elections: rows });
});

// Admin: create election
router.post('/', requireAdmin, async (req, res) => {
  const { title, candidates } = req.body;
  if (!title || !candidates?.length) return res.status(400).json({ error: 'Title and candidates required' });

  const db = await getDb();
  db.run("INSERT INTO elections (title, status) VALUES (?, 'draft')", [title]);
  const elRes = db.exec("SELECT last_insert_rowid() as id");
  const elId = elRes[0].values[0][0];

  for (const c of candidates) {
    db.run("INSERT INTO candidates (election_id, name, role, photo) VALUES (?, ?, ?, ?)",
      [elId, c.name, c.role || '', c.photo || null]);
  }
  save();
  res.json({ ok: true, id: elId });
});

// Admin: upload photo
router.post('/upload-photo', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Admin: update election
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, status, candidates } = req.body;
  const db = await getDb();

  if (title) db.run("UPDATE elections SET title = ? WHERE id = ?", [title, req.params.id]);
  if (status) db.run("UPDATE elections SET status = ? WHERE id = ?", [status, req.params.id]);

  if (candidates) {
    const el = db.exec("SELECT status FROM elections WHERE id = ?", [req.params.id]);
    const elStatus = el[0].values[0][0];
    if (elStatus === 'draft') {
      db.run("DELETE FROM candidates WHERE election_id = ?", [req.params.id]);
      for (const c of candidates) {
        db.run("INSERT INTO candidates (election_id, name, role, photo) VALUES (?, ?, ?, ?)",
          [req.params.id, c.name, c.role || '', c.photo || null]);
      }
    } else {
      // Only allow name/role/photo updates on published elections
      for (const c of candidates) {
        if (c.id) db.run("UPDATE candidates SET name = ?, role = ?, photo = ? WHERE id = ? AND election_id = ?",
          [c.name, c.role || '', c.photo || null, c.id, req.params.id]);
      }
    }
  }

  save();
  res.json({ ok: true });
});

// Admin: delete election
router.delete('/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  db.run("DELETE FROM elections WHERE id = ?", [req.params.id]);
  save();
  res.json({ ok: true });
});

// Admin: export CSV
router.get('/:id/export.csv', requireAdmin, async (req, res) => {
  const db = await getDb();
  const el = db.exec("SELECT title FROM elections WHERE id = ?", [req.params.id]);
  if (!el.length) return res.status(404).end();
  const title = el[0].values[0][0];

  const cands = db.exec("SELECT name, role, votes FROM candidates WHERE election_id = ? ORDER BY votes DESC", [req.params.id]);
  const candidates = cands.length ? cands[0].values : [];
  const total = candidates.reduce((s, r) => s + r[2], 0);

  let csv = 'Candidate,Role,Votes,Percentage\n';
  candidates.forEach(([name, role, votes]) => {
    csv += `"${name}","${role}",${votes},${total ? Math.round(votes / total * 100) : 0}%\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}_results.csv"`);
  res.send(csv);
});

module.exports = router;
