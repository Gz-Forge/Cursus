# Design: Subdivisión del color `acento` en 4 sub-campos

**Fecha:** 2026-05-29  
**Branch destino:** feat/config-tabs  
**Alcance:** `TemaPersonalizado`, `ColoresScreen`, `TemaPersonalizadoScreen`, y todos los screens/componentes que consumen `tema.acento`

---

## Problema

El campo `acento` en `TemaPersonalizado` controla indiscriminadamente:
- Color de **texto** (headers de sección, tabs activos, flechas, íconos)
- Color de **rellenos** (botones, filtros activos, toggle ON, barras de progreso)
- Color de **líneas/bordes** (subrayado de tab activo, línea vertical del día actual en horario, bordes de checkboxes)
- Color de **gráficos** (barras y líneas en Métricas)

El usuario no puede, por ejemplo, tener botones de un color y texto de sección de otro.

---

## Solución aprobada: 4 sub-campos opcionales con fallback

### Nuevos campos en `TemaPersonalizado`

```typescript
acentoTexto?:    string;  // color: en texto (headers, tabs activos, flechas, íconos)
acentoFondo?:    string;  // backgroundColor: en rellenos (botones, filtros, toggles ON)
acentoLineas?:   string;  // borderColor / borderBottomColor / borderLeftColor
acentoGraficos?: string;  // frontColor, dataPointsColor, startFillColor en charts
```

Los mismos 4 campos se añaden a `ColoresScreen` para overrides por pantalla.

### Regla de fallback

En cada lugar que hoy usa `tema.acento`, se usa el sub-campo correspondiente con fallback:

```typescript
tema.acentoTexto    ?? tema.acento
tema.acentoFondo    ?? tema.acento
tema.acentoLineas   ?? tema.acento
tema.acentoGraficos ?? tema.acento
```

Si el sub-campo no está seteado (`undefined` o `''`), se comporta exactamente igual que antes. **Compatibilidad total con temas existentes.**

---

## Mapeo exacto de usos

### `acentoTexto` (propiedad `color:`)
Archivos: CarreraScreen, HorarioScreen, MetricsScreen, ConfigScreen, TemaPersonalizadoScreen, WebSidebar, ImportarExportarScreen, EvaluacionItem, MateriaCard, FabSpeedDial, AlertContext (texto de botón outline), PerfilSheet, SemestreSection, y demás componentes.

Qué colorea:
- Headers de sección en mayúsculas (APARIENCIA, SISTEMA DE NOTAS, etc.)
- Texto del tab activo (underline activo)
- Flechas de navegación ◀ ▶
- "Esta semana" / label de semana actual en Horario
- Nombre del día actual (esHoy) en cabecera del horario
- Ícono ⚡ del selector de perfil
- Texto del botón "Entrar a personalizar" (outlined)
- Texto activo en sidebar web
- Chevrones ▼ de acordeones
- Labels de sección en TemaPersonalizadoScreen

### `acentoFondo` (propiedad `backgroundColor:`)
Archivos: todos los screens y modales con botones de acción primaria.

Qué colorea:
- Botones de acción primaria (relleno sólido)
- Filtros/chips activos (seleccionados)
- Toggle switch cuando está ON (`trackColor: { true: acentoFondo }`)
- Checkbox marcado (backgroundColor cuando checked)
- Barra de progreso (fill de la barra)
- Fondo semitransparente del día actual en horario (`${acentoFondo}12`)
- Tab/selector activo en TemaPersonalizadoScreen y ConfigScreen
- Opción activa en segmented controls

### `acentoLineas` (propiedades `borderColor`, `borderBottomColor`, `borderLeftColor`)
Archivos: CarreraScreen, HorarioScreen, MetricsScreen, ConfigScreen, ImportarExportarScreen, MateriaCard.

Qué colorea:
- Subrayado del tab activo (`borderBottomColor`)
- Línea vertical del día actual en la grilla del horario (`borderLeftColor`)
- Borde de checkboxes (marcados o en foco)
- Borde del TextInput en edición activa
- Borde de tarjeta pinneada en MateriaCard
- Borde de botones outlined con acento
- Línea de hora actual en horario (`backgroundColor` de la línea fina horizontal — va aquí porque es una línea, no un relleno de botón)

### `acentoGraficos` (propiedades de librería de charts en MetricsScreen)
Archivos: MetricsScreen únicamente.

Qué colorea:
- `frontColor` de barras del gráfico de promedio por semestre
- `dataPointsColor` de puntos en la línea de tendencia
- `startFillColor` del relleno degradado bajo la línea
- Barras del gráfico de distribución de notas (cuando se use acento, no colores de estado)

