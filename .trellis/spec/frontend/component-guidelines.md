# Component Guidelines

> How components are built in Nocturne Memory frontend.

---

## Overview

- **Pattern**: Functional components with hooks (no class components)
- **Styling**: Tailwind CSS utility classes exclusively (no CSS modules, no styled-components)
- **Icons**: `lucide-react` icon library
- **Merge utilities**: `clsx` for conditional class merging, `tailwind-merge` for deduplication

---

## Component Structure

```jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IconName } from 'lucide-react';
import clsx from 'clsx';

function ComponentName({ prop1, prop2, className }) {
  const { t } = useTranslation();
  const [state, setState] = useState(initialValue);

  // Effects
  useEffect(() => { ... }, [deps]);

  // Handlers
  const handleClick = () => { ... };

  // Render
  return (
    <div className={clsx("base-classes", className)}>
      {t('translation.key')}
    </div>
  );
}

export default ComponentName;
```

---

## Props Conventions

- Use destructuring in function signature
- `className` prop for external style overrides (merged with `clsx`)
- No PropTypes — project uses plain JSX (no TypeScript)
- Default values via destructuring: `{ size = 'md', variant = 'default' }`

```jsx
// ✅ Correct
function PriorityBadge({ priority, className }) {
  return (
    <span className={clsx("inline-flex items-center", className)}>
      {priority}
    </span>
  );
}

// ❌ Wrong — no className passthrough
function PriorityBadge({ priority }) {
  return <span className="inline-flex items-center">{priority}</span>;
}
```

---

## Styling Patterns

### Tailwind-Only

All styling via Tailwind utility classes. No inline styles, no CSS modules.

```jsx
// ✅ Correct
<div className="flex items-center gap-2 p-4 bg-slate-900 rounded-lg">

// ❌ Wrong — inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

### Conditional Classes with clsx

```jsx
import clsx from 'clsx';

// Active state
className={clsx(
  "base-classes",
  isActive ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400"
)}

// Multiple conditions
className={clsx(
  "px-4 py-2 rounded",
  isDisabled && "opacity-50 cursor-not-allowed",
  isPrimary ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-200"
)}
```

### Color Palette

The project uses a consistent dark slate + indigo/emerald/amber accent scheme:

| Role | Classes |
|------|---------|
| Background | `bg-slate-950`, `bg-slate-900`, `bg-slate-800` |
| Text | `text-slate-200`, `text-slate-400`, `text-slate-100` |
| Border | `border-slate-800`, `border-slate-700` |
| Primary accent | `text-indigo-500`, `bg-indigo-600`, `border-indigo-500` |
| Success accent | `text-emerald-400`, `border-emerald-500` |
| Warning accent | `text-amber-400`, `border-amber-500` |
| Error accent | `text-red-500`, `bg-red-500/10` |

---

## i18n in Components

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('app.nav.brand')}</h1>;
}
```

- All user-visible text goes through `t()`
- Translation keys use dot notation: `'app.nav.brand'`, `'api.browse.path_not_found'`
- Translations defined in `src/i18n/en.json` and `src/i18n/zh.json`

---

## Modal Pattern

The project has two modal components:

1. **`ConfirmModal`** — Yes/No confirmation dialog
2. **`PromptModal`** — Text input dialog

Usage pattern:

```jsx
const [showModal, setShowModal] = useState(false);

{showModal && (
  <ConfirmModal
    title={t('confirm.title')}
    message={t('confirm.message')}
    onConfirm={() => { /* action */ setShowModal(false); }}
    onCancel={() => setShowModal(false)}
  />
)}
```

---

## Accessibility

- Use semantic HTML elements (`nav`, `button`, `select`, `input`)
- `data-testid` attributes on key interactive elements for testing
- Keyboard navigation supported (Enter, Escape in modals/inputs)
- `title` attributes on icon-only buttons

---

## Common Mistakes

1. **Missing `className` passthrough** — Always accept and merge external `className`
2. **Hardcoded strings** — Use `t()` for all user-visible text
3. **Inline styles** — Use Tailwind classes only
4. **Class components** — Always use functional components with hooks
5. **Missing key prop** — Always provide `key` in list renders
6. **Direct DOM manipulation** — Use React refs or state instead
