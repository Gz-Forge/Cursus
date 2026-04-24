# Plan C — Evaluaciones en Horario

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir asignar fecha y hora a las evaluaciones simples de una materia para que aparezcan como bloques especiales en la pantalla de Horario, vinculados con el tipo "Parcial". El sistema debe agrupar evaluaciones con la misma fecha y mostrarlas integradas junto con los bloques de horario regulares.

**Architecture:** `EvaluacionSimple` recibe campos opcionales `fecha?: string` y `hora?: number` (minutos desde 00:00, igual que `BloqueHorario`). `HorarioScreen` combina los bloques regulares con las evaluaciones con fecha, renderizándolas con un estilo visual diferenciado (borde discontinuo, icono). No se crea un nuevo `TipoBloque` — las evaluaciones son un tipo de render separado. La decisión de mostrar o no evaluaciones en el horario se controla con `config.horarioMostrarEvaluaciones: boolean`.

**Tech Stack:** React Native, Expo, TypeScript, Zustand.

---

## Task 1 — Añadir campos de fecha/hora a EvaluacionSimple

**Archivos:**
- Modificar: `src/types/index.ts`

**Contexto:** `EvaluacionSimple` (líneas 11-19 de `types/index.ts`) no tiene fecha ni hora. Hay que añadir campos opcionales compatibles con el formato de `BloqueHorario`.

**Cambio en `EvaluacionSimple`:**
```ts
export interface EvaluacionSimple {
  id: string;
  tipo: 'simple';
  nombre: string;
  pesoEnMateria: number;
  tipoNota: TipoNota;
  nota: number | null;
  notaMaxima: number;
  // Nuevos campos:
  fecha?: string;       // 'YYYY-MM-DD', opcional — si está, aparece en el horario
  hora?: number;        // minutos desde 00:00, ej: 480 = 08:00
  horaFin?: number;     // minutos desde 00:00, duración opcional
}
```

**También añadir campo de config:**
```ts
// En interfaz Config:
horarioMostrarEvaluaciones: boolean;  // default: true
```

**Commit:**
```bash
git add src/types/index.ts
git commit -m "feat: campos fecha/hora en EvaluacionSimple y config horarioMostrarEvaluaciones"
```

---

## Task 2 — Actualizar CONFIG_DEFAULT en useStore

**Archivos:**
- Modificar: `src/store/useStore.ts`

```ts
// En CONFIG_DEFAULT:
horarioMostrarEvaluaciones: true,
```

**Commit:**
```bash
git add src/store/useStore.ts
git commit -m "feat: default horarioMostrarEvaluaciones en CONFIG_DEFAULT"
```

---

## Task 3 — Inputs de fecha/hora en EvaluacionItem

**Archivos:**
- Modificar: `src/components/EvaluacionItem.tsx`

**Contexto:** `EvaluacionItem` renderiza `EvaluacionSimple` con campos nombre, peso, nota, notaMaxima, tipoNota. Hay que agregar una sección colapsable "Fecha en horario" debajo de los campos existentes.

**Helpers de formato** (añadir al tope del archivo):
```ts
function autoFormatHora(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function autoFormatFecha(prev: string, next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parsearFechaEval(str: string): string | null {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return isNaN(Date.parse(`${y}-${mo}-${d}T00:00:00`)) ? null : `${y}-${mo}-${d}`;
}

function parsearHoraEval(str: string): number | null {
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtHoraEval(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

function isoToDisplay(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}
```

**Sección de fecha/hora a añadir en el bloque `evaluacion.tipo === 'simple'`**, después del TouchableOpacity de tipoNota y antes del resultado de contribución:

