# ⚽ Fanta Asta Manager (Fantasy Soccer Auction Software)

Desktop GUI software built with **Electron & Node.js** to manage fantasy soccer auctions (Aste Fantacalcio).

---

## 🚀 How to Launch the Software

### 1. Prerequisites

Ensure you have **Node.js** (v16 or higher) and **npm** installed on your machine.

- Download from [https://nodejs.org/](https://nodejs.org/)

### 2. Install Dependencies

Open a terminal / command prompt in this project folder (`/mnt/d/test123/fantaasta` or `D:\test123\fantaasta`) and run:

```bash
npm install
```

### 3. Launch the Application

To run the Electron application in desktop mode:

```bash
npm start
```

### 4. Build Dist

To run the Electron application in desktop mode:

```bash
npm install electron-builder
npm run dist:<win|linux>
```

---

## 📁 File Formats & Configuration

The application reads two main files (either loaded at startup or via the top navigation buttons):

### 1. YAML Configuration File (`config.example.yaml`)

Defines the auction participants (auctioners), initial credits budget, countdown timer duration, total squad size, and default language.

```yaml
auctioners:
  - num: 1
    name: "Mario"
  - num: 2
    name: "Luigi"
  - num: 3
    name: "Bowser"
  - num: 4
    name: "Peach"

countdown: "60 seconds"   # Duration of countdown timer per turn
credits: 330              # Initial budget per auctioner
total_players: 25         # Target squad size (used for Max-Expendable formula)
language: "it"            # Default interface language: 'it' or 'en'
```

### 2. CSV Players File (`players.example.csv`)

Contains the list of soccer players to buy (supports `;` or `,` delimiters):

```csv
NAME;ROLE;TEAM
Lautaro Martinez;A;Inter
Svilar;P;Roma
Maignan;P;Milan
Gabbia;D;Milan
Barella;C;Inter
Vlahovic;A;Juventus
Dybala;T;Roma
```

- **Roles supported:** `P` (Portiere/GK), `D` (Difensore/DEF), `C` (Centrocampista/MID), `T` (Trequartista/ATM).`A` (Attaccante/FWD).

---

## 🧮 Max-Expendable Formula

To prevent an auctioner from overspending and being unable to complete their full squad (each remaining player slot requires at least 1 credit), the max allowable bid is automatically calculated:

$$\text{Max-Expendable} = \text{Remaining Credits} - (\text{Remaining Players Needed} - 1)$$

- Example: If an auctioner has 100 credits and needs 5 more players, they can spend at most:
  $$100 - (5 - 1) = 100 - 4 = 96 \text{ credits}$$
- The system automatically blocks any bid higher than the active auctioner's Max-Expendable.

---

## 🔄 Auction Workflow

1. **Start & Loading**: The software launches and reads `config.example.yaml` and `players.example.csv` (or lets you pick any custom file via the GUI).
2. **Caller Turn**: The top header shows which auctioner is up to call a player (following the order in the YAML config).
3. **Player Selection**: The admin searches/selects a player via the fast autocomplete search bar (or from the database sidebar).
4. **Start Auction**: Click **"Start Auction (Space)"**; focus moves to the next auctioner in round-robin order and countdown begins.
5. **Turn Options**:
   - **Raise / Bid**: Enter an amount or click `+1`, `+5`, `+10`, `+20`. Software records the new high bid, plays sound, resets the timer, and focuses the next active auctioner.
   - **Pass / Skip**: Click **"Pass / Skip (S)"** or let the countdown timer run out. The current auctioner is marked as passed (excluded from the current player's auction) and the turn advances to the next auctioner.
6. **Player Assignment**:
   - When only 1 active auctioner remains (or admin clicks **"Assign (A)"**), the player is assigned to the winner at the current price.
   - Roster, remaining credits, and Max-Expendable are instantly updated.
   - State is **automatically saved to disk** in the `save/` directory.
   - Turn automatically advances to the next caller with open slots.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| **Space** | Start Round / Pause / Resume |
| **S** / **s** | Pass / Skip current auctioner |
| **A** / **a** | Assign player to leading bidder |
| **Enter** | Confirm custom bid entered in bid field |
| **Ctrl + Z** / **Cmd + Z** | Undo last player assignment |

---

## 💾 Saving, Resuming & Exporting

- **Auto-Save**: Saved automatically after every player purchase to the `save/` folder (with timestamps and `latest_save.json`).
- **Resume Session**: Click **"Resume Saved Session"** in the top navigation to view and reload any past state.
- **Export Summary**: Click **"Export Summary CSV"** to export an Excel-ready CSV file of all squads, purchases, costs, and timestamps.
- **Multilingual Support**: Supports Italian (`it`) and English (`en`) via external JSON files in `locales/`.
