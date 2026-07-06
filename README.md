# Safari Tint Playground

Playground for testing browser chrome tinting, safe area insets, fixed headers/footers, and overlay behavior across Safari and other browsers.

## Local Development

Run the Vite dev server:

```sh
npm run dev
```

The dev server listens on your local network by default, so you can also open it from another device using the `Network` URL Vite prints, for example:

```text
http://192.168.1.10:5173/?id=<room-id>
```

Copy the full URL, including `?id=...`, from the first device. Both devices must use the same room id to sync.

The Cloudflare Vite plugin runs the React app and the Worker runtime in the same dev server. Vite handles React/HMR, while the Worker handles `/api/sync/:roomId` and the local Durable Object backend.

Open the same URL in another browser or tab to test live state sharing.

The app automatically creates a room ID if the URL does not already have one. URLs use a single query parameter:

```text
?id=<room-id>
```

The room state is stored in the local Cloudflare Durable Object.