```tsx
{/* ── Fecha en horario (colapsable) ─────────────────────────────────── */}
{(() => {
  const ev = evaluacion as EvaluacionSimple;
  const tieneFecha = !!ev.fecha;

  // Estado local: strings de edición
  const [fechaStr, setFechaStr] = React.useState(ev.fecha ? isoToDisplay(ev.fecha) : '');
  const [horaStr, setHoraStr] = React.useState(ev.hora !== undefined ? fmtHoraEval(ev.hora) : '');
  const [horaFinStr, setHoraFinStr] = React.useState(ev.horaFin !== undefined ? fmtHoraEval(ev.horaFin) : '');
  const [expandido, setExpandido] = React.useState(tieneFecha);

  const guardarFechaHora = () => {
    const fecha = parsearFechaEval(fechaStr);
    const hora = parsearHoraEval(horaStr);
    const horaFin = horaFinStr ? parsearHoraEval(horaFinStr) : undefined;
    if (!fecha && fechaStr) return; // input inválido, no guardar
    actualizarSimple({
      fecha: fecha ?? undefined,
      hora: hora ?? undefined,
      horaFin: horaFin ?? undefined,
    });
  };

  return (
    <View style={{ marginTop: 6 }}>
      <TouchableOpacity
        onPress={() => setExpandido(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={[estilos.label, { flex: 1 }]}>
          {tieneFecha ? `📅 ${isoToDisplay(ev.fecha!)} ${ev.hora !== undefined ? fmtHoraEval(ev.hora) : ''}` : '📅 Sin fecha en horario'}
        </Text>
        <Text style={{ color: tema.acento, fontSize: 11 }}>{expandido ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandido && (
        <View style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginTop: 6 }}>
          <Text style={[estilos.label, { marginBottom: 4 }]}>Fecha (DD/MM/AAAA)</Text>
          <TextInput
            style={[estilos.input, { marginBottom: 8 }]}
            value={fechaStr}
            onChangeText={v => setFechaStr(autoFormatFecha(fechaStr, v))}
            onBlur={guardarFechaHora}
            placeholder="15/04/2026"
            placeholderTextColor={tema.textoSecundario}
            keyboardType="numbers-and-punctuation"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[estilos.label, { marginBottom: 4 }]}>Hora inicio (HH:MM)</Text>
              <TextInput
                style={estilos.input}
                value={horaStr}
                onChangeText={v => setHoraStr(autoFormatHora(horaStr, v))}
                onBlur={guardarFechaHora}
                placeholder="08:00"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[estilos.label, { marginBottom: 4 }]}>Hora fin (HH:MM, opcional)</Text>
              <TextInput
                style={estilos.input}
                value={horaFinStr}
                onChangeText={v => setHoraFinStr(autoFormatHora(horaFinStr, v))}
                onBlur={guardarFechaHora}
                placeholder="10:00"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          {(ev.fecha || ev.hora !== undefined) && (
            <TouchableOpacity
              onPress={() => {
                setFechaStr(''); setHoraStr(''); setHoraFinStr('');
                actualizarSimple({ fecha: undefined, hora: undefined, horaFin: undefined });
              }}
              style={{ marginTop: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar del horario</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
})()}
```

**Nota importante:** Los hooks (`useState`) deben estar en un subcomponente separado, no en una IIFE dentro del render, para no violar las reglas de hooks. Extraer la sección como `<FechaHoraEval evaluacion={ev} onActualizar={actualizarSimple} />`.

**Commit:**
```bash
git add src/components/EvaluacionItem.tsx
git commit -m "feat: inputs de fecha y hora en EvaluacionItem para mostrar en horario"
```

---

## Task 4 — Renderizar evaluaciones en HorarioScreen

**Archivos:**
- Modificar: `src/screens/HorarioScreen.tsx`

**Contexto:**
`HorarioScreen` ya filtra `todosLosBloques` de materias cursando. Hay que añadir una segunda fuente de bloques: las evaluaciones simples con fecha+hora de esas mismas materias.

**Paso 1 — Importar tipos:**
```ts
import { BloqueHorario, EvaluacionSimple, Evaluacion } from '../types';
```

**Paso 2 — Calcular evaluaciones con fecha:**
```ts
// Añadir después de todosLosBloques (línea ~127):
const todasLasEvaluaciones: Array<EvaluacionSimple & { materia: typeof todosLosBloques[0]['materia'] }> =
  config.horarioMostrarEvaluaciones
    ? materias
        .filter(m => calcularEstadoFinal(m, config) === 'cursando')
        .flatMap(m =>
          m.evaluaciones
            .filter((ev): ev is EvaluacionSimple =>
              ev.tipo === 'simple' && !!ev.fecha && ev.hora !== undefined
            )
            .map(ev => ({ ...ev, materia: m }))
        )
    : [];
```

**Paso 3 — Incluir evaluaciones en el rango horario:**
```ts
// Extender el cálculo de horaInicio/horaFin para incluir evaluaciones:
const todosTiempos = [
  ...todosLosBloques.map(b => [b.horaInicio, b.horaFin]),
  ...todasLasEvaluaciones.map(ev => [ev.hora!, ev.horaFin ?? ev.hora! + 60]),
].flat();

const horaInicio = todosTiempos.length > 0
  ? Math.min(HORA_DEF_INICIO, Math.floor(Math.min(...todosTiempos) / 60) * 60)
  : HORA_DEF_INICIO;
const horaFin = todosTiempos.length > 0
  ? Math.max(HORA_DEF_FIN, Math.ceil(Math.max(...todosTiempos) / 60) * 60)
  : HORA_DEF_FIN;
```

