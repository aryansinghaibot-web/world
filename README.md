# Autonomous AI Human Simulation & Admin Control Panel

A production-grade, secure, and responsive **Admin Control Panel** for the **Autonomous AI Human World Simulation**. This system provides deep administrative observability and control over autonomous AI agents, their runtime activity and administrative statuses, self-defined belief profiles, rule-based virtual reward systems, simulation tick loop, and security audit logs.

---

## 🏛️ System Architecture

- **Backend**: Node.js & Express with security middleware, CSRF double-submit token enforcement, PBKDF2 password hashing, and server-side authorization.
- **Database**: Persistent SQLite (`node:sqlite` DatabaseSync) utilizing ACID transactions with WAL mode.
- **Simulation Engine**: Continuous autonomous tick loop managing agent needs (energy, hunger, happiness, social), sleep cycles, locations, conversational peer dialogues, and rule evaluations.
- **AI Intelligence**: Server-side Google Gemini integration with an autonomous heuristic fallback engine (Gemini API keys are strictly isolated on the backend and never exposed to the frontend).
- **Frontend**: Responsive Single-Page Application (SPA) with a luxury obsidian dark theme, interactive HTML5 2D simulation town canvas, persistent sidebar, live metric cards, modal dialogs, and toast notifications.

---

## 🔒 Security & Administrator Authentication

1. **No Public Default Passwords**: The system does not ship with hardcoded administrator credentials.
2. **Secure Password Hashing**: Passwords are hashed using NIST-compliant **PBKDF2** with cryptographically secure random 32-byte salts (100,000 iterations, SHA-512) and verified using constant-time buffer comparison (`crypto.timingSafeEqual`).
3. **Session Management & CSRF**:
   - Secure HTTP-only cookies (`sim_admin_token`) or `Authorization: Bearer <token>` headers.
   - CSRF protection: All state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an `x-csrf-token` header matched to the active server session.
4. **Secret Isolation**:
   - `GEMINI_API_KEY` is loaded server-side only from `.env`. Neither client bundles nor public endpoints ever return the key.
5. **Sanitized Audit Trail**: Every administrative and security action (logins, pauses, deactivations, belief changes, reward grants, reversals, setting edits) is logged to `audit_logs` with passwords and tokens strictly redacted.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env`:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key-change-in-production
GEMINI_API_KEY=your_optional_gemini_api_key_here
```

### 3. Provision Initial Administrator Account
You can securely provision the initial admin user using the CLI tool:
```bash
# Non-interactive CLI command
node scripts/create-admin.js --username admin --password "StrongPassword123!"

# Or run interactively with secure prompts
npm run create-admin
```
*(Alternatively, on a clean database without any administrator, opening the web panel will launch the First-Time Setup Wizard).*

### 4. Start the Application
```bash
npm start
```
Open your browser to: **http://localhost:3000**

---

## 🧩 Control Panel Modules

### 1. Live Simulation World View (`/`)
- Interactive 2D town canvas displaying 7 virtual districts: **Town Square, Workplace (Tech Hub), Sunny Cafe, Central Park, Grand Library, Residential Complex, Wellness Clinic**.
- Animated agent avatars moving smoothly between locations.
- Real-time activity badges: Working (`💻`), Eating (`🥪`), Walking (`🚶`), Resting (`🧘`), Socializing (`💬`), Sleeping (`💤`).
- Administrative status rings: Normal (`Active`), Amber (`Paused`), Red (`Deactivated`).
- Click any agent on the canvas to immediately inspect their profile.
- World controls: Manual Single Step Tick (`⚡ Step Tick`), Pause/Resume Engine.

### 2. Executive Overview
- Real-time dashboard KPI metrics: Total Registered, Active, Paused, Deactivated, and Sleeping agents.
- **Activity vs. Status distinction**: Sleeping agents are active in the simulation while paused or deactivated agents are segregated.
- Breakdown of runtime activities and belief distributions.
- Virtual rewards ledger metrics: Total Points Issued, Total Points Reversed, and Net Merit Points.
- Live stream of recent simulation events and administrative audit activities.

### 3. Human Management
- Comprehensive searchable, sortable, filterable agent directory.
- Filters: Search by name/occupation/goal/ID, Administrative Status, Activity, Location, Belief Profile.
- Visual need meters: Energy, Hunger (satiation), Happiness, Social connection.
- Administrative controls:
  - **Inspect Profile**: Open detailed profile with needs, goals, memories (public/private), relationships, peer dialogues, and last decision rationale.
  - **Pause / Resume**: Freeze agent needs decay and movement.
  - **Deactivate / Reactivate**: Fully archive or restore an agent (confirmation dialog required).
  - **Adjust Attributes**: Tweak energy, hunger, balance, or goals in real time.

### 4. Belief Profile Management
- Fictional agent attributes:
  - `Trusts in God`
  - `Does not trust in God`
  - `Unsure or undecided`
  - `Belief not specified`
- Stored in a separate table (`agent_belief_profiles`) distinct from core personality, runtime status, and memories.
- Autonomous development: Agents develop or update their profile through simulated philosophical events or explicit simulation choices.
- Declared source tracking and timestamp inspection.
- Administrative experimentation override modal with audit logging.

### 5. Configurable Reward Engine & Reward Center
- Rule-based virtual point engine supporting `Merit Tokens`, `Civic Points`, `Community Karma`, and `Gold Solis`.
- **Eligibility Condition Builder**: Configure required activities, locations, energy thresholds, and trigger events.
- **Optional Belief Condition (Controlled Experiments)**:
  - Displays explicit warning banner that characters are being treated differently based on belief.
  - Default reward rules are based purely on actions and achievements.
- **Live Affected Agent Preview**: Dynamically preview which agents match a proposed rule before saving.
- Minimum and maximum safety caps per rule.
- **Duplicate Prevention**: Automated cooldown checks prevent duplicate rewards.
- **Manual Grants**: Admin can grant points with a required reason.
- **Audited Reversals**: Points are never silently deleted. Rollbacks generate an explicit offsetting negative record with a mandatory explanation.

### 6. Simulation Settings
- Virtual world tick speed slider (1000ms - 10000ms).
- Weather selector (`Sunny`, `Pleasant Breeze`, `Light Rain`, `Overcast`).
- Server-side Google Gemini decision toggle and API key status indicator.
- Manual single-tick trigger button.

### 7. Security & Audit Logs
- Searchable and filterable audit trail table.
- Tracks: Admin logins, agent lifecycle changes, belief changes, reward rules, manual/auto grants, reversals, and simulation settings.
- Sanitized: Passwords and API keys are strictly redacted.

---

## 🧪 Testing

Run the automated test suite covering all 10 specifications:
```bash
npm test
```

### Verified Test Cases:
1. `Admin authentication and unauthorized access denial (401/403)`
2. `Secure admin provisioning and credential validation`
3. `Distinction between runtime activity and administrative status (sleeping vs paused vs deactivated)`
4. `Agent pause / resume lifecycle`
5. `Agent deactivate / reactivate lifecycle with confirmation`
6. `Belief profile creation, editing, and declared source tracking`
7. `Reward rule validation and limit enforcement`
8. `Manual reward grants and balance updates`
9. `Duplicate reward prevention within cooldown window`
10. `Atomic database transactions and audited reversals`
11. `Audit trail logging and sensitive data sanitization`
12. `Database persistence across server restarts`
13. `Gemini API key isolation from client frontend and network responses`
