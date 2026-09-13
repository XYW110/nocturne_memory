#!/usr/bin/env node
// convert-tokens.mjs — tokens.css → DTCG token sets for Penpot (task: 09-13-snow-app-to-penpot)
//
// Input : temp/Snow-App-Design-System/tokens.css (唯一完整令牌来源)
// Output: .trellis/tasks/09-13-snow-app-to-penpot/output/penpot-tokens/
//   cascade/resolved.json          24 组合 (preset×mode) 的 css-var resolved 表(原始 CSS 值)+ 命名映射
//   sets-baseline-overrides/       D1 推荐建模:light/dark 全量基线 + 22 个预设覆盖 set + $themes + $metadata
//   sets-flat-24/                  D1 备选建模:24 个全量扁平 set + $themes + $metadata
//   report.md                      统计 / 映射表 / 断言结果
//
// 级联语义:light = :root(首个);dark = :root → [data-theme="dark"];
// 预设 light = :root → [data-preset];预设 dark = :root → [data-theme=dark] → [data-preset][data-theme=dark]。
// 零依赖,node scripts/convert-tokens.mjs,断言失败非零退出。

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const SRC = path.join(REPO, 'temp', 'Snow-App-Design-System', 'tokens.css');
const OUT = path.resolve(HERE, '..', 'output', 'penpot-tokens');

const PRESETS = [
  'snow', 'midnight-blue', 'forest-green', 'rose-pink', 'solarized', 'nord',
  'dracula', 'tokyo-night', 'github', 'google', 'gruvbox', 'cream',
];
const MODES = ['light', 'dark'];

// ---------- 分类 ----------
const SHADOW_VARS = new Set(['--island-shadow', '--island-shadow-soft', '--focus-ring']);
const RADIUS_VARS = new Set(['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl']);
const SPACING_VARS = new Set(['--gap-island']);
// 无 Penpot 对应类型(响应式 / 动画 / backdrop-filter),不迁移
const WEB_ONLY = new Set(['--content-max', '--tap-target', '--transition-fast', '--blur-popover']);

const failures = [];
function assert(cond, msg) {
  if (!cond) failures.push(msg);
  return !!cond;
}

// ---------- 值转换 ----------
function parseColor(raw) {
  const s = raw.trim();
  if (s.startsWith('#')) {
    if (s.length === 4) return ('#' + [...s.slice(1)].map((c) => c + c).join('')).toUpperCase();
    if (s.length === 7 || s.length === 9) return s.toUpperCase();
    throw new Error(`bad hex: ${s}`);
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) throw new Error(`bad color: ${s}`);
  const parts = m[1].split(',').map((x) => x.trim());
  const [r, g, b] = parts.slice(0, 3).map(Number);
  const a = parts[3] !== undefined ? Number(parts[3]) : 1;
  const hex2 = (num) => Math.round(Math.min(255, Math.max(0, num))).toString(16).padStart(2, '0');
  return ('#' + hex2(r) + hex2(g) + hex2(b) + (a < 1 ? hex2(a * 255) : '')).toUpperCase();
}

function parseShadow(raw) {
  // 顶层逗号拆层(rgba 内逗号不拆)
  const layers = [];
  let depth = 0, cur = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { layers.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) layers.push(cur);
  return layers.map((layer) => {
    let inset = false;
    let rest = layer.trim();
    if (/^inset\b/i.test(rest)) { inset = true; rest = rest.replace(/^inset\s+/i, ''); }
    const m = rest.match(
      /^([-\d.]+)(px)?\s+([-\d.]+)(px)?\s+([-\d.]+)(px)?(?:\s+([-\d.]+)(px)?)?\s+(.+)$/
    );
    if (!m) throw new Error(`bad shadow layer: ${layer.trim()}`);
    const px = (num, unit) => (unit ? num + unit : num + 'px');
    const out = { offsetX: px(m[1], m[2]), offsetY: px(m[3], m[4]), blur: px(m[5], m[6]) };
    if (m[7] !== undefined) out.spread = px(m[7], m[8]);
    out.color = parseColor(m[9]);
    if (inset) out.inset = true;
    return out;
  });
}

