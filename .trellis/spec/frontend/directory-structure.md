# Directory Structure

> How frontend code is organized in Nocturne Memory.

---

## Overview

The frontend is a React SPA built with Vite. It's the Admin Dashboard for reviewing AI-generated memory changes, browsing the memory graph, and managing settings.

- **Framework**: React 18 (functional components + hooks)
- **Build tool**: Vite 7
- **Styling**: Tailwind CSS 3
- **Routing**: React Router DOM 6
- **HTTP client**: Axios
- **i18n**: i18next + react-i18next

---

## Directory Layout

```
frontend/
├── index.html                  # Vite entry HTML
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── postcss.config.js           # PostCSS (autoprefixer + tailwind)
│
└── src/
    ├── main.jsx                # React entry point (renders App)
    ├── App.jsx                 # Root component (routing, auth, layout)
    ├── index.css               # Global styles (Tailwind directives)
    │
    ├── components/             # Shared/reusable UI components
    │   ├── ConfirmModal.jsx    # Generic confirmation dialog
    │   ├── DiffViewer.jsx      # Text diff display (unified/split)
    │   ├── PromptModal.jsx     # Input prompt dialog
    │   ├── SnapshotList.jsx    # Changeset snapshot browser
    │   ├── Toast.jsx           # Toast notification system
    │   └── TokenAuth.jsx       # API token login form
    │
    ├── features/               # Feature-based page modules
    │   ├── memory/             # Memory browser feature
    │   │   ├── MemoryBrowser.jsx      # Main browser page
    │   │   └── components/            # Memory-specific components
    │   │       ├── AliasManager.jsx
    │   │       ├── Breadcrumb.jsx
    │   │       ├── CreateMemoryModal.jsx
    │   │       ├── GlossaryHighlighter.jsx
    │   │       ├── KeywordManager.jsx
    │   │       ├── MemorySidebar.jsx
    │   │       ├── NodeGridCard.jsx
    │   │       └── PriorityBadge.jsx
    │   │
    │   ├── review/             # Changeset review feature
    │   │   └── ReviewPage.jsx
    │   │
    │   ├── maintenance/        # Database maintenance feature
    │   │   └── MaintenancePage.jsx
    │   │
    │   └── settings/           # Settings drawer feature
    │       ├── SettingsDrawer.jsx
    │       ├── Section.jsx
    │       ├── AdvancedSection.jsx
    │       ├── BootUrisSection.jsx
    │       ├── DatabaseSection.jsx
    │       ├── EmotionDashboard.jsx        # Emotion dimension visualization
    │       ├── LocaleSection.jsx
    │       ├── PresetsSection.jsx
    │       ├── RelationshipPanel.jsx       # Relationship type management
    │       ├── ServerSection.jsx
    │       └── TemplatesSection.jsx        # Soul template management (create, select, reset)
    │
    ├── lib/                    # Shared utilities
    │   └── api.js              # Axios instance + API functions
    │
    └── i18n/                   # Internationalization
        ├── index.js            # i18next setup + detectLocale()
        ├── useLocale.js        # Locale hook
        ├── en.json             # English translations
        ├── zh.json             # Chinese translations
        └── i18n.test.js        # i18n tests
```

---

## Module Organization Rules

### Feature-Based Structure

Each major page/feature gets its own directory under `features/`:
- `features/<name>/` — page component + local sub-components
- `features/<name>/components/` — components used only by this feature

### Shared Components

Components used across multiple features live in `src/components/`:
- Generic UI primitives (modals, toasts, diff viewer)
- No feature-specific logic in shared components

### API Layer

All HTTP calls go through `src/lib/api.js`:
- Axios instance with interceptors (auth token, namespace header)
- One function per API endpoint
- Named exports per resource group (`getGroups`, `getDomains`, `initExistingSoul`, `resetExistingSoul`, etc.)

### Settings Sections

Settings drawer organizes related functionality into sections:
- `TemplatesSection.jsx` — Soul template management (create, delete, select, apply, reset)
- `EmotionDashboard.jsx` — Emotion dimension visualization and adjustment
- `RelationshipPanel.jsx` — Relationship type selection and management

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase | `MemoryBrowser.jsx`, `TokenAuth.jsx`, `TemplatesSection.jsx` |
| Hooks | camelCase, `use` prefix | `useLocale.js` |
| Utilities | camelCase | `api.js`, `detectLocale()` |
| CSS | Tailwind utility classes | `bg-slate-950`, `text-indigo-500` |
| Test files | `*.test.js` | `i18n.test.js` |

---

## Build & Dev Commands

```bash
npm run dev        # Vite dev server (proxies /api to backend)
npm run build      # Production build → frontend/dist/
npm run test       # Vitest watch mode
npm run test:run   # Vitest single run
```

---

## Key Patterns

1. **Auth gate** — `App.jsx` checks token before rendering the router
2. **Namespace selector** — Global in nav bar, stored in `localStorage`
3. **Settings drawer** — Slide-over panel, not a route
4. **Feature isolation** — Each feature directory is self-contained
5. **API interceptors** — Auto-attach `Authorization` and `X-Namespace` headers
6. **Portal rendering** — Modals rendered via `createPortal` to `document.body` to avoid overflow/crop issues in nested containers
7. **Version-based refresh** — State updates trigger version increments (e.g., `soulVersion`) to force re-fetching data across components
8. **Soul template workflow** — Two-step process: (1) Fill persona variables, (2) Apply template with optional force overwrite
9. **Emotion dimension display** — 6-axis visualization showing trust, closeness, respect, dependency, security, resonance
