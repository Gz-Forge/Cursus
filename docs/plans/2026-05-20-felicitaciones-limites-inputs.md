# Felicitaciones por semestre + Límites de inputs — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrar un mensaje motivacional cuando el usuario exonera todo un semestre, y agregar límites de caracteres con contadores discretos en los inputs de la app.

**Architecture:** Bloque 1 — un `useEffect` en `CarreraScreen` detecta cambios en `materias` y dispara un modal cuando un semestre pasa a estar 100% exonerado. Las frases se eligen aleatoriamente sin repetir usando `frasesUsadas[]` persistido en `Config`. Bloque 2 — patrón inline de contador (Text debajo del TextInput) aplicado a cada input afectado.

**Tech Stack:** React Native + Expo, Zustand (store), TypeScript.

---

## Task 1: Agregar campos a Config + defaults

**Files:**
- Modify: `src/types/index.ts` (al final de `interface Config`)
- Modify: `src/store/useStore.ts` (en `CONFIG_DEFAULT`)
- Modify: `src/utils/perfiles.ts` (en `CONFIG_DEFAULT_PARCIAL`)

**Step 1: Agregar campos al tipo Config**

En `src/types/index.ts`, dentro de `interface Config`, agregar al final (después de `estadoNombresPersonalizados`):

```ts
  mostrarFelicitaciones?: boolean;  // default true — aviso al exonerar todo un semestre
  frasesUsadas?: number[];          // índices de frases ya mostradas (para no repetir)
```

**Step 2: Agregar defaults en useStore.ts**

En `src/store/useStore.ts`, dentro de `CONFIG_DEFAULT`, agregar:

```ts
  mostrarFelicitaciones: true,
  frasesUsadas: [],
```

**Step 3: Agregar defaults en perfiles.ts**

En `src/utils/perfiles.ts`, dentro de `CONFIG_DEFAULT_PARCIAL`, agregar:

```ts
  mostrarFelicitaciones: true,
  frasesUsadas: [] as number[],
```

**Step 4: Commit**

```bash
git add src/types/index.ts src/store/useStore.ts src/utils/perfiles.ts
git commit -m "feat(types): agregar mostrarFelicitaciones y frasesUsadas a Config"
```

---

## Task 2: Crear src/utils/frases.ts

**Files:**
- Create: `src/utils/frases.ts`

**Step 1: Crear el archivo con las 60 frases**

Extraer las 60 frases de `frases.md` (raíz del proyecto, fuera de TablaApp). Crear `src/utils/frases.ts`:

