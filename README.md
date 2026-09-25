# 🍲 Surplus-to-Shelter (FoodRescue)

> **Real-time, hyper-local surplus food allocation, matching, and courier dispatch platform.** Connecting restaurants, catering services, and grocery establishments with verified shelters and community kitchens within critical freshness windows.

---

## 🚀 Key Features

### 1. 🍽️ Donor Portal (`/donor`)
- **Rapid Surplus Food Posting**: Post surplus food batches with quantity, food type (prepared meals, dairy, produce, bakery, dry goods), and safe consumption windows.
- **Good Samaritan Legal Safe Harbor**: Built-in compliance standards and temperature guidelines.
- **Real-Time Courier Handshake**: Digital batch tracking from kitchen loading dock to final shelter delivery.
- **Organization & Notification Settings**: Manage pickup addresses, contact info, and notification triggers.

### 2. 🏠 Shelter / Recipient Portal (`/recipient`)
- **Automated Spatial Matching Engine**: Matches available food within an 8.0 km radius using PostGIS geographic scoring.
- **Offer Decision Cascade**: 30-second accept/decline countdown with automatic failover to the next closest shelter.
- **Dynamic Capacity Management**: Real-time shelter intake load tracking (current vs. max capacity) with automatic dispatch pause when at 100% capacity to prevent food spoilage.
- **Live Logistics Ledger**: History of received donations, assigned couriers, and intake times.

### 3. 🚗 Driver / Courier Portal (`/driver`)
- **Fleet Overview Dashboard**: Key metrics on active missions, completed rescues, total weight transported, and operational radius.
- **Turn-by-Turn Mission Route**: Point-to-point routing from donor loading bay to shelter intake dock.
- **Safe Cold-Chain Checkpoints**: Temperature logging and digital signature handshakes on pickup and delivery.
- **Real-Time Dispatch Radar**: Instant notifications via Socket.io when assigned a new route.

### 4. 🌍 Public Impact Portal (`/impact`)
- **Environmental & Social Metrics**: Live counter of total meals rescued, kilograms diverted from landfills, and CO₂e emissions avoided.
- **Live Activity Feed**: Real-time stream of verified deliveries across regional urban corridors.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, TailwindCSS / Custom Design System, Lucide React, Socket.io-client.
- **Backend**: Node.js, Express, Socket.io, JSON Web Tokens (JWT), bcryptjs.
- **Database & Geospatial**: PostgreSQL with **PostGIS** extension (`ST_DWithin`, `ST_Distance`, `ST_MakePoint`).
- **Real-Time Communications**: WebSockets (Socket.io) for instantaneous offer alerts and route updates.

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL with PostGIS extension enabled
- npm or yarn

### 1. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=3000
DATABASE_URL=postgres://postgres:password@localhost:5432/foodrescue
JWT_SECRET=your_jwt_secret_key_here
MATCH_RADIUS_METERS=8000
OFFER_TIMEOUT_SECONDS=30
```

Run database schema and initial demo seed:
```bash
node scripts/run_schema.js
node scripts/seed.js
```

Start the backend server:
```bash
npm start
# or for development with auto-reload:
node server.js
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Demo Credentials

| Role | Email | Password | Portal Route |
| :--- | :--- | :--- | :--- |
| **Donor** | `grand_bistro@demo.com` | `password123` | `/donor` |
| **Shelter (Recipient)** | `paharganj_kitchen@demo.com` | `demo1234` | `/recipient` |
| **Driver (Courier)** | `driver_browser@test.com` | `demo1234` | `/driver` |

---

## 🔒 Security & Route Protection
- Role-based route guards (`ProtectedDonorRoute`, `ProtectedRecipientRoute`, `ProtectedDriverRoute`) ensure complete cross-role isolation.
- Passwords hashed with `bcryptjs`.
- JWT-authenticated REST and WebSocket channels.

---

## 📄 License
MIT License. Built with ❤️ for community food security.
