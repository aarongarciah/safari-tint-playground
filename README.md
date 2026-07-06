# Safari Tint Playground

Playground for testing browser chrome tinting, safe area insets, fixed headers/footers, and overlay behavior across Safari and other browsers.

## Local Development

For normal UI work without Cloudflare sync:

```sh
npm run dev
```

This starts Vite only. The app works, but local sync will not connect because `/api/sync/:roomId` is served by the Cloudflare Worker.

For local cross-browser sync testing:

```sh
npm run preview:worker
```

Then open the Wrangler URL, usually `http://localhost:8787/`. This builds the app and runs `wrangler dev`, serving both the static Vite build and the local Durable Object/WebSocket backend.

Open the same URL in another browser or tab to test live state sharing.

The app automatically creates a room ID if the URL does not already have one. URLs use a single query parameter:

```text
?id=<room-id>
```

The room state is stored in the local Cloudflare Durable Object.