```ts
export const FRASES: string[] = [
  'Exoneraste todas las materias del semestre. Disfrutá este logro, porque refleja constancia, disciplina y muchísimo esfuerzo personal.',
  'Cerrar el semestre con todo exonerado no es suerte, es resultado de tu compromiso diario. Seguí así.',
  'Tu desempeño este semestre demuestra que vas construyendo grandes hábitos universitarios. Felicitaciones por el excelente resultado.',
  'Exonerar todas las materias requiere dedicación real. Hoy podés sentir orgullo por cada hora invertida durante el semestre.',
  'Terminaste el semestre sin finales pendientes. Excelente trabajo y gran demostración de responsabilidad académica.',
  'Cada exoneración representa esfuerzo sostenido. Haber logrado todas habla muy bien de tu capacidad y perseverancia.',
  'Lograste cerrar el semestre de la mejor manera posible. Felicitaciones y a seguir construyendo este gran camino universitario.',
  'Tus resultados muestran constancia y compromiso. Disfrutá este momento y seguí avanzando con la misma energía.',
  'Exonerar todo un semestre es un objetivo difícil. Haberlo conseguido merece reconocimiento y celebración.',
  'Tu dedicación durante el semestre tuvo recompensa. Excelente trabajo académico y gran ejemplo de organización.',
  'Felicitaciones por completar el semestre con todas las materias exoneradas. Tu esfuerzo realmente hizo la diferencia.',
  'Cerraste una etapa importante con resultados excelentes. Que este logro te motive para los próximos desafíos.',
  'Lo que conseguiste este semestre refleja disciplina, responsabilidad y muchas ganas de superarte constantemente.',
  'No todos logran exonerar todo un semestre. Valorá este resultado y seguí confiando en tus capacidades.',
  'Cada materia aprobada sin examen es fruto de trabajo constante. Excelente semestre y merecido reconocimiento.',
  'Tu rendimiento académico este semestre fue sobresaliente. Felicitaciones por mantener el compromiso hasta el final.',
  'Exoneraste todas las materias y eso merece celebrarse. Disfrutá el logro y preparate para seguir creciendo.',
  'Terminaste el semestre con excelentes resultados. El esfuerzo sostenido siempre termina dando recompensas importantes.',
  'Tus logros académicos muestran dedicación y constancia. Seguí avanzando con la misma actitud positiva.',
  'Este semestre fue una gran demostración de disciplina personal. Felicitaciones por el trabajo realizado.',
  'Exonerar todas las materias requiere mucho más que inteligencia: requiere constancia diaria. Excelente trabajo este semestre.',
  'Tu compromiso académico se reflejó claramente en los resultados. Felicitaciones por este gran cierre de semestre.',
  'Cada día de estudio valió la pena. Terminaste el semestre con un resultado realmente destacable.',
  'Felicitaciones por este logro académico tan importante. Tu esfuerzo constante quedó reflejado en cada materia exonerada.',
  'Haber exonerado todo el semestre habla de tu responsabilidad y capacidad para mantener objetivos claros.',
  'Excelente semestre. Tu dedicación y organización fueron claves para alcanzar este gran resultado académico.',
  'Hoy podés mirar atrás y reconocer todo lo que avanzaste. Felicitaciones por exonerar todas las materias.',
  'Tu esfuerzo silencioso durante el semestre terminó convirtiéndose en un resultado excelente. Muy buen trabajo.',
  'Exonerar todas las materias es reflejo de compromiso verdadero. Seguí construyendo este camino con confianza.',
  'Terminaste el semestre sin pendientes y con excelentes resultados. Disfrutá este logro totalmente merecido.',
  'Tu rendimiento demuestra que el trabajo constante siempre tiene recompensa. Felicitaciones por este gran semestre.',
  'Este logro académico es resultado de muchas pequeñas decisiones correctas tomadas durante el semestre.',
  'Felicitaciones por mantener el nivel durante todo el semestre. Tu constancia realmente marcó la diferencia.',
  'Exoneraste todas las materias y eso merece reconocimiento. Excelente trabajo y gran forma de cerrar el semestre.',
  'Tu desempeño académico este semestre fue ejemplar. Seguí confiando en tu capacidad para alcanzar metas importantes.',
  'Lograste uno de los mejores cierres posibles para un semestre universitario. Felicitaciones por el esfuerzo realizado.',
  'Cada exoneración representa horas de estudio y dedicación. Haber logrado todas es realmente destacable.',
  'Tus resultados reflejan organización, disciplina y perseverancia. Excelente semestre y merecidas felicitaciones.',
  'Exonerar todas las materias no ocurre por casualidad. Es consecuencia directa de tu compromiso académico.',
  'Terminaste el semestre demostrando gran responsabilidad y constancia. Seguí avanzando con esa misma mentalidad.',
  'Felicitaciones por este gran resultado académico. Tu esfuerzo constante quedó reflejado en cada evaluación.',
  'Cerraste el semestre con excelentes logros y mucho aprendizaje acumulado. Muy buen trabajo realizado.',
  'Exonerar todo un semestre requiere mantener el foco durante meses. Excelente trabajo y gran dedicación.',
  'Tu constancia académica dio resultados sobresalientes. Felicitaciones por completar el semestre con éxito total.',
  'Este semestre deja claro que vas por muy buen camino. Seguí construyendo sobre este gran avance.',
  'Cada materia exonerada representa un objetivo cumplido. Haber conseguido todas merece una felicitación especial.',
  'Excelente trabajo durante todo el semestre. Tus resultados reflejan compromiso y dedicación sostenida.',
  'Felicitaciones por alcanzar este logro académico tan importante. Que sea motivación para tus próximos desafíos.',
  'Tu desempeño demuestra que la disciplina diaria tiene resultados concretos. Excelente cierre de semestre.',
  'Exoneraste todas las materias y eso habla muy bien de tu esfuerzo, organización y compromiso académico.',
  'Terminaste el semestre con resultados excelentes y sin pendientes. Disfrutá este logro completamente merecido.',
  'Lo conseguido este semestre refleja trabajo constante y mucha perseverancia. Felicitaciones por el gran resultado.',
  'Mantener un rendimiento así durante todo el semestre no es fácil. Excelente trabajo académico.',
  'Felicitaciones por este semestre sobresaliente. Tu compromiso y dedicación fueron claves para alcanzar este resultado.',
  'Exonerar todas las materias es un logro importante. Seguí confiando en tu capacidad y manteniendo este nivel.',
  'Tus resultados muestran que el esfuerzo sostenido siempre vale la pena. Excelente semestre y felicitaciones.',
  'Cerraste el semestre de manera impecable. Que este logro te impulse hacia nuevos objetivos académicos.',
  'Excelente desempeño académico. Haber exonerado todas las materias refleja constancia y gran responsabilidad personal.',
  'Tu esfuerzo durante el semestre tuvo una recompensa enorme. Felicitaciones por este gran logro universitario.',
  'Exoneraste todo el semestre y eso merece reconocimiento. Disfrutá este momento y seguí creciendo académicamente.',
];

/** Elige una frase aleatoria que no esté en `usadas`. Resetea si ya se usaron todas. */
export function elegirFrase(usadas: number[]): { frase: string; idx: number; nuevasUsadas: number[] } {
  const total = FRASES.length;
  const pool = usadas.length >= total ? [] : usadas;
  const disponibles = Array.from({ length: total }, (_, i) => i).filter(i => !pool.includes(i));
  const idx = disponibles[Math.floor(Math.random() * disponibles.length)];
  return {
    frase: FRASES[idx],
    idx,
    nuevasUsadas: [...pool, idx],
  };
}
```

