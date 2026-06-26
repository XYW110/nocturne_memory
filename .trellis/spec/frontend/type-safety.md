# Type Safety

> Type safety patterns in Nocturne Memory frontend.

---

## Overview

The frontend uses **plain JSX** — no TypeScript. Type safety relies on:

1. **Prop destructuring** with default values
2. **Runtime checks** where needed
3. **API response shapes** assumed from backend Pydantic models
4. **JSDoc comments** for complex functions (optional)

---

## Type Organization

No type files, interfaces, or type definitions. The project is pure JavaScript/JSX.

API response shapes are implicitly defined by the backend Pydantic models:
- `ChangeGroup` → `{ node_uuid, display_uri, top_level_table, action, row_count, namespaces }`
- `UriDiff` → `{ uri, change_type, action, before_content, current_content, ... }`

---

## Prop Validation

Props are validated at the call site, not the definition site:

```jsx
// No PropTypes, no TypeScript — trust the parent
function PriorityBadge({ priority, className }) {
  return (
    <span className={clsx("inline-flex items-center", className)}>
      {priority ?? 0}
    </span>
  );
}
```

### Default Values via Destructuring

```jsx
function Component({ size = 'md', variant = 'default', className = '' }) {
  // size, variant, className are guaranteed defined
}
```

---

## API Response Handling

Trust backend responses; validate at boundaries:

```javascript
// API functions assume correct shape
export const getDomains = () =>
  api.get('/browse/domains').then(res => res.data);

// Component uses response directly
const [domains, setDomains] = useState([]);
useEffect(() => {
  getDomains().then(setDomains);
}, []);
```

### Defensive Access

For optional nested properties:

```jsx
// ✅ Safe access with optional chaining
const name = item?.node?.name ?? 'unknown';

// ✅ Default empty array
const children = data?.children ?? [];
```

---

## Common Patterns

### Conditional Rendering

```jsx
{data && <Display data={data} />}
{loading && <Spinner />}
{error && <ErrorMessage error={error} />}
```

### Nullish Coalescing for Defaults

```jsx
const priority = node.priority ?? 0;
const label = selected || '(default)';
const count = items?.length ?? 0;
```

---

## What NOT to Do

1. **Don't add TypeScript incrementally** — The project is committed to plain JSX
2. **Don't add PropTypes** — Not used in this codebase
3. **Don't use `as` type assertions** — N/A for JS
4. **Don't trust external input** — Validate API responses at the component boundary if they drive critical UI

---

## Migration Path (If Ever Needed)

If TypeScript is adopted in the future:
1. Start with `lib/api.js` — define response types matching Pydantic models
2. Add `.d.ts` files for shared types
3. Convert files incrementally (`.jsx` → `.tsx`)
4. The backend Pydantic schemas in `models/schemas.py` are the source of truth for response shapes
