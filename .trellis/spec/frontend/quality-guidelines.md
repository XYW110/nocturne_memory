# Quality Guidelines

> Code quality standards for Nocturne Memory frontend.

---

## Overview

- **Framework**: React 18 (functional components + hooks)
- **Build**: Vite 7
- **Testing**: Vitest 4 + React Testing Library
- **Linting**: No formal ESLint config; rely on code review
- **Type checking**: None (plain JSX, no TypeScript)

---

## Required Patterns

### 1. Functional Components Only

```jsx
// ✅ Correct
function MyComponent({ prop1 }) {
  return <div>{prop1}</div>;
}
export default MyComponent;

// ❌ Wrong — class components
class MyComponent extends React.Component {
  render() { return <div>{this.props.prop1}</div>; }
}
```

### 2. Default Export per File

Each component file exports one default component:

```jsx
// ✅ One component per file, default export
function MemoryBrowser() { ... }
export default MemoryBrowser;
```

### 3. i18n for All User-Visible Text

```jsx
const { t } = useTranslation();

// ✅ Correct
<h1>{t('app.nav.brand')}</h1>

// ❌ Wrong — hardcoded text
<h1>Nocturne Memory</h1>
```

### 4. data-testid on Interactive Elements

```jsx
// ✅ Correct
<button data-testid="retry-btn" onClick={handleRetry}>
<select data-testid="namespace-selector">
<div data-testid="app-loading">
```

### 5. Mounted Flag in Effects

```jsx
useEffect(() => {
  let mounted = true;
  fetchData().then(data => {
    if (mounted) setData(data);
  });
  return () => { mounted = false; };
}, []);
```

### 6. API Functions from lib/api.js

```jsx
import { getDomains, createMemory } from '../lib/api';

// ✅ Correct
const data = await getDomains();

// ❌ Wrong — direct axios usage
const data = await axios.get('/api/browse/domains');
```

---

## Forbidden Patterns

### 1. Inline Styles

```jsx
// ❌ WRONG
<div style={{ color: 'red', padding: '10px' }}>

// ✅ CORRECT
<div className="text-red-500 p-2.5">
```

### 2. Class Components

```jsx
// ❌ WRONG
class MyComponent extends React.Component { ... }

// ✅ CORRECT
function MyComponent() { ... }
```

### 3. Direct DOM Manipulation

```jsx
// ❌ WRONG
document.getElementById('my-div').innerText = 'hello';

// ✅ CORRECT — use state
const [text, setText] = useState('');
<div>{text}</div>
```

### 4. Hardcoded API URLs

```jsx
// ❌ WRONG
fetch('http://localhost:8233/api/browse/domains')

// ✅ CORRECT — use api.js
import { getDomains } from '../lib/api';
```

### 5. Missing Key Prop in Lists

```jsx
// ❌ WRONG
{items.map(item => <Item data={item} />)}

// ✅ CORRECT
{items.map(item => <Item key={item.id} data={item} />)}
```

---

## Testing Requirements

- **Framework**: Vitest + `@testing-library/react`
- **File convention**: `*.test.js` co-located with source
- **Run commands**:
  - `npm run test` — watch mode
  - `npm run test:run` — single run

### Test Structure

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByTestId('my-element')).toBeInTheDocument();
  });
});
```

---

## Code Review Checklist

- [ ] Functional components with hooks (no classes)
- [ ] All text uses `t()` for i18n
- [ ] `data-testid` on key interactive elements
- [ ] Mounted flag in async effects
- [ ] API calls through `lib/api.js`
- [ ] Tailwind classes only (no inline styles)
- [ ] `key` prop on list items
- [ ] Default export per file
- [ ] Cleanup function in effects
