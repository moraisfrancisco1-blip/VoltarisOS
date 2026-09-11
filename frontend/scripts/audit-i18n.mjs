#!/usr/bin/env node
/**
 * VoltarisOS — i18n audit
 *
 * Scans the frontend source for likely hardcoded Portuguese (or otherwise
 * untranslated) user-facing strings. It reports any source line that:
 *   - contains Portuguese-specific accented characters, or
 *   - contains common Portuguese words (with word boundaries).
 *
 * The translation catalogue (src/i18n/translations.js) is intentionally
 * excluded, since it is where the Portuguese strings are supposed to live.
 *
 * Usage:  node scripts/audit-i18n.mjs   (or  npm run i18n:audit)
 * Exit code is non-zero when findings exist, so it can gate CI.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");
const EXCLUDE = [join(SRC, "i18n", "translations.js")];
const EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);

// Portuguese accented characters
const ACCENT = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/;

// Common Portuguese words. Kept conservative to avoid false positives on
// English words ("no", "a", "as", "e" are intentionally NOT included).
const PT_WORDS = [
  "não", "Nenhum", "Nenhuma", "Carregando", "Seleciona", "Selecione", "Escolhe",
  "Escolha", "Introduz", "Insere", "Preenche", "Guardar", "Cancelar", "Fechar",
  "Eliminar", "Apagar", "Criar", "Adicionar", "Voltar", "Entrar", "Sair",
  "Definições", "Utilizador", "Utilizadores", "Faturação", "Relatório",
  "Relatórios", "Previsão", "Manutenção", "Ativar", "Desativar", "Ativo",
  "Inativo", "Alterar", "Pesquisar", "Recarregar", "passo", "conta", "hoje",
  "Hoje", "Ontem", "Amanhã", "semana", "mês", "mês", "total", "Acesso",
  "Obrigatório", "obrigatório", "inválido", "erro", "Erro", "sucesso",
];

const wordRe = new RegExp(
  "\\b(" + PT_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b"
);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (EXCLUDE.includes(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(full))) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Skip comment-only lines (not user-facing)
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (ACCENT.test(line) || wordRe.test(line)) {
      findings.push({ file: relative(join(__dirname, ".."), file), line: i + 1, text: trimmed });
    }
  });
}

const report = [];
if (findings.length === 0) {
  report.push("i18n audit: no hardcoded Portuguese strings found.");
} else {
  report.push(`i18n audit: ${findings.length} potential hardcoded string(s):`, "");
  for (const f of findings) report.push(`${f.file}:${f.line}: ${f.text}`);
  report.push("", `Total: ${findings.length}`);
}
const out = report.join("\n");
console.log(out);
// Also write a machine-readable UTF-8 report next to the frontend folder.
const outPath = join(__dirname, "..", "..", "i18n-audit.txt");
writeFileSync(outPath, out, "utf8");
process.exit(findings.length === 0 ? 0 : 1);