function classify(varName, value) {
  // focus-ring 在基线是完整 box-shadow,在预设块是裸颜色(源数据的类型混用),按值判定
  if (SHADOW_VARS.has(varName) && /^([-\d.]|inset\b)/i.test(value.trim())) return 'shadow';
  if (RADIUS_VARS.has(varName)) return 'borderRadius';
  if (SPACING_VARS.has(varName)) return 'spacing';
  return 'color';
}

// Penpot 令牌名是路径语义:叶子 "surface" 与子级 "surface.solid" 不能共存。
// 对会形成"叶+子"冲突的 css var 挂 .base 后缀,其余保持 -→. 机械转换
const NAME_OVERRIDES = {
  '--surface': 'surface.base',
  '--accent': 'accent.base',
  '--border': 'border.base',
  '--island-shadow': 'island.shadow.base',
};
const tokenName = (varName) => NAME_OVERRIDES[varName] ?? varName.slice(2).replace(/-/g, '.');

function toToken(varName, value) {
  const name = tokenName(varName);
  const type = classify(varName, value);
  if (type === 'shadow') {
    // Penpot addToken 要求每层 spread 必填(DTCG 里本可省略),统一补 "0px"
    const layers = parseShadow(value).map((l) => ({ spread: '0px', ...l }));
    return { name, type, value: layers };
  }
  if (type === 'borderRadius' || type === 'spacing') return { name, type, value };
  return { name, type, value: parseColor(value) };
}

// ---------- CSS 解析 ----------
function parseBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const open = text.indexOf('{', i);
    if (open === -1) break;
    const selector = text.slice(i, open).trim();
    if (selector.startsWith('@media')) {
      let depth = 1, j = open + 1;
      while (j < n && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      i = j; // 整个 @media 块跳过(响应式令牌不迁移)
      continue;
    }
    const close = text.indexOf('}', open);
    if (close === -1) break;
    const decls = {};
    for (const raw of text.slice(open + 1, close).split(';')) {
      const s = raw.trim();
      if (!s) continue;
      const c = s.indexOf(':');
      if (c === -1) continue;
      const prop = s.slice(0, c).trim();
      if (!prop.startsWith('--')) continue;
      decls[prop] = s.slice(c + 1).trim().replace(/\s+/g, ' ');
    }
    blocks.push({ selector, decls });
    i = close + 1;
  }
  return blocks;
}

// ---------- 主流程 ----------
const css = readFileSync(SRC, 'utf8');
const blocks = parseBlocks(css);

const rootLight = blocks.find((b) => b.selector === ':root');
const rootDark = blocks.find((b) => b.selector === '[data-theme="dark"]');
assert(rootLight && Object.keys(rootLight.decls).length > 20, '首个 :root 亮色基线未找到');
assert(rootLight.decls['--bg-base'] === '#eef2f7', '首个 :root 不是令牌基线块(误取响应式块?)');
assert(rootLight.decls['--content-max'] === undefined, '首个 :root 混入了响应式令牌');
assert(!!rootDark, '[data-theme="dark"] 基线块未找到');

const presetLight = new Map();
const presetDark = new Map();
for (const b of blocks) {
  let m = b.selector.match(/^\[data-preset="([^"]+)"\]$/);
  if (m) { presetLight.set(m[1], b.decls); continue; }
  m = b.selector.match(/^\[data-preset="([^"]+)"\]\[data-theme="dark"\]$/);
  if (m) presetDark.set(m[1], b.decls);
}
const presetIds = PRESETS.filter((p) => p !== 'snow');
assert(presetLight.size === 11 && presetDark.size === 11,
  `预设块数量不符:light=${presetLight.size} dark=${presetDark.size}(应为 11/11)`);
for (const id of presetIds) {
  assert(presetLight.has(id) && presetDark.has(id), `预设 ${id} 缺块`);
}

