const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const imageDownloader = require("image-downloader");
const multer = require("multer");
const fs = require("fs");
require("dotenv").config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const db = require("../../config/db");

const router = express.Router();

const bucket = process.env.BUCKET;

const bcryptSalt = bcrypt.genSaltSync(10);

// router.use('/uploads', express.static(__dirname + '/uploads'));

async function uploadToS3(path, originalFilename, mimetype) {
  const client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  const parts = await originalFilename.split(".");
  const ext = parts[parts.length - 1];
  const newFilename = Date.now() + "." + ext;
  try {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Body: fs.readFileSync(path),
      Key: newFilename,
      ContentType: mimetype,
      ACL: "public-read",
    })
  );
} catch (err) {
  console.error("S3 Upload Error:", err);
  throw err;
}
  return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
}

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    const token = req.cookies.token; // Ensure token is coming from cookies
    console.log(token)
    if (!token) {
      return reject(new Error("Token not provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, {}, (err, userData) => {
      if (err) {
        return reject(new Error(`JWT Verification Failed: ${err.message}`));
      }
      resolve(userData);
    });
  });
}

router.get("/test", (req, res) => {
  db.query("SELECT 1 + 1 AS solution", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json({ solution: results[0].solution });
  });
});

// User Signup
router.post("/signUp", async (req, res) => {
  const { name, email, password } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, bcryptSalt); // Use bcrypt for hashing

    // Check if the email already exists
    const checkEmailSql = "SELECT email FROM users WHERE email = ?";
    const [results] = await db.execute(checkEmailSql, [email]);

    if (results.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // Insert the new user
    const insertSql =
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    await db.execute(insertSql, [name, email, hashedPassword]);

    res.status(201).json({ name, email });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const sql = "SELECT * FROM users WHERE email = ?";
    const [results] = await db.execute(sql, [email]);

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }, // Token expires in 1 day
      (err, token) => {
        if (err) {
          console.error("JWT signing error:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        const isProduction = process.env.NODE_ENV === "production";
        // console.log(isProduction,'====idProduction');
    
        res.cookie("token", token, {
            maxAge: 24 * 60 * 60 * 1000, // 1 day
            httpOnly: true,
            secure: isProduction, // Secure only in production
            sameSite: isProduction ? "None" : "Lax", // 'None' for production, 'Lax' for development
        });

        // Respond with user data (excluding sensitive fields like password)
        // const { password, ...userWithoutPassword } = user;
        return res.json({success: true});
      }
    );
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Profile Route
router.get("/profile", async (req, res) => {
 
  try { 

    const userData = await getUserDataFromReq(req);
    // Verify JWT token
    // const userData = jwt.verify(token, process.env.JWT_SECRET); // Use sync verify to get userData

    // Query user by email from the decoded token
    const [results] = await db.query(
      "SELECT email FROM users WHERE email = ?",
      [userData.email]
    );

    // Handle case where no user is found
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found", success: false }); // If no user is found
    }

    // Respond with user data (ensure it's the required fields)
    res.json({ success: true, data: { email: results[0].email } }); // Respond with success and user email
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res
        .status(403)
        .json({ error: "Invalid or expired token", success: false }); // If token is invalid or expired
    }
    return res
      .status(500)
      .json({ error: "Server error", details: err.message, success: false }); // Handle other errors
  }
});

// Logout
router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      httpOnly: true,
      secure: isProduction, // Secure only in production
      sameSite: isProduction ? "None" : "Lax", // 'None' for production, 'Lax' for development
  });
});

// Upload photos by link
router.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  try {
  await imageDownloader.image({
    url: link,
    dest: "/tmp/" + newName,
  });
  console.log("first ")
  const url = await uploadToS3(
    "/tmp/" + newName,
    newName,
    mime.lookup("/tmp/" + newName)
  );
  res.json(url);
} catch (error) {
  console.error("Image upload error:", error);
  res.status(500).json({ error: "Internal server error" });
    
}
});