**Paso 4 — Filtrar evaluaciones de la semana:**
```ts
const evaluacionesEstaSemana = todasLasEvaluaciones.filter(
  ev => ev.fecha! >= fechasSemana[0] && ev.fecha! <= fechasSemana[6]
);
```

**Paso 5 — Renderizar evaluaciones en cada columna de día** (dentro del map de `fechasSemana`, después del render de `bloquesEstaSemana`):

```tsx
{/* Evaluaciones / Parciales */}
{evaluacionesEstaSemana
  .filter(ev => ev.fecha === fecha)
  .map(ev => {
    const horaI = ev.hora!;
    const horaF = ev.horaFin ?? horaI + 60;  // si no hay horaFin, asumir 1 hora
    const top    = (horaI - horaInicio) * PX_POR_MIN;
    const height = Math.max((horaF - horaI) * PX_POR_MIN, 16);
    // Color: usar el color de parcial de esa materia si está configurado, sino naranja
    const colorConfig = config.coloresHorario?.[ev.materia.id]?.parcial;
    const fondoColor  = colorConfig?.fondo ?? '#FF9800';
    const textoColor  = colorConfig?.texto ?? '#fff';

    return (
      <View key={ev.id} style={{
        position: 'absolute', top, height,
        left: 1, right: 1,
        backgroundColor: fondoColor,
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: textoColor,
        borderStyle: 'dashed',
        padding: 2,
        overflow: 'hidden',
      }}>
        <Text
          style={{ color: textoColor, fontSize: 8, fontWeight: '700', lineHeight: 11 }}
          numberOfLines={Math.max(1, Math.floor((height - 4) / 11))}
          ellipsizeMode="tail"
        >
          📝 {ev.nombre || ev.materia.nombre}
        </Text>
      </View>
    );
  })}
```

**Verificación:** Al añadir fecha y hora a una evaluación de una materia cursando, ese bloque aparece en el horario semanal correspondiente con borde discontinuo y emoji 📝. Usa el color de "parcial" configurado si existe.

**Commit:**
```bash
git add src/screens/HorarioScreen.tsx
git commit -m "feat: renderizar evaluaciones con fecha como bloques en HorarioScreen"
```

---

## Task 5 — Toggle en ConfigScreen para mostrar/ocultar evaluaciones en horario

**Archivos:**
- Modificar: `src/screens/ConfigScreen.tsx`

En la sección "TIPOS DE BLOQUE DE HORARIO" (o al final de la sección de horario), añadir el toggle usando la función `toggle` existente.

Primero hay que extender el tipo de la función `toggle` para incluir `'horarioMostrarEvaluaciones'`:

```ts
// Cambiar la firma de la función toggle:
const toggle = (label: string, key: 'usarEstadoAprobado' | 'aprobadoHabilitaPrevias' | 'mostrarNombreCompletoEnBloque' | 'horarioMostrarEvaluaciones', descripcion?: string) => {
```

Luego añadir el toggle en la sección de horario:
```tsx
{toggle(
  'Mostrar evaluaciones en el horario',
  'horarioMostrarEvaluaciones',
  'Muestra las evaluaciones con fecha como bloques especiales en la vista semanal',
)}
```

**Verificación:** En Configuración aparece el toggle. Al desactivarlo, las evaluaciones desaparecen del horario.

**Commit:**
```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat: toggle para mostrar/ocultar evaluaciones en horario"
```

---

## Resumen de archivos tocados

| Archivo | Cambio |
|---------|--------|
| `src/types/index.ts` | Campos `fecha`, `hora`, `horaFin` en `EvaluacionSimple`; `horarioMostrarEvaluaciones` en `Config` |
| `src/store/useStore.ts` | Default `horarioMostrarEvaluaciones: true` |
| `src/components/EvaluacionItem.tsx` | Subcomponente `FechaHoraEval` con inputs de fecha/hora colapsables |
| `src/screens/HorarioScreen.tsx` | Calcular y renderizar evaluaciones con fecha como bloques especiales |
| `src/screens/ConfigScreen.tsx` | Toggle para mostrar/ocultar evaluaciones en horario |

## Notas de diseño

- **¿Por qué no un nuevo TipoBloque?** — Las evaluaciones ya tienen su propio tipo en el sistema de notas. Duplicarlas como `BloqueHorario` crearía desincronización. Es mejor renderizarlas directamente desde `evaluaciones`.
- **Vinculación con tipo "Parcial":** La vinculación visual existe: los bloques de evaluación usan el color configurado para el tipo "parcial" de esa materia. Para vincular datos, el usuario puede nombrar la evaluación igual que el parcial correspondiente.
- **Agrupación:** Si varias evaluaciones caen en la misma fecha/hora, se superponen igual que los bloques normales (mismo comportamiento que bloques solapados). No se agrupan automáticamente.
