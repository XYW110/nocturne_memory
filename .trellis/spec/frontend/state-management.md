# State Management

> How state is managed in Nocturne Memory frontend.

---

## Overview

No global state management library (no Redux, no Zustand, no Context). State is managed via:

1. **`useState`** — Component-local state
2. **`localStorage`** — Persistent cross-session state
3. **`sessionStorage`** — Temporary cross-navigation state
4. **Props** — Parent-to-child data flow

---

## State Categories

### Local Component State (`useState`)

Used for UI state: loading, modals, form inputs, fetched data.

```jsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState([]);
const [showModal, setShowModal] = useState(false);
```

### Persistent State (`localStorage`)

| Key | Purpose | Set by |
|-----|---------|--------|
| `api_token` | Bearer token for auth | `TokenAuth` component, URL `?token=` param |
| `selected_namespace` | Active memory namespace | `NamespaceSelector` component |
| `locale` | UI language preference | `useLocale` hook / `LocaleSection` |

### Temporary State (`sessionStorage`)

| Key | Purpose |
|-----|---------|
| `nocturne:namespace-switch-root-redirect` | Tracks namespace switch for root redirect logic |

### Custom Events (Cross-Component Communication)

| Event | Purpose | Dispatched by |
|-------|---------|---------------|
| `nocturne:auth-error` | Trigger re-auth on 401 | Axios response interceptor |
| `open-settings` | Open settings drawer | Nav bar button |

---

## When to Use Global State

**Rule**: There is no global state. Every piece of state is either:
- Local to a component (via `useState`)
- Persisted to `localStorage` (auth, namespace, locale)
- Passed via props

**Why**: The app has only 3 main pages (Review, Memory, Maintenance) with minimal cross-page state sharing.

---

## Server State Pattern

Server data is fetched directly in components — no caching layer:

```jsx
// Fetch and hold in local state
const [domains, setDomains] = useState([]);
useEffect(() => {
  getDomains().then(setDomains).catch(handleError);
}, []);
```

**No invalidation needed** — Data is re-fetched on page navigation (React Router re-mounts components).

---

## Namespace Isolation

The namespace system affects state management:

1. User selects namespace in nav bar → stored in `localStorage`
2. Axios interceptor reads from `localStorage` → attaches `X-Namespace` header
3. Namespace change triggers `window.location.reload()` for clean state

---

## Common Mistakes

1. **Using Context for simple props** — Just pass props; the component tree is shallow
2. **Storing fetched data globally** — Re-fetch on mount is fine for this app's scale
3. **Not clearing localStorage on 401** — The interceptor handles this automatically
4. **Forgetting namespace in API calls** — The interceptor handles this automatically
5. **Reading localStorage in render** — Read in `useState` initializer or `useEffect`
