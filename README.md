# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# 🛡️ SENTINEL — Security Operations Center Dashboard

Real-time SOC Dashboard powered by Wazuh SIEM. Built for Blue Team hands-on learning and practical threat visualization.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Wazuh 4.7.5 running on VMware (accessible via network)
- npm

### Frontend Setup
```bash
cd sentinel-soc
npm install
npm run dev
# → http://localhost:5173
```

### Backend Setup
```bash
cd sentinel-soc/backend
npm install
cp .env.example .env
# Edit .env with your Wazuh VM IPs and credentials
node server.js
# → http://localhost:3001
```

---

## ⚙️ Wazuh Configuration

### Point to your Wazuh VM
Edit `backend/.env`:
```env
WAZUH_HOST=https://192.168.X.X     # Your VMware VM IP
INDEXER_HOST=https://192.168.X.X   # Usually same as WAZUH_HOST
INDEXER_USER=admin
INDEXER_PASS=<your-wazuh-admin-pass>
```

### Allow API access from your host
On your Wazuh VM, the Manager API runs on port **55000** and Indexer on **9200**.
Make sure your VMware network adapter is set to **Bridged** or **Host-Only** so your host can reach the VM.

### Enable GeoIP enrichment in Wazuh
Add to `/var/ossec/etc/ossec.conf`:
```xml
<ossec_config>
  <geoipdb>
    <mmdb_database>/etc/maxmind/GeoLite2-City.mmdb</mmdb_database>
  </geoipdb>
</ossec_config>
```

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt (12 rounds) |
| Auth tokens | JWT (HS256, 8h expiry) |
| Rate limiting | 10 auth attempts / 15 min |
| Account lockout | 5 fails → 15 min lockout |
| Timing attack prevention | `crypto.timingSafeEqual` |
| Input validation | express-validator |
| Security headers | Helmet.js |

---

## 📁 Project Structure

```
sentinel-soc/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── styles/global.css
│   └── components/
│       ├── LoginPage.jsx / .css      ← Animated SVG login
│       ├── Dashboard.jsx / .css      ← Main layout
│       ├── Topbar.jsx / .css         ← HUD metrics bar
│       ├── Sidebar.jsx / .css        ← Navigation
│       ├── MetricsHUD.jsx / .css     ← Stats cards
│       ├── ThreatMap.jsx / .css      ← Leaflet attack map
│       ├── AlertsFeed.jsx / .css     ← Real-time alert list
│       ├── MitrePanel.jsx / .css     ← MITRE ATT&CK matrix
│       └── AgentsPanel.jsx / .css    ← Agent monitoring
├── index.html
├── vite.config.js
├── package.json
└── backend/
    ├── server.js                     ← Express + Wazuh integration
    ├── package.json
    └── .env.example
```

---

## 🎨 Tech Stack

- **React 18** + Vite
- **Leaflet.js** — Interactive threat map with attack arcs
- **Express** + Helmet + JWT + bcrypt
- **Wazuh 4.7.5** — SIEM data source
- **OpenSearch/ES** — Wazuh Indexer query
- **MITRE ATT&CK** — Tactic mapping
- **CSS custom properties** — Full dark cyber design system

---

## 🔌 Connecting Real Wazuh Data

The frontend currently uses mock data generators. To connect live Wazuh data:

1. Start the backend (`cd backend && node server.js`)
2. Update `Dashboard.jsx` — replace mock `generateMockAlerts()` with API calls:

```js
// Replace mock call with:
const res = await fetch('/api/alerts?limit=50', {
  headers: { Authorization: `Bearer ${localStorage.getItem('sentinel_token')}` }
});
const { alerts } = await res.json();
```

3. The login form (`LoginPage.jsx`) already has the commented API call template ready.

---

*Built for hands-on Blue Team learning. Use responsibly.*