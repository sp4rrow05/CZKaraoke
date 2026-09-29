# 🎤 Karaoke Rooms

This is a karaoke web app built around password-protected rooms. One device (a TV or laptop) is the **host screen** and plays YouTube videos. Everyone else joins from their phone to search songs, reserve them and control playback.

## Setup

1. Get a YouTube Data API v3 key:
   1. In the Google Cloud Console, create a project.
   2. Enable **YouTube Data API v3**.
   3. Go to **Credentials** and create an API key.
2. Copy `.env.example` to `.env` and set `YOUTUBE_API_KEY`.
3. Install and run:

   ```sh
   npm install
   npm run dev
   ```

This starts the API and Socket.IO server on http://localhost:3001 and the web app on http://localhost:5173.

To let phones join, open the app with your computer's LAN address (for example `http://192.168.1.20:5173`), not `localhost`. That address is also what the QR code on the host screen links to.

## How it works

1. **Create a room** with your name and a password. You get a 6-character room code and become the host.
2. The host clicks **📺 Open host screen** on the TV or laptop, then clicks once to allow sound.
3. Guests join with the room code and password, or by scanning the QR code on the host screen.
4. Anyone can **search** YouTube (karaoke versions by default) and **reserve** songs. The first reserved song starts right away, and the next one plays automatically when a song ends.
5. **Move the screen:** in the **People** panel, the host can press **Make screen** next to anyone who is online. That person gets an **📺 Open screen** button, and the old screen stops playing. Being the screen doesn't give extra control.
6. **Play, pause, stop and next** are allowed for the host and for the person who reserved the current song. Guests can remove their own reserved songs. The host can remove or reorder any song.

## Production

```sh
npm run build   # builds client/dist
npm start       # serves the API and the built client on PORT (default 3001)
```

Rooms are kept in memory. They are lost when the server restarts, and a room is closed after 6 hours with no activity.

## Deploying (pages on Vercel, server on Render)

Vercel only runs short-lived functions, so it can't host the Socket.IO server. The pages go on Vercel and the server goes on Render.

1. **Server on Render:** choose **New → Blueprint**, pick this repo, and Render reads `render.yaml`. When asked, fill in:
   - `YOUTUBE_API_KEY`: your key.
   - `CLIENT_ORIGIN`: your Vercel URL, for example `https://czkaraoke.vercel.app`. Separate several URLs with commas. `*` works as a wildcard for preview deployments, as in `https://czkaraoke-*.vercel.app`.

   Check `https://<your-service>.onrender.com/api/health`. It should return `{"ok":true}`.
2. **Pages on Vercel:** import the repo with **Root Directory** set to `client`. Under **Environment Variables**, add `VITE_SERVER_URL` set to your Render URL, for example `https://czkaraoke-server.onrender.com`. Then redeploy, because Vite bakes this setting into the build.

On the free Render plan the server sleeps after 15 minutes idle. The first visit afterwards takes about 30 seconds while it wakes up, and sleeping also clears all rooms.

Running only `npm start` on one host still works too: when `VITE_SERVER_URL` is empty, the pages use the same site as the server.

## Tests

```sh
npm test
```

## Notes

- Each search costs about 100 units of YouTube API quota, and the free daily limit is 10,000 units, so about 100 searches a day. Results are cached for an hour.
- Some videos don't allow embedding. When one fails to play, the host screen skips it automatically.
