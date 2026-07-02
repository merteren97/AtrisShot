# AtrisShot

AtrisShot is a Tauri + Next.js desktop application for authenticated Atris users to capture, edit, preview, copy, and reuse screenshots locally.

The app follows the existing Atris desktop product split:

- Desktop runtime for capture, settings, history, overlay, editor, auth session, and updater.
- Public service for landing pages, release downloads, and update metadata.
- AtrisHub for account login and access verification.

## Product Scope

- Free, Premium, and Admin Atris accounts can access the app.
- Screenshots, annotations, history, and saved paths stay on the local device.
- Users can copy the image, copy the saved path, or show a draggable corner result overlay after capture.
- The editor foundation supports simple annotations such as pen, rectangle, arrow, highlight, and text.
- GitHub Actions release artifacts feed the public release proxy and Tauri updater.

## Development

```powershell
npm.cmd install --cache .npm-cache
npm.cmd run dev:local
npm.cmd run typecheck
npm.cmd run test:runtime-boundary
npm.cmd run build
npm.cmd run build:landing
npm.cmd run build:public
npm.cmd run tauri:dev
npm.cmd run brand:generate
```

`npm.cmd run dev:local` starts the public service on `127.0.0.1:3008` and the Tauri desktop together. AtrisHub must run separately on `127.0.0.1:3000`.

The desktop development server uses port `3009`, the landing development server uses `3010`, and the production public-service contract remains port `3008`.
