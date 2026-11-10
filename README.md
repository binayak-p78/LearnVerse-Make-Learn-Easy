# MAKE LEARN EASY

An interactive learning platform with simulators, NCERT Class 11–12 mathematics lessons and a virtual engineering lab.

| Module | What it does |
|---|---|
| Graphing Calculator | Plots explicit and implicit equations, points and user functions; unknown letters become sliders; shareable links |
| Projectile Motion | Launch settings, live vectors, comparison overlays; quadratic drag integrated with RK4 |
| Calculus Visualizer | Draggable tangent, Riemann sums, limit approach, and step-by-step SymPy solutions |
| DFA / NFA | Diagram + table editor, step-through simulation, NFA → DFA (subset construction), Hopcroft minimization |
| PDA | Animated stack, acceptance by final state or empty stack, breadth-first branch search |
| Turing Machine | Two-way infinite tape, step/run with a loop guard |
| NCERT Mathematics | Class 11–12 catalog; chapters with notes, worked examples and server-checked quizzes |
| Engineering Lab | Pendulum, Ohm's law, RC circuit, convex lens, meter bridge, series/parallel, each with an observation table, graph, % error, viva and CSV/PDF export |
| Dashboard | Progress, streak, activity chart, bookmarks and recent items (stored in the browser) |

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

The interface uses a soft "bone and ivory" style:

- **Colours:** a greige page with off-white rounded cards, white inner panels, black buttons, a black pill navigation bar with a white active tab, and lime, yellow and salmon accents.
- **Details:** dotted textures behind meters and charts. The font is Plus Jakarta Sans.
- **Themes:** light is the default. A matching warm dark theme is available from the moon button in the top bar.
- **Changing it:** every colour is a CSS variable in `frontend/src/index.css`.

## Run it

Requirements: Python 3.14 (via [uv](https://docs.astral.sh/uv/)) and Node 22+.

```bash
# backend: http://127.0.0.1:8000 (API docs at /docs)
cd backend
uv venv .venv --python 3.14
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload

# frontend: http://localhost:5173 (proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Once both are installed, start the backend and frontend together from the project root (Ctrl+C stops both):

```bash
(trap 'kill 0' INT TERM; (cd backend && .venv/bin/uvicorn app.main:app --reload) & (cd frontend && npm run dev); wait)
```

The simulators run entirely in the browser. Lessons, quiz checking, lab theory, symbolic solutions and DFA minimization need the backend.

For a single deployment, run `npm run build` in `frontend/`. FastAPI then serves `frontend/dist` alongside the API.

## Tests

```bash
cd backend && .venv/bin/python -m pytest && .venv/bin/ruff check app tests
cd frontend && npm test && npm run typecheck
```

Both the Python and TypeScript automata engines run the same fixtures in `shared/automata/examples.json`.

## Updating the screenshots

With the app running on http://localhost:5173, run:

```bash
node docs/capture-screenshots.mjs
```

It opens headless Google Chrome with a fresh profile, visits every page, and overwrites the PNGs in `docs/screenshots/`. Set `CHROME=/path/to/chrome` if Chrome is installed somewhere else. You can also pass a different base URL as the first argument.

## Layout

```
backend/
  app/routers/      automata, calculus, content (+quiz), labs
  app/services/     automata engines (structures, finite, pda, turing, validation), sympy_solver, content_loader
  app/schemas/      Pydantic request/response models (camelCase JSON)
  content/ncert/    catalog.json + class-11/, class-12/ chapter files
  content/labs/     experiment theory, procedure and viva
frontend/src/
  app/              top bar, pill navigation and routes
  modules/          one folder per module (graph, projectile, calculus, automata, ncert, lab, dashboard)
  services/         typed API client (generated from OpenAPI), progress and settings stores
  components/ui/    shared UI kit
shared/
  automata/examples.json   example machines + expected results
  openapi.json             exported API schema
docs/
  screenshots/             README screenshots
  capture-screenshots.mjs  regenerates the screenshots
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
cd backend && .venv/bin/python -c "import json; from app.main import app; json.dump(app.openapi(), open('../shared/openapi.json','w'), indent=1, ensure_ascii=False)"
cd ../frontend && npm run gen:api
```

## Adding content

- **NCERT chapter:** add `backend/content/ncert/class-NN/<chapter-id>.json`, using an id from `catalog.json`. Graph widgets list expressions as `e1`, `e2`, …, and a frontend test checks that every widget expression parses.
- **Lab experiment:** add the theory JSON in `backend/content/labs/` and an `ExperimentDef` in `frontend/src/modules/lab/experiments/`.
