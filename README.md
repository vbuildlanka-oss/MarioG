# 🍄 MarioG - Super Platformer

A fun Mario-style side-scrolling platformer game packaged as a desktop application. Jump on enemies, collect coins, hit question blocks, and reach the flag!

**Built by VBUILD(TM) Lanka**

---

## 🎮 Download & Play

### Windows
1. Go to the [**Actions tab**](../../actions) on this repository
2. Click the latest successful **"Build MarioG Desktop"** workflow run
3. Download the **`MarioG-Windows-Setup`** artifact
4. Extract and run `MarioG Setup 1.0.0.exe`
5. Follow the installer — a desktop shortcut will be created!

### Linux
Download the **`MarioG-Linux-AppImage`** artifact from the same Actions page.

### Release Builds
When a version tag is pushed (e.g., `v1.0.0`), the exe/AppImage are automatically attached to a GitHub Release.

---

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `←` / `A` | Move left |
| `→` / `D` | Move right |
| `Space` / `↑` / `W` | Jump |

**Tips:**
- Stomp enemies from above to defeat them
- Hit `?` blocks from below to get coins
- Collect floating coins for bonus points
- Reach the 🏁 flag to advance to the next level
- Beat all 3 levels to win!

---

## 🏗️ Development

### Prerequisites
- Node.js 18+

### Run locally (Electron dev mode)
```bash
npm install
npm start
```

### Build Windows EXE locally (requires Windows or Wine)
```bash
npm run dist:win
```

### Build for current platform
```bash
npm run dist
```

### Build output
Built installers go to the `dist/` directory.

---

## 📁 Project Structure

```
MarioG/
├── main.js              # Electron main process
├── renderer/            # Desktop game UI (standalone)
│   ├── index.html       # Game page
│   ├── game.js          # Game engine (Canvas platformer)
│   ├── app.js           # Desktop app logic (local scores)
│   └── style.css        # Styles
├── assets/
│   ├── icon.png         # App icon (256x256)
│   └── icon.svg         # Icon source
├── public/              # Original web version (server-based)
├── server.js            # Express server (web version only)
├── db.js                # SQLite DB (web version only)
├── .github/workflows/
│   └── build.yml        # CI: builds Windows exe + Linux AppImage
└── package.json         # Electron + electron-builder config
```

---

## ⚙️ CI/CD

The GitHub Actions workflow (`.github/workflows/build.yml`) automatically:
- Builds a **Windows NSIS installer** (`.exe`) on every push to `main`
- Builds a **Linux AppImage** on every push to `main`
- Uploads both as downloadable artifacts
- On version tags (`v*`), attaches them to a GitHub Release

---

## 📜 License

MIT — VBUILD(TM) Lanka
