const vscode = require("vscode");

/**
 * Limpia una cadena SQL eliminando tokens @bind, @const, @if, etc.
 */
function cleanSQLString(text) {
  let working = text;
  working = working.replace(
    /^[\s\S]*?(?:constant|const|let|var)\s+\w+\s*=\s*/,
    "",
  );
  working = working.replace(/\s*\n\s*/g, " ").trim();
  working = working.replace(/;\s*$/, "");

  const fragments = [];
  const stringRegex = /"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g;
  let match;
  while ((match = stringRegex.exec(working)) !== null) {
    fragments.push(match[1] !== undefined ? match[1] : match[3]);
  }

  let combined = fragments.join("");
  combined = combined.replace(/@bind/g, "");
  combined = combined.replace(/@const,[A-Z_a-z0-9]+;?/g, "");
  combined = combined.replace(/@if,[^;@]+;?/g, "");
  combined = combined.replace(/@[A-Za-z_]+(?:,[^;@]*)?;?/g, "");

  // Recolectar variables para declarar, sin repetir nombres
  const variables = [];
  const declared = new Set();

  // #num,VAR;  => @VAR INT = 123
  combined = combined.replace(/#num,([A-Z_a-z0-9]+);/g, (m, v) => {
    if (!declared.has(v)) {
      variables.push({ name: v, type: "INT", value: "123" });
      declared.add(v);
    }
    return `@${v}`;
  });
  // #data,VAR; => @VAR VARCHAR(100) = 'demo'
  combined = combined.replace(/#data,([A-Z_a-z0-9]+);/g, (m, v) => {
    if (!declared.has(v)) {
      variables.push({ name: v, type: "VARCHAR(100)", value: "'demo'" });
      declared.add(v);
    }
    return `@${v}`;
  });
  // #like,VAR; => LIKE @VAR y declara solo una vez
  combined = combined.replace(/#like,([A-Z_a-z0-9]+);/g, (m, v) => {
    if (!declared.has(v)) {
      variables.push({ name: v, type: "VARCHAR(100)", value: "'%ejemplo%'" });
      declared.add(v);
    }
    return `LIKE @${v}`;
  });
  // #numSession,VAR; => @VAR VARCHAR(100) = 'demo'
  combined = combined.replace(/#numSession,([A-Z_a-z0-9]+);/g, (m, v) => {
    if (!declared.has(v)) {
      variables.push({ name: v, type: "VARCHAR(100)", value: "'demo'" });
      declared.add(v);
    }
    return `@${v}`;
  });
  // #fecha,VAR; => @VAR DATE = '2024-01-01'
  combined = combined.replace(/#fecha,([A-Z_a-z0-9]+);/g, (m, v) => {
    if (!declared.has(v)) {
      variables.push({ name: v, type: "DATE", value: "'2024-01-01'" });
      declared.add(v);
    }
    return `@${v}`;
  });
  // #listData,VAR; o #listData,VAR,¦; => IN (@VAR), soporta NOT(...)
  combined = combined.replace(
    /#listData,([A-Z_a-z0-9]+)(?:,[^;]*)?;/g,
    (m, v) => {
      if (!declared.has(v)) {
        variables.push({ name: v, type: "VARCHAR(200)", value: "'A,B,C'" });
        declared.add(v);
      }
      return `IN (@${v})`;
    },
  );

  combined = combined.replace(/[ \t]{2,}/g, " ").trim();

  // Generar declaraciones SQL para las variables
  let declarations = "";
  if (variables.length > 0) {
    declarations =
      variables
        .map((v) => `DECLARE @${v.name} ${v.type} = ${v.value};`)
        .join("\n") + "\n\n";
  }

  return { declarations, sql: combined };
}

/**
 * Extrae DB_TABLE_NAME y DB_ALIAS_NAME buscando hacia arriba desde fromLine.
 */
