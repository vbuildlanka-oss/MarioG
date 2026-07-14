# 🍄 MarioG

A simple **Mario-style platformer** you can play in your browser. Log in, run and
jump through 3 levels, stomp goombas, grab coins, reach the flag — and your high
scores are saved to a persistent leaderboard.

Built with **100% free, open-source tools**. No paid services, no API keys, and
**zero local setup** beyond Node.js.

## Tech stack (all free)

| Part | Tech |
|------|------|
| Game | HTML5 Canvas + vanilla JavaScript |
| Server | Node.js + [Express](https://expressjs.com/) |
| Auth | [bcryptjs](https://www.npmjs.com/package/bcryptjs) password hashing + [JWT](https://www.npmjs.com/package/jsonwebtoken) session cookies |
| Storage | A local JSON file (`data/mario.json`) — no database server to install, no native modules to compile |

## Run it

Requires only **Node.js 18+**.

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

That's it — no database to configure, no environment variables required. The data
file is created automatically on first run.

> Optional: set `PORT` to change the port and `JWT_SECRET` to keep sessions valid
> across restarts. Both are optional.

## Play online for free (optional)

MarioG runs as a normal, always-on Node server, so any free host that runs a
long-lived Node process works. No code changes needed — the host just runs
`npm install` then `npm start`.

**Render (free tier) — easiest:**
1. Push this repo to GitHub (already done if you're reading this there).
2. Go to [render.com](https://render.com), create a **New Web Service**, and connect the repo.
3. Settings: **Build Command** `npm install`, **Start Command** `npm start`.
4. (Recommended) Add an environment variable `JWT_SECRET` set to any long random
   string, so login sessions stay valid across restarts.
5. Deploy — Render gives you a free public URL.

Other free "runs-a-normal-server" hosts that work the same way: **Railway**,
**Fly.io**, **Cyclic**, or any VPS.

> ⚠️ **Note on free tiers & saved scores:** This app saves scores to a local file
> (`data/mario.json`). On most free hosts the disk is *ephemeral* — it resets when
> the app redeploys or goes to sleep, so scores can be wiped on those events. That's
> fine for testing. To make scores survive permanently online you'd either attach a
> **persistent disk/volume** (Fly.io offers a free one; Render offers it as a paid
> add-on) or switch the storage layer to a free hosted database. Running **locally**,
> scores persist permanently with no extra setup.

## How to play

- **← / A** — move left
- **→ / D** — move right
- **Space / ↑ / W** — jump
- Stomp enemies from above, collect coins, hit `?` blocks, and reach the 🏁 flag.
- You have 3 lives. Clearing a level and finishing the game award bonus points.
- When the game ends, your score is saved automatically and the leaderboard updates.

## How it works

1. You register or log in. Passwords are hashed with bcrypt; a signed JWT is stored
   in an `httpOnly` cookie so your session is remembered.
2. You play the canvas game. Score, coins, and level are tracked live in the HUD.
3. On game over / win, the client posts your run to `POST /api/scores`.
4. The server keeps each player's best score and serves a global leaderboard.

## API overview

| Method & path | Description | Auth |
|---------------|-------------|------|
| `POST /api/register` | Create an account | — |
| `POST /api/login` | Log in | — |
| `POST /api/logout` | Clear session | — |
| `GET /api/me` | Current user + best score | cookie/JWT |
| `POST /api/scores` | Save a run `{score, coins, level}` | cookie/JWT |
| `GET /api/leaderboard` | Top scores across all players | — |

## License

MIT