**Step 2: Commit**

```bash
git add src/utils/frases.ts
git commit -m "feat(frases): crear utils con 60 frases motivacionales y elegirFrase()"
```

---

## Task 3: Detección de semestre completo en CarreraScreen

**Files:**
- Modify: `src/screens/CarreraScreen.tsx`

**Step 1: Agregar imports al inicio del archivo**

Agregar a los imports existentes:

```ts
import { FRASES, elegirFrase } from '../utils/frases';
```

Y asegurarse de que `ConfirmModal` ya está importado (ya lo está).

**Step 2: Agregar estado y ref para el modal de felicitaciones**

Dentro de la función `CarreraScreen`, junto a los otros `useState`:

```ts
const [felicitacionModal, setFelicitacionModal] = useState<{ semestre: number; frase: string } | null>(null);
const semestresCompletadosRef = React.useRef<Set<number> | null>(null);
```

**Step 3: Agregar useEffect de detección**

Agregar después de los otros `useEffect` existentes (después del de `config.modoExamen`):

```ts
  useEffect(() => {
    if (config.mostrarFelicitaciones === false) return;

    // Calcular semestres donde TODAS las materias son 'exonerado'
    const semestresUnicos = [...new Set(materias.map(m => m.semestre))];
    const completados = new Set(
      semestresUnicos.filter(sem => {
        const enSem = materias.filter(m => m.semestre === sem);
        return enSem.length > 0 && enSem.every(m => calcularEstadoFinal(m, config) === 'exonerado');
      })
    );

    // En la primera ejecución, inicializar el ref sin disparar modal
    if (semestresCompletadosRef.current === null) {
      semestresCompletadosRef.current = completados;
      return;
    }

    // Detectar semestres recién completados
    const prevCompletados = semestresCompletadosRef.current;
    semestresCompletadosRef.current = completados;

    for (const sem of completados) {
      if (!prevCompletados.has(sem)) {
        const { frase, idx, nuevasUsadas } = elegirFrase(config.frasesUsadas ?? []);
        actualizarConfig({ frasesUsadas: nuevasUsadas });
        setFelicitacionModal({ semestre: sem, frase });
        break; // mostrar de a uno
      }
    }
  }, [materias, config]);
```

