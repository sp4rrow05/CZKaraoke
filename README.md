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
5. **Play, pause, stop and next** are allowed for the host and for the person who reserved the current song. Guests can remove their own reserved songs. The host can remove or reorder any song.

## Production

```sh
npm run build   # builds client/dist
npm start       # serves the API and the built client on PORT (default 3001)
```

Rooms are kept in memory. They are lost when the server restarts, and a room is closed after 6 hours with no activity.

## Tests

```sh
npm test
```

## Notes

- Each search costs about 100 units of YouTube API quota, and the free daily limit is 10,000 units, so about 100 searches a day. Results are cached for an hour.
- Some videos don't allow embedding. When one fails to play, the host screen skips it automatically.
