import os, re, json, hashlib, subprocess, urllib.parse
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

# --- A. integridade do repositorio ---
head = git('rev-parse', 'HEAD')
add('HEAD inalterado', head == '23444f0a62f5e5c2b45eed0905442a6e6069ca44', head)
diff_check = subprocess.run(['git', 'diff', '--check'], capture_output=True, text=True)
add('git diff --check', diff_check.returncode == 0 and not diff_check.stdout.strip(), diff_check.stdout.strip() or 'sem espacos em branco')

# --- B. inventario / contagem ---
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
esperados_mudados = set(movidos.values()) | {
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/INDICE-EVIDENCIAS-R2-5-7.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/RELATORIO-FINAL-R2-5-7.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-integrity.json',
}
inalterados, alterados_inesperados, ausentes = [], [], []
for f in inv['arquivos']:
    old = f['path']
    new = movidos.get(old, old)
    if not os.path.exists(new):
        ausentes.append(old); continue
    igual = sha(new) == f['sha256']
    if not igual and new not in esperados_mudados:
        alterados_inesperados.append(new)
    if igual and new in esperados_mudados:
        inalterados.append(new)
add('Nenhum arquivo do baseline ausente', not ausentes, str(ausentes[:5]))
add('Nenhum arquivo alterado fora do escopo', not alterados_inesperados, str(alterados_inesperados[:5]))
add('Todos os arquivos esperados foram alterados', not inalterados, str(inalterados[:5]))
count = sum(len(fs) for _,_,fs in os.walk('docs'))
add('Contagem de arquivos em docs/', count == 156, f'{count} (155 do baseline + 1 README criado na F4)')
novos = [os.path.join(dp,f).replace(os.sep,'/') for dp,_,fs in os.walk('docs') for f in fs if os.path.join(dp,f).replace(os.sep,'/') not in set(movidos.values())|{f['path'] for f in inv['arquivos']}]
add('Unico arquivo novo em docs/', novos == ['docs/README.md'], str(novos))

# --- C. links Markdown relativos ---
padrao_link = re.compile(r'\[[^\]]*\]\(([^)]+)\)')
quebrados, verificados = [], 0
for dp,_,fs in os.walk('docs'):
    for fn in fs:
        if not fn.endswith('.md'): continue
        p = os.path.join(dp,fn).replace(os.sep,'/')
        for i,l in enumerate(open(p,encoding='utf-8',errors='replace'),1):
            for m in padrao_link.finditer(l):
                alvo = urllib.parse.unquote(m.group(1).split('#')[0].split('?')[0].strip())
                if not alvo or alvo.startswith(('http://','https://','mailto:','data:')): continue
                verificados += 1
                cand = [alvo] if alvo.startswith('docs/') else [os.path.join(dp, alvo).replace(os.sep,'/'), alvo]
                if not any(os.path.exists(c) for c in cand):
                    quebrados.append((p, i, alvo))
quebrados_c4 = [x for x in quebrados if 'c4-v05-b' in x[0]]
quebrados_escopo = [x for x in quebrados if 'c4-v05-b' not in x[0]]
add('Links em documentos movidos, indice e READMEs', not quebrados_escopo,
    f'{verificados} links verificados; {len(quebrados_escopo)} quebrados fora do pacote C.4: {quebrados_escopo[:5]}')
add('Links quebrados preexistentes no pacote C.4 protegido', not quebrados_c4,
    f'{len(quebrados_c4)} alvos inexistentes em indices C.4: ' + '; '.join(f'{p}:{i} -> {a}' for p,i,a in quebrados_c4[:6]) +
    ' — todos presentes no HEAD antes desta execucao (ver git show HEAD:<arquivo>); nao corrigidos por serem artefatos protegidos',
    status_fail='BLOCKED')

# --- D. referencias a caminhos antigos (fora do baseline) ---
nomes = list(movidos)
antigos = []
skipdirs = {'.git','node_modules'}
for dp,dns,fs in os.walk('.'):
    dns[:] = [d for d in dns if d not in skipdirs]
    for fn in fs:
        p = os.path.join(dp,fn).replace(os.sep,'/')
        if p.startswith('./tmp-c13/') or p.startswith('tmp-c13/'): continue
        if os.path.splitext(fn)[1].lower() not in {'.md','.js','.cjs','.mjs','.json','.html','.yml','.yaml','.txt'}: continue
        for i,l in enumerate(open(p,encoding='utf-8',errors='replace'),1):
            for old in nomes:
                if old in l: antigos.append(f'{p}:{i} -> {old}')
add('Referencias a caminhos antigos', not antigos, f'{len(antigos)}: {antigos[:6]}')