**Step 4: Agregar el ConfirmModal de felicitaciones**

Dentro del JSX de `CarreraScreen`, junto a los otros modales al final (antes del `</View>` final del `contenido`):

```tsx
      <ConfirmModal
        visible={!!felicitacionModal}
        titulo={`🎉 ¡Semestre ${felicitacionModal?.semestre}° completo!`}
        mensaje={felicitacionModal?.frase ?? ''}
        labelConfirmar="¡Gracias!"
        onConfirmar={() => setFelicitacionModal(null)}
        onCancelar={() => setFelicitacionModal(null)}
      />
```

**Step 5: Commit**

```bash
git add src/screens/CarreraScreen.tsx
git commit -m "feat(carrera): modal de felicitaciones al completar semestre con frases sin repetir"
```

---

## Task 4: Toggle mostrarFelicitaciones en ConfigScreen

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

**Step 1: Extender el tipo del helper toggle()**

En `ConfigScreen.tsx`, el helper `toggle` tiene este signature (línea ~196):

```ts
const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias' | 'mostrarNombreCompletoEnBloque', descripcion?: string) => {
```

Agregar `'mostrarFelicitaciones'` a la unión:

```ts
const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias' | 'mostrarNombreCompletoEnBloque' | 'mostrarFelicitaciones', descripcion?: string) => {
```

**Step 2: Agregar el toggle en el panel App**

En el bloque `tabActiva === 'app'`, después del bloque de APARIENCIA (después de la navegación a TarjetaConfig, antes de ESTADOS DE MATERIA), agregar:

```tsx
          <Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>MOTIVACIÓN</Text>
          {toggle(
            'Felicitaciones por semestre completo',
            'mostrarFelicitaciones',
            'Mostrá un mensaje motivacional cuando exonerás todas las materias de un semestre',
          )}
```

**Step 3: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(config): toggle mostrarFelicitaciones en panel App"
```

---

## Task 5: Límites + contadores en ConfigScreen

**Files:**
- Modify: `src/screens/ConfigScreen.tsx`

Patrón de contador a usar (inline, sin componente separado):

```tsx
<View style={{ marginBottom: N }}>
  <TextInput ... maxLength={MAX} />
  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
    {value.length}/{MAX}
  </Text>
</View>
```

**Step 1: Nombres de estado de materia — maxLength 20**

En el bloque del panel de estados (alrededor de línea 341), el TextInput de nombre:

```tsx
<TextInput
  style={{ ... }}
  value={config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado]}
  onChangeText={v => { ... }}
  maxLength={20}
  ...
/>
```

Envolver en View con contador. Reemplazar el bloque actual:

```tsx
{/* Nombre editable */}
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
  <Text style={{ color: tema.textoSecundario, fontSize: 12, width: 52 }}>Nombre</Text>
  <View style={{ flex: 1 }}>
    <TextInput
      style={{
        flex: 1, backgroundColor: tema.superficie,
        color: tema.texto, padding: 8, borderRadius: 6,
        fontSize: 14, borderWidth: 1, borderColor: tema.borde,
      }}
      value={config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado]}
      onChangeText={v => {
        const trimmed = v.trim();
        if (!trimmed) return;
        actualizarConfig({
          estadoNombresPersonalizados: {
            ...config.estadoNombresPersonalizados,
            [estado]: trimmed,
          },
        });
      }}
      placeholder={ESTADO_NOMBRES[estado]}
      placeholderTextColor={tema.textoSecundario}
      maxLength={20}
    />
    <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
      {(config.estadoNombresPersonalizados?.[estado] ?? ESTADO_NOMBRES[estado]).length}/20
    </Text>
  </View>
