import { MatchScore } from "../models/MatchScore.js";
import { User } from "../models/User.js";
import { fetchMatchScore } from "../routes/matchScores.js";

const activePortfolioMatches = new Map(); // matchId => interval

export async function startTrackingUserPortfolioMatches() {
  try {
    // Create a map to track matches that still have active positions
    const matchesWithActiveHoldings = new Map(); // matchId => hasActiveHoldings

    // Find users who have either a player portfolio or team portfolio
    const users = await User.find({
      $or: [
        { "portfolio.0": { $exists: true } },
        { "teamPortfolio.0": { $exists: true } }
      ]
    });

    console.log(`Found ${users.length} users with portfolios`);

    // Process each user's portfolios
    users.forEach((user) => {
      // Process player portfolio
      if (user.portfolio && user.portfolio.length > 0) {
        user.portfolio.forEach((item) => {
          const holdings = Number(item.currentHoldings);
          if (!isNaN(holdings) && holdings > 0) {
            console.log(`Adding active match from user ${user._id}'s player portfolio: ${item.matchId} with holdings: ${holdings}`);
            matchesWithActiveHoldings.set(item.matchId, true);
          }
        });
      }

      // Process team portfolio
      if (user.teamPortfolio && user.teamPortfolio.length > 0) {
        user.teamPortfolio.forEach((item) => {
          const holdings = Number(item.currentHoldings);
          if (!isNaN(holdings) && holdings > 0) {
            console.log(`Adding active match from user ${user._id}'s team portfolio: ${item.matchId} with holdings: ${holdings}`);
            matchesWithActiveHoldings.set(item.matchId, true);
          }
        });
      }
    });

    // Get array of match IDs that have active holdings
    const matchIds = [...matchesWithActiveHoldings.keys()];
    console.log("Tracking matchIds from portfolios with active holdings:", matchIds);

    // Skip tracking if no matches have active holdings
    if (matchIds.length === 0) {
      console.log("No matches with active holdings found. Skipping tracking setup.");
      return;
    }

    for (const matchId of matchIds) {
      if (activePortfolioMatches.has(matchId)) {
        console.log(`Match ${matchId} already being tracked. Skipping.`);
        continue;
      }

      // Check if match is already complete
      const match = await MatchScore.findOne({ matchId });
      if (match?.isMatchComplete) {
        console.log(`Skipping completed match ${matchId}`);
        continue;
      }

      console.log(`Setting up tracking interval for match ${matchId}`);
      const interval = setInterval(async () => {
        try {
          const updatedMatch = await fetchMatchScore(matchId);

          // Stop interval if match completes
          if (updatedMatch?.isMatchComplete) {
            clearInterval(activePortfolioMatches.get(matchId));
            activePortfolioMatches.delete(matchId);
            console.log(`Stopped polling match ${matchId} (completed)`);
          }
        } catch (err) {
          console.error(`Error fetching match ${matchId}:`, err.message);
        }
      }, 10000); // 10 seconds

      activePortfolioMatches.set(matchId, interval);
    }

    console.log(`Now tracking ${activePortfolioMatches.size} active matches`);
  } catch (err) {
    console.error("Error starting portfolio match tracking:", err.message);
  }
}

// Function to stop tracking all matches
export function stopAllPortfolioTracking() {
  const count = activePortfolioMatches.size;

  activePortfolioMatches.forEach((interval, matchId) => {
    clearInterval(interval);
    console.log(`Stopped tracking match ${matchId}`);
  });

  activePortfolioMatches.clear();
  console.log(`All portfolio match tracking stopped (${count} matches)`);
}

// Function to manually check for completed matches and clean up
export async function checkAndCleanupCompletedMatches() {
  const matchIds = [...activePortfolioMatches.keys()];
  console.log(`Checking ${matchIds.length} matches for completion status`);

  let cleanedCount = 0;

  for (const matchId of matchIds) {
    try {
      const match = await MatchScore.findOne({ matchId });

      if (match?.isMatchComplete) {
        clearInterval(activePortfolioMatches.get(matchId));
        activePortfolioMatches.delete(matchId);
        cleanedCount++;
        console.log(`Cleaned up completed match ${matchId}`);
      }
    } catch (err) {
      console.error(`Error checking match ${matchId}:`, err.message);
    }
  }

  console.log(`Cleanup complete. Removed ${cleanedCount} completed matches.`);
}

// Function to check if any users have active holdings for a specific match
export async function checkActiveHoldingsForMatch(matchId) {
  try {
    const usersWithActiveHoldings = await User.find({
      $or: [
        {
          "portfolio": {
            $elemMatch: {
              "matchId": matchId,
              "currentHoldings": { $gt: 0 }
            }
          }
        },
        {
          "teamPortfolio": {
            $elemMatch: {
              "matchId": matchId,
              "currentHoldings": { $gt: 0 }
            }
          }
        }
      ]
    });

    return usersWithActiveHoldings.length > 0;
  } catch (err) {
    console.error(`Error checking holdings for match ${matchId}:`, err.message);
    return false;
  }
}

// Function to periodically refresh which matches need tracking
export async function refreshPortfolioTracking() {
  console.log("Starting portfolio tracking refresh");

  // Stop all current tracking
  stopAllPortfolioTracking();

  // Restart with fresh data
  await startTrackingUserPortfolioMatches();
  console.log("Portfolio tracking refresh completed");
}

// Function to check and stop tracking for matches with no active holdings
export async function cleanupInactiveMatches() {
  const matchIds = [...activePortfolioMatches.keys()];
  console.log(`Checking ${matchIds.length} tracked matches for inactive status`);

  let removedCount = 0;

  for (const matchId of matchIds) {
    const hasActiveHoldings = await checkActiveHoldingsForMatch(matchId);

    if (!hasActiveHoldings) {
      clearInterval(activePortfolioMatches.get(matchId));
      activePortfolioMatches.delete(matchId);
      removedCount++;
      console.log(`Stopped tracking match ${matchId} (no active holdings)`);
    }
  }

  console.log(`Inactive cleanup complete. Removed ${removedCount} matches with no active holdings.`);
}
