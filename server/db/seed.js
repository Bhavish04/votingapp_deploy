const bcrypt = require('bcryptjs');
const { getDb, save } = require('./database');

async function seed() {
  const db = await getDb();

  const existing = db.exec("SELECT id FROM admins WHERE username = 'admin'");
  if (existing.length && existing[0].values.length) {
    console.log('Admin already exists, skipping seed.');
    return;
  }

  const hash = await bcrypt.hash('admin123', 10);
  db.run("INSERT INTO admins (username, password) VALUES (?, ?)", ['admin', hash]);

  save();
  console.log('✅ Database seeded. Admin: admin / admin123');
}

module.exports = seed;

if (require.main === module) {
  seed().catch(console.error);
}