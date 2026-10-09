/* Fonte única do CSS do app para os testes.
   style/styles.css foi dividido preservando a ordem byte a byte:
   themes → base → components → layout → features → dashboard-chat.
   readAppCss(ROOT) concatena os cinco arquivos splitados na mesma
   ordem de carga do index.html, então qualquer asserção de padrão
   no CSS continua válida independentemente do arquivo que o contém. */
import fs from "node:fs";
import path from "node:path";

export const CSS_FILES = [
  "base.css",
  "components.css",
  "layout.css",
  "features.css",
  "dashboard-chat.css"
];

export function readAppCss(root) {
  return CSS_FILES.map((file) =>
    fs.readFileSync(path.join(root, "style", file), "utf8")
  ).join("\n");
}
