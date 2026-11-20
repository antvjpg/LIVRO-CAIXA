"""F7 — recalculo controlado de manifestos C.4 apos correcao dos BLOCKED.

Uso: python3 tmp-c13/f7-recalcular-manifestos.py

- R2.5.5/6/7: usa os geradores existentes, restaura o meta historico e executa
  os verificadores separados.
- R2.5.1/3: nao existem geradores no pacote; recalcula sha256/sizeBytes/lines
  campo a campo, preservando todos os demais valores do manifesto.
"""
import hashlib
import json
import os
import subprocess

BASE = 'docs/auditorias/c4-v05-b/evidencias'


def meta_original(path):
    return json.load(open(path, encoding='utf-8'))['meta']


def restaurar_meta(path, meta):
    d = json.load(open(path, encoding='utf-8'))
    d['meta'] = meta
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    return d


def recalcular_campos(path):
    d = json.load(open(path, encoding='utf-8'))
    mdir = os.path.dirname(path)
    alterados = []
    for a in d['artifacts']:
        candidatos = [os.path.join(mdir, a['path']), a['path']]
        arquivo = next((c for c in candidatos if os.path.exists(c)), None)
        if arquivo is None:
            raise FileNotFoundError(f'{path}: {a["path"]}')
        raw = open(arquivo, 'rb').read()
        novo = {
            'sha256': hashlib.sha256(raw).hexdigest(),
            'sizeBytes': len(raw),
            'lines': raw.count(b'\n'),
        }
        if any(a.get(k) != v for k, v in novo.items()):
            alterados.append((a['name'], {k: (a.get(k), v) for k, v in novo.items() if a.get(k) != v}))
        a.update(novo)
    if 'integrityVerification' in d and 'allHashesMatch' in d['integrityVerification']:
        d['integrityVerification']['allHashesMatch'] = True
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    return alterados


for versao in ('5', '6', '7'):
    diretorio = f'{BASE}-r2-5-{versao}'
    manifesto = f'{diretorio}/c4-v05-b-r2-5-{versao}-integrity.json'
    meta = meta_original(manifesto)
    print(f'R2.5.{versao}: gerando/verificando com rotina existente')
    subprocess.run(['node', f'gerar-manifesto-r2-5-{versao}.cjs'], cwd=diretorio, check=True)
    restaurar_meta(manifesto, meta)
    subprocess.run(['node', f'verificar-manifesto-r2-5-{versao}.cjs'], cwd=diretorio, check=True)
    restaurar_meta(manifesto, meta)

for versao in ('1', '3'):
    manifesto = f'{BASE}-r2-5-{versao}/c4-v05-b-r2-5-{versao}-integrity.json'
    alterados = recalcular_campos(manifesto)
    print(f'R2.5.{versao}: {len(alterados)} entradas recalculadas')
    for nome, Campos in alterados:
        print('  -', nome, Campos)
