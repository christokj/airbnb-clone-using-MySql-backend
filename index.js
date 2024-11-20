const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();
const {S3Client, PutObjectCommand, } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

const bucket = 'christo-booking-web';

const app = express();
const bcryptSalt = bcrypt.genSaltSync(10);

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors({
  credentials: true,
  origin: 'http://localhost:5173',
}));

async function uploadToS3(path, originalFilename, mimetype) {
  const client = new S3Client({
      region: 'us-east-1',
      credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,

      }
  });
  const parts = originalFilename.split('.');
  const ext = parts[parts.length - 1];
  const newFilename = Date.now() + '.' + ext;
      await client.send(new PutObjectCommand({
          Bucket: bucket,
          Body: fs.readFileSync(path),
          Key: newFilename,
          ContentType: mimetype,
          ACL: 'public-read',
      }));
      return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
}

// Helper function to extract user data from the request
function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, {}, (err, userData) => {
      if (err) reject(err);
      resolve(userData);
    });
  });
}

// Test Route
app.get('/test', (req, res) => {
  db.query('SELECT 1 + 1 AS solution', (err, results) => {
    if (err) return res.status(500).json(err);
    res.json({ solution: results[0].solution });
  });
});

// User Signup
app.post('/signUp', async (req, res) => {
  const { name, email, password } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, bcryptSalt); // Use bcrypt for hashing

    // Check if the email already exists
    const checkEmailSql = 'SELECT email FROM users WHERE email = ?';
    const [results] = await db.execute(checkEmailSql, [email]);

    if (results.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Insert the new user
    const insertSql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    await db.execute(insertSql, [name, email, hashedPassword]);

    res.status(201).json({ name, email });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const [results] = await db.execute(sql, [email]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }, // Token expires in 1 day
      (err, token) => {
        if (err) {
          console.error('JWT signing error:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        // Set secure cookie with the token
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // Use secure flag in production
          sameSite: 'strict',
        });

        // Respond with user data (excluding sensitive fields like password)
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Profile Route
app.get('/profile', async (req, res) => {
  const { token } = req.cookies; // Get the token from cookies

  // Check if token exists
  if (!token) {
    return res.status(401).json({ error: 'No token provided' }); // If no token, return 401
  }
  try {
    // Verify JWT token
    const userData = jwt.verify(token, process.env.JWT_SECRET); // Use sync verify to get userData

    // Query user by email from the decoded token
    const [results] = await db.query('SELECT email FROM users WHERE email = ?', [userData.email]);

    // Handle case where no user is found
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' }); // If no user is found
    }

    // Respond with user data (ensure it's the required fields)
    res.json({ success: true, data: { email: results[0].email } }); // Respond with success and user email
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Invalid or expired token' }); // If token is invalid or expired
    }
    return res.status(500).json({ error: 'Server error', details: err.message }); // Handle other errors
  }
});

// Logout
app.post('/logout', (req, res) => {
  res.cookie('token', '').json(true);
});

// Upload photos by link
app.post('/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await imageDownloader.image({
    url: link,
    dest: '/tmp/' + newName,
  });
  const url = await uploadToS3('/tmp/' + newName, newName,  mime.lookup('/tmp/' + newName));
  res.json(url);
});

// Upload photos from file
const photosMiddleware = multer({ dest: 'uploads/' });
app.post('/upload', photosMiddleware.array('photos', 100), async (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++){
    const {path,originalname, mimetype} = req.files[i];
    const url = await uploadToS3(path, originalname, mimetype);
    uploadedFiles.push(url);
}
  res.json(uploadedFiles);
});

// Add a new place
app.post('/places', async (req, res) => {
  const { token } = req.cookies;
  const {
    title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;

  try {
    const userData = await getUserDataFromReq(req);
    const sql = `
      INSERT INTO places 
      (title, address, photos, description, perks, extra_info, check_in, check_out, max_guests, price, userEmail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
       title, address, JSON.stringify(addedPhotos), description,
       JSON.stringify(perks), extraInfo, checkIn, checkOut, maxGuests, price, userData.email
    ];
    db.query(sql, values, (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message:"success", result }); //id: result.insertId
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

// List user's places
app.get('/user-places', async (req, res) => {
  const { token } = req.cookies;

  try {
    const userData = await getUserDataFromReq(req);
    const sql = 'SELECT * FROM places WHERE owner_id = ?';
    db.query(sql, [userData.id], (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get('/places/:title', async (req, res) => {
  const { title } = req.params;
  try {
      const [rows] = await db.query('SELECT * FROM places WHERE title = ?', [title]);
      if (rows.length === 0) {
          return res.status(404).json({ error: 'Place not found' });
      }
      res.json(rows[0]);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.put('/places', async (req, res) => {
  const { token } = req.cookies;
  const {
      id, title, address, addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;

  jwt.verify(token, {}, async (err, userData) => {
      if (err) return res.status(403).json({ error: 'Unauthorized' });

      try {
          const [placeRows] = await db.query('SELECT * FROM places WHERE id = ?', [id]);
          if (placeRows.length === 0) {
              return res.status(404).json({ error: 'Place not found' });
          }
          const place = placeRows[0];

          if (userData.id !== place.owner.toString()) {
              return res.status(403).json({ error: 'Not authorized to edit this place' });
          }

          await pool.query(
              `UPDATE places SET title = ?, address = ?, photos = ?, description = ?, perks = ?, extraInfo = ?, checkIn = ?, checkOut = ?, maxGuests = ?, price = ? WHERE id = ?`,
              [title, address, JSON.stringify(addedPhotos), description, perks, extraInfo, checkIn, checkOut, maxGuests, price, id]
          );
          res.json('ok');
      } catch (err) {
          res.status(500).json({ error: err.message });
      }
  });
});

app.get('/places', async (req, res) => {
  try {
      const [rows] = await db.query('SELECT * FROM places');
      res.json(rows);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.post('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const { place, checkIn, checkOut, numberOfGuests, name, phone, price } = req.body;

  try {
      const [result] = await db.query(
          `INSERT INTO bookings (place, checkIn, checkOut, numberOfGuests, name, phone, price, user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [place, checkIn, checkOut, numberOfGuests, name, phone, price, userData.id]
      );
      res.json({ id: result.insertId });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.get('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);

  try {
      const [rows] = await db.query(
          `SELECT bookings.*, places.* FROM bookings 
           INNER JOIN places ON bookings.place = places.id 
           WHERE bookings.user = ?`,
          [userData.id]
      );
      res.json(rows);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(4000, () => {
  console.log('Server is running on http://localhost:4000');
});
