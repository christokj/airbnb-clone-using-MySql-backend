const e = require("express");
const v1Router = require("./v1/index.js");

const apiRouter = e.Router();

apiRouter.use("/v1", v1Router);

module.exports = apiRouter;
