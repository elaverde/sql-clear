<p align="center">
  <img src="https://i.ibb.co/215wns3x/logo.png" width="128" alt="Logo"/>
</p>
# SQL String Cleaner — Extensión VS Code

Extrae SQL puro desde cadenas concatenadas en JavaScript/TypeScript con un solo clic derecho.

---

## ¿Qué hace?

Convierte esto:
```js
const BUILD_FROM_TIPO_CD_SUBTIPO_CD = "@bind" + "@const,THIS_FROM;" + "@const,WHERE_COND;" +
  "@const,WHERE_AND; (H.BORRADO_FL IS NULL OR H.BORRADO_FL = 0) AND H.TIPO_PROD_CD" +
  " = #DATA,TIPO_PROD_CD; AND H.SUBTIPO_PROD_CD = #data,SUBTIPO_PROD_CD; " +
  "@const,GROUP_BY;" + "@const,HAVING;" + "@const,ORDER_BY;" + ""
```

En esto (limpio en el portapapeles):
```sql
DECLARE @TIPO_PROD_CD VARCHAR(100) = 'demo';
DECLARE @SUBTIPO_PROD_CD VARCHAR(100) = 'demo';

SELECT * FROM TABLA P
WHERE
    (H.BORRADO_FL IS NULL OR H.BORRADO_FL = 0) AND H.TIPO_PROD_CD = @TIPO_PROD_CD AND H.SUBTIPO_PROD_CD = @SUBTIPO_PROD_CD
```

**Novedades:**
- Soporte para variables en mayúsculas (`#NUM`, `#DATA`, etc.).
- Detección automática de tabla y alias.
- Reconstrucción de `SELECT * FROM`.

**Uso:** Selecciona el texto → Clic derecho → **"Copiar SQL limpio"** ✅

---

## Estructura del proyecto

```
SqlClear/
├── .vscode/
│   └── launch.json       ← configuración para F5
├── assets/
│   └── logo.png          ← logo de la extensión
├── src/
│   └── extension.js      ← lógica principal
├── package.json          ← configuración
└── README.md
```

---

## Instalación desde .vsix (usuario final)

1. Abre VS Code
2. `Ctrl+Shift+X` → Extensiones
3. Clic en los `...` (tres puntos arriba a la derecha)
4. **"Install from VSIX..."**
5. Selecciona el archivo `assets/sql-string-cleaner-1.0.1.vsix`

---

## Desarrollo — ver cambios en tiempo real

### Requisito: archivo `.vscode/launch.json`

Crea la carpeta `.vscode/` dentro de la raíz con este archivo:

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

1. Abre la carpeta del proyecto en VS Code.
2. Presiona **F5** → se abre una segunda ventana **"[Extension Development Host]"**.
3. En esa segunda ventana prueba la extensión normalmente.
4. Cuando hagas cambios en el código → guarda con `Ctrl+S`.
5. Recarga la ventana de desarrollo con `Ctrl+Shift+F5`.

---

## Empaquetar (.vsix) para distribuir

Desde la terminal en la raíz del proyecto:

```bash
npx @vscode/vsce package --allow-missing-repository
```

Genera el archivo `sql-string-cleaner-1.0.1.vsix`.

---

## Cómo modificar la lógica de limpieza

La lógica de las variables está centralizada en `src/extension.js` dentro de la constante `variableMetadata`. 

Para agregar un nuevo tipo de variable (por ejemplo `#bool`), solo añade un objeto al array:

```js
{ 
  regex: /#bool,([A-Z_a-z0-9]+);/gi, 
  type: "BIT", 
  value: "1" 
}
```

La extensión se encargará automáticamente de:
1. Buscar el patrón (insensible a mayúsculas).
2. Declarar la variable arriba del SQL.
3. Reemplazar el marcador por `@NombreVariable` en el cuerpo del SQL.

---

## Problemas frecuentes

| Error | Causa | Solución |
|-------|-------|----------|
| `vsce` no se reconoce | No está en el PATH | Usar `npx @vscode/vsce package` |
| `Extension entrypoint missing` | `main` en package.json apunta mal | Verificar que diga `"./src/extension.js"` |
| F5 no abre segunda ventana | Falta `launch.json` | Crear `.vscode/launch.json` |
| Comando no aparece en clic derecho | No hay texto seleccionado | Seleccionar texto antes de hacer clic derecho |
