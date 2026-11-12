# MAKE LEARN EASY

An interactive learning platform with simulators, NCERT Class 11–12 mathematics lessons and a virtual engineering lab.

| Module | What it does |
|---|---|
| Dashboard | Ambient hero with a "type what you want to learn" box that routes by rules (an equation opens the grapher, a lab name opens that experiment, anything else searches lessons); progress, streak, activity chart, bookmarks and recent items |
| Graphing Calculator | Plots explicit and implicit equations, points and user functions; unknown letters become sliders; shareable links; **audio graphs** (hear a curve as pitch, with clicks at roots) and arrow-key exploration |
| Graph Match | 14 challenges (easy to hard): tune a curve onto a dashed target, live match score, rule-based hints such as "period too short: b is too big" |
| Projectile Motion | Launch settings, live vectors, comparison overlays; quadratic drag integrated with RK4; motion graphs of x, y, vₓ, vᵧ against time with the tangent slope and shaded area at the current moment |
| Calculus Visualizer | Draggable tangent, Riemann sums, limit approach, and step-by-step SymPy solutions |
| DFA / NFA | Diagram + table editor, step-through simulation, NFA → DFA (subset construction), Hopcroft minimization |
| PDA | Animated stack, acceptance by final state or empty stack, breadth-first branch search |
| Turing Machine | Two-way infinite tape, step/run with a loop guard |
| NCERT Mathematics | Class 11–12 catalog; notes, worked examples and server-checked quizzes with a 3-step hint ladder and a diagnosis of wrong answers (sign slip, reciprocal, missing square root, degrees vs radians, and so on) |
| Concept Map | All 27 chapters with their prerequisites, coloured by mastery, plus a rule-based "what to study next" |
| Daily Review | Spaced repetition of quiz questions using the FSRS memory model, entirely in the browser |
| Engineering Lab | Pendulum, Ohm's law, RC circuit, convex lens, meter bridge, series/parallel, each with an observation table, graph, % error, viva and CSV/PDF export. **Guided**, **Realistic** (zero errors, parallax, rule-based diagnosis) and **Mystery** (unknown sample, graded 0–100) modes |
| Assignments | A teacher builds a task list and shares it as a link; students return a checksummed verification code; the teacher pastes codes to get a results table and CSV |
| Offline app | Installable, works offline once built; "Save lessons for offline" downloads every lesson and lab |

There are no AI models anywhere in the app. Hints, mistake diagnosis, grading and recommendations are deterministic rules. There is no login either: progress lives in the browser.

![Dashboard](docs/screenshots/01-dashboard.png)

## Screenshots

All screenshots are in [`docs/screenshots/`](docs/screenshots/).

### Dashboard and navigation

| Dashboard (dark theme) | Navigation menu |
|---|---|
| ![Dashboard, dark theme](docs/screenshots/15-dashboard-dark.png) | ![Simulators menu open](docs/screenshots/13-navigation-menu.png) |

<p align="center"><img src="docs/screenshots/14-dashboard-mobile.png" alt="Dashboard on a phone" width="300" /></p>

### Simulators

| Graphing Calculator | Projectile Motion |
|---|---|
| ![Graphing Calculator](docs/screenshots/02-graphing-calculator.png) | ![Projectile Motion](docs/screenshots/03-projectile-motion.png) |

| Calculus Visualizer |
|---|
| ![Calculus Visualizer](docs/screenshots/04-calculus-visualizer.png) |

### Theory of Computation

| DFA / NFA | PDA | Turing Machine |
|---|---|---|
| ![DFA / NFA Simulator](docs/screenshots/05-dfa-nfa-simulator.png) | ![PDA Simulator](docs/screenshots/06-pda-simulator.png) | ![Turing Machine](docs/screenshots/07-turing-machine.png) |

### NCERT Mathematics

| Classes | Class 11 chapters | Chapter lesson and quiz |
|---|---|---|
| ![NCERT home](docs/screenshots/08-ncert-home.png) | ![Class 11](docs/screenshots/09-ncert-class-11.png) | ![Limits and Derivatives chapter](docs/screenshots/10-ncert-chapter.png) |

### Engineering Lab

| Experiments | Simple Pendulum experiment |
|---|---|
| ![Engineering Lab](docs/screenshots/11-engineering-lab.png) | ![Simple Pendulum](docs/screenshots/12-lab-experiment.png) |

## Design

The interface mixes a soft "bone and ivory" style with an ambient glow:

- **Ambient backdrop:** soft light pools sit behind every page. Each section has its own palette (blue/pink/orange on the overview, sky and teal for simulators, violet for automata, peach for lessons, lime and mint for the lab), and the colours cross-fade as you move between sections.
- **Frosted cards:** cards are translucent with a backdrop blur, so the glow shows through. With the system "reduce transparency" setting on, they become solid.
- **Colours:** black buttons, a black pill navigation bar with a white active tab, and lime, yellow and salmon accents. Dotted textures sit behind meters and charts. The font is Plus Jakarta Sans.
- **Themes:** light is the default. A matching warm dark theme is available from the moon button in the top bar.
- **Changing it:** every colour is a CSS variable in `frontend/src/index.css`. The section palettes are the `.ambient[data-tint=…]` rules there.

