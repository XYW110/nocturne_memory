# Frontend Development Guidelines

> Best practices for frontend development in Nocturne Memory.

---

## Overview

The frontend is a React SPA (Admin Dashboard) for reviewing AI memory changes, browsing the memory graph, and managing settings.

- **Framework**: React 18 (functional components + hooks)
- **Build tool**: Vite 7
- **Styling**: Tailwind CSS 3 (utility classes only)
- **HTTP**: Axios with interceptors
- **i18n**: i18next + react-i18next
- **Testing**: Vitest + React Testing Library
- **Type system**: Plain JSX (no TypeScript)

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | Feature-based layout, component organization, build commands |
| [Component Guidelines](./component-guidelines.md) | Functional components, Tailwind styling, modals, i18n, accessibility |
| [Hook Guidelines](./hook-guidelines.md) | Data fetching pattern, custom hooks, event listeners, API interceptors |
| [State Management](./state-management.md) | useState, localStorage, sessionStorage, custom events |
| [Quality Guidelines](./quality-guidelines.md) | Required patterns, forbidden patterns, testing, review checklist |
| [Type Safety](./type-safety.md) | Plain JSX conventions, prop defaults, defensive access |

---

## Pre-Development Checklist

Before writing frontend code:

- [ ] Read [Directory Structure](./directory-structure.md) to know where your file belongs
- [ ] Read [Component Guidelines](./component-guidelines.md) for component patterns and styling
- [ ] Read [Hook Guidelines](./hook-guidelines.md) for data fetching conventions
- [ ] Check [State Management](./state-management.md) for state storage patterns
- [ ] Review [Quality Guidelines](./quality-guidelines.md) for required/forbidden patterns

---

## Quick Reference

### API Calls

```jsx
import { getDomains, createMemory } from '../lib/api';
```

### i18n

```jsx
const { t } = useTranslation();
<h1>{t('app.nav.brand')}</h1>
```

### Conditional Classes

```jsx
import clsx from 'clsx';
className={clsx("base", isActive && "active-class")}
```

### Data Fetching

```jsx
useEffect(() => {
  let mounted = true;
  getData().then(d => { if (mounted) setData(d); });
  return () => { mounted = false; };
}, []);
```
