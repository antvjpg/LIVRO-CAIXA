"""F7 — validacao apos correcao dos dois itens BLOCKED.

Evidencia: tmp-c13/f7-validacao-resultados.json
"""
import glob
import hashlib
import json
import os
import re
import subprocess
import urllib.parse
from collections import Counter
from datetime import datetime, timezone

ROOT = os.getcwd()
inv = json.load(open('tmp-c13/f0-inventario-baseline.json', encoding='utf-8'))
checks = []


def add(name, ok, detail, status_fail='FAIL'):
    checks.append({'name': name, 'status': 'PASS' if ok else status_fail, 'detail': detail})


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def git(*args):
    return subprocess.run(['git', *args], capture_output=True, text=True).stdout.strip()


head = git('rev-parse', 'HEAD')
branch = git('branch', '--show-current')
add('HEAD inalterado', head == '23444f0a62f5e5c2b45eed0905442a6e6069ca44', head)
upstream_sha = git('rev-parse', '@{upstream}')
add('Branch alinhada ao remoto', branch == 'feat/app-layout-redesign' and upstream_sha == head,
    f'{branch} local {head[:8]} == upstream {upstream_sha[:8]}')
add('Sem commits locais alem do remoto', git('rev-list', '--count', '@{upstream}..HEAD') == '0', '0 commits')
dc = subprocess.run(['git', 'diff', '--check'], capture_output=True, text=True)
add('git diff --check', dc.returncode == 0 and not dc.stdout.strip(), 'limpo')

movidos = {
 'docs/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md':'docs/auditorias/autenticacao/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md',
 'docs/AUDITORIA-GROQ-EXCLUSIVA.md':'docs/auditorias/ia/AUDITORIA-GROQ-EXCLUSIVA.md',
 'docs/AUDITORIA-IA-RESUMO.md':'docs/arquitetura/ia/AUDITORIA-IA-RESUMO.md',
 'docs/AUDITORIA-VISUAL-MODAIS.md':'docs/auditorias/visual/AUDITORIA-VISUAL-MODAIS.md',
 'docs/AUTHOVERLAY-EVOLUCAO-VISUAL.md':'docs/design-system/auth-overlay/AUTHOVERLAY-EVOLUCAO-VISUAL.md',
 'docs/COBERTURA-FLUXOS-FINANCEIROS.md':'docs/referencias/financeiro/COBERTURA-FLUXOS-FINANCEIROS.md',
 'docs/CORRECOES-GROQ-EXCLUSIVO.md':'docs/implementacoes/ia/CORRECOES-GROQ-EXCLUSIVO.md',
 'docs/DOCUMENTACAO_VARIAVEIS_CSS.md':'docs/design-system/DOCUMENTACAO_VARIAVEIS_CSS.md',
 'docs/NOTION_PHASE_B_CONTENT.md':'docs/implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md',
 'docs/OPENGOALS_PANEL_FIX_SUMMARY.md':'docs/implementacoes/correcoes/OPENGOALS_PANEL_FIX_SUMMARY.md',
 'docs/REFATORACAO-AUTENTICACAO-RELATORIO.md':'docs/implementacoes/autenticacao/REFATORACAO-AUTENTICACAO-RELATORIO.md',
}
c4_alterados = {
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/INDICE-EVIDENCIAS-R2-5-7.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/RELATORIO-FINAL-R2-5-7.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-integrity.json',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-5/INDICE-EVIDENCIAS-R2-5-5.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-6/INDICE-EVIDENCIAS-R2-5-6.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-5/c4-v05-b-r2-5-5-integrity.json',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-integrity.json',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-integrity.json',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-integrity.json',
}
esperados = set(movidos.values()) | c4_alterados
ausentes, inesperados, nao_alterados = [], [], []
for f in inv['arquivos']:
    antigo = f['path']
    atual = movidos.get(antigo, antigo)
    if not os.path.exists(atual):
        ausentes.append(antigo); continue
    igual = sha(atual) == f['sha256']
    if not igual and atual not in esperados:
        inesperados.append(atual)
    if igual and atual in esperados:
        nao_alterados.append(atual)
