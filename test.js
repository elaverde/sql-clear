function cleanSQLString(text) {
  let working = text;
  working = working.replace(
    /^[\s\S]*?(?:constant|const|let|var)\s+\w+\s*=\s*/,
    "",
  );
  working = working.replace(/\s*\n\s*/g, " ");
  working = working.trim();
  working = working.replace(/;\s*$/, "");
  const fragments = [];
  const stringRegex = /"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g;
  let match;
  while ((match = stringRegex.exec(working)) !== null) {
    const content = match[1] !== undefined ? match[1] : match[3];
    fragments.push(content);
  }
  let combined = fragments.join("");
  combined = combined.replace(/@bind/g, "");
  combined = combined.replace(/@const,[A-Z_a-z0-9]+;?/g, "");
  combined = combined.replace(/@if,[^;@]+;?/g, "");
  combined = combined.replace(/@[A-Za-z_]+(?:,[^;@]*)?;?/g, "");
  combined = combined.replace(/[ \t]{2,}/g, " ");
  combined = combined.trim();
  return combined;
}

function extractTableInfo(lines, fromLine) {
  let tableName = null,
    aliasName = null;
  for (let i = fromLine; i >= 0; i--) {
    const line = lines[i];
    if (!tableName) {
      const m = line.match(/DB_TABLE_NAME\s*=\s*["']?([A-Z_a-z0-9]+)["']?/);
      if (m) tableName = m[1];
    }
    if (!aliasName) {
      const m = line.match(/DB_ALIAS_NAME\s*=\s*["']?([A-Z_a-z0-9]+)["']?/);
      if (m) aliasName = m[1];
    }
    if (tableName && aliasName) break;
  }
  return { tableName, aliasName };
}

const fakeFile = `   constant DB_TABLE_NAME = "HIPO_PENALIZACION_HIP"
   constant DB_ALIAS_NAME = "H"
   constant BUILD_FROM_TIPO_CD_SUBTIPO_CD =
      "@bind" + "@const,THIS_FROM;" + "@const,WHERE_COND;" +
      "@const,WHERE_AND; (H.BORRADO_FL IS NULL OR H.BORRADO_FL = 0) AND H.TIPO_PROD_CD" +
      " = #data,TIPO_PROD_CD; AND H.SUBTIPO_PROD_CD = #data,SUBTIPO_PROD_CD; " +
      "@const,GROUP_BY;" +
      "@const,HAVING;" +
      "@const,ORDER_BY;" +
      ""`;

const lines = fakeFile.split("\n");
const buildLine = lines.findIndex((l) =>
  l.includes("BUILD_FROM_TIPO_CD_SUBTIPO_CD"),
);
const selectedBlock = lines.slice(buildLine).join("\n");
const cleanSQL = cleanSQLString(selectedBlock);
const { tableName, aliasName } = extractTableInfo(lines, buildLine);
const parts = [
  tableName && `TABLE: ${tableName}`,
  aliasName && `ALIAS: ${aliasName}`,
]
  .filter(Boolean)
  .join("  |  ");
const result = parts ? `-- ${parts}\n${cleanSQL}` : cleanSQL;

console.log("══════════════════════════════════════════");
console.log("RESULTADO (lo que se copia al portapapeles):");
console.log("══════════════════════════════════════════");
console.log(result);
console.log("══════════════════════════════════════════");
