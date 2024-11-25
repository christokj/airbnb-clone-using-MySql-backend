const db = require("./db"); // Assuming you have a separate db.js file for MySQL connection setup
const bcrypt = require("bcryptjs");

const bcryptSalt = bcrypt.genSaltSync(10);

const User = {
  // Create a new user
  createUser: async (name, email, password) => {
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    return new Promise((resolve, reject) => {
      db.query(sql, [name, email, hashedPassword], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  },

  // Find user by email
  findByEmail: async (email) => {
    const sql = "SELECT * FROM users WHERE email = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [email], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0] || null); // Return the first matched user or null
        }
      });
    });
  },

  // Find user by ID
  findById: async (id) => {
    const sql = "SELECT id, name, email FROM users WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0] || null);
        }
      });
    });
  },

  // Update user details
  updateUser: async (id, name, email) => {
    const sql = "UPDATE users SET name = ?, email = ? WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [name, email, id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  },
};

module.exports = User;
