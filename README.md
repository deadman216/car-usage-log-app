[README.md](https://github.com/user-attachments/files/33999752/README.md)
# car-usage-log-app# Sanaya Vehicle Use Register

A vehicle log with an Electron desktop app and a browser-based, multi-device web app. Both use the same Express API and JSON data store.

## Desktop app (Windows)

From the project root:

```powershell
npm install
npm start
```

Electron starts the local API on `127.0.0.1:3000` before opening the app. Data is stored in Electron's user-data directory and remains available after app updates. If port 3000 is already in use, close the other process and restart the app.

The first run creates the default administrator account: **admin / admin123**. Change the password after signing in before using the app with real data.

Build the installer and portable app with:

```powershell
npm run build
npm run build:dir
```

## Browser and multi-device server

For a browser on the same computer, run the server from the project root:

```powershell
cd server
npm install
npm start
```

Open `http://localhost:3000/login.html`. For other devices on the same network, open `http://<host-computer-LAN-address>:3000/login.html`. The server must be running and reachable from those devices. Configure the host firewall to allow port 3000 on the trusted network.

The server creates `server/data/sanaya.json` on first run. Back up this file regularly. Browser/PWA installs use the server for login and trip data, so a static-only deployment is not sufficient; deploy the server and web files together.

## Features

- User registration and sign-in, with administrator and standard-user roles.
- Trip logging with date/time ranges, vehicle details, and optional purpose.
- Admin reports, trip deletion, dashboard filters, charts, and CSV export.
- WebSocket presence updates in the admin panel.
- Installable browser shell; the server is required for authenticated data access.

## Project layout

```text
.
├── electron-main.js
├── preload.js
├── package.json
├── server/
│   ├── server.js
│   └── data/                 # Browser/server deployment data
└── car-log-app/
    ├── login.html
    ├── index.html
    ├── dashboard.html
    ├── admin.html
    ├── auth.js
    ├── app.js
    └── dashboard.js
```