function resolve(preset, mode) {
  const out = {};
  const apply = (decls) => {
    for (const [k, v] of Object.entries(decls)) if (!WEB_ONLY.has(k)) out[k] = v;
  };
  apply(rootLight.decls);
  if (mode === 'dark') apply(rootDark.decls);
  if (preset !== 'snow') apply(mode === 'dark' ? presetDark.get(preset) : presetLight.get(preset));
  return out;
}

const combos = {};
for (const preset of PRESETS) for (const mode of MODES) combos[`${preset}/${mode}`] = resolve(preset, mode);

const allVars = [...new Set(Object.values(combos).flatMap((c) => Object.keys(c)))].sort();
const nameMapping = Object.fromEntries(allVars.map((v) => [v, tokenName(v)]));
const tokenOf = Object.fromEntries(allVars.map((v) => {
  const rep = combos['snow/light'][v] ?? combos['snow/dark'][v];
  return [v, classify(v, rep)];
}));
assert(WEB_ONLY.size === 4, 'WEB_ONLY 应为 4 项');
assert(allVars.every((v) => !WEB_ONLY.has(v)), 'web-only 令牌混进了 resolved 表');

// ---------- 抽查断言(值从 tokens.css 人工核对硬编码) ----------
const SPOTS = {
  'snow/light': { '--bg-base': '#eef2f7', '--surface': 'rgba(255, 255, 255, 0.78)', '--radius-xl': '16px', '--text-muted': '#6b7280', '--accent': '#111827' },
  'snow/dark': { '--bg-base': '#050505', '--surface': '#0a0a0a', '--surface-2': '#111111', '--accent': '#58a6ff' },
  'dracula/light': { '--bg-base': '#ebe3f5', '--surface': '#f8f5ff', '--surface-2': '#ede8f5', '--semantic-info-bg': '#ede9fe', '--accent': '#111827' },
  'dracula/dark': { '--surface': '#282a36', '--text-primary': '#f8f8f2', '--semantic-success-fg': '#50fa7b', '--accent': '#58a6ff' },
  'github/light': { '--bg-base': '#f0f3f6', '--text-primary': '#1f2328', '--border': '#d0d7de', '--surface': 'rgba(255, 255, 255, 0.78)', '--semantic-success-bg': '#dafbe1' },
  'github/dark': { '--bg-base': '#0a0e14', '--surface': '#0d1117', '--border': '#30363d', '--semantic-info-fg': '#79c0ff', '--text-faint': '#6e7681' },
  'google/light': { '--accent': '#0b57d0', '--bg-base': '#f1f3f4', '--surface-hover': '#f1f3f4', '--semantic-success-fg': '#137333' },
  'google/dark': { '--accent': '#a8c7fa', '--surface': '#202124', '--text-primary': '#e8eaed', '--border-strong': '#5f6368' },
  'midnight-blue/dark': { '--bg-base': '#020617', '--border': '#334155', '--text-muted': '#94a3b8', '--focus-ring': 'rgba(148, 163, 184, 0.14)', '--selection-bg': 'rgba(59, 130, 246, 0.3)' },
  'solarized/light': { '--bg-base': '#f5edd6', '--text-primary': '#586e75', '--border': '#ddd6c1', '--semantic-success-fg': '#586e75', '--accent-contrast': '#fdf6e3' },
  'forest-green/light': { '--bg-base': '#e8f0e8', '--semantic-info-fg': '#115e59', '--surface-3': '#dce8dc', '--semantic-success-fg': '#14532d' },
  'rose-pink/light': { '--bg-base': '#fbe7ef', '--semantic-danger-fg': '#9d174d', '--surface': '#fdf2f8', '--semantic-info-fg': '#86198f' },
  'tokyo-night/dark': { '--bg-base': '#16161e', '--text-primary': '#c0caf5', '--semantic-info-fg': '#7aa2f7', '--surface-2': '#24283b' },
  'nord/dark': { '--bg-base': '#242a33', '--surface': '#2e3440', '--text-primary': '#eceff4', '--semantic-success-fg': '#a3be8c' },
  'gruvbox/dark': { '--bg-base': '#1e1e1e', '--text-primary': '#ebdbb2', '--border': '#504945', '--semantic-danger-fg': '#fb4934' },
  'cream/light': { '--accent': '#d97757', '--bg-base': '#e8e6dc', '--surface': '#faf9f5', '--semantic-danger-fg': '#8b3e31' },
  'cream/dark': { '--accent': '#d97757', '--surface': '#141413', '--semantic-danger-fg': '#f0b1a0', '--selection-bg': 'rgba(106, 155, 204, 0.3)' },
};
for (const [combo, spots] of Object.entries(SPOTS)) {
  for (const [k, v] of Object.entries(spots)) {
    assert(combos[combo] && combos[combo][k] === v, `${combo} ${k}: 期望 ${v}, 实得 ${combos[combo] ? combos[combo][k] : '<组合缺失>'}`);
  }
}

