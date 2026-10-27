# Sanaya Vehicle Use Register — browser app

This folder contains the browser UI. Login, trips, admin tools, and the dashboard require the Express API server; hosting these files as a static site alone will not provide working authentication or data storage.

## Run locally

From the project root:

```powershell
cd server
npm install
npm start
```

Open `http://localhost:3000/login.html`. The server serves this folder and stores browser/server deployment data in `server/data/sanaya.json`.

For use from other devices on the same trusted network, run the server on the host computer and open `http://<host-computer-LAN-address>:3000/login.html` from each device. Keep the server running and allow port 3000 through the host firewall as appropriate.

The first run creates the default administrator account **admin / admin123**. Change that password before storing real information.

## Features

- `login.html` — sign-in and account registration.
- `index.html` — trip log and weekly/monthly reports.
- `dashboard.html` — filters, charts, table, and CSV export.
- `admin.html` — user, connection, and trip statistics.
- `service-worker.js` — caches the browser app shell; API access still requires the server.
