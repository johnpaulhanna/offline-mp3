# Offline MP3 Player

A free, ad-free MP3 player for iPhone. Import your own music from your Files app and listen offline — no account, no subscription, no internet needed after setup.

---

## How to install on your iPhone

> You only need to do this once. It takes about a minute.

**Step 1 — Open the app in Safari**

On your iPhone, open **Safari** and go to:

**[offline-mp3.vercel.app](https://offline-mp3.vercel.app)**

> It must be Safari — Chrome and other browsers on iPhone don't support installing web apps to your home screen.

**Step 2 — Add it to your Home Screen**

1. Tap the **Share** button at the bottom of Safari (the square with an arrow pointing up).
2. Scroll down in the menu that appears and tap **Add to Home Screen**.
3. You can rename it (e.g. "Music") or leave it as-is — then tap **Add** in the top right.

The app icon will appear on your Home Screen just like any other app.

**Step 3 — Open it from your Home Screen**

Tap the icon you just added. The app will open full-screen.

> The very first time you open it, your phone needs to be online so the app can finish installing. After that it works completely offline.

---

## How to add your music

1. Open the app and tap **Add Music** at the top.
2. Your Files app will open — navigate to where your MP3s are saved (iCloud Drive, On My iPhone, etc.).
3. Tap a file to import it, or tap **Select** in the top right to pick multiple files at once.
4. Your songs will appear in the library immediately.

> The app reads the song title, artist, album, and cover art automatically from the file. If a file has no tags, the filename is used as the title.

---

## How to use the player

**Playing music**
- Tap any song to start playing it.
- The mini player appears at the bottom — tap it to open the full Now Playing screen.
- Swipe the Now Playing screen down to go back to your library.

**Scrubbing through a song**
- In the Now Playing screen, drag the white bar left or right to jump to any part of the song.

**Shuffle and repeat**
- The shuffle and repeat buttons are in the Now Playing screen.
- Shuffle stays on even if you close the app and come back later.

**Lock screen controls**
- Once a song is playing, controls appear on your lock screen and in Control Center — just like a normal music app.

**Playlists**
- Tap the **Playlists** tab at the bottom.
- Tap **+** to create a new playlist.
- To add a song to a playlist: go to the Songs tab, **hold down** on any song until a menu appears, then tap **Add to Playlist**.
- Tap a playlist to open it. Tap the cover image to set a custom photo for that playlist.

**Deleting a song**
- **Hold down** on any song until a menu appears, then tap **Delete from Library**.

---

## Features

- Import MP3s — title, artist, album, and cover art read automatically
- Library sorted by title, artist, or album, with search
- Playlists with custom cover images
- Shuffle (remembers your setting) and repeat (off / all / one)
- Lock screen and Control Center controls
- Works fully offline after the first load
- Everything stored on your device — no accounts, no cloud, no ads

---

## For developers

```bash
npm install
npm run dev
# open http://localhost:5173
```

**Deploy to Vercel**

1. Push this repo to GitHub.
2. Go to vercel.com → **Add New Project** → import the repo.
3. Vercel detects Vite automatically. Build command: `npm run build`, output directory: `dist`.
4. Click **Deploy**.