---

## Cambios en `mergeScreenColors`

La función actualmente mergea 5 campos de `ColoresScreen` al `TemaPersonalizado` del draft. Se expande para mergear también los 4 nuevos:

```typescript
function mergeScreenColors(draft: TemaPersonalizado, pagina: PantallaKey): TemaPersonalizado {
  const overrides = draft[COLORES_KEY[pagina]] as ColoresScreen | undefined;
  if (!overrides) return draft;
  return {
    ...draft,
    // campos existentes
    ...(overrides.tarjeta         && isValidHex(overrides.tarjeta)         ? { tarjeta }         : {}),
    ...(overrides.texto           && isValidHex(overrides.texto)           ? { texto }           : {}),
    ...(overrides.textoSecundario && isValidHex(overrides.textoSecundario) ? { textoSecundario } : {}),
    ...(overrides.acento          && isValidHex(overrides.acento)          ? { acento }          : {}),
    ...(overrides.borde           && isValidHex(overrides.borde)           ? { borde }           : {}),
    // nuevos sub-campos
    ...(overrides.acentoTexto    && isValidHex(overrides.acentoTexto)    ? { acentoTexto }    : {}),
    ...(overrides.acentoFondo    && isValidHex(overrides.acentoFondo)    ? { acentoFondo }    : {}),
    ...(overrides.acentoLineas   && isValidHex(overrides.acentoLineas)   ? { acentoLineas }   : {}),
    ...(overrides.acentoGraficos && isValidHex(overrides.acentoGraficos) ? { acentoGraficos } : {}),
  };
}
```

---

## UI en `TemaPersonalizadoScreen`

### Panel "Colores Globales" — de 6 a 10 inputs

Orden visual:
1. Tarjeta / panel
2. Texto principal
3. Texto secundario
4. **Acento base** (el `acento` existente — fallback de todos los sub-campos)
5. **↳ Acento texto** (indentado, placeholder = valor del acento base)
6. **↳ Acento rellenos** (indentado)
7. **↳ Acento líneas** (indentado)
8. **↳ Acento gráficos** (indentado)
9. Borde / separador
10. Labels tab bar

Los 4 sub-campos van visualmente agrupados bajo el "Acento base" con indentación (paddingLeft ~16) y un separador sutil. El placeholder de cada uno muestra el valor efectivo actual (el base si está vacío).

### Panel "Colores por pantalla" (`PantallaEditor`)

Se añaden los mismos 4 sub-campos a la lista de overrides por pantalla. `Acento gráficos` aparece en todas las pestañas (para consistencia), pero solo tiene efecto visual real en Métricas.

El placeholder de cada sub-campo muestra: `global: {valorGlobal}` o el sub-campo global si existe.

---

## Compatibilidad

- Sub-campos `undefined` en temas existentes → fallback a `acento` → sin cambio visual
- Reset al tema oscuro: solo resetea los campos que existen en `temaOscuro` (no incluye sub-campos) → correcto, los sub-campos quedan `undefined` y el fallback funciona
- Exportar/importar JSON: campos opcionales, backwards compatible

---

## Archivos a modificar

1. `src/types/index.ts` — `TemaPersonalizado` + `ColoresScreen`
2. `src/screens/TemaPersonalizadoScreen.tsx` — UI + `mergeScreenColors`
3. `src/screens/CarreraScreen.tsx`
4. `src/screens/HorarioScreen.tsx`
5. `src/screens/MetricsScreen.tsx`
6. `src/screens/ConfigScreen.tsx`
7. `src/screens/ImportarExportarScreen.tsx`
8. `src/navigation/RootNavigator.tsx`
9. `src/navigation/WebSidebar.tsx`
10. `src/components/MateriaCard.tsx`
11. `src/components/EvaluacionItem.tsx`
12. `src/components/SemestreSection.tsx`
13. `src/components/FabSpeedDial.tsx`
14. `src/components/ConfirmModal.tsx`
15. `src/components/AgregarMateriaModal.tsx`
16. `src/components/DuplicadosModal.tsx`
17. `src/components/PerfilSheet.tsx`
18. `src/components/QrShareModal.tsx`
19. `src/components/QrScannerModal.tsx`
20. `src/components/PeriodoExamenModal.tsx`
21. `src/components/EvaluacionesQrModal.tsx`
22. `src/components/SyncDispositivosModal.tsx`
23. `src/contexts/AlertContext.tsx`
