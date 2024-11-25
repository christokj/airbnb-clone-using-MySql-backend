const express = require("express");
const userRoute = require("./userRoute.js");

const v1Router = express.Router();

v1Router.use("/user", userRoute);

module.exports = v1Router;
