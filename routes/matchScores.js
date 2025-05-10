import express from "express";
import { MatchScore } from "../models/MatchScore.js";
import { MatchSchedule } from "../models/MatchSchedule.js";
import { User } from "../models/User.js";
import axios from "axios";
import dotenv from "dotenv";
// import { io } from "../index.js";
import { getIO } from "../SocketService/socket.js";

const router = express.Router();
dotenv.config();

// RapidAPI configuration
const rapidAPIHeaders = {
  "x-rapidapi-key": process.env.CRICKET_API,
  "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
};

// Function to fetch match scores
export const fetchMatchScore = async (matchId) => {
  try {
    const io = getIO();
    const response = await axios.get(
      `https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${matchId}/hscard`,
      { headers: rapidAPIHeaders }
    );

    const matchData = response.data;

    if (!matchData) return null;

    // Extract scorecard data for both teams
    const scorecard = matchData.scoreCard || [];


    // Process data for both innings
    const processedInnings = scorecard.map((innings) => ({
      inningsId: innings.inningsId,
      batTeamName: innings.batTeamDetails.batTeamName,
      batTeamSName: innings.batTeamDetails.batTeamShortName,
      bowlTeamName: innings.bowlTeamDetails.bowlTeamName,
      bowlTeamSName: innings.bowlTeamDetails.bowlTeamShortName,
      score: innings.scoreDetails.runs || 0,
      wickets: innings.scoreDetails.wickets || 0,
      overs: innings.scoreDetails.overs || "0.0",
      runRate: innings.scoreDetails.runRate || "0.00",
      ballNbr: innings.scoreDetails.ballNbr,
      rpb: innings.scoreDetails.runsPerBall,
      isDeclared: innings.scoreDetails.isDeclared || false,
      isFollowOn: innings.scoreDetails.isFollowOn || false,
      revisedOvers: innings.scoreDetails.revisedOvers || 0,

      batsmen: Object.values(innings.batTeamDetails.batsmenData).map((bat) => ({
        id: bat.batId,
        name: bat.batName,
        nickName: bat.batShortName,
        balls: bat.balls || 0,
        runs: bat.runs || 0,
        fours: bat.fours || 0,
        sixes: bat.sixes || 0,
        dots: bat.dots || 0,
        ones: bat.ones || 0,
        twos: bat.twos || 0,
        threes: bat.threes || 0,
        fives: bat.fives || 0,
        boundaries: bat.boundaries || 0,
        minutes: bat.mins || 0,
        strikeRate: bat.strikeRate || "0.00",
        outDesc: bat.outDesc || "not out",
        bowlerId: bat.bowlerId || 0,
        fielderId1: bat.fielderId1 || 0,
        fielderId2: bat.fielderId2 || 0,
        fielderId3: bat.fielderId3 || 0,
        wicketCode: bat.wicketCode || "",
        isCaptain: bat.isCaptain || false,
        isKeeper: bat.isKeeper || false,
        isOverseas: bat.isOverseas || false,
        inMatchChange: bat.inMatchChange || "",
        playingXIChange: bat.playingXIChange || "",
      })),

      bowlers: Object.values(innings.bowlTeamDetails.bowlersData).map(
        (bowl) => ({
          id: bowl.bowlerId,
          name: bowl.bowlName,
          nickName: bowl.bowlShortName,
          overs: bowl.overs || "0.0",
          maidens: bowl.maidens || 0,
          wickets: bowl.wickets || 0,
          runs: bowl.runs || 0,
          economy: bowl.economy || "0.00",
          balls: bowl.balls || 0,
          dots: bowl.dots || 0,
          noBalls: bowl.no_balls || 0,
          wides: bowl.wides || 0,
          runsPerBall: bowl.runsPerBall || 0,
          isCaptain: bowl.isCaptain || false,
          isKeeper: bowl.isKeeper || false,
          isOverseas: bowl.isOverseas || false,
          inMatchChange: bowl.inMatchChange || "",
          playingXIChange: bowl.playingXIChange || "",
        })
      ),

      extras: {
        legByes: innings.extrasData.legByes || 0,
        byes: innings.extrasData.byes || 0,
        wides: innings.extrasData.wides || 0,
        noBalls: innings.extrasData.noBalls || 0,
        penalty: innings.extrasData.penalty || 0,
        total: innings.extrasData.total || 0,
      },

      wickets: Object.values(innings.wicketsData).map((fall) => ({
        batsmanId: fall.batId,
        batsmanName: fall.batName,
        wicketNumber: fall.wktNbr,
        overNumber: fall.wktOver,
        runs: fall.wktRuns,
        ballNumber: fall.ballNbr,
      })),

      partnerships: Object.values(innings.partnershipsData).map((p) => ({
        bat1Id: p.bat1Id,
        bat1Name: p.bat1Name,
        bat1Runs: p.bat1Runs || 0,
        bat1Balls: p.bat1balls || 0,
        bat1Dots: p.bat1dots || 0,
        bat1Ones: p.bat1Ones || 0,
        bat1Twos: p.bat1Twos || 0,
        bat1Threes: p.bat1Threes || 0,
        bat1Fours: p.bat1fours || 0,
        bat1Fives: p.bat1Fives || 0,
        bat1Sixes: p.bat1sixes || 0,
        bat1Boundaries: p.bat1Boundaries || 0,

        bat2Id: p.bat2Id,
        bat2Name: p.bat2Name,
        bat2Runs: p.bat2Runs || 0,
        bat2Balls: p.bat2balls || 0,
        bat2Dots: p.bat2dots || 0,
        bat2Ones: p.bat2Ones || 0,
        bat2Twos: p.bat2Twos || 0,
        bat2Threes: p.bat2Threes || 0,
        bat2Fours: p.bat2fours || 0,
        bat2Fives: p.bat2Fives || 0,
        bat2Sixes: p.bat2sixes || 0,
        bat2Boundaries: p.bat2Boundaries || 0,

        totalRuns: p.totalRuns || 0,
        totalBalls: p.totalBalls || 0,
      })),

      // Power Play data if available
      powerPlayData: innings.ppData || {},
    }));

    // const stored = await MatchScore.findOne({ matchId });

    // console.log(stored)

    // processedInnings.forEach((inn) => {
    //   inn.batsmen.forEach((bat) => {
    //     const previous = stored?.innings?.flatMap(i => i.batsmen)?.find(b => b.id === bat.id);

    //     if (previous && bat.dots < previous.dots) {
    //       bat.dots = previous.dots;
    //     }
    //   });
    // });    

    const newMatchScore = {
      matchId,
      status: matchData.status,
      isMatchComplete: matchData.isMatchComplete,
      responseLastUpdated: new Date(), // Ensure this is a Date object
      innings: processedInnings,
    };


    // Store in database - use findOneAndUpdate with new:true to return the updated document
    const storedMatchScore = await MatchScore.findOneAndUpdate(
      {
        matchId,
        $or: [
          { responseLastUpdated: { $exists: false } },
          { responseLastUpdated: { $lt: newMatchScore.responseLastUpdated } }
        ]
      },
      newMatchScore,
      { upsert: true, new: true }
    );




    io.to(matchId).emit("scoreUpdate", storedMatchScore);
    console.log(`Broadcasting update for match ${matchId}`);

    return storedMatchScore;
  } catch (error) {
    console.error(`Error fetching score for match ${matchId}:`, error.message);
    return null;
  }
};


