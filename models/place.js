const db = require("./db"); // Assuming you have a separate db.js file for MySQL connection setup

const Place = {
  // Create a new place
  createPlace: async (
    ownerId,
    title,
    address,
    photos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  ) => {
    const sql = `INSERT INTO places (owner, title, address, photos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    return new Promise((resolve, reject) => {
      db.query(
        sql,
        [
          ownerId,
          title,
          address,
          JSON.stringify(photos),
          description,
          JSON.stringify(perks),
          extraInfo,
          checkIn,
          checkOut,
          maxGuests,
          price,
        ],
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

  // Find a place by its ID
  findPlaceById: async (id) => {
    const sql = "SELECT * FROM places WHERE id = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [id], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result[0] || null); // Return the first matched place or null if not found
        }
      });
    });
  },

  // Get all places
  getAllPlaces: async () => {
    const sql = "SELECT * FROM places";
    return new Promise((resolve, reject) => {
      db.query(sql, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result); // Returning all the places
        }
      });
    });
  },

  // Find places by owner
  getPlacesByOwner: async (ownerId) => {
    const sql = "SELECT * FROM places WHERE owner = ?";
    return new Promise((resolve, reject) => {
      db.query(sql, [ownerId], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result); // Returning places owned by the specified user
        }
      });
    });
  },

  // Update a place's details
  updatePlace: async (
    id,
    title,
    address,
    photos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  ) => {
    const sql = `UPDATE places SET title = ?, address = ?, photos = ?, description = ?, perks = ?, extraInfo = ?, checkIn = ?, checkOut = ?, maxGuests = ?, price = ? WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.query(
        sql,
        [
          title,
          address,
          JSON.stringify(photos),
          description,
          JSON.stringify(perks),
          extraInfo,
          checkIn,
          checkOut,
          maxGuests,
          price,
          id,
        ],
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

  // Delete a place by ID
  deletePlace: async (id) => {
    const sql = "DELETE FROM places WHERE id = ?";
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

module.exports = Place;
