# Surplus-to-Shelter — Live Demo Script & Walkthrough

This script guides the 3-minute live demonstration for hackathon judges, demonstrating all key SRS requirements and architectural highlights.

---

## 👥 Demo Personas & Credentials

| Role | Organization / Name | Demo Email | Password |
|---|---|---|---|
| **Public** | General Audience / Judges | [http://localhost:5173/impact](http://localhost:5173/impact) | *No Login Required* |
| **Donor** | The Connaught Grand Bistro | `grand_bistro@demo.com` | `demo1234` |
| **Recipient 1** | Pahar Ganj Community Kitchen (Closer) | `paharganj_kitchen@demo.com` | `demo1234` |
| **Recipient 2** | Karol Bagh Relief Shelter (Backup) | `karolbagh_shelter@demo.com` | `demo1234` |
| **Driver** | Amit Kumar (Volunteer Driver) | `amit_driver@demo.com` | `demo1234` |

---

## 🎬 3-Minute Walkthrough Flow

### 0:00 – 0:30 | The Problem & The Public Impact Dashboard
- **Screen:** Open [http://localhost:5173/impact](http://localhost:5173/impact)
- **Talking Points:**
  - *"In urban centers like Delhi, surplus prepared food is wasted simply because shelters don't know it's available in time. Surplus-to-Shelter is a real-time routing engine connecting donors to shelters in under 60 seconds."*
  - Show the live numbers: Meals Rescued, Food Diverted (kg), and CO₂e emissions diverted (EPA WARM formula: 2.5×).

### 0:30 – 1:00 | Donor Intake (< 60 Seconds Interaction)
- **Screen:** Sign in as Donor (`grand_bistro@demo.com`)
- **Actions:**
  - Food Description: `35 kg Fresh Dal Makhani, Biryani & Breads`
  - Food Type: `Prepared Meals`
  - Quantity & Unit: `35 kg`
  - Address: `Connaught Place Inner Circle, Delhi`
  - Available Until: Select 4 hours from now
  - Click **"Post Donation"**
- **Talking Points:**
  - *"Notice the intake form is strictly single-page with no unnecessary fields (NFR-2). Address is geocoded to PostGIS coordinates on submission."*
  - *"Expiry window is strictly validated to prevent offering expired food."*

### 1:00 – 1:45 | Real-Time Matching & The Cascade Moment
- **Screen 1 (Split or Tab 1):** Sign in as Shelter 1 (`paharganj_kitchen@demo.com`)
- **Actions:**
  - Notice the offer arrives in real time via Socket.io without refreshing!
  - Distance: ~0.85 km away.
  - Click **"Decline"**
- **Screen 2 (Split or Tab 2):** Sign in as Shelter 2 (`karolbagh_shelter@demo.com`)
- **Actions:**
  - Watch the offer instantly cascade to Shelter 2 in real time without restarting the server (FR-3.4)!
  - Click **"Accept"**
- **Talking Points:**
  - *"The matching engine ranks shelters using the exact formula: 50% proximity, 30% capacity fit, 20% urgency."*
  - *"When Shelter 1 declines, the engine instantly re-ranks and cascades to the next eligible shelter."*

### 1:45 – 2:30 | Driver Dispatch & State Machine Progression
- **Screen:** Sign in as Driver (`amit_driver@demo.com`)
- **Actions:**
  - Driver automatically receives the dispatched rescue order.
  - Shows Step 1 (Pickup at Connaught Bistro) and Step 2 (Dropoff at Karol Bagh).
  - Click **"Confirm Food Picked Up"** → Status becomes `picked_up`
  - Click **"Confirm Delivered to Shelter"** → Status becomes `delivered`
- **Talking Points:**
  - *"Driver dispatch finds the nearest available driver with PostGIS straight-line distance."*
  - *"The state machine strictly enforces the sequence: `matched → picked_up → delivered` (no skipping)."*

### 2:30 – 3:00 | Impact Verification
- **Screen:** Return to [http://localhost:5173/impact](http://localhost:5173/impact)
- **Talking Points:**
  - *"The delivery immediately incremented the total meals counter (+64 meals) and CO₂e emissions prevented (+87.5 kg)."*
  - *"All status transitions emit WebSocket events, updating donor, shelter, driver, and public dashboards in real-time."*

---

## 🤖 Automated Demo Rehearsal Command

To execute the entire sequence automatically in 15 seconds to verify end-to-end functionality:
```bash
node backend/scripts/demo_scenario.js
```
