import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.resolve("./data");
const dataFile = path.join(dataDir, "leaderboard.json");

const emptyState = {
  users: {},
  appUsage: [],
  points: [],
  discussion: {
    messages: []
  }
};

let state = null;

async function loadState() {
  if (state) return state;
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    state = JSON.parse(raw);
  } catch (err) {
    state = { ...emptyState };
    await saveState();
  }
  if (!state.discussion) {
    state.discussion = { messages: [] };
  }
  return state;
}

async function saveState() {
  const tmp = `${dataFile}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.rename(tmp, dataFile);
}

function getLatestPoints(userId) {
  const rows = state.points
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date));
  return rows[0]?.total ?? 0;
}

function getPreviousUsage(userId, appName, date) {
  const rows = state.appUsage
    .filter((row) => row.userId === userId && row.app === appName && row.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return rows[0] ?? null;
}

app.post("/v1/usage", async (req, res) => {
  await loadState();
  const { userId, userName, date, apps } = req.body || {};
  if (!userId || !date || !Array.isArray(apps)) {
    return res.status(400).json({ error: "userId, date, apps[] required" });
  }

  state.users[userId] = userName || userId;

  let totalDelta = 0;
  for (const entry of apps) {
    const appName = entry.packageName;
    const minutes = Number(entry.minutes || 0);
    const factor = Number(entry.factor || 1);
    if (!appName) continue;

    const previous = getPreviousUsage(userId, appName, date);
    const previousMinutes = previous ? previous.minutes : 0;
    const delta = previousMinutes - minutes;
    const appliedFactor = delta >= 0 ? factor : factor * 0.5;
    totalDelta += delta * appliedFactor;

    const existingIndex = state.appUsage.findIndex(
      (row) => row.userId === userId && row.date === date && row.app === appName
    );
    const record = {
      userId,
      date,
      app: appName,
      minutes,
      factor
    };
    if (existingIndex >= 0) {
      state.appUsage[existingIndex] = record;
    } else {
      state.appUsage.push(record);
    }
  }

  const previousTotal = getLatestPoints(userId);
  const newTotal = previousTotal + totalDelta;
  const pointsIndex = state.points.findIndex(
    (row) => row.userId === userId && row.date === date
  );
  const pointsRecord = {
    userId,
    date,
    delta: totalDelta,
    total: newTotal
  };
  if (pointsIndex >= 0) {
    state.points[pointsIndex] = pointsRecord;
  } else {
    state.points.push(pointsRecord);
  }

  await saveState();
  res.json({ userId, date, delta: totalDelta, total: newTotal });
});

app.get("/v1/points/:userId", async (req, res) => {
  await loadState();
  const userId = req.params.userId;
  const total = getLatestPoints(userId);
  res.json({ userId, points: total });
});

app.get("/v1/leaderboard", async (req, res) => {
  await loadState();
  const limit = Number(req.query.limit || 20);
  const latestByUser = {};
  for (const row of state.points) {
    const existing = latestByUser[row.userId];
    if (!existing || row.date > existing.date) {
      latestByUser[row.userId] = row;
    }
  }
  const entries = Object.values(latestByUser)
    .map((row) => ({
      userId: row.userId,
      userName: state.users[row.userId] || row.userId,
      points: row.total
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);

  res.json({
    updatedAt: new Date().toISOString(),
    entries
  });
});

app.get("/v1/discussion/:topic", async (req, res) => {
  await loadState();
  const topic = req.params.topic;
  const limit = Number(req.query.limit || 50);
  const messages = state.discussion.messages
    .filter((msg) => msg.topic === topic)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
  res.json({ topic, messages });
});

const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  socket.on("join_topic", (topic) => {
    if (typeof topic === "string" && topic.length > 0) {
      socket.join(topic);
    }
  });

  socket.on("leave_topic", (topic) => {
    if (typeof topic === "string" && topic.length > 0) {
      socket.leave(topic);
    }
  });

  socket.on("new message", async (data) => {
    const topic = data?.topic;
    const text = data?.text;
    const sender = data?.sender || "Anonymous";
    if (typeof topic !== "string" || typeof text !== "string" || !text.trim()) {
      return;
    }

    await loadState();
    const message = {
      topic,
      text,
      sender,
      timestamp: Date.now()
    };
    state.discussion.messages.push(message);
    await saveState();

    io.to(topic).emit("new message", {
      topic,
      text,
      sender,
      timestamp: message.timestamp
    });
  });
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Leaderboard API listening on ${port}`);
});
