// Tras «next build»: apunta qué archivos del código son el motor de PDF (react-pdf), para que la app
// los pueda descargar por detrás SIN ejecutarlos (ejecutarlos congela el móvil ~0,5 s). Escribe out/pdf-chunks.json
import fs from "node:fs";
import path from "node:path";
const dir = "out/_next/static/chunks";
if (!fs.existsSync(dir)) process.exit(0);
const lista = fs.readdirSync(dir).filter((f) => f.endsWith(".js") && /@react-pdf|react-pdf/.test(fs.readFileSync(path.join(dir, f), "utf8")))
  .map((f) => `_next/static/chunks/${f}`);
fs.writeFileSync("out/pdf-chunks.json", JSON.stringify(lista));
console.log("Motor de PDF:", lista.join(", ") || "(no encontrado)");