## Run it

Works on **Windows, macOS and Linux**. You need:

- [uv](https://docs.astral.sh/uv/getting-started/installation/), which downloads Python 3.14 for you
- [Node.js](https://nodejs.org/) 22 or newer

From the project folder:

```bash
npm run setup   # once: creates backend/.venv and installs all packages
npm run dev     # starts the backend and the frontend together; Ctrl+C stops both
```

Then open the address Vite prints, usually http://localhost:5173. The API runs on http://127.0.0.1:8000 (interactive docs at `/docs`).

| Command | What it does |
|---|---|
| `npm run setup` | Creates the Python environment and installs backend and frontend packages |
| `npm run dev` | Backend with auto-reload plus the Vite dev server |
| `npm test` | Backend tests and lint, frontend tests and typecheck |
| `npm run build` | Builds the frontend into `frontend/dist` |
| `npm start` | Serves the built app and the API from one process on http://127.0.0.1:8000 |

If port 8000 is taken, pick another for both servers, for example `API_PORT=8010 npm run dev` (macOS/Linux) or `$env:API_PORT=8010; npm run dev` (PowerShell).

The simulators run entirely in the browser. Lessons, quiz checking, hints, lab theory, symbolic solutions and DFA minimization need the backend.

<details>
<summary>Running the two servers by hand</summary>

macOS / Linux:

```bash
cd backend
uv venv .venv --python 3.14
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload
```

Windows (PowerShell):

```powershell
cd backend
uv venv .venv --python 3.14
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

In a second terminal, on any system:

```bash
cd frontend
npm install
npm run dev
```

</details>

## Tests

```bash
npm test
```

This runs `pytest` and `ruff` for the backend and `vitest` plus the TypeScript check for the frontend. Both the Python and TypeScript automata engines run the same fixtures in `shared/automata/examples.json`.

## Updating the screenshots

With the app running on http://localhost:5173, run:

```bash
node docs/capture-screenshots.mjs
```

It opens headless Google Chrome with a fresh profile, visits every page, and overwrites the PNGs in `docs/screenshots/`. It looks for Chrome in the usual place on Windows, macOS and Linux; set `CHROME=/path/to/chrome` if it is installed somewhere else. You can also pass a different base URL as the first argument.

## Layout

```
backend/
  app/routers/      automata, calculus, content (+quiz), labs
  app/services/     automata engines (structures, finite, pda, turing, validation), sympy_solver,
                    content_loader, tutor (rule-based hints and answer diagnosis)
  app/schemas/      Pydantic request/response models (camelCase JSON)
  content/ncert/    catalog.json (with prerequisites) + class-11/, class-12/ chapter files
  content/labs/     experiment theory, procedure and viva
frontend/src/
  app/              top bar, pill navigation and routes
  modules/          one folder per module (graph, projectile, calculus, automata, ncert, lab,
                    review, assign, dashboard)
  services/         typed API client (generated from OpenAPI), progress, review (FSRS) and
                    settings stores, offline support
  public/           manifest, service worker and app icons
  components/ui/    shared UI kit
shared/
  automata/examples.json   example machines + expected results
  openapi.json             exported API schema
docs/
  screenshots/             README screenshots
  capture-screenshots.mjs  regenerates the screenshots
scripts/
  run.mjs                  cross-platform setup, dev, test, build and start commands
```

## Automata API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/automata/examples?kind=` | List example machines |
| GET | `/api/automata/examples/{id}` | One example with its test cases |
| POST | `/api/automata/validate` | `{valid, errors[], warnings[]}` with codes such as `DFA_NONDETERMINISTIC` |
| POST | `/api/automata/simulate` | `{machine, input, maxSteps}` → step trace (states, stack or tape) |
| POST | `/api/automata/convert/nfa-to-dfa` | Subset construction with the subset mapping and each step |
| POST | `/api/automata/minimize` | Hopcroft minimization with partitions |
| POST | `/api/automata/export` / `import` | Versioned JSON document (`schemaVersion: 1`) |

Machines use a `kind` discriminator (`dfa`, `nfa`, `pda`, `tm`). Errors share one shape, `{"detail": {"code", "message"}}`: 422 for schema errors and 400 for semantic errors.

After changing backend schemas, regenerate the client types:

```bash
cd backend && .venv/bin/python -c "import json; from app.main import app; json.dump(app.openapi(), open('../shared/openapi.json','w', encoding='utf-8'), indent=1, ensure_ascii=False)"
cd ../frontend && npm run gen:api
```

## Adding content

- **NCERT chapter:** add `backend/content/ncert/class-NN/<chapter-id>.json`, using an id from `catalog.json`. Graph widgets list expressions as `e1`, `e2`, …, and a frontend test checks that every widget expression parses. Give every question a `hint`; MCQs can add `optionFeedback` (one message per option, empty for the correct one), which is shown when a student picks that option.
- **Prerequisites:** list them in `catalog.json` under each chapter's `prerequisites`. A test checks that they form a graph without cycles.
- **Lab experiment:** add the theory JSON in `backend/content/labs/` and an `ExperimentDef` in `frontend/src/modules/lab/experiments/`.
