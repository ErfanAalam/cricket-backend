import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import http from "http";
import { initializeSocket } from "./SocketService/socket.js";
import { setupSocketConnections } from "./routes/matchScores.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server);

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "https://cricket-frontend-one.vercel.app", // Add your frontend and backend URLs
    methods: "GET,POST,PUT,DELETE",
    credentials: true, // Allow cookies and auth headers
  })
);
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
  })
);

// Connect to MongoDB

const MONGO_URI =
  process.env.MONGO_URI 

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Import routes after initializing socket.io
import authRoutes from "./routes/authRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import matchScores from "./routes/matchScores.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import portfolioRoute from "./routes/portfolioRoute.js";
import paymentRoute from "./routes/paymentRoute.js"
import { startTrackingUserPortfolioMatches } from "./MatchPortfolioTracker/MatchPortfolioTracker.js";

// Define Routes
app.use("/auth", authRoutes);
app.use("/matches", matchRoutes);
app.use("/match-scores", matchScores);
app.use("/upload", uploadRoutes);
app.use("/portfolio", portfolioRoute);
app.use("/payment", paymentRoute);

// Root Route
app.get("/", (req, res) => {
  res.send("Cricket Betting App API is running...");
});

setupSocketConnections();

// Start the Server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  startTrackingUserPortfolioMatches();
  console.log(`Server running on port ${PORT}`);
});
