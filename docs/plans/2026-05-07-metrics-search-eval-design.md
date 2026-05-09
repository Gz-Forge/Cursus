# Design: Métricas + Búsqueda + Evaluaciones Multi-materia

**Fecha:** 2026-05-07

---

## Cambio 1: Eliminar "Promedio acumulado" del panel General

**Archivo:** `src/screens/MetricsScreen.tsx`

- Eliminar `{ id: 'promedio_acumulado', label: 'Promedio acumulado' }` del array `METRICAS_GENERAL` (línea ~33)
- Eliminar el bloque de render `{esVisible('promedio_acumulado') && (...)}` (líneas ~611-638)
- Conservar el cálculo `promedioAcumuladoData` (lo usa el panel Gráficos)

---

## Cambio 2: Bug cuello de botella — cursando siempre visible con soloSiguiente

**Archivo:** `src/screens/MetricsScreen.tsx`

Modificar el filtro `cuellosBotella`:

```typescript
const cuellosBotella = materias.filter(m => {
  const e = calcularEstadoFinal(m, config);
  if (e === 'aprobado' || e === 'exonerado') return false;
  // Con soloSiguiente activo, las cursando siempre aparecen
  if (soloSiguiente && e === 'cursando') return true;
  // Resto sigue el filtro normal
  if (m.esPreviaDe.length < umbralCuello) return false;
  if (soloSiguiente && siguienteSem !== null) {
    return m.esPreviaDe.some(num => numerosEnSigSem.has(num));
  }
  return true;
});
```

Actualizar el subtítulo de la sección cuello de botella para reflejar que con `soloSiguiente` activo también se muestran las cursando.

---

## Cambio 3: Fix overflow eje X en gráficos

**Archivo:** `src/screens/MetricsScreen.tsx`

Envolver en `<View style={{ overflow: 'hidden' }}>` cada uno de los 3 gráficos afectados:
- `LineChart` de "Promedio por semestre" (~línea 674)
- `BarChart` de "Distribución por rango de nota" (~línea 710)
- `BarChart` de "Notas obtenidas" (~línea 787)

El wrapper va dentro del `<View style={{ flexDirection: 'row', alignItems: 'center' }}>` que contiene `ejeY` + chart, rodeando solo el chart component.

---

## Cambio 4: Evaluaciones multi-materia

**Archivos:**
- `src/utils/importExport.ts` — nueva función `parsearJSONEvaluacionesMultiMateria` y prompt actualizado
- `src/screens/EditMateriaScreen.tsx` — `importarEvaluaciones` auto-detecta formato

### Formato nuevo
```json
[
  { "materia": "Fisiología I", "evaluaciones": [...] },
  { "materia": "Microbiología", "evaluaciones": [...] }
]
```

### Auto-detección en `importarEvaluaciones`
- Si el array tiene objetos con clave `"materia"` y `"evaluaciones"` → modo multi-materia
- Si no → modo actual (array plano de evaluaciones para la materia en edición)

### Modo multi-materia
- Para cada entrada, buscar la materia en el store por nombre (case-insensitive) o número
- Si encuentra match: merge de evaluaciones (agregar las nuevas, no reemplazar) usando `guardarMateria`
- Si no encuentra: ignorar con log en Alert al final ("X de Y materias procesadas")
- No requiere pantalla nueva: se activa desde el mismo botón "📥 Importar evaluaciones (.json)"

### `generarPromptEvaluaciones()` actualizado
Mostrar el formato multi-materia como principal, con nota de que el formato simple (array plano) sigue siendo válido para una sola materia.

---

## Cambio 5: CarreraScreen — Long-press para fijar materia de referencia

**Archivo:** `src/screens/CarreraScreen.tsx`

### Estado nuevo
```typescript
const [materiaPinned, setMateriaPinned] = useState<typeof materias[0] | null>(null);
```

### Comportamiento
- Long-press en resultado → fija/desfija esa materia (`setMateriaPinned`)
- Al cambiar `textoBusqueda` → limpiar pin automáticamente
- Visual: materia fijada muestra `borderWidth: 2, borderColor: tema.acento` + texto "📌" al inicio del nombre

### Efecto en modos
- `'es_previa_de'`: si hay pin → `const nums = new Set([materiaPinned.numero])` en lugar de todos los matches
- `'sus_previas'`: ídem con `materiaPinned.previasNecesarias`

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/screens/MetricsScreen.tsx` | Cambios 1, 2 y 3 |
| `src/utils/importExport.ts` | Nueva función + prompt actualizado |
| `src/screens/EditMateriaScreen.tsx` | Auto-detección formato eval |
| `src/screens/CarreraScreen.tsx` | Pin por long-press |