</View>
```

**Step 2: Tipos de formación — maxLength 50**

Hay dos inputs de formación en ConfigScreen:
1. El input "Nuevo tipo..." (alrededor de línea 526):

```tsx
<TextInput
  placeholder="Nuevo tipo..."
  ...
  value={nuevoTipo}
  onChangeText={setNuevoTipo}
  maxLength={50}
/>
```
Agregar contador debajo:
```tsx
{nuevoTipo.length > 0 && (
  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
    {nuevoTipo.length}/50
  </Text>
)}
```

2. El TextInput de edición inline (alrededor de línea 484):
```tsx
<TextInput
  autoFocus
  style={{ ... }}
  value={textoEdicion}
  onChangeText={setTextoEdicion}
  ...
  maxLength={50}
/>
```
Agregar contador debajo del TextInput de edición.

**Step 3: Título completo de tipo de bloque — maxLength 35**

En el bloque de tipos de bloque de horario (alrededor de línea 564), el primer TextInput de cada fila (nombre completo):

```tsx
<TextInput
  style={{ flex: 1, ... }}
  value={String(config[labelKey] ?? '')}
  onChangeText={v => actualizarConfig({ [labelKey]: v } as any)}
  ...
  maxLength={35}
/>
```

Envolver en View con contador:

```tsx
<View style={{ flex: 1 }}>
  <TextInput
    style={{ flex: 1, backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 8, fontSize: 14 }}
    value={String(config[labelKey] ?? '')}
    onChangeText={v => actualizarConfig({ [labelKey]: v } as any)}
    placeholder={labelKey.replace('label', '')}
    placeholderTextColor={tema.textoSecundario}
    maxLength={35}
  />
  <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
    {String(config[labelKey] ?? '').length}/35
  </Text>
</View>
```

**Step 4: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(config): límites de caracteres con contadores en estados, tipos de formación y bloques"
```

---

## Task 6: Límites + validaciones en EditMateriaScreen

**Files:**
- Modify: `src/screens/EditMateriaScreen.tsx`

**Step 1: Actualizar helper campo() para soportar maxLength**

El helper `campo` actual (línea 507) no soporta `maxLength`. Reemplazarlo:

```ts
const campo = (label: string, value: string, onChange: (v: string) => void, numerico = false, maxLength?: number) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>{label}</Text>
    <TextInput
      style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8, ...(numerico ? { width: 80 } : {}) }}
      value={value}
      onChangeText={onChange}
      keyboardType={numerico ? 'numeric' : 'default'}
      maxLength={maxLength}
    />
    {maxLength !== undefined && (
      <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
        {value.length}/{maxLength}
      </Text>
    )}
  </View>
);
```

**Step 2: Agregar maxLength=100 al campo Nombre**

En la línea donde se llama `campo('Nombre', ...)` (línea 542):

```tsx
{campo('Nombre', form.nombre, v => setForm(f => ({ ...f, nombre: v })), false, 100)}
```

**Step 3: Validar nota manual — no superar notaMaxima**

En `handleNotaManualChange` (línea 148), agregar clamp superior para modo 'numero':

```ts
const handleNotaManualChange = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
  setNotaManualStr(normalized);
  const num = parseFloat(normalized);
  if (!isNaN(num)) {
    const maxVal = form.tipoNotaManual === 'numero' ? config.notaMaxima : 100;
    const clamped = Math.max(0, Math.min(maxVal, num));
    const pct = form.tipoNotaManual === 'numero' ? (clamped / config.notaMaxima) * 100 : clamped;
    // Si el usuario escribió más que el máximo, corregir el string también
    if (num > maxVal) setNotaManualStr(String(maxVal));
    setForm(f => ({ ...f, notaManual: Math.max(0, Math.min(100, pct)) }));
  } else if (normalized === '' || normalized === '.') {
    setForm(f => ({ ...f, notaManual: null }));
  }
};
```

