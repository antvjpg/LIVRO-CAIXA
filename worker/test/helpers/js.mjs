/* Fonte única do JS do app para os testes.
   app.js foi dividido em js/ por responsabilidade preservando a ordem
   de execução: bootstrap top-level → arquivos de responsabilidade →
   dispatcher DOMContentLoaded. readAppJs(ROOT) concatena os arquivos
   na mesma ordem de carga do index.html, então qualquer asserção de
   padrão no JS continua válida independentemente do arquivo que o
   contém. */
import fs from "node:fs";
import path from "node:path";

export const JS_FILES = [
  "00-bootstrap.js",
  "10-state-utils.js",
  "11-financial-domain.js",
  "12-auth-session.js",
  "13-backup.js",
  "14-theme.js",
  "15-tabs-nav.js",
  "16-events-modals.js",
  "17-sync-persistence.js",
  "18-render-core.js",
  "19-goals.js",
  "20-dashboard.js",
  "21-ai-features.js",
  "22-profile.js",
  "23-ai-chat.js",
  "24-automation-render.js",
  "25-bills-receivables.js",
  "26-receipts.js",
  "27-cards.js",
  "28-ocr-lia.js",
  "29-invest-movements.js",
  "30-transfer-receipts.js",
  "31-import-export.js",
  "32-auth-wiring.js",
  "99-init.js"
];

export function readAppJs(root) {
  return JS_FILES.map((file) =>
    fs.readFileSync(path.join(root, "js", file), "utf8")
  ).join("\n");
}
