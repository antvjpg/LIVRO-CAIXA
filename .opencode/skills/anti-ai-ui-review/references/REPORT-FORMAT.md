# Formato de relatório — v1.1.1

## JSON

O comando `--json` produz:

```json
{
  "version": "1.1.1",
  "mode": "detect",
  "scopeFilter": null,
  "view": null,
  "summary": {
    "files": 0,
    "findings": 0,
    "bySeverity": { "P0": 0, "P1": 0, "P2": 0, "INFO": 0 },
    "byStatus": {
      "confirmed": 0,
      "candidate": 0,
      "inconclusive": 0,
      "false_positive": 0,
      "unsupported": 0
    }
  },
  "findings": [],
  "limitations": []
}
```

Cada finding contém:

- `id`;
- `rule`;
- `description`;
- `category`;
- `file`;
- `line`;
- `selector`;
- `snippet`;
- `scope`;
- `severity`;
- `confidence`;
- `status`;
- `evidence`;
- `impact`;
- `limitations`;
- `recommendation`;
- `validation`.

## Markdown

A saída textual usa os mesmos dados e agrupa por `status`:

1. `confirmed`
2. `candidate`
3. `inconclusive`
4. `false_positive`
5. `unsupported`

O resumo apresenta severidade e status separadamente. A soma total de findings não é apresentada como quantidade de defeitos.

## Exemplo de ocorrência

```text
P2 CSS-MOTION-001 style/base.css:163 transition: all
  status=candidate confidence=high scope=global
  selector=.nav-tab snippet="transition: all 0.15s ease"
  evidence=Static source declaration found.
  validate=Verificar estados reais e substituir por propriedades explícitas quando fizer sentido.
```

## Regras de consistência

- JSON e Markdown devem conter o mesmo número de findings.
- `severity`, `confidence` e `status` são independentes.
- `file:line` deve apontar para a linha real da declaração.
- Achados `false_positive` devem explicar o contexto.
- Achados `unsupported` não devem ser contados como problemas.
- Limitações da auditoria devem ser explícitas.
