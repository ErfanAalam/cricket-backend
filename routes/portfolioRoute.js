import express from "express";
import { User } from "../models/User.js";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/set-portfolio", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get portfolio data from request body
    const {
      matchId,
      playerId,
      playerName,
      team,
      initialPrice,
      price,
      quantity,
    } = req.body;

    // Validate required fields
    if (!matchId || !playerId || !team || price === undefined || quantity === undefined) {
      return res
        .status(400)
        .json({ message: "Missing required portfolio data" });
    }

    // Check if user already has this player from this match in portfolio
    const existingPortfolioIndex = user.portfolio.findIndex(
      (item) =>
        item.matchId.toString() === matchId.toString() &&
        item.playerId.toString() === playerId.toString()
    );

    console.log(user.portfolio);

    if (existingPortfolioIndex !== -1) {
      // Portfolio entry exists - update it
      const portfolioItem = user.portfolio[existingPortfolioIndex];

      // Add a new transaction
      portfolioItem.transactions.push({
        type: "buy",
        quantity,
        price,
      });

      // Update current holdings
      portfolioItem.currentHoldings += quantity;
    } else {
      // Add new portfolio entry
      user.portfolio.push({
        matchId,
        playerId,
        playerName,
        team,
        initialPrice,
        transactions: [
          {
            type: "buy",
            quantity,
            price,
          },
        ],
        currentHoldings: quantity,
      });
    }

    // Save updated user data
    await user.save();

    res.status(200).json({
      message: "Portfolio updated successfully",
      portfolio: user.portfolio,
    });
  } catch (err) {
    console.error("❌ Error storing portfolio data:", err);
    res.status(500).json({ message: "Error storing portfolio data" });
  }
});

router.post("/sell-portfolio", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get selling data from request body
    const { matchId, playerId, price, quantity, autoSold, reason } = req.body;

    // Validate required fields
    if (!matchId || !playerId || price === undefined || quantity === undefined) {
      return res.status(400).json({ message: "Missing required sell data" });
    }

    // Find the portfolio item using both matchId and playerId
    const portfolioIndex = user.portfolio.findIndex(
      (item) =>
        item.matchId.toString() === matchId.toString() &&
        item.playerId.toString() === playerId.toString()
    );

    if (portfolioIndex === -1) {
      return res.status(404).json({ message: "Player not found in portfolio for the specified match" });
    }

    const portfolioItem = user.portfolio[portfolioIndex];

    // Check if user has enough stocks to sell
    if (portfolioItem.currentHoldings < quantity) {
      return res.status(400).json({
        message: "Not enough holdings to sell",
        available: portfolioItem.currentHoldings,
      });
    }

    // Add sell transaction with auto-sell info if provided
    portfolioItem.transactions.push({
      type: "sell",
      quantity,
      price: price.toFixed(2),
      timestamp: Date.now(),
      autoSold: autoSold || false,
      reason: reason || ''
    });

    // Update holdings
    portfolioItem.currentHoldings = Math.max(
      0,
      portfolioItem.currentHoldings - quantity
    );

    await user.save();

    res.status(200).json({
      message: "Successfully sold stocks",
      portfolio: user.portfolio,
    });
  } catch (err) {
    console.error("❌ Error processing sell request:", err);
    res.status(500).json({ message: "Error processing sell request" });
  }
});

// Get user's portfolio
router.get("/get-portfolio", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;

    // Find user by ID in MongoDB
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sort transactions in each portfolio item
    user.portfolio.forEach((item) => {
      item.transactions.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    });

    res.status(200).json({ portfolio: user.portfolio });
  } catch (err) {
    console.error("❌ Error retrieving portfolio data:", err);
    res.status(500).json({ message: "Error retrieving portfolio data" });
  }
});


// routes for teamportfolio 

router.post("/set-team-portfolio", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get team portfolio data from request body
    const {
      matchId,
      teamId,
      teamName,
      initialPrice,
      price,
      quantity,
    } = req.body;

    // Validate required fields
    if (!matchId || !teamId || !teamName || price === undefined || quantity === undefined) {
      return res
        .status(400)
        .json({ message: "Missing required team portfolio data" });
    }

    // Check if user already has this team from this match in portfolio
    const existingTeamPortfolioIndex = user.teamPortfolio.findIndex(
      (item) =>
        item.matchId.toString() === matchId.toString() &&
        item.teamId.toString() === teamId.toString()
    );

    if (existingTeamPortfolioIndex !== -1) {
      // Team portfolio entry exists - update it
      const teamPortfolioItem = user.teamPortfolio[existingTeamPortfolioIndex];

      // Add a new transaction
      teamPortfolioItem.transactions.push({
        type: "buy",
        quantity,
        price,
        timestamp: Date.now()
      });

      // Update current holdings
      teamPortfolioItem.currentHoldings += quantity;
    } else {
      // Add new team portfolio entry
      user.teamPortfolio.push({
        matchId,
        teamId,
        teamName,
        initialPrice,
        transactions: [
          {
            type: "buy",
            quantity,
            price,
            timestamp: Date.now()
          },
        ],
        currentHoldings: quantity,
      });
    }

    // Save updated user data
    await user.save();

    res.status(200).json({
      message: "Team portfolio updated successfully",
      teamPortfolio: user.teamPortfolio,
    });
  } catch (err) {
    console.error("❌ Error storing team portfolio data:", err);
    res.status(500).json({ message: "Error storing team portfolio data" });
  }
});

router.post("/sell-team-portfolio", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get selling data from request body
    const { matchId, teamId, price, quantity, autoSold, reason } = req.body;

    // Validate required fields
    if (!matchId || !teamId || price === undefined || quantity === undefined) {
      return res.status(400).json({ message: "Missing required team sell data" });
    }

    // Find the team portfolio item using both matchId and teamId
    const teamPortfolioIndex = user.teamPortfolio.findIndex(
      (item) =>
        item.matchId.toString() === matchId.toString() &&
        item.teamId.toString() === teamId.toString()
    );

    if (teamPortfolioIndex === -1) {
      return res.status(404).json({ message: "Team not found in portfolio for the specified match" });
    }

    const teamPortfolioItem = user.teamPortfolio[teamPortfolioIndex];

    // Check if user has enough stocks to sell
    if (teamPortfolioItem.currentHoldings < quantity) {
      return res.status(400).json({
        message: "Not enough team holdings to sell",
        available: teamPortfolioItem.currentHoldings,
      });
    }

    // Add sell transaction with auto-sell info if provided
    teamPortfolioItem.transactions.push({
      type: "sell",
      quantity,
      price,
      timestamp: Date.now(),
      autoSold: autoSold || false,
      reason: reason || ''
    });

    // Update holdings
    teamPortfolioItem.currentHoldings = Math.max(
      0,
      teamPortfolioItem.currentHoldings - quantity
    );

    await user.save();

    res.status(200).json({
      message: "Successfully sold team stocks",
      teamPortfolio: user.teamPortfolio,
    });
  } catch (err) {
    console.error("❌ Error processing team sell request:", err);
    res.status(500).json({ message: "Error processing team sell request" });
  }
});

// Get user's team portfolio
router.get("/get-team-portfolio", authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No user data in token" });
    }

    const userId = req.user.userId;

    // Find user by ID in MongoDB
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Sort transactions in each team portfolio item
    user.teamPortfolio.forEach((item) => {
      item.transactions.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    });

    res.status(200).json({ teamPortfolio: user.teamPortfolio });
  } catch (err) {
    console.error("❌ Error retrieving team portfolio data:", err);
    res.status(500).json({ message: "Error retrieving team portfolio data" });
  }
});

export default router;