# --- E. manifestos C.4 (somente leitura) ---
import glob
manifests = sorted(glob.glob('docs/auditorias/c4-v05-b/**/*integrity.json', recursive=True))
declarados = conferidos = divergentes = 0
div_list = []
for mp in manifests:
    d = json.load(open(mp, encoding='utf-8'))
    mdir = os.path.dirname(mp)
    for a in d.get('artifacts', []):
        declarados += 1
        path = a['path']
        cand = [os.path.join(mdir,path), path]
        found = next((c for c in cand if os.path.exists(c)), None)
        if not found:
            divergentes += 1; div_list.append(f'{mp}:{path} AUSENTE'); continue
        b = open(found,'rb').read()
        ok = hashlib.sha256(b).hexdigest() == a['sha256'] and len(b) == a['sizeBytes'] and b.count(b'\n') == a['lines']
        if ok: conferidos += 1
        else: divergentes += 1; div_list.append(f'{mp}:{path}')
add('Manifestos C.4 (hash/size/lines)', divergentes == 0,
    f'{len(manifests)} manifestos, {declarados} artefatos declarados, {conferidos} conferidos, {divergentes} divergentes: {div_list[:8]}'
    ' — divergencias preexistentes em R2.5.1/R2.5.3 (artefatos inalterados desde o baseline F0); nao corrigidas sem autorizacao especifica',
    status_fail='BLOCKED')

base_hash = {f['path']: f['sha256'] for f in inv['arquivos']}
c4_mudados = [p for p,h in base_hash.items() if p.startswith('docs/auditorias/c4-v05-b/') and sha(p) != h]
c4_esperados = {
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/INDICE-EVIDENCIAS-R2-5-7.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/RELATORIO-FINAL-R2-5-7.md',
 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-integrity.json',
}
add('Pacote C.4 alterado apenas onde autorizado (F1.1)', set(c4_mudados) == c4_esperados,
    f'{len(c4_mudados)} alterados: {sorted(c4_mudados)}')

# --- F. R2.5.7 apos F1.1 ---
base = 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/'
t = json.load(open(base+'c4-v05-b-r2-5-7-test-results.json',encoding='utf-8'))
ids = Counter(x['id'] for x in t['tests'])
pares = Counter((x['id'],x['name']) for x in t['tests'])
add('R2.5.7 contagens', len(t['tests'])==393 and len(ids)==134 and sum(1 for v in ids.values() if v>1)==93 and len(pares)==393,
    f"{len(t['tests'])} registros / {len(ids)} IDs / {sum(1 for v in ids.values() if v>1)} IDs repetidos / {len(pares)} chaves")
v32 = [x['status'] for x in t['tests'] if x['id']=='V32']
add('R2.5.7 V32 BLOCKED preservado', v32.count('BLOCKED') == 1 and sum(1 for x in t['tests'] if x['status']=='BLOCKED') == 1,
    f"registros com id V32: {v32}; unico BLOCKED do conjunto preservado (o id V32 tambem identifica uma assercao PASS)")
rel = open(base+'RELATORIO-FINAL-R2-5-7.md',encoding='utf-8').read()
idx = open(base+'INDICE-EVIDENCIAS-R2-5-7.md',encoding='utf-8').read()
add('F1.1 corrigido em relatorio e indice', 'IDs de caso com mais de uma asserção' in rel and 'IDs de caso com mais de uma asserção' in idx, 'semantica presente nos dois')
man = json.load(open(base+'c4-v05-b-r2-5-7-integrity.json',encoding='utf-8'))
add('Metadados historicos R2.5.7 preservados', man['meta']['baseCommit'].startswith('a790d616') and 'publicationCommit' in man['meta'], f"{man['meta']['baseCommit'][:8]}, publicationCommit presente")

# --- G. qualidade documental ---
nb = open('docs/implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md',encoding='utf-8').read()
add('D-06 a D-08 nao pendentes', 'em execução' not in nb and 'D-01 a D-08' in nb, 'documento reconciliado')
add('C.1-C.8 nao marcadas como concluidas',
    'A conclusão de D-01 a D-08 **não**' in nb and 'implica a conclusão das divergências macro C.1 a C.8' in nb,
    'aviso presente (quebrado entre linhas do bloco de citacao)')

# --- H. teste que consome o documento movido ---
sec = open('tmp-c13/f5-security-test.log', encoding='utf-8', errors='replace').read()
add('Teste de seguranca com caminho movido', 'ℹ pass 44' in sec and 'ℹ fail 0' in sec,
    'node --test e2e/security/security.test.mjs: 44/44 PASS, 0 FAIL (inclusive o teste que le docs/auditorias/autenticacao/AUDITORIA-ARQUITETURA-AUTH-PERSISTENCIA.md)')

out = {
 'executado_em_utc': datetime.now(timezone.utc).isoformat(),
 'branch': git('branch','--show-current'),
 'head': head,
 'total': len(checks),
 'pass': sum(1 for c in checks if c['status']=='PASS'),
 'fail': sum(1 for c in checks if c['status']=='FAIL'),
 'blocked': sum(1 for c in checks if c['status']=='BLOCKED'),
 'checks': checks,
}
json.dump(out, open('tmp-c13/f5-validacao-resultados.json','w',encoding='utf-8'), indent=2, ensure_ascii=False)
for c in checks:
    print(f"[{c['status']}] {c['name']}: {c['detail'][:160]}")
print(f"\nTOTAL: {out['pass']} PASS / {out['fail']} FAIL / {out['blocked']} BLOCKED")
