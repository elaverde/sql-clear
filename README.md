# SQL String Cleaner — Extensión VS Code

Extrae SQL puro desde cadenas concatenadas en JavaScript/TypeScript con un solo clic derecho.

---

## ¿Qué hace?

Convierte esto:
```js
const BUILD_FROM_TIPO_CD_SUBTIPO_CD = "@bind" + "@const,THIS_FROM;" + "@const,WHERE_COND;" +
  "@const,WHERE_AND; (H.BORRADO_FL IS NULL OR H.BORRADO_FL = 0) AND H.TIPO_PROD_CD" +
  " = #data,TIPO_PROD_CD; AND H.SUBTIPO_PROD_CD = #data,SUBTIPO_PROD_CD; " +
  "@const,GROUP_BY;" + "@const,HAVING;" + "@const,ORDER_BY;" + ""
```

En esto (limpio en el portapapeles):
```sql
(H.BORRADO_FL IS NULL OR H.BORRADO_FL = 0) AND H.TIPO_PROD_CD = #data,TIPO_PROD_CD; AND H.SUBTIPO_PROD_CD = #data,SUBTIPO_PROD_CD;
```

**Uso:** Selecciona el texto → Clic derecho → **"Copiar SQL limpio"** ✅

---

## Estructura del proyecto

```
extension/
├── .vscode/
│   └── launch.json       ← configuración para F5 / modo desarrollo
├── src/
│   └── extension.js      ← lógica principal (aquí haces cambios)
├── test.js               ← pruebas rápidas sin VS Code
├── package.json          ← configuración de la extensión
└── README.md
```

---

## Instalación desde .vsix (usuario final)

1. Abre VS Code
2. `Ctrl+Shift+X` → Extensiones
3. Clic en los `...` (tres puntos arriba a la derecha)
4. **"Install from VSIX..."**
5. Selecciona el archivo `sql-string-cleaner-1.0.0.vsix`

---

## Desarrollo — ver cambios en tiempo real

### Requisito: archivo `.vscode/launch.json`

Crea la carpeta `.vscode/` dentro de `extension/` con este archivo:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ]
    }
  ]
}
```

### Pasos para desarrollar

1. Abre la carpeta `extension/` en VS Code
   ```bash
   code "C:\ruta\a\tu\carpeta\extension"
   ```
2. Presiona **F5** → se abre una segunda ventana **"[Extension Development Host]"**
3. En esa segunda ventana prueba la extensión normalmente
4. Cuando hagas cambios en el código → guarda con `Ctrl+S`
5. Recarga con `Ctrl+Shift+F5` o en la segunda ventana: `Ctrl+Shift+P` → **"Reload Window"**

> ⚠️ Abre siempre la carpeta que contiene `package.json` directamente, no una carpeta padre.

---

## Testear la lógica sin VS Code

Edita el archivo `test.js` con tus cadenas reales:

```js
const test = `const MI_QUERY = "@bind" + "@const,THIS_FROM;" + " tu SQL aqui " + "@const,ORDER_BY;"`;

console.log(cleanSQLString(test));
```

Ejecuta desde terminal:

```bash
node test.js
```

Ves el resultado al instante. Ideal para probar nuevos patrones antes de modificar `extension.js`.

---

## Empaquetar (.vsix) para distribuir

### Primera vez — instalar vsce

```bash
npm install -g @vscode/vsce --force
```

> Si da error de permisos, usa `npx` directamente (no requiere instalación global).

### Generar el .vsix

Desde dentro de la carpeta `extension/`:

```bash
npx @vscode/vsce package --allow-missing-repository
```

Genera el archivo `sql-string-cleaner-1.0.0.vsix` en esa misma carpeta.

---

## Cómo modificar la lógica de limpieza

Todo está en `src/extension.js` dentro de la función `cleanSQLString()`. Los pasos son:

**Paso 1** — Elimina la declaración de variable (`const X =`)

**Paso 2** — Extrae todos los strings entre comillas

**Paso 3** — Elimina los tokens de control:
```js
combined = combined.replace(/@bind/g, '');
combined = combined.replace(/@const,[A-Z_a-z0-9]+;?/g, '');
combined = combined.replace(/@if,[^;@]+;?/g, '');
combined = combined.replace(/@[A-Za-z_]+(?:,[^;@]*)?;?/g, ''); // cualquier @TOKEN
```

> Para agregar nuevos tokens a eliminar, añade una línea `.replace()` siguiendo el mismo patrón.

**Paso 4** — Limpia espacios múltiples y devuelve el SQL limpio

### Ejemplo: agregar soporte para `@loop`

```js
// Añade esta línea después de las existentes:
combined = combined.replace(/@loop,[A-Z_a-z0-9]+;?/g, '');
```

### Cambiar el texto del menú contextual

En `package.json`, busca y edita:
```json
"title": "Copiar SQL limpio"
```

---

## Problemas frecuentes

| Error | Causa | Solución |
|-------|-------|----------|
| `vsce` no se reconoce | No está en el PATH | Usar `npx @vscode/vsce package` |
| `EEXIST: file already exists` | Instalación incompleta de vsce | `npm install -g @vscode/vsce --force` |
| `Extension entrypoint missing` | `main` en package.json apunta mal | Verificar que diga `"./src/extension.js"` |
| F5 no abre segunda ventana | Falta `launch.json` | Crear `.vscode/launch.json` (ver sección desarrollo) |
| Comando no aparece en clic derecho | No hay texto seleccionado | Seleccionar texto antes de hacer clic derecho |
