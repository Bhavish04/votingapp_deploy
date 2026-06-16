# VoteDesk — School Election System

A minimal, real-backend school voting system. Kiosk-style student voting (no student login needed), with a secure admin panel to manage elections and view results.

## Features

- **Kiosk voting**: Students walk up, tap a candidate, hear a beep, see a 3-second "Thank you" popup, done.
- **Admin panel**: Create elections, add candidates with photos, publish/close elections, view live results.
- **Secure**: Votes stored in SQLite. Vote counts never sent to the student-facing API.
- **CSV export**: Download results per election.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and set a real secret
cp .env.example .env
# Edit .env and change JWT_SECRET

# 3. Seed the database (creates admin account + sample election)
node server/db/seed.js

# 4. Start the server
node server/index.js
```

Open http://localhost:3000

## Login

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |

Students don't need a login — the voting screen is open to anyone.

## Deployment (Render / Railway / Fly.io)

1. Push this folder to a GitHub repo.
2. Connect to Render/Railway, set `JWT_SECRET` in environment variables.
3. Set start command: `node server/index.js`
4. Done — the SQLite file persists on disk.

## Changing the admin password

```bash
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('your_new_password', 10).then(h => console.log(h));
"
```
Then update the hash directly in the database or re-run seed after clearing data/votes.db.

## Project structure

```
votingapp/
├── server/
│   ├── index.js          # Express app entry point
│   ├── routes/
│   │   ├── auth.js       # Admin login/logout
│   │   └── elections.js  # All election + voting routes
│   ├── db/
│   │   ├── database.js   # sql.js setup + table creation
│   │   └── seed.js       # Initial data seed
│   └── middleware/
│       └── auth.js       # JWT middleware
├── public/
│   ├── index.html        # Full frontend (single page)
│   └── uploads/          # Candidate photos (auto-created)
├── data/                 # SQLite database file (auto-created)
├── .env.example
└── README.md
```
