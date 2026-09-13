import json, re

data = json.load(open('presets.json', encoding='utf-8'))
palettes, registry = data['palettes'], data['registry']
snowL = palettes['snowLight']
snowD = palettes['snowDark']

# ThemePalette field -> token name (None = skip)
FIELD_MAP = {
    'appBg': '--bg-base',
    'bgPrimary': '--surface',
    'bgSecondary': '--surface-2',
    'bgTertiary': '--surface-3',
    'bgHover': '--surface-hover',
    'bgActive': '--surface-active',
    'chromeBg': '--surface-chrome',
    'borderColor': '--border',
    'borderSubtle': '--border-strong',
    'textPrimary': '--text-primary',
    'textSecondary': '--text-secondary',
    'textTertiary': '--text-muted',
    'textMuted': '--text-faint',
    'onSolid': '--accent-contrast',
    'accentGreenBg': '--semantic-success-bg',
    'accentGreenText': '--semantic-success-fg',
    'accentRedBg': '--semantic-danger-bg',
    'accentRedText': '--semantic-danger-fg',
    'accentBlueBg': '--semantic-info-bg',
    'accentBlueText': '--semantic-info-fg',
    'selectionBg': '--selection-bg',
    'focusRing': '--focus-ring',
    'accentColor': '--accent',
}

CSS_VAR_RE = re.compile(r'^#[0-9a-fA-F]{3,8}$|^rgba\([^)]*\)$')

def emit_block(selector, base, pal, indent=''):
    lines = []
    for field, token in FIELD_MAP.items():
        val = pal.get(field)
        if val is None or val == '':
            continue
        if not CSS_VAR_RE.match(val):
            print(f'  !! skip non-color {field}={val!r}', file=sys.stderr)
            continue
        if base is not None and pal[field] == base.get(field):
            continue  # identical to snow baseline -> inherit
        lines.append(f'  {token}: {val};')
    if not lines:
        return None
    body = '\n'.join(lines)
    return f'{selector} {{\n{body}\n}}'

out = []
out.append('')
out.append('/* ============================================================')
out.append('   Theme presets — 12 palettes ported from snow-app')
out.append('   (src/renderer/components/sidebar/themeSettings/themePresets.ts).')
out.append('   Structure never changes, only the palette: set data-preset on the')
out.append('   document root, composable with data-theme="dark".')
out.append('   "snow" IS the default (:root / [data-theme="dark"]), so it has no block.')
out.append('   Only fields that differ from the snow baseline are emitted.')
out.append('   --semantic-warning-* stays with the snow defaults for all presets')
out.append('   (snow-app palettes define green/red/blue only).')
out.append('   ============================================================ */')

for pid, disp, light_id, dark_id in registry:
    if pid == 'snow':
        continue
    block_l = emit_block(f'[data-preset="{pid}"]', snowL, palettes[light_id])
    block_d = emit_block(f'[data-preset="{pid}"][data-theme="dark"]', snowD, palettes[dark_id])
    out.append('')
    out.append(f'/* --- {disp} --- */')
    out.append(block_l or f'[data-preset="{pid}"] {{ /* inherits snow light */ }}')
    if block_d:
        out.append(block_d)

preset_css = '\n'.join(out) + '\n'

DS = r'C:/Users/I/AppData/Roaming/Open Design/namespaces/release-stable-win/data/design-systems/snow-app'
tokens = open(f'{DS}/tokens.css', encoding='utf-8').read()
open(f'{DS}/tokens.css', 'w', encoding='utf-8', newline='\n').write(tokens.rstrip('\n') + '\n' + preset_css)
print('appended', len(preset_css.splitlines()), 'lines to tokens.css')
print('preset blocks written for:', [p[0] for p in registry if p[0] != 'snow'])
