const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = 3000;

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Connect to SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    mobile TEXT,
    voter_id TEXT UNIQUE,
    email TEXT UNIQUE,
    dob TEXT,
    password TEXT,
    address TEXT,
    voted INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname TEXT,
    party_name TEXT,
    image_path TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    candidate_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(candidate_id) REFERENCES candidates(id)
  )`);
});

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle user login
app.post('/login', (req, res) => {
  const { voter_id, email, password } = req.body;
  db.get('SELECT * FROM users WHERE voter_id = ? AND email = ? AND password = ?', [voter_id, email, password], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      res.redirect('/home');
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
});

// Handle admin login
app.post('/adminLogin', (req, res) => {
  // Directly redirect to admin panel
  // Ask ChatGPT to implement admin login shyam Broo
  res.redirect('/adminpanel');
});


// Handle user registration
app.post('/register', (req, res) => {
  const { FullName, MobileNo, VoterID, Email, DOB, Password, Address } = req.body;
  db.run('INSERT INTO users (fullname, mobile, voter_id, email, dob, password, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [FullName, MobileNo, VoterID, Email, DOB, Password, Address], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Registration failed' });
      }
      res.redirect('/');
    });
});

// Serve home page after successful login
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve polls page
app.get('/polls', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'polls.html'));
});

// Handle voting
app.post('/vote', (req, res) => {
  const { user_id, candidate_id } = req.body;
  db.get('SELECT voted FROM users WHERE id = ?', [user_id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row && row.voted === 0) {
      db.run('INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)', [user_id, candidate_id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Voting failed' });
        }
        db.run('UPDATE users SET voted = 1 WHERE id = ?', [user_id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Updating user status failed' });


  }
          res.json({ message: 'Vote recorded successfully' });
        });
      });
    } else {
      res.status(400).json({ error: 'User has already voted' });
    }
  });
});

// Serve admin panel
app.get('/adminpanel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adminpanel.html'));
});

// Handle adding new candidate
app.post('/addCandidate', upload.single('Image'), (req, res) => {
  const { FullName, PartyName } = req.body;
  const imagePath = req.file ? '/uploads/' + req.file.filename : null;
  db.run('INSERT INTO candidates (fullname, party_name, image_path) VALUES (?, ?, ?)',
    [FullName, PartyName, imagePath], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Adding candidate failed' });
      }
      res.redirect('/adminpanel');
    });
});

// Serve admin table
app.get('/admintable', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admintable.html'));
});

// Get all users
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get all candidates
app.get('/api/candidates', (req, res) => {
  db.all('SELECT * FROM candidates', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Serve admin result
app.get('/adminresult', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'adminresult.html'));
});

// Get voting results
app.get('/api/results', (req, res) => {
  db.all(`
    SELECT c.id, c.fullname, c.party_name, c.image_path, COUNT(v.id) as votes
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    GROUP BY c.id
    ORDER BY votes DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Serve add voter page
app.get('/addvoter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'addvote.html'));
});

// Handle adding new voter
app.post('/addVoter', (req, res) => {
  const { voter_id, name, email, address } = req.body;
  const password = Math.random().toString(36).slice(-8); // Generate a random password
  db.run('INSERT INTO users (fullname, voter_id, email, address, password) VALUES (?, ?, ?, ?, ?)',
    [name, voter_id, email, address, password], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Adding voter failed' });
      }
      res.redirect('/admintable');
    });
});

// Serve edit user page
app.get('/edituser/:id', (req, res) => {
  const userId = req.params.id;
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      res.sendFile(path.join(__dirname, 'public', 'edituser.html'));
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });
});

// Handle editing user
app.post('/editUser/:id', (req, res) => {
  const userId = req.params.id;
  const { FullName, MobileNo, Email, DOB, Password } = req.body;
  db.run('UPDATE users SET fullname = ?, mobile = ?, email = ?, dob = ?, password = ? WHERE id = ?',
    [FullName, MobileNo, Email, DOB, Password, userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Updating user failed' });
      }
      res.redirect('/admintable');
    });
});

// Serve edit nominee page
app.get('/editnominee/:id', (req, res) => {
  const nomineeId = req.params.id;
  db.get('SELECT * FROM candidates WHERE id = ?', [nomineeId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      res.sendFile(path.join(__dirname, 'public', 'editnominee.html'));
    } else {
      res.status(404).json({ error: 'Nominee not found' });
    }
  });
});

// Handle editing nominee
app.post('/editNominee/:id', upload.single('Image'), (req, res) => {
  const nomineeId = req.params.id;
  const { FullName, PartyName } = req.body;
  let imagePath = null;
  if (req.file) {
    imagePath = '/uploads/' + req.file.filename;
    // Delete old image if exists
    db.get('SELECT image_path FROM candidates WHERE id = ?', [nomineeId], (err, row) => {
      if (row && row.image_path) {
        fs.unlink('public' + row.image_path, (err) => {
          if (err) console.error('Failed to delete old image:', err);
        });
      }
    });
  }
  const updateQuery = imagePath
    ? 'UPDATE candidates SET fullname = ?, party_name = ?, image_path = ? WHERE id = ?'
    : 'UPDATE candidates SET fullname = ?, party_name = ? WHERE id = ?';
  const params = imagePath
    ? [FullName, PartyName, imagePath, nomineeId]
    : [FullName, PartyName, nomineeId];
  db.run(updateQuery, params, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Updating nominee failed' });
    }
    res.redirect('/admintable');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});