function extractTableInfo(lines, fromLine) {
  let tableName = null,
    aliasName = null;

  const searchLines = (start, end) => {
    for (let i = start; i >= end; i--) {
      const line = lines[i];
      if (!tableName) {
        const m = line.match(/DB_TABLE_NAME\s*=\s*["']([A-Z_a-z0-9]+)["']/);
        if (m) tableName = m[1];
      }
      if (!aliasName) {
        const m = line.match(/DB_ALIAS_NAME\s*=\s*["']([A-Z_a-z0-9]+)["']/);
        if (m) aliasName = m[1];
      }
      if (tableName && aliasName) break;
    }
  };

  searchLines(fromLine, 0);
  if (!tableName || !aliasName) searchLines(lines.length - 1, 0);

  return { tableName, aliasName };
}

/**
 * Busca THIS_FROM más cercano (hacia arriba desde fromLine) dentro del mismo
 * bloque de clase (hasta la siguiente "public class" hacia arriba).
 * Extrae el FROM limpio: tabla, alias y cualquier JOIN que haya.
 *
 * Soporta:
 *   constant THIS_FROM = " FROM " + KTS_SEQ.BD_PREFFIX + "TABLA" + " P LEFT JOIN OTRA X ON ..."
 *   (multilinea también)
 *
 * Devuelve string tipo: "FROM TABLA P\nLEFT JOIN OTRA X ON X.ID = P.ID"
 * o null si no encuentra.
 */
function extractThisFrom(lines, fromLine) {
  // Buscar la línea de THIS_FROM más cercana hacia arriba
  let thisFromStartLine = null;
  for (let i = fromLine; i >= 0; i--) {
    if (/\bTHIS_FROM\s*=/.test(lines[i])) {
      thisFromStartLine = i;
      break;
    }
  }
  if (thisFromStartLine === null) return null;

  // Recopilar el bloque completo de THIS_FROM (puede ser multilinea)
  let rawBlock = lines[thisFromStartLine];
  for (let i = thisFromStartLine + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.startsWith('"') ||
      trimmed.startsWith("'") ||
      trimmed.startsWith("+")
    ) {
      rawBlock += " " + trimmed;
    } else {
      break;
    }
  }

  // Extraer solo los literales de string (ignora KTS_SEQ.BD_PREFFIX y variables)
  const fragments = [];
  const stringRegex = /"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'/g;
  let match;
  while ((match = stringRegex.exec(rawBlock)) !== null) {
    const content = match[1] !== undefined ? match[1] : match[3];
    fragments.push(content);
  }

  // Unir y limpiar
  let fromClean = fragments.join("").trim();

  // Eliminar tokens especiales como #seq;
  fromClean = fromClean.replace(/#[a-z]+,[^;]*;/g, "").replace(/#[a-z]+;/g, "");
  fromClean = fromClean.replace(/[ \t]{2,}/g, " ").trim();

  if (!fromClean || !fromClean.toUpperCase().includes("FROM")) return null;

  // Formatear: separar JOIN keywords en nuevas líneas para legibilidad
  fromClean = fromClean
    .replace(
      /\s+(LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|JOIN)\s+/gi,
      (_, join) => `\n${join.trim()} `,
    )
    .trim();

  return fromClean;
}

/**
 * Si la selección es solo la primera línea de un bloque multilinea,
 * lo expande automáticamente hasta el final del bloque.
 */
function expandSelectionIfNeeded(document, selection) {
  const selectedText = document.getText(selection);
  if (selection.start.line !== selection.end.line) return selectedText;

  const startLine = selection.start.line;
  const lineText = document.lineAt(startLine).text;
  if (!/(?:constant|const|let|var)\s+\w+\s*=/.test(lineText))
    return selectedText;

  const totalLines = document.lineCount;
  let endLine = startLine;

  for (let i = startLine + 1; i < totalLines; i++) {
    const line = document.lineAt(i).text.trim();
    if (line.startsWith('"') || line.startsWith("'") || line.startsWith("+")) {
      endLine = i;
      if (i + 1 < totalLines) {
        const nextLine = document.lineAt(i + 1).text.trim();
        if (
          !nextLine.startsWith('"') &&
          !nextLine.startsWith("'") &&
          !nextLine.startsWith("+")
        )
          break;
      } else break;
    } else break;
  }

  return document.getText(
    new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, document.lineAt(endLine).text.length),
    ),
  );
}

function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "sqlCleaner.copyCleanSQL",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No hay editor activo.");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage("Selecciona texto primero.");
        return;
      }

      try {
        const document = editor.document;
        const lines = document.getText().split("\n");
        const selLine = selection.start.line;

        // Expandir selección si es solo primera línea del bloque
        const textToProcess = expandSelectionIfNeeded(document, selection);

        // Limpiar el SQL del WHERE
        const cleanResult = cleanSQLString(textToProcess);
        if (!cleanResult || !cleanResult.sql) {
          vscode.window.showWarningMessage(
            "No se encontró SQL en el texto seleccionado.",
          );
          return;
        }

        // Buscar tabla, alias y THIS_FROM
        const { tableName, aliasName } = extractTableInfo(lines, selLine);
        const thisFrom = extractThisFrom(lines, selLine);

        // Construir resultado final con indentación y declaraciones arriba
        let sqlBody = "";
        if (thisFrom) {
          sqlBody = `SELECT *\n${thisFrom}\nWHERE\n    ${cleanResult.sql.replace(/\n/g, "\n    ")}`;
        } else if (tableName) {
          const alias = aliasName || "";
          sqlBody = `SELECT * FROM ${tableName} ${alias}\nWHERE\n    ${cleanResult.sql.replace(/\n/g, "\n    ")}`;
        } else {
          sqlBody = cleanResult.sql;
        }

        const result = cleanResult.declarations + sqlBody;
        await vscode.env.clipboard.writeText(result);

        const label = tableName || (thisFrom ? "FROM detectado" : "");
        vscode.window.showInformationMessage(
          label
            ? `✅ SQL copiado! (${label} ${aliasName || ""})`
            : "✅ SQL limpio copiado!",
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          "Error al limpiar SQL: " + error.message,
        );
      }
    },
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}
module.exports = { activate, deactivate };