// Route to get all stored match scores
router.get("/all-scores", async (req, res) => {
  try {
    const users = await User.find({ "portfolio.0": { $exists: true } });
    const matchIds = new Set();

    users.forEach((user) => {
      user.portfolio.forEach((p) => matchIds.add(p.matchId));
    });

    const matchScores = await MatchScore.find({ matchId: { $in: [...matchIds] } });
    res.status(200).json({ matchScores });
  } catch (error) {
    res.status(500).json({ message: "Error fetching portfolio match scores", error: error.message });
  }
});

const activeMatches = new Map(); // Map<matchId, {interval, subscribers}>
let connectedUsers = new Set(); // Track connected users by socket ID

export function setupSocketConnections() {
  try {
    const io = getIO();

    // Add route to get connected users count
    // const router = express.Router();
    router.get('/connected-users', (req, res) => {
      res.json({ count: connectedUsers.size });
    });

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);
      connectedUsers.add(socket.id);
      console.log(`Total connected users: ${connectedUsers.size}`);

      // Keep track of which matches this socket is subscribed to
      socket.subscribedMatches = new Set(); // Attach to socket object directly

      socket.on("subscribeMatch", async (match) => {
        const matchId = match.matchId
        console.log(`Client ${socket.id} subscribed to match ${matchId}`);

        socket.join(matchId);
        socket.subscribedMatches.add(matchId);

        await fetchMatchScore(matchId);

        const matchData = await MatchScore.findOne({ matchId });

        if (!match) {
          console.log(`No match found with ID: ${matchId}`);
          return;
        }

        // Always send initial data (could be pre-match info too)
        socket.emit("scoreUpdate", matchData);

        const now = new Date();
        const matchStart = new Date(match.startDate);

        // If match is complete, don't do anything further
        if (match.isMatchComplete) {
          console.log(`Match ${matchId} is complete. Not starting interval.`);
          return;
        }

        // If match hasn't started yet, schedule it
        if (matchStart > now) {
          const msUntilStart = matchStart.getTime() - now.getTime();
          console.log(`Match ${matchId} will start in ${msUntilStart / (1000 * 60)}m`);

          setTimeout(() => {
            // Double-check match hasn't completed before starting interval
            MatchScore.findOne({ matchId }).then((latestMatch) => {
              if (latestMatch && !latestMatch.isMatchComplete) {
                if (!activeMatches.has(matchId)) {
                  const interval = setInterval(() => {
                    fetchMatchScore(matchId);
                  }, 1500);
                  activeMatches.set(matchId, { interval, subscribers: 1 });
                  console.log(`Interval started for future match ${matchId}`);
                }
              }
            });
          }, msUntilStart);

          return;
        }

        // Match is already live – start fetching now
        if (!activeMatches.has(matchId)) {
          const interval = setInterval(() => {
            fetchMatchScore(matchId);
          }, 1500);
          activeMatches.set(matchId, { interval, subscribers: 1 });
          console.log(`Interval started for live match ${matchId}`);
        } else {
          const matchData = activeMatches.get(matchId);
          matchData.subscribers += 1;
          activeMatches.set(matchId, matchData);
          console.log(`Match ${matchId} now has ${matchData.subscribers} subscribers`);
        }
      });


      // Handle unsubscribe (if you have this functionality)
      socket.on("unsubscribeMatch", (matchId) => {
        handleUnsubscribe(socket, matchId);
      });

      // Cleanup on disconnect
      socket.on("disconnect", () => {
        console.log(`Client ${socket.id} disconnected`);
        connectedUsers.delete(socket.id);
        console.log(`Total connected users: ${connectedUsers.size}`);

        // Clean up all subscriptions for this socket
        if (socket.subscribedMatches) {
          for (const matchId of socket.subscribedMatches) {
            handleUnsubscribe(socket, matchId);
          }
        }
      });
    });

    // Helper function to handle unsubscribing
    function handleUnsubscribe(socket, matchId) {
      // Remove from room
      socket.leave(matchId);

      // Remove from tracking set
      if (socket.subscribedMatches) {
        socket.subscribedMatches.delete(matchId);
      }

      // Decrement subscribers and possibly clean up interval
      if (activeMatches.has(matchId)) {
        const matchData = activeMatches.get(matchId);
        matchData.subscribers -= 1;

        // If no more subscribers, clear the interval
        if (matchData.subscribers <= 0) {
          console.log(`Clearing interval for match ${matchId} - no more subscribers`);
          clearInterval(matchData.interval);
          activeMatches.delete(matchId);
        } else {
          // Update the subscriber count
          activeMatches.set(matchId, matchData);
          console.log(`Match ${matchId} now has ${matchData.subscribers} subscribers`);
        }
      }
    }

    console.log("Socket connections setup complete");
  } catch (error) {
    console.error("Error setting up socket connections:", error);
  }
}

export default router;