// Upload photos from file
const photosMiddleware = multer({ dest: "/tmp/uploads/" });
router.post(
  "/upload",
  photosMiddleware.array("photos", 100),
  async (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
      const { path, originalname, mimetype } = req.files[i];
      const url = await uploadToS3(path, originalname, mimetype);
      uploadedFiles.push(url);
    }
    res.json(uploadedFiles);
  }
);

// Add a new place
router.post("/places", async (req, res) => {
  const {
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  try {
    const userData = await getUserDataFromReq(req);
    const user_email = userData.email;
    const sql = `
        INSERT INTO places 
        (title, address, photos, description, perks, extra_info, check_in, check_out, max_guests, price, user_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    const values = [
      title,
      address,
      JSON.stringify(addedPhotos),
      description,
      JSON.stringify(perks),
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
      user_email,
    ];

    // Execute query using promise-based API
    const [result] = await db.execute(sql, values);

    // Respond with success
    res.json({ message: "success", id: result.insertId });
  } catch (err) {
    console.error("Error in try-catch:", err);
    res.status(500).json(err);
  }
});

// List user's places
router.get("/user-places", async (req, res) => {
  const { token } = req.cookies;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Extract user data from the token
    const userData = await getUserDataFromReq(req);

    // Query to fetch places where the userEmail matches the user's id
    const sql = "SELECT * FROM places WHERE user_email = ?";
    const [results] = await db.query(sql, [userData.email]);

    // Send the results as JSON
    res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching user-specific places:", err.message);
    res.status(500).json({ error: "Failed to fetch user-specific places" });
  }
});

router.get("/places/:title", async (req, res) => {
  const { title } = req.params;
  try {
    const [rows] = await db.query("SELECT * FROM places WHERE title = ?", [
      title,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Place not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/places", async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  jwt.verify(token, process.env.JWT_SECRET, {}, async (err, userData) => {
    if (err) return res.status(403).json({ error: "Unauthorized" });

    try {
      const [placeRows] = await db.query("SELECT * FROM places WHERE id = ?", [
        id,
      ]);
      if (placeRows.length === 0) {
        return res.status(404).json({ error: "Place not found" });
      }
      const place = placeRows[0];

      if (userData.email !== place.user_email.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to edit this place" });
      }

      await db.query(
        `UPDATE places SET title = ?, address = ?, photos = ?, description = ?, perks = ?, extra_info = ?, check_in = ?, check_out = ?, max_guests = ?, price = ? WHERE user_email = ?`,
        [
          title,
          address,
          JSON.stringify(addedPhotos),
          description,
          JSON.stringify(perks),
          extraInfo,
          checkIn,
          checkOut,
          maxGuests,
          price,
          place.userEmail,
        ]
      );
      res.json("ok");
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

router.get("/places", async (req, res) => {
  const { title } = req.query; // Retrieve the title from the query parameters

  try {
    let rows;
    if (title) {
      // Fetch places where the title matches the given title
      const [results] = await db.query("SELECT * FROM places WHERE title = ?", [
        title,
      ]);
      rows = results;
    } else {
      // If no title is provided, fetch all places
      const [results] = await db.query("SELECT * FROM places");
      rows = results;
    }

    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching places:", err.message);
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    // Fetch all bookings from the bookings table
    const [rows] = await db.query("SELECT * FROM bookings");

    // Send the fetched rows as a JSON response
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching bookings:", err.message);
    res.status(500).json({ error: "Failed to retrieve bookings" });
  }
});

router.post("/bookings", async (req, res) => {
  const { check_in, check_out, number_of_guests, name, phone, place, price } =
    req.body;
  const userData = await getUserDataFromReq(req);
  try {
    const result = await db.query(
      `INSERT INTO bookings (check_in, check_out, number_of_guests, name, phone, place, price, user_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        check_in,
        check_out,
        number_of_guests,
        name,
        phone,
        place,
        price,
        userData.email,
      ]
    );
    res.status(201).json({
      message: "Booking created successfully",
      bookingId: result[0].insertId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
