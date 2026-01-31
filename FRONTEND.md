# frontendclaude.md — Reality Memory Frontend (Tailwind + anime.js + UI kit)

## 0) Your role
You are Claude building the frontend for Reality Memory.

Primary goal:
- A polished, judge-friendly web UI that makes the demo instantly understandable.

You must implement:
- A strong landing page
- A mapping/recall app UI
- Camera stream view
- Voice input + text fallback
- Results + guidance UI
- Debug view (detections + confidence + system status)

Constraints:
- Frontend runs on Mac/Windows, talks only to FastAPI.
- Camera feed comes from backend (`/camera/stream`) via WebRTC or HTTP streaming.
- Voice input uses Web Speech API when available; always provide text fallback.

---

## 1) Tech stack recommendation (do this unless repo dictates otherwise)
Preferred:
- Next.js + TypeScript
- TailwindCSS
- shadcn/ui (Radix-based) for clean components
- lucide-react icons
- anime.js for tasteful motion (hero, transitions, subtle micro-interactions)

If the repo is plain Vite React, mirror the same component approach.

---

## 2) Color system (must match)
Palette:
- Ink Black: `#0d1321` (background base)
- Deep Space Blue: `#1d2d44` (surfaces)
- Blue Slate: `#3e5c76` (borders/secondary surfaces)
- Dusty Denim: `#748cab` (muted text, secondary accents)
- Eggshell: `#f0ebd8` (primary text + highlight)

### Tailwind setup (extend theme)
Add to `tailwind.config.*`:

- colors.ink: `#0d1321`
- colors.space: `#1d2d44`
- colors.slateblue: `#3e5c76`
- colors.denim: `#748cab`
- colors.eggshell: `#f0ebd8`

Design rules:
- Background: ink
- Cards/surfaces: space
- Borders: slateblue at 30–60% opacity
- Primary text: eggshell
- Secondary text: denim
- Primary button: eggshell text on slateblue/denim gradient OR eggshell outline on space
- Focus rings: denim

---

## 3) Global UI style
Tone:
- “space lab” vibe: dark, crisp, calm, premium
- Minimal but cinematic (subtle animations)

Defaults:
- Rounded corners: 14–18px
- Shadows: soft, not harsh
- Typography: large headings, readable body
- 8pt spacing grid

Motion:
- Avoid “bouncy” UI.
- Use anime.js for:
  - Landing hero reveal (stagger)
  - Mode switch (Mapping ↔ Recall)
  - Result card entrance
  - Guidance arrow pulse
  - “Success” confirmation glow

---

## 4) Pages / routes
Minimum pages:
1) `/` — Landing page (high quality)
2) `/app` — Main application (mapping + recall)
Optional:
3) `/demo` — guided “click-through” mode with mock data

---

## 5) Landing page requirements (must be strong)
Goal: judges understand the project in 10 seconds.

Landing sections (in order):
1) Hero
   - Title: “Reality Memory”
   - Subtitle: “Ask where you last saw something. Get guided back.”
   - CTA buttons:
     - “Launch Demo” → `/app`
     - “Watch How It Works” (scroll)
2) How it works (3 steps)
   - Map once
   - We remember objects
   - Ask and get guided
3) Live-ish preview card
   - Fake screenshot frame (or real if available) showing:
     - object card with snapshot
     - distance + direction
4) Trust + privacy
   - “Memory, not surveillance”
   - “Last known location + timestamp”
5) Tech strip (small)
   - VSLAM + EyePop + FastAPI + Voice
6) Final CTA

Landing animations:
- Hero title fades in + slight slide
- Step cards stagger in
- A gentle starfield/noise background (CSS, not heavy)

---

## 6) `/app` layout (core)
Top nav:
- Left: Reality Memory logo + status pill (Connected / Mock / Offline)
- Center: Mode toggle (Mapping | Recall)
- Right: Settings (voice on/off), Help, Reset

Main grid (desktop):
- Left (60–70%): Camera panel
- Right (30–40%): Control panel + results + guidance

Mobile:
- Tab switcher: Camera | Controls | Results | Debug

---

## 7) Core components (build these)
### A) CameraStreamPanel
- Shows live feed from `/camera/stream`
- If stream fails:
  - show placeholder and “Reconnect” button
  - allow mock still frame mode

