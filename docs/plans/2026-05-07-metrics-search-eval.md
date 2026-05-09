# Métricas + Búsqueda + Evaluaciones Multi-materia: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cinco mejoras: eliminar "Promedio acumulado" del panel General, fix cuello de botella con soloSiguiente, fix overflow eje X en gráficos, importar evaluaciones multi-materia, y long-press para fijar materia de referencia en búsqueda.

**Architecture:** Cambios localizados en 4 archivos. MetricsScreen recibe 3 cambios independientes. La lógica de multi-materia vive en `importExport.ts` con auto-detección de formato. CarreraScreen agrega estado `materiaPinned` y prop `onLongPress` a MateriaCard.

**Tech Stack:** React Native, TypeScript, Zustand, react-native-gifted-charts.

---

## Task 1: Eliminar "Promedio acumulado" del panel General

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Eliminar entrada del array METRICAS_GENERAL**

Ubicar (línea ~27):
```typescript
const METRICAS_GENERAL = [
  { id: 'progreso',           label: 'Progreso general' },
  { id: 'avance_año',         label: 'Avance por año' },
  { id: 'materias_estado',    label: 'Materias por estado' },
  { id: 'creditos_semestre',  label: 'Créditos por semestre' },
  { id: 'cuello_botella',     label: 'Cuello de botella' },
  { id: 'promedio_acumulado', label: 'Promedio acumulado' },
];
```

Reemplazar con:
```typescript
const METRICAS_GENERAL = [
  { id: 'progreso',          label: 'Progreso general' },
  { id: 'avance_año',        label: 'Avance por año' },
  { id: 'materias_estado',   label: 'Materias por estado' },
  { id: 'creditos_semestre', label: 'Créditos por semestre' },
  { id: 'cuello_botella',    label: 'Cuello de botella' },
];
```

**Step 2: Eliminar el bloque de render del Promedio Acumulado en el panel General**

Ubicar el bloque completo (líneas ~611-657):
```typescript
            {/* Promedio Acumulado */}
            {esVisible('promedio_acumulado') && (
              <View style={col}>
                {seccion('PROMEDIO ACUMULADO')}
                ...
              </View>
            )}
```

Eliminar ese bloque completo. El cálculo `promedioAcumuladoData` y `promedioEnEscala` deben **conservarse** (los usa el panel Gráficos).

**Step 3: Verificar TypeScript**

```bash
cd TablaApp && npx tsc --noEmit
```
Esperado: 0 errores nuevos.

**Step 4: Commit**

```bash
git config user.name "GzForge" && git config user.email "gzforge.admin@gmail.com"
git add src/screens/MetricsScreen.tsx
git commit -m "feat(metrics): remove Promedio Acumulado from General panel"
```

---

## Task 2: Fix cuello de botella — mostrar cursando con soloSiguiente activo

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Reemplazar el filtro `cuellosBotella`**

Ubicar (líneas ~132-142):
```typescript
  const cuellosBotella = materias
    .filter(m => {
      if (m.esPreviaDe.length < umbralCuello) return false;
      const e = calcularEstadoFinal(m, config);
      if (e === 'aprobado' || e === 'exonerado') return false;
      if (soloSiguiente && siguienteSem !== null) {
        return m.esPreviaDe.some(num => numerosEnSigSem.has(num));
      }
      return true;
    })
    .sort((a, b) => b.esPreviaDe.length - a.esPreviaDe.length);
```

Reemplazar con:
```typescript
  const cuellosBotella = materias
    .filter(m => {
      const e = calcularEstadoFinal(m, config);
      if (e === 'aprobado' || e === 'exonerado') return false;
      // Con soloSiguiente activo, las cursando siempre aparecen
      if (soloSiguiente && e === 'cursando') return true;
      // Resto: filtro normal de umbral + siguiente semestre
      if (m.esPreviaDe.length < umbralCuello) return false;
      if (soloSiguiente && siguienteSem !== null) {
        return m.esPreviaDe.some(num => numerosEnSigSem.has(num));
      }
      return true;
    })
    .sort((a, b) => b.esPreviaDe.length - a.esPreviaDe.length);
```

**Step 2: Actualizar subtítulo de la sección**

Ubicar (líneas ~546-549):
```typescript
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                    {soloSiguiente && siguienteSem !== null
                      ? `Afectan al ${siguienteSem}° semestre · previa de ≥${umbralCuello} materias`
                      : `Previa de ${umbralCuello} o más materias (sin aprobar)`}
                  </Text>
```

