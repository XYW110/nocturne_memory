# Design Tokens (snow-app style system)

> Established in task `09-13-snow-app-restyle` (2026-09-13). The frontend uses a CSS-variable token layer ported from the snow-app design language (floating-island layout, monochrome accent, semantic pills).

---

## Convention: tokens.css is the single source of truth for color/radius/shadow

**What**: All frontend styling must consume the CSS variables defined in `frontend/src/styles/tokens.css`. Tailwind is used via arbitrary-value classes that reference tokens.

**Why**: The restyle replaced every hard-coded Tailwind palette class (slate-800, indigo-500, ...) with token references so that light/dark themes and the snow-app visual language stay consistent and centrally tunable.

**Example**

```jsx
// Good — consume tokens
<div className="bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--island-shadow)] border border-[var(--border)]">
<button className="bg-[var(--accent)] text-white hover:opacity-90">
<span className="bg-[var(--semantic-success-bg)] text-[var(--semantic-success-fg)]">

// Bad — hard-coded palette colors (forbidden; grep gate: slate-|indigo-|emerald-|amber-|red-|rose-|sky- in *.jsx must be 0)
<div className="bg-slate-900 border-indigo-500 text-emerald-400">
```

### Key variables

| Purpose | Variables |
|---|---|
| Base / surfaces | `--bg-base`, `--surface`, `--surface-solid`, `--surface-2/3` (dark layering), `--surface-hover` |
| Text hierarchy (4 levels) | `--text-primary / -secondary / -muted / -faint` |
| Accent (= near-black in light, `#58a6ff` in dark) | `--accent` |
| Radius ladder | `--radius-sm/md/lg/xl` (6/8/12/16px) |
| Island look | `--island-shadow`, `--island-shadow-soft`, `--border`, `--gap-island: 10px` |
| Focus | `--focus-ring` |
| Semantic pills (light-bg + dark-fg pairs) | `--semantic-{success,danger,info,warning}-{bg,fg}` |

### Layout rules

- Floating-island shell: page root uses `bg-[var(--bg-base)]` with `10px` padding/gaps; top bar and content panels are independent rounded-16 island cards.
- Semantic colors are **status pills only** (approved/rejected/pending/info) — never large surfaces.
- No large-area glassmorphism (snow-app perf tradeoff); `--blur-popover` is reserved for small floating elements only.

### Theming

### Theme & preset switching (lib/theme.js)

`frontend/src/lib/theme.js` owns both switches; never set the attributes elsewhere:
- `getTheme/setTheme/toggleTheme` + `useTheme()` hook — localStorage `theme`, applies/removes `data-theme` on `documentElement` (light default).
- `getPreset/setPreset` + `PRESET_IDS` — localStorage `preset` (default/fallback `snow`), applies/removes `data-preset` on `documentElement`. Preset ids must match the `[data-preset]` blocks in tokens.css.
- The SettingsDrawer 外观 row is the only UI consumer. `frontend/index.html` body must stay on token classes (`bg-[var(--bg-base)]`) — a hard-coded `bg-slate-900` there once shadowed every preset.

`[data-theme="dark"]` block in tokens.css carries the full dark set (neutral black `#050505/#0a0a0a/#111/#1a1a1a`, GitHub-blue accent). Switching goes through `frontend/src/lib/theme.js` (`getTheme`/`setTheme`/`toggleTheme` + `useTheme`), which persists the choice in `localStorage['theme']` (default light) and mirrors it onto `document.documentElement.dataset.theme`. The UI entry point is the Appearance row in SettingsDrawer.

---

## Common Mistake: var() reference without definition

**Symptom**: Element silently falls back to initial property value.

**Cause**: A component references `var(--foo)` that is not defined in tokens.css.

**Fix / Prevention**: Check `grep -rohE "var\(--[a-z0-9-]+\)" src | sort -u` against tokens.css definitions before committing. (Audit on 2026-09-13 after the design-system backport: 28 referenced vars, all defined.)
