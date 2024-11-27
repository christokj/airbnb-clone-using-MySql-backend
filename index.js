const express = require("express");
const cors = require("cors");
const apiRouter = require("./routes");
const cookieParser = require("cookie-parser");

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_DOMAIN,
  allowedHeaders:[
    "Content-Type",         // General content type header
    "Authorization",        // For tokens or auth headers
    "Accept",               // Accept header for API responses
    "Origin",               // Origin header for CORS
    "X-Requested-With",     // XMLHttpRequest (used in some AJAX libraries)
    "Access-Control-Allow-Headers", // Ensures dynamic headers are included
  ],
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