// 缺失令牌语义:snow 基线下 surface-active/chrome、selection-bg 两种模式都未定义;
// surface-2/3 仅暗色基线定义(亮色无)
const absentBoth = ['--surface-active', '--surface-chrome', '--selection-bg'];
for (const v of absentBoth) {
  assert(combos['snow/light'][v] === undefined, `snow/light 不应定义 ${v}`);
  assert(combos['snow/dark'][v] === undefined, `snow/dark 不应定义 ${v}`);
}
assert(combos['snow/light']['--surface-2'] === undefined, 'snow/light 不应定义 --surface-2');
assert(combos['snow/light']['--surface-3'] === undefined, 'snow/light 不应定义 --surface-3');
assert(combos['snow/dark']['--surface-2'] === '#111111', 'snow/dark --surface-2 应为 #111111');
assert(combos['snow/dark']['--surface-3'] === '#1a1a1a', 'snow/dark --surface-3 应为 #1a1a1a');

// 核心令牌 28 项在 24 组合中全部存在
const CORE = ['--bg-base', '--surface', '--surface-solid', '--surface-hover',
  '--text-primary', '--text-secondary', '--text-muted', '--text-faint',
  '--accent', '--accent-contrast', '--border', '--border-strong',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl',
  '--semantic-success-bg', '--semantic-success-fg', '--semantic-danger-bg', '--semantic-danger-fg',
  '--semantic-info-bg', '--semantic-info-fg', '--semantic-warning-bg', '--semantic-warning-fg',
  '--island-shadow', '--island-shadow-soft', '--focus-ring', '--gap-island'];
assert(CORE.length === 28, 'CORE 清单应为 28 项');
for (const [combo, table] of Object.entries(combos)) {
  for (const v of CORE) assert(table[v] !== undefined, `${combo} 缺核心令牌 ${v}`);
  assert(Object.keys(table).length >= 28 && Object.keys(table).length <= 60, `${combo} 令牌数异常: ${Object.keys(table).length}`);
}

// shadow 解析抽查
assert(JSON.stringify(toToken('--focus-ring', '0 0 0 3px rgba(17, 24, 39, 0.06)').value)
  === JSON.stringify([{ spread: '3px', offsetX: '0px', offsetY: '0px', blur: '0px', color: '#1118270F' }]),
  'focus-ring shadow 解析不符');
assert(JSON.stringify(toToken('--island-shadow', '0 14px 34px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.72)').value)
  === JSON.stringify([
    { spread: '0px', offsetX: '0px', offsetY: '14px', blur: '34px', color: '#0F172A0F' },
    { spread: '0px', offsetX: '0px', offsetY: '1px', blur: '0px', color: '#FFFFFFB8', inset: true },
  ]),
  'island-shadow 双层解析不符');

// ---------- 产物 ----------
const comboTokens = {};
for (const [combo, table] of Object.entries(combos)) {
  comboTokens[combo] = Object.fromEntries(Object.entries(table).map(([v, val]) => {
    const t = toToken(v, val);
    return [t.name, { $type: t.type, $value: t.value }];
  }));
}

