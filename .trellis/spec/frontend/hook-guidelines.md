# Hook Guidelines

> How hooks are used in Nocturne Memory frontend.

---

## Overview

- **Custom hooks**: Minimal — only `useLocale` in `src/i18n/useLocale.js`
- **Data fetching**: Direct `api.js` function calls with `useEffect` + `useState` (no React Query/SWR)
- **Pattern**: Fetch on mount, handle loading/error states manually

---

## Data Fetching Pattern

The project uses a simple fetch-on-mount pattern:

```jsx
import { useState, useEffect } from 'react';
import { getDomains } from '../lib/api';

function MyComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    getDomains()
      .then(result => {
        if (mounted) setData(result);
      })
      .catch(err => {
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <DataView data={data} />;
}
```

### Key Rules

1. **`mounted` flag** — Prevent state updates after unmount
2. **Cleanup function** — Set `mounted = false` in effect cleanup
3. **Empty dependency `[]`** — Fetch once on mount
4. **Separate states** — `data`, `loading`, `error` as independent state variables

---

## Custom Hook: useLocale

```jsx
// src/i18n/useLocale.js
import { useTranslation } from 'react-i18next';

export function useLocale() {
  const { t, i18n } = useTranslation();
  
  const changeLocale = (locale) => {
    i18n.changeLanguage(locale);
    localStorage.setItem('locale', locale);
  };

  return { t, locale: i18n.language, changeLocale };
}
```

---

## Event Listeners Pattern

For custom events (e.g., auth errors, settings drawer):

```jsx
useEffect(() => {
  const handler = () => { /* handle event */ };
  window.addEventListener('open-settings', handler);
  return () => window.removeEventListener('open-settings', handler);
}, []);
```

---

## API Interceptors (in api.js)

Axios interceptors handle cross-cutting concerns:

```javascript
// Request: auto-attach token and namespace
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('api_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const ns = localStorage.getItem('selected_namespace');
  if (ns) config.headers['X-Namespace'] = ns;
  return config;
});

// Response: 401 → trigger re-auth
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('api_token');
      window.dispatchEvent(new CustomEvent(AUTH_ERROR_EVENT));
    }
    return Promise.reject(error);
  }
);
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Custom hooks | `use` prefix, camelCase | `useLocale` |
| API functions | camelCase, verb-first | `getDomains`, `createMemory` |
| Event handlers | `handle` prefix | `handleClick`, `handleAuthError` |
| Effects | Direct `useEffect`, no wrapper | `useEffect(() => {...}, [])` |

---

## Common Mistakes

1. **Missing cleanup** — Always return cleanup function from effects that set state
2. **Stale closure** — Include all dependencies in dependency array
3. **No error handling** — Always handle `.catch()` in data fetching
4. **Direct API calls in components** — Import from `lib/api.js`, don't use `axios` directly
5. **No loading state** — Always show loading indicator during async operations
