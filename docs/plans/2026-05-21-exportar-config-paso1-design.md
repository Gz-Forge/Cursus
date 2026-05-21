# Diseño: Exportar configuración en PASO 1

**Fecha:** 2026-05-21
**Branch:** feat/config-tabs

## Contexto

En la pantalla Configuración → Panel datos → Gestionar importación y exportación → tab Exportar, el PASO 1 permite seleccionar qué datos incluir en el JSON exportado (Materias, Notas, Evaluaciones, Horarios). Se pide agregar la opción de incluir también la **configuración** (umbrales, colores, horario, tarjetas, etc.).

Ya existe una sección "CONFIGURACIÓN" separada que permite compartir config via QR — esa sección se mantiene intacta.

## Decisiones de diseño

- **Enfoque A** aprobado: checkbox en PASO 1 + `config` como campo top-level en el payload JSON.
- La config es global (no por perfil), por lo que va como campo raíz del payload, no dentro de cada perfil.
- Al importar un JSON que contiene `config`, se pregunta al usuario con `Alert.alert` (botones Sí/No) si quiere aplicarla.

## Archivos a modificar

### 1. `src/utils/exportPayload.ts`

- `OpcionesExport`: agregar `inclConfig: boolean` y `config?: Config`
- `ExportPayload`: agregar `config?: Config` (campo raíz opcional)
- `construirPayload`: si `inclConfig === true`, incluir `config` en el payload retornado

### 2. `src/screens/ImportarExportarScreen.tsx`

**Panel Exportar:**
- Estado: agregar `const [inclConfig, setInclConfig] = useState(false)`
- PASO 1: agregar `<Checkbox label="Configuración" value={inclConfig} onChange={setInclConfig} />`
- Props de `PanelMetodos`: agregar `inclConfig` y `config`

**PanelMetodos:**
- Interfaz `PanelMetodosProps`: agregar `inclConfig: boolean` y `config: Config`
- Pasar `inclConfig` y `config` a `construirPayload` en cada handler (`handleDescargarJson`, `handleCopiarJson`, `handleQrPantalla`, `handleDescargarQrs`)

**Panel Importar — detección `version: 1` + `perfiles`:**
- Si el JSON tiene campo `config`, mostrar `Alert.alert` con botones Sí/No preguntando si aplicar la configuración
- Si el usuario acepta, aplicar con `actualizarConfig(datos.config)`
- Luego continuar con el mensaje "próximamente" para los perfiles (sin modificar esa lógica)

## Comportamiento esperado

- El checkbox "Configuración" en PASO 1 es opcional y está desmarcado por defecto.
- Al exportar con "Configuración" marcado, el JSON resultante incluye `config: { ... }` como campo raíz junto a `version`, `exportadoEn` y `perfiles`.
- Al importar ese JSON, se detecta `version: 1` + `perfiles`. Si tiene `config`, aparece un diálogo nativo preguntando si aplicarla. El usuario puede elegir Sí o No independientemente.
- No hay warning especial al marcar "Configuración" (a diferencia de Notas/Evaluaciones que muestran aviso de datos personales).

## Lo que NO cambia

- La sección "CONFIGURACIÓN" (QR) que ya existe debajo del PASO 2 permanece sin cambios.
- La lógica de importación de perfiles permanece como "próximamente".
- El esquema de versión del payload no cambia (sigue siendo `version: 1`).
