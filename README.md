# TrailBuilt

Mobile-friendly web app for georeferencing trail screenshots onto a live map with GPS.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). On a phone, use your computer’s LAN address over HTTPS or `localhost` tunnels—browsers require a secure context for precise geolocation outside localhost.

## Deploy on Railway

Railway builds with Nixpacks (`npm run build`) and serves the static site with `serve`.

1. Deploy from the GitHub repo (`lancekalbach/TRAILBUILT`).
2. In the service **Settings → Networking**, click **Generate Domain**.
3. No environment variables are required — trails and markers stay in the browser (IndexedDB).

GPS needs HTTPS; Railway’s public domain provides that.

## How to use

1. Export a trail as **GPX** from Trailforks or Strava.
2. In TrailBuilt, tap **Import GPX** and choose the file — the trail line appears on the map automatically.
3. Use **Zoom to** / pan / zoom, and **⌖** for live GPS.
4. Optional: **Screenshot** still works for paper maps (drag to place).
5. Trails are stored in this browser (IndexedDB).

# TRAILBUILT