**Step 4: Validar asistencias — clamp 1-99 en onBlur**

En el bloque de `faltasMaxTeorica` / `faltasMaxPractica` (alrededor de línea 1294), agregar `onBlur` al TextInput existente:

```tsx
<TextInput
  style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 10, borderRadius: 8 }}
  value={form[key] !== undefined ? String(form[key]) : ''}
  onChangeText={v => {
    const n = parseInt(v, 10);
    setForm(f => ({ ...f, [key]: v === '' ? undefined : isNaN(n) ? f[key] : n }));
  }}
  onBlur={() => {
    const val = form[key];
    if (val !== undefined) {
      setForm(f => ({ ...f, [key]: Math.max(1, Math.min(99, val)) }));
    }
  }}
  keyboardType="number-pad"
  placeholder="Sin límite"
  placeholderTextColor={tema.textoSecundario}
/>
```

**Step 5: Commit**

```bash
git add src/screens/EditMateriaScreen.tsx
git commit -m "feat(edit-materia): maxLength nombre, clamp nota manual y asistencias 1-99"
```

---

## Task 7: Límite maxLength=20 en EvaluacionItem

**Files:**
- Modify: `src/components/EvaluacionItem.tsx`

Hay tres TextInputs de nombre en EvaluacionItem:

1. **Nombre de evaluación simple** (línea ~354-355):
```tsx
<TextInput style={estilos.input} placeholder="Nombre" placeholderTextColor={tema.textoSecundario}
  value={evaluacion.nombre} onChangeText={nombre => actualizarSimple({ nombre })}
  maxLength={20} />
<Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
  {evaluacion.nombre.length}/20
</Text>
```

2. **Nombre del grupo** (línea ~421-422):
```tsx
<TextInput style={estilos.input} placeholder="Nombre del grupo" placeholderTextColor={tema.textoSecundario}
  value={grupo.nombre} onChangeText={nombre => onChange({ ...grupo, nombre })}
  maxLength={20} />
<Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
  {grupo.nombre.length}/20
</Text>
```

3. **Nombre de sub-evaluación** (línea ~433-434):
```tsx
<TextInput style={estilos.input} placeholder={`Prueba ${i + 1}`} placeholderTextColor={tema.textoSecundario}
  value={sub.nombre} onChangeText={nombre => actualizarSub(i, { nombre })}
  maxLength={20} />
<Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
  {sub.nombre.length}/20
</Text>
```

Para cada uno: el `<Text>` contador va inmediatamente después del `<TextInput>`, sin envolver en View adicional (ya están dentro de Views).

**Step 2: Commit**

```bash
git add src/components/EvaluacionItem.tsx
git commit -m "feat(evaluacion): maxLength 20 con contadores en nombres de evaluaciones"
```

---

## Task 8: PR final

```bash
git push
gh pr create \
  --title "feat: felicitaciones por semestre + límites de caracteres en inputs" \
  --body "$(cat <<'EOF'
## Summary
- Modal motivacional al exonerar todas las materias de un semestre, con 60 frases sin repetir
- Toggle en Config > App para activar/desactivar las felicitaciones
- Límites de caracteres con contadores discretos (X/MAX) en: nombres de materia (100), evaluaciones (20), estados de materia (20), tipos de formación (50), título de tipo de bloque (35)
- Asistencias (faltasMax) clampean a rango 1-99 en onBlur
- Nota manual no puede superar la nota máxima configurada

## Test plan
- [ ] Marcar todas las materias de un semestre como exoneradas → debe aparecer modal con frase
- [ ] Repetir para verificar que no sale la misma frase dos veces consecutivas
- [ ] Desactivar toggle en Config > App → no aparece modal
- [ ] Verificar contadores en cada input afectado
- [ ] Ingresar nota manual mayor a notaMaxima → se trunca al máximo
- [ ] Ingresar faltasMax > 99 y salir del input → se clampea a 99

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