add('Baseline sem arquivos ausentes', not ausentes, str(ausentes[:4]))
add('Nenhuma alteracao fora do escopo', not inesperados, str(inesperados[:4]))
add('Todas as alteracoes esperadas presentes', not nao_alterados, str(nao_alterados[:4]))
add('Contagem de docs/', sum(len(fs) for _, _, fs in os.walk('docs')) == 156, '156 = 155 baseline + README')

padrao_link = re.compile(r'\[[^\]]*\]\(([^)]+)\)')
quebrados = []
verificados = 0
for dp, _, fs in os.walk('docs'):
    for fn in fs:
        if not fn.endswith('.md'):
            continue
        p = os.path.join(dp, fn).replace(os.sep, '/')
        for i, l in enumerate(open(p, encoding='utf-8', errors='replace'), 1):
            for m in padrao_link.finditer(l):
                alvo = urllib.parse.unquote(m.group(1).split('#')[0].split('?')[0].strip())
                if not alvo or alvo.startswith(('http://', 'https://', 'mailto:', 'data:')):
                    continue
                verificados += 1
                cand = [alvo] if alvo.startswith('docs/') else [os.path.join(dp, alvo).replace(os.sep, '/'), alvo]
                if not any(os.path.exists(c) for c in cand):
                    quebrados.append(f'{p}:{i} -> {alvo}')
add('Links Markdown (inclusive C.4)', not quebrados, f'{verificados} verificados; {len(quebrados)} quebrados: {quebrados[:5]}')

manifestos = sorted(glob.glob('docs/auditorias/c4-v05-b/**/*integrity.json', recursive=True))
declarados = conferidos = divergentes = 0
div = []
for mp in manifestos:
    d = json.load(open(mp, encoding='utf-8'))
    mdir = os.path.dirname(mp)
    for a in d.get('artifacts', []):
        declarados += 1
        arquivo = next((c for c in (os.path.join(mdir, a['path']), a['path']) if os.path.exists(c)), None)
        if arquivo is None:
            divergentes += 1
            div.append(f'{a["path"]}:AUSENTE')
            continue
        raw = open(arquivo, 'rb').read()
        if hashlib.sha256(raw).hexdigest() == a['sha256'] and len(raw) == a['sizeBytes'] and raw.count(b'\n') == a['lines']:
            conferidos += 1
        else:
            divergentes += 1
            div.append(f'{a["path"]}@{os.path.basename(mp)}')
add('Manifestos C.4 (74/74)', divergentes == 0,
    f'{len(manifestos)} manifestos, {declarados} artefatos, {conferidos} conferidos, {divergentes} divergentes: {div[:5]}')

base = 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/'
t = json.load(open(base + 'c4-v05-b-r2-5-7-test-results.json', encoding='utf-8'))
ids = Counter(x['id'] for x in t['tests'])
pares = Counter((x['id'], x['name']) for x in t['tests'])
add('R2.5.7 contagens preservadas', len(t['tests']) == 393 and len(ids) == 134 and len(pares) == 393,
    f'{len(t["tests"])} registros / {len(ids)} IDs / {len(pares)} chaves')
add('V32 unico BLOCKED', sum(1 for x in t['tests'] if x['status'] == 'BLOCKED') == 1, 'preservado')

out = {
 'executado_em_utc': datetime.now(timezone.utc).isoformat(),
 'branch': branch,
 'head': head,
 'total': len(checks),
 'pass': sum(c['status'] == 'PASS' for c in checks),
 'fail': sum(c['status'] == 'FAIL' for c in checks),
 'blocked': sum(c['status'] == 'BLOCKED' for c in checks),
 'checks': checks,
}
json.dump(out, open('tmp-c13/f7-validacao-resultados.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
for c in checks:
    print(f'[{c["status"]}] {c["name"]}: {c["detail"][:150]}')
print(f'\nTOTAL: {out["pass"]} PASS / {out["fail"]} FAIL / {out["blocked"]} BLOCKED')
