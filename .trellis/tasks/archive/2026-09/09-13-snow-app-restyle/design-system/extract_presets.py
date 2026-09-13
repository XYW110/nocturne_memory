import re, json, sys

s = open('themePresets.tmp.ts', encoding='utf-8').read()

palettes = {}
pat = re.compile(r'const (\w+): ThemePalette = \{(.*?)\n\};', re.S)
for m in pat.finditer(s):
    name, body = m.group(1), m.group(2)
    fields = {}
    for fm in re.finditer(r'(\w+)\s*:\s*"((?:[^"\\]|\\.)*)"', body):
        fields[fm.group(1)] = fm.group(2)
    palettes[name] = fields

registry = re.findall(
    r'id:\s*"([\w-]+)",\s*\n\s*nameKey:[^,]+,\s*\n\s*defaultName:\s*"([^"]+)",\s*\n\s*light:\s*(\w+),\s*\n\s*dark:\s*(\w+),',
    s)

print('palettes parsed:', len(palettes), '| registry entries:', len(registry))
for pid, disp, l, dk in registry:
    ok = l in palettes and dk in palettes
    print(f'{pid:14s} {disp:14s} light={l:18s} dark={dk:18s} {"OK" if ok else "MISSING"}')
    assert ok

json.dump({'palettes': palettes, 'registry': registry}, open('presets.json', 'w', encoding='utf-8'), indent=1)
print('saved presets.json')