Reemplazar con:
```typescript
                  <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 10 }}>
                    {soloSiguiente && siguienteSem !== null
                      ? `Cursando + previa de ≥${umbralCuello} que afectan al ${siguienteSem}° sem`
                      : `Previa de ${umbralCuello} o más materias (sin aprobar)`}
                  </Text>
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "fix(metrics): always show cursando in cuello de botella when soloSiguiente active"
```

---

## Task 3: Fix overflow eje X en los 3 gráficos del panel Gráficos

**Files:**
- Modify: `src/screens/MetricsScreen.tsx`

**Step 1: Envolver LineChart "Promedio por semestre" con overflow:hidden**

Ubicar (línea ~672):
```typescript
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {ejeY(`Nota (/${config.notaMaxima})`)}
                          <LineChart
                            data={datosLinea}
                            width={chartWidth}
```

Reemplazar con:
```typescript
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {ejeY(`Nota (/${config.notaMaxima})`)}
                          <View style={{ overflow: 'hidden', flex: 1 }}>
                          <LineChart
                            data={datosLinea}
                            width={chartWidth}
```

Y agregar el cierre `</View>` justo después del cierre de `<LineChart />`:
```typescript
                          />
                          </View>
                        </View>
```

**Step 2: Envolver BarChart "Distribución por rango" con overflow:hidden**

Ubicar (línea ~708):
```typescript
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {ejeY('Materias')}
                          <BarChart
                            data={barrasRangos}
                            barWidth={barWidthRangos}
```

Reemplazar con:
```typescript
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {ejeY('Materias')}
                          <View style={{ overflow: 'hidden', flex: 1 }}>
                          <BarChart
                            data={barrasRangos}
                            barWidth={barWidthRangos}
```

Y agregar `</View>` después del cierre de `<BarChart />`.

**Step 3: Envolver BarChart "Notas obtenidas" con overflow:hidden**

Ubicar (línea ~785):
```typescript
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {ejeY('Materias')}
                          <BarChart
                            data={barrasNotas}
                            barWidth={barWidthNotas}
```

Reemplazar con:
```typescript
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {ejeY('Materias')}
                          <View style={{ overflow: 'hidden', flex: 1 }}>
                          <BarChart
                            data={barrasNotas}
                            barWidth={barWidthNotas}
```

Y agregar `</View>` después del cierre de `<BarChart />`.

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/screens/MetricsScreen.tsx
git commit -m "fix(metrics): wrap charts with overflow:hidden to prevent X-axis overflow"
```

---

## Task 4: Evaluaciones multi-materia — nueva función y prompt actualizado

**Files:**
- Modify: `src/utils/importExport.ts`

**Step 1: Agregar función `parsearJSONEvaluacionesMultiMateria`**

Al final de `importExport.ts`, antes del último export o al final del archivo, agregar:

```typescript
/**
 * Detecta si un JSON parseado es formato multi-materia de evaluaciones.
 * Multi-materia: array de objetos con clave "materia" y "evaluaciones".
 * Simple: array plano de evaluaciones (formato legacy).
 */
