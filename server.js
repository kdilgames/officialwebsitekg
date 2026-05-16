require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cors());

const PORT = process.env.PORT || 3000;
const ROBLOX_SECRET = process.env.ROBLOX_SECRET;

let leaderboardPlayers = [];
let lastServerUpdate = null;

function cleanPlayer(player) {
  return {
    username: String(player.username || "Unknown"),
    displayName: String(player.displayName || player.username || "Unknown"),
    userId: Number(player.userId || 0),

    cash: Number(player.cash || 0),
    kills: Number(player.kills || 0),

    team: String(player.team || "No Team"),
    wanted: Boolean(player.wanted),

    playtimeSeconds: Number(player.playtimeSeconds || 0),
    online: Boolean(player.online),

    lastUpdated: String(player.lastUpdated || new Date().toISOString())
  };
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "KDILGAMES Leaderboard API"
  });
});

app.get("/api/leaderboard", (req, res) => {
  const sortedPlayers = [...leaderboardPlayers]
    .sort((a, b) => b.cash - a.cash)
    .map((player, index) => ({
      rank: index + 1,
      ...player
    }));

  res.json({
    success: true,
    updatedAt: lastServerUpdate,
    players: sortedPlayers
  });
});

app.post("/api/leaderboard/update", (req, res) => {
  const body = req.body;

  if (!body || body.secret !== ROBLOX_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  if (!Array.isArray(body.players)) {
    return res.status(400).json({
      success: false,
      message: "players must be an array"
    });
  }

  leaderboardPlayers = body.players.map(cleanPlayer);
  lastServerUpdate = new Date().toISOString();

  res.json({
    success: true,
    message: "Leaderboard updated",
    totalPlayers: leaderboardPlayers.length,
    updatedAt: lastServerUpdate
  });
});

app.listen(PORT, () => {
  console.log(`KDILGAMES Leaderboard API running on port ${PORT}`);
});