function writeSet(file, table) {
  writeFileSync(file, JSON.stringify(table, null, 2) + '\n');
}
function writeJson(file, obj) {
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(path.join(OUT, 'cascade'), { recursive: true });
mkdirSync(path.join(OUT, 'sets-baseline-overrides', 'preset-light'), { recursive: true });
mkdirSync(path.join(OUT, 'sets-baseline-overrides', 'preset-dark'), { recursive: true });
mkdirSync(path.join(OUT, 'sets-flat-24'), { recursive: true });

// cascade/resolved.json(ground truth,css var 键 + 原始 CSS 值)
writeJson(path.join(OUT, 'cascade', 'resolved.json'), {
  source: 'temp/Snow-App-Design-System/tokens.css',
  note: '值为规范化空白后的原始 CSS 值;颜色转换(#RRGGBBAA)只发生在 token 产物中',
  webOnlyExcluded: [...WEB_ONLY],
  nameMapping,
  combos,
});

// 布局 A:baseline + overrides
const setsA = path.join(OUT, 'sets-baseline-overrides');
writeSet(path.join(setsA, 'light.json'), comboTokens['snow/light']);
writeSet(path.join(setsA, 'dark.json'), comboTokens['snow/dark']);
for (const id of presetIds) {
  writeSet(path.join(setsA, 'preset-light', `${id}.json`), comboTokens[`${id}/light`]
    ? Object.fromEntries(Object.entries(presetLight.get(id)).filter(([k]) => !WEB_ONLY.has(k)).map(([v, val]) => {
        const t = toToken(v, val); return [t.name, { $type: t.type, $value: t.value }];
      }))
    : {});
  writeSet(path.join(setsA, 'preset-dark', `${id}.json`), Object.fromEntries(Object.entries(presetDark.get(id)).filter(([k]) => !WEB_ONLY.has(k)).map(([v, val]) => {
    const t = toToken(v, val); return [t.name, { $type: t.type, $value: t.value }];
  })));
}
const setOrderA = ['light', 'dark',
  ...presetIds.flatMap((id) => [`preset-light/${id}`, `preset-dark/${id}`])];
writeJson(path.join(setsA, '$metadata.json'), {
  tokenSetOrder: setOrderA,
  note: '预设覆盖集排在基线之后:假设 Penpot 后激活/靠后 set 覆盖靠前 set,P1 导入后实测验证',
});
writeJson(path.join(setsA, '$themes.json'), [
  { id: 'mode.light', name: 'light', group: 'Mode', selectedTokenSets: { light: 'enabled' } },
  { id: 'mode.dark', name: 'dark', group: 'Mode', selectedTokenSets: { dark: 'enabled' } },
  { id: 'preset.snow', name: 'snow', group: 'Preset', selectedTokenSets: {} },
  ...presetIds.map((id) => ({
    id: `preset.${id}`,
    name: id,
    group: 'Preset',
    selectedTokenSets: { [`preset-light/${id}`]: 'enabled', [`preset-dark/${id}`]: 'enabled' },
  })),
]);

// 布局 B:flat 24
const setsB = path.join(OUT, 'sets-flat-24');
const setOrderB = [];
for (const preset of PRESETS) for (const mode of MODES) {
  const setName = `${preset}-${mode}`;
  setOrderB.push(setName);
  writeSet(path.join(setsB, `${setName}.json`), comboTokens[`${preset}/${mode}`]);
}
writeJson(path.join(setsB, '$metadata.json'), {
  tokenSetOrder: setOrderB,
  note: '单 group Theme,24 主题互斥激活;每 set 即该组合全量 resolved 值',
});
writeJson(path.join(setsB, '$themes.json'), PRESETS.flatMap((preset) => MODES.map((mode) => ({
  id: `theme.${preset}.${mode}`,
  name: `${preset} / ${mode}`,
  group: 'Theme',
  selectedTokenSets: { [`${preset}-${mode}`]: 'enabled' },
}))));

// ---------- report ----------
const counts = Object.fromEntries(Object.entries(combos).map(([c, t]) => [c, Object.keys(t).length]));
const lines = [];
lines.push('# 转换报告(convert-tokens.mjs)');
lines.push('');
lines.push(`- 输入: temp/Snow-App-Design-System/tokens.css`);
lines.push(`- 组合数: ${Object.keys(combos).length}(12 preset × 2 mode)`);
lines.push(`- 联合令牌数(去除 web-only): ${allVars.length}`);
lines.push(`- web-only 排除: ${[...WEB_ONLY].join(', ')}(content-max/tap-target 响应式、transition-fast 动画、blur-popover backdrop-filter,Penpot 无对应类型)`);
lines.push(`- 断言: ${failures.length === 0 ? '✅ 全部通过' : '❌ 失败 ' + failures.length + ' 项'}`);
lines.push('');
lines.push('## 类型映射');
lines.push('');
lines.push('- color: 全部语义颜色(含 --selection-bg 等)');
lines.push('- borderRadius: --radius-sm/md/lg/xl → radius.sm/md/lg/xl');
lines.push('- spacing: --gap-island → gap.island(基线 10px;响应式覆盖不迁移)');
lines.push('- shadow: --island-shadow / --island-shadow-soft / --focus-ring(基线)→ DTCG 多层 shadow(inset 拆层,rgba→#RRGGBBAA)');
lines.push('- ⚠ focus-ring 类型混用(源数据坑):基线值是完整 box-shadow,11 个预设块只给了裸 rgba 颜色(按 var(--focus-ring) 整体作 box-shadow 消费时,预设下实际是无效 CSS)。按值分类:基线→shadow 令牌,预设覆盖→color 令牌,如实迁移');
lines.push('');
lines.push('## 每组合令牌数');
lines.push('');
lines.push('| 组合 | 令牌数 |');
lines.push('|---|---|');
for (const [c, n] of Object.entries(counts)) lines.push(`| ${c} | ${n} |`);
lines.push('');
lines.push('## 命名映射(css var → Penpot token 名,`-`→`.` 机械转换)');
lines.push('');
lines.push('例外(Penpot 名为路径语义,叶名与子路径不能共存,叶子挂 `.base`):--surface→surface.base、--accent→accent.base、--border→border.base、--island-shadow→island.shadow.base;shadow 每层补必填 `spread:"0px"`');
lines.push('');
lines.push('| css var | token 名 | 类型 |');
lines.push('|---|---|---|');
for (const v of allVars) lines.push(`| ${v} | ${nameMapping[v]} | ${tokenOf[v]} |`);
lines.push('');
lines.push('## 产物布局');
lines.push('');
lines.push('- `cascade/resolved.json` — 24 组合 resolved 表(原始 CSS 值)+ 命名映射,导入后核对用');
lines.push('- `sets-baseline-overrides/` — D1 推荐建模:light/dark 全量基线 + preset-light/·preset-dark/ 覆盖集 + $themes(Mode×Preset 双组)+ $metadata.tokenSetOrder(覆盖集在后)');
lines.push('- `sets-flat-24/` — D1 备选建模:24 个全量扁平 set + $themes(单 Theme 组 24 项)');
lines.push('- 布局 A 的风险:同一 Preset 主题会同时激活其 light/dark 两个覆盖集,与 Mode 主题组合时可能互相污染 → P1 导入实测,若污染则改用布局 B');
lines.push('');
if (failures.length) {
  lines.push('## 失败断言');
  lines.push('');
  for (const f of failures) lines.push(`- ${f}`);
  lines.push('');
}
writeFileSync(path.join(OUT, 'report.md'), lines.join('\n'));

console.log(`combos=${Object.keys(combos).length} tokens(union)=${allVars.length} assertions=${failures.length === 0 ? 'PASS' : 'FAIL(' + failures.length + ')'}`);
for (const f of failures) console.error('  ✗ ' + f);
if (failures.length) process.exit(1);