export function esFormatoMultiMateriaEval(parsed: unknown): parsed is { materia: string; evaluaciones: Evaluacion[] }[] {
  return (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    typeof parsed[0] === 'object' &&
    parsed[0] !== null &&
    'materia' in parsed[0] &&
    'evaluaciones' in parsed[0]
  );
}
```

Asegurate de importar `Evaluacion` si no está importado (verificar los imports existentes del archivo).

**Step 2: Actualizar `generarPromptEvaluaciones`**

Ubicar la función `generarPromptEvaluaciones()` (línea ~139) y reemplazar su return con:

```typescript
export function generarPromptEvaluaciones(): string {
  return `Generá un JSON con las evaluaciones de una o más materias.
Devolvé solo el JSON, sin explicaciones.

━━ FORMATO MULTI-MATERIA (recomendado) ━━
Usalo cuando querés importar evaluaciones para varias materias a la vez:
[
  {
    "materia": "Nombre exacto de la materia",
    "evaluaciones": [ ...array de evaluaciones... ]
  },
  {
    "materia": "Otra materia",
    "evaluaciones": [ ...array de evaluaciones... ]
  }
]

━━ FORMATO SIMPLE (una sola materia) ━━
Devolvé un array directamente:
[ ...array de evaluaciones... ]

━━ TIPOS DE EVALUACIÓN ━━

1. Evaluación simple:
{
  "id": "1",
  "tipo": "simple",
  "nombre": "Parcial 1",
  "pesoEnMateria": 40,
  "tipoNota": "numero",
  "nota": null,
  "notaMaxima": 12
}

2. Grupo de evaluaciones (con subítems):
{
  "id": "2",
  "tipo": "grupo",
  "nombre": "Trabajos prácticos",
  "pesoEnMateria": 30,
  "subEvaluaciones": [
    { "id": "2a", "nombre": "TP1", "tipoNota": "numero", "nota": null, "notaMaxima": 10 },
    { "id": "2b", "nombre": "TP2", "tipoNota": "numero", "nota": null, "notaMaxima": 10 }
  ]
}

Reglas:
- La suma de pesoEnMateria de todos los ítems raíz debe ser 100.
- tipoNota: "numero" o "porcentaje".
- nota: null si no hay nota aún.
- notaMaxima: puntaje máximo posible.

Mis materias y sus evaluaciones:
[describí acá cada materia con sus exámenes, trabajos y pesos aproximados]`;
}
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/utils/importExport.ts
git commit -m "feat(import): add esFormatoMultiMateriaEval helper and update evaluaciones prompt"
```

---

## Task 5: EditMateriaScreen — auto-detección de formato multi-materia

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx`

**Step 1: Agregar import de la nueva función**

Ubicar el import de `importExport.ts` en EditMateriaScreen. Agregar `esFormatoMultiMateriaEval` a los imports existentes.

Buscar la línea que importa desde `'../utils/importExport'` (o donde estén los imports de ese módulo) y agregar `esFormatoMultiMateriaEval`.

**Step 2: Reemplazar `importarEvaluaciones`**

Ubicar la función `importarEvaluaciones` (línea ~310):
```typescript
  const importarEvaluaciones = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'Importá desde la app móvil.');
      return;
    }
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      const parsed = JSON.parse(texto);
      if (!Array.isArray(parsed)) {
        Alert.alert('Formato inválido', 'El archivo debe ser un array JSON de evaluaciones.');
        return;
      }
      const evaluaciones = parsed as Evaluacion[];
      Alert.alert(
        'Importar evaluaciones',
        `Se encontraron ${evaluaciones.length} evaluación${evaluaciones.length !== 1 ? 'es' : ''}. ¿Qué querés hacer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar', onPress: () => setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, ...evaluaciones] })) },
          { text: 'Reemplazar', style: 'destructive', onPress: () => setForm(f => ({ ...f, evaluaciones })) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error al importar', e.message);
    }
  };