Overlay options:
- Bounding boxes toggle (if backend can provide them)
- Crosshair for center

### B) ModeToggle
- Two-state: Mapping / Recall
- Animates underline/slider with anime.js

### C) MappingControls
- Start mapping → `POST /mapping/start`
- Stop mapping → `POST /mapping/stop`
- Show mapping state:
  - Idle / Mapping / Saving / Saved / Error
- Show a subtle “mapping pulse” indicator while active

### D) QueryBar (Voice + text)
- Input field + mic button
- Voice:
  - Uses Web Speech API if available
  - On transcript final: auto-run search
- Text fallback always works
- “Example queries” chips: `water bottle`, `keys`, `backpack`

### E) ResultsList + ResultCard
When search returns candidates:
- Each card shows:
  - Snapshot image (if present)
  - Label
  - Last seen timestamp (“2m ago” + absolute time tooltip)
  - Confidence bar
  - CTA: “Guide me” calls `/navigation/guide?target_id=...`

### F) GuidancePanel
Shows active guidance:
- Big distance number (meters)
- Direction indicator:
  - “Turn left/right X°”
  - Simple compass arrow (SVG) rotating by bearing
- “Speak” button to re-read instruction
- Arrival state:
  - glow + “You’re here”
  - button: “Mark found” (optional, just clears guidance)

Voice output:
- Prefer browser SpeechSynthesis (fast + no key needed)
- If ElevenLabs is available via backend, allow toggle: “High quality voice”

### G) DebugDrawer (important for judges)
A collapsible panel listing:
- Latest detections (label + confidence)
- Current system mode
- Last API response times
- Errors
- Memory count (how many objects stored)

---

## 8) API client contract (frontend)
Base URL:
- Use env var: `NEXT_PUBLIC_API_BASE_URL`
- Default: `http://localhost:8000`

Endpoints:
- `POST /mapping/start`
- `POST /mapping/stop`
- `GET /objects/search?query=...`
- `GET /navigation/guide?target_id=...`
- `GET /camera/stream`

Error handling rules:
- Never crash on backend failures.
- Show toast + status pill flips to “Offline”.
- Provide “Mock mode” toggle so the UI remains demoable.

---

## 9) State model (keep it simple)
Recommended client state:
- `mode`: "mapping" | "recall"
- `status`: connected | mock | offline
- `mappingState`: idle | active | saving | saved | error
- `query`: string
- `results`: array of objects
- `activeTarget`: object | null
- `guidance`: guidance object | null
- `debug`: last detections, logs

Polling:
- Guidance can re-fetch every 500–1000ms when active (or websocket later).
- Avoid heavy polling on search; only run on user action.

---

## 10) UI components to adopt (suggested)
Use shadcn/ui equivalents:
- Button, Card, Badge, Tabs, Dialog, Drawer/Sheet, Toast, Tooltip, Progress, Switch, Skeleton

Icons:
- lucide-react

Motion:
- anime.js for orchestrated transitions
- CSS transitions for small hover/focus

---

## 11) Accessibility + polish checklist
- Keyboard accessible (tab order)
- Visible focus rings (denim)
- Large tap targets on mobile
- Reduced motion option (if `prefers-reduced-motion`, disable anime.js heavy sequences)
- Loading skeletons for camera and search
- Clear empty states:
  - “No objects found. Try ‘keys’ or map again.”

---

## 12) “Looks good in a demo” details
Add these:
- A “Demo Mode” toggle that seeds fake results if backend is offline
- A “Run the script” hint panel:
  1) Start mapping
  2) Walk and detect
  3) Stop mapping
  4) Ask “Find my water bottle”
- A “confidence legend” tooltip

---

## 13) Deliverables checklist (what you should output as Claude)
When implementing:
- Create the landing page `/` with the palette + hero + steps + CTA
- Create `/app` with:
  - camera stream
  - mapping controls
  - query (voice + text)
  - results list
  - guidance panel
  - debug drawer
- Tailwind theme configured with the exact colors
- anime.js used in at least:
  - landing hero reveal
  - mode toggle transition
  - result card entrance

Definition of done:
- Works end-to-end with backend online
- Still looks good with backend offline (mock mode)
- Judges can understand the whole system from the UI alone
