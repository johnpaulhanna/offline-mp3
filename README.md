# Offline MP3 Player

A strictly offline, ad-free MP3 player PWA for iPhones. Import your own MP3 files from the Files app. Everything lives on your device — no accounts, no cloud, no ads.

## Dev

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to vercel.com → **Add New Project** → import your repo.
3. Vercel auto-detects Vite. Build command: `npm run build`, output: `dist`.
4. Click **Deploy**.

## Add to Home Screen on iPhone

1. Open the deployed URL in **Safari** (not Chrome — PWA install only works in Safari on iOS).
2. The **first load must be online** so the service worker installs.
3. Tap the **Share** button (box with arrow pointing up).
4. Scroll down and tap **Add to Home Screen**.
5. Name it "Music" and tap **Add**.
6. Launch from your home screen — it runs fully offline from here.

## How to use

- Tap **Add Music** → pick MP3 files from the Files app.
- Tap any track to start playing.
- Tap the track row in the mini player to open Now Playing.
- Tap × on a track to delete it.
- Lock screen controls work once a track is playing.

## Features

- Import MP3s with automatic ID3 tag parsing (title, artist, album, cover art)
- Library sorted by title / artist / album
- Play, pause, seek, next, previous
- Shuffle and repeat (none / all / one)
- Lock screen + Control Center controls via Media Session API
- Fully offline after first load — service worker caches the app shell
- All data in IndexedDB — persists across app restarts
- No network requests at runtime