```

Reemplazar con:
```typescript
  const importarEvaluaciones = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('No disponible', 'Importá desde la app móvil.');
      return;
    }
    try {
      const texto = await leerArchivo(['application/json', '*/*']);
      if (!texto) return;
      const parsed = JSON.parse(texto);
      if (!Array.isArray(parsed)) {
        Alert.alert('Formato inválido', 'El archivo debe ser un array JSON de evaluaciones.');
        return;
      }

      // ── Modo multi-materia ─────────────────────────────────────────────────
      if (esFormatoMultiMateriaEval(parsed)) {
        const { guardarMateria, materias: materiasActuales } = useStore.getState();
        let procesadas = 0;
        const noEncontradas: string[] = [];

        parsed.forEach(({ materia: nombreMateria, evaluaciones: evals }) => {
          const match = materiasActuales.find(m =>
            m.nombre.toLowerCase() === nombreMateria.toLowerCase() ||
            String(m.numero) === String(nombreMateria)
          );
          if (match) {
            guardarMateria({ ...match, evaluaciones: [...match.evaluaciones, ...evals] });
            procesadas++;
          } else {
            noEncontradas.push(nombreMateria);
          }
        });

        const msg = `${procesadas} de ${parsed.length} materia(s) procesadas.` +
          (noEncontradas.length > 0 ? `\n\nNo encontradas: ${noEncontradas.join(', ')}` : '');
        Alert.alert('Importación completada', msg);
        return;
      }

      // ── Modo simple (formato legacy: array plano de evaluaciones) ──────────
      const evaluaciones = parsed as Evaluacion[];
      Alert.alert(
        'Importar evaluaciones',
        `Se encontraron ${evaluaciones.length} evaluación${evaluaciones.length !== 1 ? 'es' : ''}. ¿Qué querés hacer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar', onPress: () => setForm(f => ({ ...f, evaluaciones: [...f.evaluaciones, ...evaluaciones] })) },
          { text: 'Reemplazar', style: 'destructive', onPress: () => setForm(f => ({ ...f, evaluaciones })) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error al importar', e.message);
    }
  };
```

**Step 3: Verificar que `useStore` está importado en EditMateriaScreen**

Buscar `import { useStore }` en el archivo. Ya debería existir. Si no, agregar:
```typescript
import { useStore } from '../store/useStore';
```

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(import): support multi-materia format in importarEvaluaciones"
```

---

## Task 6: MateriaCard — agregar prop onLongPress

**Files:**
- Modify: `src/components/MateriaCard.tsx`

**Step 1: Agregar `onLongPress` a la interfaz Props**

Ubicar (línea ~38):
```typescript
interface Props {
  materia: Materia;
  todasLasMaterias: Materia[];
  config: Config;
  onEditar: () => void;
  onToggleCursando?: (v: boolean) => void;
  mostrarToggleCursando?: boolean;
}
```

Reemplazar con:
```typescript
interface Props {
  materia: Materia;
  todasLasMaterias: Materia[];
  config: Config;
  onEditar: () => void;
  onToggleCursando?: (v: boolean) => void;
  mostrarToggleCursando?: boolean;
  onLongPress?: () => void;
  pinned?: boolean;
}
```

**Step 2: Usar `onLongPress` y `pinned` en el componente**

Ubicar la línea de destructuring (línea ~47):
```typescript
export function MateriaCard({ materia, todasLasMaterias, config, onEditar, onToggleCursando, mostrarToggleCursando }: Props) {
```

Reemplazar con:
```typescript
export function MateriaCard({ materia, todasLasMaterias, config, onEditar, onToggleCursando, mostrarToggleCursando, onLongPress, pinned }: Props) {
```

**Step 3: Agregar borde de pin al contenedor raíz de la tarjeta**

Buscar el `TouchableOpacity` raíz de la tarjeta (el que envuelve toda la card y maneja el expand). Añadirle `onLongPress` y el borde condicional de `pinned`.

Buscar la apertura del TouchableOpacity raíz que contiene la lógica de expand (algo como `onPress={() => setExpandida(!expandida)}`). Modificarlo para agregar:
- `onLongPress={onLongPress}`
- en su `style`: agregar `borderWidth: pinned ? 2 : 0, borderColor: pinned ? tema.acento : undefined`

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/MateriaCard.tsx
git commit -m "feat(card): add onLongPress and pinned props to MateriaCard"
```

---

## Task 7: CarreraScreen — long-press para fijar materia de referencia

**Files:**
- Modify: `src/screens/CarreraScreen.tsx`

**Step 1: Agregar estado `materiaPinned`**

Ubicar el bloque de estados (línea ~43):
```typescript
  const [modoBusqueda, setModoBusqueda] = useState<'nombre' | 'es_previa_de' | 'sus_previas'>('nombre');
```

Agregar justo después:
```typescript
  const [materiaPinned, setMateriaPinned] = useState<typeof materias[0] | null>(null);
```

**Step 2: Limpiar pin al cambiar el texto de búsqueda**

Ubicar donde se llama `setTextoBusqueda` en el `onChangeText` del TextInput (línea ~366):
```typescript
                onChangeText={v => {
                  setTextoBusqueda(v);
                  if (!v) setModoBusqueda('nombre');
                }}
```

Reemplazar con:
```typescript
                onChangeText={v => {
                  setTextoBusqueda(v);
                  if (!v) setModoBusqueda('nombre');
                  setMateriaPinned(null);
                }}
```

También en el botón de limpiar (✕) que llama a `setTextoBusqueda('')`:
```typescript
                <TouchableOpacity onPress={() => { setTextoBusqueda(''); setModoBusqueda('nombre'); }}>
```
Reemplazar con:
```typescript
                <TouchableOpacity onPress={() => { setTextoBusqueda(''); setModoBusqueda('nombre'); setMateriaPinned(null); }}>
```

**Step 3: Modificar la lógica de los modos `es_previa_de` y `sus_previas`**

Ubicar (línea ~398):
```typescript
                } else if (modoBusqueda === 'es_previa_de') {
                  const nums = new Set(materias.filter(m => matchBusqueda(m)).map(m => m.numero));
                  resultados = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)));
                  emptyMsg = 'Esta materia no es requisito directo de ninguna otra';
                } else {
                  const nums = new Set(
                    materias.filter(m => matchBusqueda(m)).flatMap(m => m.previasNecesarias)
                  );
                  resultados = materias.filter(m => nums.has(m.numero));
                  emptyMsg = 'Esta materia no tiene previas requeridas';
                }
```

Reemplazar con:
```typescript
                } else if (modoBusqueda === 'es_previa_de') {
                  const nums = materiaPinned
                    ? new Set([materiaPinned.numero])
                    : new Set(materias.filter(m => matchBusqueda(m)).map(m => m.numero));
                  resultados = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)));
                  emptyMsg = 'Esta materia no es requisito directo de ninguna otra';
                } else {
                  const previas = materiaPinned
                    ? materiaPinned.previasNecesarias
                    : materias.filter(m => matchBusqueda(m)).flatMap(m => m.previasNecesarias);
                  const nums = new Set(previas);
                  resultados = materias.filter(m => nums.has(m.numero));
                  emptyMsg = 'Esta materia no tiene previas requeridas';
                }
```

**Step 4: Crear función `renderSearchResults` que pasa `onLongPress` y `pinned`**

La búsqueda usa `renderMateriasList(resultados)` (línea ~433). Reemplazar SOLO esa llamada dentro del bloque de búsqueda activa por una implementación inline que agrega `onLongPress` y `pinned`:

Buscar (dentro del bloque de búsqueda activa, línea ~432):
```typescript
                    ) : (
                      renderMateriasList(resultados)
                    )}
```

Reemplazar con:
```typescript
                    ) : (
                      isWeb ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {resultados.map(m => (
                            <View key={m.id} style={{ width: '50%', paddingHorizontal: 4 }}>
                              <MateriaCard
                                materia={m}
                                todasLasMaterias={materias}
                                config={config}
                                onEditar={() => irAEditar(m)}
                                mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
                                onToggleCursando={(v) => handleToggleCursandoCard(m, v)}
                                onLongPress={() => setMateriaPinned(prev => prev?.id === m.id ? null : m)}
                                pinned={materiaPinned?.id === m.id}
                              />
                            </View>
                          ))}
                        </View>
                      ) : (
                        resultados.map(m => (
                          <MateriaCard
                            key={m.id}
                            materia={m}
                            todasLasMaterias={materias}
                            config={config}
                            onEditar={() => irAEditar(m)}
                            mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
                            onToggleCursando={(v) => handleToggleCursandoCard(m, v)}
                            onLongPress={() => setMateriaPinned(prev => prev?.id === m.id ? null : m)}
                            pinned={materiaPinned?.id === m.id}
                          />
                        ))
                      )
                    )}
```

**Step 5: Agregar indicador de pin activo sobre los chips de modo**

Cuando `materiaPinned !== null`, mostrar un texto encima de los chips:

Ubicar el bloque de chips de modo (línea ~412):
```typescript
                    {/* Chips de modo */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
```

Insertar antes de ese `<View>`:
```typescript
                    {materiaPinned && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                        <Text style={{ color: tema.acento, fontSize: 12 }}>
                          📌 {materiaPinned.nombre}
                        </Text>
                        <TouchableOpacity onPress={() => setMateriaPinned(null)}>
                          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {/* Chips de modo */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
```

**Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat(search): long-press to pin materia as reference for Es-previa-de and Sus-previas modes"
```

---

## Checklist final

- [ ] Task 1: "Promedio acumulado" eliminado de METRICAS_GENERAL y su render en panel General
- [ ] Task 2: `cuellosBotella` siempre incluye cursando cuando `soloSiguiente` activo; subtítulo actualizado
- [ ] Task 3: 3 gráficos envueltos con `overflow: 'hidden'`
- [ ] Task 4: `esFormatoMultiMateriaEval` en importExport.ts; prompt actualizado con formato multi-materia
- [ ] Task 5: `importarEvaluaciones` auto-detecta formato y procesa multi-materia
- [ ] Task 6: MateriaCard acepta `onLongPress` y `pinned`
- [ ] Task 7: CarreraScreen pina materia con long-press, indicador visible, modos usan pin cuando disponible
