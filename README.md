# Amo's Board

A dark, glassy, macOS/iOS-inspired board for drawing, text and images, built with Next.js for Vercel and a Scriptable iOS widget preview.

## Features

- Minimal dark-mode glass UI
- Expandable rounded board
- Text tool
- Pen tool with thickness, color and opacity
- Eraser mask
- Undo / redo
- Reset
- Image uploads from the gallery
- Image URL support
- Select, move, resize and rotate text/images
- Server-synced board state for the iOS widget
- PNG preview endpoint for Scriptable widgets

## Project structure

```txt
app/
  api/board/route.ts       JSON API for reading/writing the board
  api/preview/route.ts     PNG render API for Scriptable
  globals.css              Dark glass UI styles
  layout.tsx
  page.tsx
components/
  BoardApp.tsx             Main editor
lib/
  board.ts                 Board types and sanitization
  paths.ts                 SVG path helper
  render.ts                SVG renderer for PNG previews
  storage.ts               Upstash Redis / local fallback storage
scriptable/
  amos-board-widget.js     Scriptable iOS widget script
```

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Redis environment variables, the app uses an in-memory fallback for local development. That fallback resets when the dev server restarts.

## Vercel setup

1. Push this folder to GitHub.
2. Import the GitHub repository into Vercel.
3. Add an Upstash Redis database from the Vercel Marketplace or add these environment variables manually:

```env
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

The app also supports Upstash's standard variable names:

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional security:

```env
BOARD_WRITE_TOKEN=choose-a-private-token
BOARD_KEY=amos-board:state
```

If you set `BOARD_WRITE_TOKEN`, open the web app, paste the same token into the “Optional write token” field and save it locally. Do not expose that token in GitHub.

## Scriptable iOS widget setup

1. Open `scriptable/amos-board-widget.js`.
2. Replace `https://YOUR-VERCEL-APP.vercel.app` with your deployed Vercel URL.
3. Copy the script into Scriptable on iOS.
4. Add a medium or large Scriptable widget to your Home Screen and select this script.
5. Optional: instead of editing the script, set the widget parameter to your Vercel URL.

The widget loads:

```txt
https://YOUR-VERCEL-APP.vercel.app/api/preview?w=1092&h=510
```

The large widget uses a taller preview size automatically.

## Useful commands

```bash
git clone https://github.com/Amoo71/Board.git
cd Board
npm install
npm run dev
```

Then connect the repository in Vercel.