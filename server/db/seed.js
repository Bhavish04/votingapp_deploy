const bcrypt = require('bcryptjs');
const { getDb, save } = require('./database');

async function seed() {
  const db = await getDb();

  // Check if admin already exists
  const existing = db.exec("SELECT id FROM admins WHERE username = 'admin'");
  if (existing.length && existing[0].values.length) {
    console.log('Admin already exists, skipping seed.');
    return;
  }

  const hash = await bcrypt.hash('admin123', 10);
  db.run("INSERT INTO admins (username, password) VALUES (?, ?)", ['admin', hash]);

  // Sample election
  db.run("INSERT INTO elections (title, status) VALUES (?, ?)", ['Student Council President', 'active']);
  const elRes = db.exec("SELECT last_insert_rowid() as id");
  const elId = elRes[0].values[0][0];

  db.run("INSERT INTO candidates (election_id, name, role, votes) VALUES (?, ?, ?, ?)", [elId, 'Arjun Mehta', 'Class 11A', 0]);
  db.run("INSERT INTO candidates (election_id, name, role, votes) VALUES (?, ?, ?, ?)", [elId, 'Priya Sharma', 'Class 11B', 0]);
  db.run("INSERT INTO candidates (election_id, name, role, votes) VALUES (?, ?, ?, ?)", [elId, 'Rahul Nair', 'Class 12A', 0]);

  save();
  console.log('✅ Database seeded. Admin: admin / admin123');
}

seed().catch(console.error);
