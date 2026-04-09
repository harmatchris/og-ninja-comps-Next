# OG Ninja Comp — Project Context

## What This Is
A Progressive Web App (PWA) for managing Ninja Warrior competitions. Built as a single-page React application using Babel standalone (no build step), Firebase Realtime Database for live sync, and CDN-loaded dependencies.

## Tech Stack
- **Frontend:** React 18 with Vite bundler (ES modules, hot reload)
- **Database:** Firebase Realtime Database (real-time listeners via `useFbVal` hook)
- **Audio:** Web Audio API (tone synthesis for countdowns/buzzers) + Vibration API
- **Hardware:** Web Bluetooth API for physical buzzer integration (`BLE` global object)
- **PWA:** manifest.json, service worker-capable, apple-mobile-web-app-capable
- **i18n:** German/English via `LangCtx` React Context and `T` translation object
- **Build:** Vite 5 + @vitejs/plugin-react. `npm run dev` for local dev, `npm run build` for production

## Architecture
- **State model:** Firebase as source of truth. No Redux/Zustand. Local `useState` for UI transients. `LangCtx` context for language.
- **Routing:** URL query params (`?mode=`, `?comp=`, `?station=`) parsed in the `App` component to select views.
- **Real-time sync:** All views use `useFbVal(path)` hook which sets up Firebase `.on('value')` listeners. Changes propagate instantly across all connected clients (jury tablets, TV displays, coordinator devices).

## Firebase Data Structure
```
ogn/
  {compId}/
    info                        — competition metadata (name, date, mode, stages)
    athletes/{athId}            — athlete records (name, team, country, category)
    obstacles/{obsId}           — obstacle definitions (name, order)
    stages/{stNum}/
      athletes/{athId}          — athletes assigned to this stage
      obstacles/{obsId}         — obstacles for this stage
      closed                    — boolean
    stations/{stNum}/cat        — category assigned to a station
    completedRuns/{runKey}      — result records (athlete, time, CPs, status)
    activeRuns/{stNum}          — live timer state for display sync
    skillPhaseStatus            — skill competition state
    skillScores/{athId}/{skillId} — skill attempt scores
```

## Major Views (URL-routed)
| View | URL param | Purpose |
|------|-----------|---------|
| HomeView | (default) | List/create competitions |
| CoordinatorView | `?mode=coord&comp=X` | Full competition management |
| JuryApp | `?mode=jury&comp=X&station=N` | Timing & scoring (tablet) |
| DisplayView | `?mode=display&comp=X` | TV output (live results, countdown) |
| SkillSelfEntryView | `?mode=skill&comp=X` | Athlete self-entry for skill comps |
| QueueDisplayView | `?mode=queue&comp=X` | TV queue display |
| StatsDisplayView | `?mode=stats&comp=X` | TV stats display |

## Competition Flow
1. **Setup** (SetupWizard): Create competition info, define stages, configure obstacles, register athletes
2. **Run stages** (CoordinatorView assigns stations, JuryApp runs individual athletes):
   - JuryWait → JuryCountdown (3-2-1-GO) → JuryActive (timer + CP tracking) → FallModal/StopModal → JuryDone
3. **Results** (ResultsView): Ranking by category, stage filtering, result editing
4. **Skills** (SkillPhaseView): Optional skill competition (oldschool or boulderstyle mode)
5. **Display** (DisplayView): Live stage cards, countdown sync, podium results

## Competition Modes
- **classic**: Athlete runs until fall or completion. CPs counted, time recorded.
- **lives**: Athlete has multiple lives (falls allowed). Lives deplete on fall, run ends when all lives used.

## Key Shared Dependencies
- `useFbVal(path)` — used by ALL views for real-time Firebase data
- `useLang()` — used by ALL views for i18n
- `SFX` object — audio feedback (countdown tones, buzzer sounds, haptics)
- `BLE` object — Bluetooth buzzer connection
- `computeRanked()` / `computeRankedStage()` / `computeRankedMultiStage()` — ranking algorithms used by ResultsView, DisplayView, StatsView
- `IGN_CATS` — 8 athlete categories used everywhere
- `I` — SVG icon library (35+ icons)
- Firebase helpers: `fbSet`, `fbUpdate`, `fbRemove`

## File Structure
```
og-ninja-comp/
  index.html              — slim HTML shell (just <div id="root">)
  package.json            — npm deps (react, firebase, vite)
  vite.config.js          — Vite config (React plugin, host: true)
  public/
    manifest.json         — PWA manifest
    icon-180.png          — Apple touch icon
    icon-192.png          — Android icon
    icon-512.png          — Splash icon
  src/
    main.jsx              — App component + ReactDOM.render (routing)
    styles.css            — all CSS (~170 lines)
    config.js             — Firebase init + IGN_CATS, MODES, DEF_OBS
    countries.js           — COUNTRIES array (194 entries)
    i18n.js               — T translations, REGELWERK_DE/EN, LangCtx, useLang
    utils.js              — uid, fmtMs, storage, autocomplete, ranking, resize
    hooks.js              — useFbVal, useTimer, useWinW, SFX, BLE
    icons.jsx             — I object (35+ SVG icon components)
    components/
      shared.jsx          — AutocompleteInput, Spinner, EmptyState, TopBar, DragList, etc.
      HomeView.jsx        — competition list + creation
      SetupWizard.jsx     — multi-step competition setup
      CoordinatorView.jsx — main coordinator dashboard
      JuryApp.jsx         — jury timing interface + FallModal, StopModal, etc.
      DisplayView.jsx     — TV display + InstallPrompt + QueueDisplayView + StatsDisplayView
      ResultsView.jsx     — rankings table + EditRunModal + Regelwerk
      SkillPhaseView.jsx  — skill competition management
      SkillSelfEntryView.jsx — athlete self-entry for skill comps
      StatsView.jsx       — charts (Survival, Difficulty, Progress)
      QueueView.jsx       — athlete queue + AutoScrollList
  agents/
    CLAUDE.md             — this file
```

## Development Commands
- `npm run dev` — start dev server (accessible on local network for phone testing)
- `npm run build` — production build to dist/
- `npm run preview` — preview production build locally

## Important Constraints
- Firebase config is in `src/config.js`. Credentials are client-side (public Firebase project).
- The `BLE` object in `hooks.js` manages Web Bluetooth state globally.
- CSS is in a single `src/styles.css`. CSS variables are used for theming.
- The app must work on iPads (jury), phones (athletes), and desktop/TV (display).
- QRCode library (`qrcodejs`) is still loaded via CDN in index.html.
