const db = require("./db"); // Assuming you have a separate db.js file for MySQL connection setup

const Booking = {
  // Create a new booking
  createBooking: async (
    placeId,
    userId,
    checkIn,
    checkOut,
    name,
    phone,
    price,
  ) => {
    const sql = `INSERT INTO bookings (place, user, checkIn, checkOut, name, phone, price)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
      db.query(
        sql,
        [placeId, userId, checkIn, checkOut, name, phone, price],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result); // Returning the result of the insert operation
          }
        },
      );
    });
  },

  // Get bookings by user ID
  getBookingsByUser: async (userId) => {
    const sql = "SELECT * FROM bookings WHERE user = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [userId], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result); // Returning the bookings for the specified user
        }
      });
    });
  },

  // Get booking details by booking ID
  getBookingById: async (id) => {
    const sql = "SELECT * FROM bookings WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0] || null); // Returning the first matched booking or null if not found
        }
      });
    });
  },

  // Update booking details
  updateBooking: async (
    id,
    placeId,
    userId,
    checkIn,
    checkOut,
    name,
    phone,
    price,
  ) => {
    const sql = `UPDATE bookings SET place = ?, user = ?, checkIn = ?, checkOut = ?, name = ?, phone = ?, price = ? WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.query(
        sql,
        [placeId, userId, checkIn, checkOut, name, phone, price, id],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result); // Returning the result of the update operation
          }
        },
      );
    });
  },

  // Delete a booking by ID
  deleteBooking: async (id) => {
    const sql = "DELETE FROM bookings WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result); // Returning the result of the delete operation
        }
      });
    });
  },
};

module.exports = Booking;
