# AttenSync Leaderboard Backend (Node 24)

Express + JSON file storage leaderboard API (no native addons).

## Requirements

- Node.js 24.x

## Endpoints

- `POST /v1/usage`
- `GET /v1/points/:userId`
- `GET /v1/leaderboard?limit=20`
- `GET /v1/discussion/:topic?limit=50`

### POST /v1/usage

```json
{
  "userId": "user_123",
  "userName": "Aman",
  "date": "2026-02-28",
  "apps": [
    { "packageName": "com.instagram.android", "minutes": 120, "factor": 1 },
    { "packageName": "com.youtube.android", "minutes": 60, "factor": 1 }
  ]
}
```

Points are computed per app as `(previous - current) * factor`.
If negative, the factor is halved: `factor * 0.5`.

## Discussion (Socket.IO)

Socket events:

- `join_topic` → payload: `"Computer Science"`
- `leave_topic` → payload: `"Computer Science"`
- `new message` → payload: `{ "topic": "Computer Science", "sender": "You", "text": "Hello" }`

Messages are persisted in `data/leaderboard.json` under `discussion.messages`.

## Run

```bash
npm install
npm start
```

## Seed data

```bash
node scripts/seed.js
```

Data is stored in `backend/data/leaderboard.json`.
