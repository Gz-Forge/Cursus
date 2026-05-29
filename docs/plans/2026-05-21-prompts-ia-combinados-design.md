# Design: Prompts IA combinados con checkboxes

**Fecha:** 2026-05-21  
**Branch:** feat/config-tabs  
**Estado:** Aprobado

## Problema

La sección "PROMPTS PARA IA" en la pestaña Datos tiene 6 acordeones independientes. El usuario debe saber cuál usar y no puede combinar módulos. El prompt "todo en uno" ya existe pero es fijo.

## Solución

Reemplazar los 6 acordeones por una sola interfaz con checkboxes donde el usuario elige qué módulos incluir. El prompt generado funde las instrucciones seleccionadas en uno solo.

## Módulos disponibles

| Opción | Qué genera en el JSON |
|--------|----------------------|
| Plan de carrera | `materias[]` con nombre, semestre, previas, créditos, tipo_formacion |
| Horarios | `materias[].bloques[]` con fecha, hora, tipo, salón |
| Evaluaciones | `materias[].evaluaciones[]` con nombre, peso, tipoNota, notaMaxima |
| Configuración | `config{}` con umbrales, etiquetas, tarjetas, períodos |
| Colores del horario | `config.coloresHorario`, `config.coloresGruposEvaluacion`, `config.coloresEvaluacionesSimples` |

## UI

```
┌──────────────────────────────────────────┐
│ PROMPTS PARA IA                          │
│ Seleccioná los módulos que querés generar│
│                                          │
│  [✓] Seleccionar todo                    │
│  ─────────────────────────────────────   │
│  [✓] Plan de carrera                     │
│  [✓] Horarios                            │
│  [✓] Evaluaciones                        │
│  [✓] Configuración de la app             │
│  [✓] Colores del horario                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ preview scrollable del prompt...   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ 📋 Copiar prompt ]                    │
└──────────────────────────────────────────┘
```

- "Seleccionar todo" marca/desmarca todos a la vez
- Si ninguno está seleccionado → deshabilitar el botón copiar + mostrar mensaje
- Preview se actualiza en tiempo real al cambiar checkboxes

## Comportamiento del prompt combinado

El prompt instruye a la IA a:
1. Analizar toda info que el usuario ya proveyó
2. Preguntar solo lo que no pueda determinar (de a una pregunta por vez)
3. Generar **un único JSON** al final con todos los módulos seleccionados

### Formato del JSON de salida

Basado en `cursus_todo_en_uno` extendido:

```json
{
  "cursus_todo_en_uno": 1,
  "config": {
    // campos de Configuración si está seleccionado
    // coloresHorario, coloresGruposEvaluacion, coloresEvaluacionesSimples si Colores está seleccionado
  },
  "materias": [
    {
      "nombre": "...",
      "semestre": 1,
      // bloques[] si Horarios está seleccionado
      // evaluaciones[] si Evaluaciones está seleccionado
    }
  ]
}
```

- Si solo están seleccionados módulos que van en `materias` (sin config/colores) → se puede omitir la sección `config`
- Si solo están seleccionados config/colores (sin materias) → se omite la sección `materias`
- Si solo 1 módulo → usar el prompt individual existente tal cual (sin overhead)

## Función nueva: `generarPromptCombinado`

Nueva función en `importExport.ts`:

```ts
type ModuloIA = 'carrera' | 'horarios' | 'evaluaciones' | 'config' | 'colores';

export function generarPromptCombinado(
  modulos: Set<ModuloIA>,
  config: AppConfig,
  materias: Materia[]
): string
```

- Recibe los módulos seleccionados + config actual (para inyectar datos dinámicos de colores)
- Si `modulos.size === 1` → retorna el prompt individual correspondiente sin cambios
- Si múltiples → construye prompt fusionado con solo las secciones relevantes

## Archivos a modificar

1. `src/utils/importExport.ts` — agregar `generarPromptCombinado()` + tipo `ModuloIA`
2. `src/screens/ConfigScreen.tsx` — reemplazar los 6 acordeones por la nueva UI con checkboxes

## Lo que se elimina

- `promptCarreraExpandido`, `promptHorarioExpandido`, `promptEvalExpandido`, `promptConfigExpandido`, `promptColoresExpandido`, `promptCompletoExpandido` (6 estados)
- Los 6 bloques de acordeón en el JSX
