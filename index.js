const express = require("express");
const cors = require("cors");
const apiRouter = require("./routes");
const cookieParser = require("cookie-parser");

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_DOMAIN, // ""
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Allow credentials (cookies, etc.)
  optionSuccessStatus: 200, // Success status for older browsers (IE11, etc.)
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api", apiRouter);

app.all("*", (req, res, next) => {
  if (!res.headersSent) {
    res.status(404).json({ message: "End point does not exist" });
  }
});

// Start Server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
