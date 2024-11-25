const mysql = require("mysql2/promise");

// MySQL connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Test the connection
(async () => {
  try {
    const connection = await db.getConnection();
    console.log("Connected to the database.");
    connection.release(); // Release the connection back to the pool
  } catch (err) {
    console.error("Database connection failed:", err);
  }
})();

module.exports = db;
