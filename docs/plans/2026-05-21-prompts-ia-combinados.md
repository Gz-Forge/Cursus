# Prompts IA Combinados — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar los 6 acordeones individuales de "PROMPTS PARA IA" en la pestaña Datos por una UI con checkboxes que genera un único prompt fusionado según los módulos seleccionados.

**Architecture:** Se agrega `generarPromptCombinado(modulos, config, materias)` en `importExport.ts`. Si hay un solo módulo, delega al prompt individual existente. Si hay múltiples, construye un prompt "todo en uno" con solo las secciones seleccionadas. ConfigScreen.tsx reemplaza los 6 acordeones y sus 6 estados por la nueva UI.

**Tech Stack:** React Native, TypeScript, expo-clipboard

---

## Task 1: Actualizar imports y agregar tipo `ModuloIA` en importExport.ts

**Files:**
- Modify: `src/utils/importExport.ts:1`

**Step 1: Actualizar la línea de import en importExport.ts**

Reemplazar la línea 1:
```ts
import { Materia, BloqueHorario, Evaluacion, TipoBloque } from '../types';
```
por:
```ts
import { Materia, BloqueHorario, Evaluacion, TipoBloque, EvaluacionSimple, GrupoEvaluacion, Config } from '../types';
```

**Step 2: Verificar que los tipos existen en types/index.ts**

Buscar `EvaluacionSimple`, `GrupoEvaluacion`, `Config` en `src/types/index.ts`. Si alguno no está exportado con ese nombre exacto, usar el nombre correcto en el import. (Basado en el análisis ya hecho: todos existen.)

**Step 3: Agregar export del tipo `ModuloIA` justo después del import (línea 2)**

```ts
export type ModuloIA = 'carrera' | 'horarios' | 'evaluaciones' | 'config' | 'colores';
```

**Step 4: Commit**

```bash
git add src/utils/importExport.ts
git commit -m "feat(prompts-ia): add ModuloIA type and Config import"
```

---

## Task 2: Agregar función `generarPromptCombinado` en importExport.ts

**Files:**
- Modify: `src/utils/importExport.ts` — agregar al final del archivo (después de `generarPromptConfig`)

**Step 1: Agregar función helper para el prompt de colores**

Esta lógica estaba inline en ConfigScreen. Agregar al final de `importExport.ts`:

```ts
const COLORES_BLOQUES_DEFAULT_PROMPT = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#009688',
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
];

function buildSeccionColores(config: Config, materias: Materia[]): string {
  const materiasConHorario = materias.filter(m => {
    const bloques = m.bloques ?? [];
    const tieneEvalsConFecha = config.horarioMostrarEvaluaciones &&
      m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha);
    return bloques.length > 0 || tieneEvalsConFecha;
  });

  if (materiasConHorario.length === 0) return '';

  const labelTipo = (tipo: string, cfg: Config) => {
    switch (tipo) {
      case 'teorica':  return cfg.labelTeorica  || 'Teórica';
      case 'practica': return cfg.labelPractica || 'Práctica';
      case 'parcial':  return 'Evaluación';
      case 'otro':     return cfg.labelOtro     || 'Otro';
      default:         return tipo;
    }
  };

  const materiasExport = materiasConHorario.map(m => {
    const tiposBloque = [...new Set((m.bloques ?? []).map((b: BloqueHorario) => b.tipo))] as TipoBloque[];
    const tieneEvalsConFecha = config.horarioMostrarEvaluaciones &&
      m.evaluaciones.some(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha);
    if (tieneEvalsConFecha && !tiposBloque.includes('parcial')) tiposBloque.push('parcial');

    const coloresPersonalizados = config.coloresHorario?.[m.id] ?? {};
    const colorFondoDefault = COLORES_BLOQUES_DEFAULT_PROMPT[m.numero % COLORES_BLOQUES_DEFAULT_PROMPT.length];
    const coloresActuales: Record<string, { fondo: string; texto: string }> = {};
    tiposBloque.forEach(t => {
      coloresActuales[t] = coloresPersonalizados[t] ?? { fondo: colorFondoDefault, texto: '#ffffff' };
    });

    const grupos = m.evaluaciones.filter(ev => ev.tipo === 'grupo') as GrupoEvaluacion[];
    const gruposEvaluacion = grupos.length > 0
      ? grupos.map(g => ({
          id: g.id,
          nombre: g.nombre,
          colorActual: config.coloresGruposEvaluacion?.[g.id] ?? { fondo: colorFondoDefault, texto: '#ffffff' },
        }))
      : undefined;

    const simplesConFecha = config.horarioMostrarEvaluaciones
      ? (m.evaluaciones.filter(ev => ev.tipo === 'simple' && !!(ev as EvaluacionSimple).fecha) as EvaluacionSimple[])
      : [];
    const evaluacionesConFecha = simplesConFecha.length > 0
      ? simplesConFecha.map(ev => ({
          id: ev.id,
          nombre: ev.nombre,
          colorActual: config.coloresEvaluacionesSimples?.[ev.id] ?? { fondo: colorFondoDefault, texto: '#ffffff' },
        }))
      : undefined;

    return {
      id: m.id,
      nombre: m.nombre,
      bloques: tiposBloque.map(t => ({ tipo: t, nombre: labelTipo(t, config) })),
      coloresActuales,
      ...(gruposEvaluacion ? { gruposEvaluacion } : {}),
      ...(evaluacionesConFecha ? { evaluacionesConFecha } : {}),
    };
  });

  return `
════════════════════════════
SECCIÓN "config" — COLORES DEL HORARIO
════════════════════════════

Estado actual de colores de mis materias:
${JSON.stringify(materiasExport, null, 2)}

Para cada materia, preguntame qué colores quiero usar para fondo y texto de cada tipo de bloque.
Si la materia tiene "gruposEvaluacion", preguntame también el color de cada grupo.
Si la materia tiene "evaluacionesConFecha", preguntame también el color de cada evaluación individual.

Incluí los colores elegidos dentro de la sección "config" del JSON final con este formato:
- "coloresHorario": { "[id_materia]": { "[tipo_bloque]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } } }
- "coloresGruposEvaluacion": { "[id_grupo]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } }
- "coloresEvaluacionesSimples": { "[id_evaluacion]": { "fondo": "#RRGGBB", "texto": "#RRGGBB" } }
(Omitir los que no apliquen o no se modifiquen)`;
}
```

**Step 2: Agregar la función principal `generarPromptCombinado`**

Agregar al final de `importExport.ts`, después de `buildSeccionColores`:

```ts
export function generarPromptCombinado(
  modulos: Set<ModuloIA>,
  config: Config,
  materias: Materia[],
): string {
  // Caso de módulo único: delegar al prompt individual sin cambios
  if (modulos.size === 1) {
    const [unico] = modulos;
    if (unico === 'carrera')      return generarPromptCarrera();
    if (unico === 'horarios')     return generarPromptHorario(config);
    if (unico === 'evaluaciones') return generarPromptEvaluaciones();
    if (unico === 'config')       return generarPromptConfig();
    if (unico === 'colores') {
      const seccion = buildSeccionColores(config, materias);
      if (!seccion) return 'No hay materias con horarios definidos para configurar colores.';
      return `Sos un asistente de diseño de colores para una app académica de horarios.\n${seccion}\nCuando termines de preguntar, devolvé SOLO el JSON con los colores elegidos (sin texto adicional).`;
    }
  }

  const tieneMaterias  = modulos.has('carrera') || modulos.has('horarios') || modulos.has('evaluaciones');
  const tieneConfig    = modulos.has('config')  || modulos.has('colores');

  // Descripción de qué incluye este prompt
  const LABELS: Record<ModuloIA, string> = {
    carrera:      'el plan de carrera (materias, semestres, previas)',
    horarios:     'los horarios de las materias',
    evaluaciones: 'las evaluaciones de las materias',
    config:       'la configuración de la app',
    colores:      'los colores del horario',
  };
  const descripcion = [...modulos].map(m => LABELS[m]).join(', ');

  // Estructura del JSON raíz
  const partes: string[] = [];
  partes.push(`  "cursus_todo_en_uno": 1`);
  if (tieneConfig)   partes.push(`  "config": { ...campos de configuración... }`);
  if (tieneMaterias) partes.push(`  "materias": [ ...array de materias... ]`);
  const estructuraRaiz = `{\n${partes.join(',\n')}\n}`;

  // Sección materias
  let seccionMaterias = '';
  if (tieneMaterias) {
    const camposMateriaPartes: string[] = [
      `  "nombre": "Nombre de la materia",`,
      `  "semestre": 1,`,
    ];
    if (modulos.has('carrera')) {
      camposMateriaPartes.push(
        `  "creditos_da": 6,          // opcional`,
        `  "creditos_necesarios": 0,  // opcional`,
        `  "previas": ["Nombre de prerequisito"],  // opcional`,
        `  "tipo_formacion": "Básica",             // opcional`,
      );
    }
    if (modulos.has('horarios')) {
      camposMateriaPartes.push(
        `  "bloques": [`,
        `    { "fecha": "YYYY-MM-DD", "horaInicio": 480, "horaFin": 600, "tipo": "teorica", "salon": "Aula 3" }`,
        `  ],`,
      );
    }
    if (modulos.has('evaluaciones')) {
      camposMateriaPartes.push(
        `  "evaluaciones": [`,
        `    { "id": "ev1", "tipo": "simple", "nombre": "Parcial 1", "pesoEnMateria": 50, "tipoNota": "numero", "nota": null, "notaMaxima": 12 }`,
        `  ],`,
      );
    }

    const reglasPartes: string[] = [];
    if (modulos.has('horarios')) {
      reglasPartes.push(
        `Reglas para "bloques":`,
        `- "fecha": formato ISO YYYY-MM-DD (ej: "2026-03-15")`,
        `- "horaInicio" / "horaFin": minutos desde las 00:00 (480 = 8:00, 600 = 10:00)`,
        `- "tipo": "teorica", "practica" u "otro" (los exámenes van en evaluaciones, no en bloques)`,
        `- "salon" (opcional): nombre del aula`,
      );
    }
    if (modulos.has('evaluaciones')) {
      reglasPartes.push(
        `Reglas para "evaluaciones":`,
        `- "tipo": "simple" para una evaluación, "grupo" para agrupar varias.`,
        `- "pesoEnMateria": % que pesa en la nota final. La suma de todos los ítems de una materia debe ser 100.`,
        `- "tipoNota": "numero" o "porcentaje". "nota": null si no hay nota aún.`,
        `- Para grupos: incluí "subEvaluaciones" (sin "tipo" ni "pesoEnMateria").`,
        `- "notaMaxima": puntaje máximo de esa evaluación.`,
      );
    }

    seccionMaterias = `
════════════════════════════
SECCIÓN "materias" (array)
════════════════════════════

Cada elemento del array representa una materia:
{
${camposMateriaPartes.join('\n')}
}

${reglasPartes.join('\n')}

Campos opcionales por materia: creditos_da, creditos_necesarios, previas, tipo_formacion${modulos.has('horarios') ? ', bloques' : ''}${modulos.has('evaluaciones') ? ', evaluaciones' : ''}.`;
  }

  // Sección config (sin colores)
  let seccionConfig = '';
  if (modulos.has('config')) {
    seccionConfig = `
════════════════════════════
SECCIÓN "config" — CONFIGURACIÓN DE LA APP
════════════════════════════

Por cada campo que no puedas determinar con la información provista, preguntale al usuario de a uno por vez antes de generar el JSON.
Solo incluí los campos que puedas confirmar. Omití los que queden sin confirmar.

Campos disponibles (los más comunes):
- notaMaxima (número): nota máxima de la carrera. Ej: 12, 10, 100.
- umbralExoneracion (0–100): % mínimo para exonerar una materia.
- umbralAprobacion (0–100): % mínimo para estado "Aprobado" (si aplica).
- umbralPorExamen (0–100): % mínimo para tener derecho a rendir examen.
- umbralExamenExoneracion (0–100): % mínimo EN el examen para aprobar.
- usarEstadoAprobado (true/false): ¿existe el estado "Aprobado" separado de "Exonerado"?
- aprobadoHabilitaPrevias (true/false): ¿"Aprobado" desbloquea correlativas?
- oportunidadesExamenDefault (entero ≥ 1): oportunidades de examen por defecto.
- modoExamen ("automatico" o "manual"): cómo se activa el modo examen.
- fechasLimiteExamen (array YYYY-MM-DD): fechas de inicio de períodos de examen (si automatico).
- tiposFormacion (array de strings): categorías de materias. Ej: ["Básica", "Específica"].
- horarioPrimerDia ("lunes" o "domingo"): primer día de la semana en el horario.
- horarioMostrarEvaluaciones (true/false): mostrar evaluaciones con fecha en el horario.
- labelTeorica / abrevTeorica, labelPractica / abrevPractica, labelParcial / abrevParcial, labelOtro / abrevOtro: etiquetas y abreviaturas de tipos de bloque (máx 3 chars).
- tarjetaMostrarNota (true/false), tarjetaNota ("numero" o "porcentaje"): nota en tarjeta.
- tarjetaPrevias ("todas", "faltantes" o "ninguna"): previas visibles en tarjeta.
- tarjetaCreditosBadge ("da", "necesita" o "ambos"): badge de créditos en tarjeta.`;
  }

  // Sección colores
  const seccionColores = modulos.has('colores') ? buildSeccionColores(config, materias) : '';

  return `Sos un asistente de la app Cursus. Tu objetivo es generar UN SOLO archivo JSON con ${descripcion}.

Para lograrlo:
1. Analizá toda la información que te proporcione el usuario (documentos, programas, calendarios académicos, etc.).
2. Por cada dato que no puedas determinar con certeza, preguntale al usuario de a uno por vez, explicándole brevemente para qué sirve.
3. Solo incluí en el JSON los datos que puedas confirmar. Omití los que queden sin confirmar.
4. Al final, devolvé ÚNICAMENTE el JSON completo, sin texto adicional.

FORMATO DEL JSON:
${estructuraRaiz}
${seccionMaterias}
${seccionConfig}
${seccionColores}`;
}
```

> **Nota:** La función `generarPromptHorario` está en `horarioImportExport.ts`. Para el caso de módulo único `horarios`, importar desde ahí (o copiar inline en `generarPromptCombinado` — ver paso siguiente).

**Step 3: Resolver la dependencia de `generarPromptHorario`**

`generarPromptCombinado` necesita llamar a `generarPromptHorario(config)` (que está en `horarioImportExport.ts`) para el caso de módulo único. Agregar el import al inicio de `importExport.ts`:

```ts
import { generarPromptHorario } from './horarioImportExport';
```

Verificar primero que no cause imports circulares. Si hay circularidad: copiar inline la función en el branch `if (unico === 'horarios')` con los campos de config necesarios.

**Step 4: Commit**

```bash
git add src/utils/importExport.ts
git commit -m "feat(prompts-ia): add generarPromptCombinado with fused multi-module prompt"
```

---

## Task 3: Actualizar ConfigScreen.tsx — estado y imports

**Files:**
- Modify: `src/screens/ConfigScreen.tsx:9` — línea de import de importExport
- Modify: `src/screens/ConfigScreen.tsx:118-128` — bloque de estados de prompt

**Step 1: Actualizar el import de importExport en ConfigScreen.tsx**

Línea 9 actual:
```ts
import { normalizarTipo, generarPromptCarrera, generarPromptEvaluaciones, generarPromptCompleto, generarPromptConfig } from '../utils/importExport';
```

Reemplazar por:
```ts
import { normalizarTipo, generarPromptCombinado, ModuloIA } from '../utils/importExport';
```

**Step 2: Eliminar el import de `generarPromptHorario` de horarioImportExport**

Línea 11 actual:
```ts
import { generarPromptHorario } from '../utils/horarioImportExport';
```
Eliminar esta línea (ya no se usa directamente en ConfigScreen).

**Step 3: Eliminar los 6 estados de prompt expandido**

Eliminar las líneas 118–120 y 126–128:
```ts
const [promptCarreraExpandido, setPromptCarreraExpandido] = useState(false);
const [promptHorarioExpandido, setPromptHorarioExpandido] = useState(false);
const [promptColoresExpandido, setPromptColoresExpandido] = useState(false);
// ...
const [promptEvalExpandido, setPromptEvalExpandido] = useState(false);
const [promptCompletoExpandido, setPromptCompletoExpandido] = useState(false);
const [promptConfigExpandido, setPromptConfigExpandido] = useState(false);
```

**Step 4: Agregar estado de módulos seleccionados**

En su lugar, agregar (en el bloque de useState, cerca de línea 118):
```ts
const TODOS_MODULOS: ModuloIA[] = ['carrera', 'horarios', 'evaluaciones', 'config', 'colores'];
const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<ModuloIA>>(
  new Set(TODOS_MODULOS)
);
```

**Step 5: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(prompts-ia): replace 6 prompt states with modulosSeleccionados set"
```

---

## Task 4: Reemplazar los 6 acordeones con la nueva UI en ConfigScreen.tsx

**Files:**
- Modify: `src/screens/ConfigScreen.tsx:898–1148` — sección completa "PROMPTS PARA IA"

**Step 1: Identificar el bloque exacto a reemplazar**

El bloque a reemplazar va desde:
```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>PROMPTS PARA IA</Text>
```
hasta (incluyendo):
```tsx
          </>
          )}
```
al final de la pestaña `datos` (línea ~1148).

**Step 2: Reemplazar con la nueva UI**

```tsx
<Text style={{ color: tema.acento, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>PROMPTS PARA IA</Text>
<Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 14 }}>
  Seleccioná qué querés generar. La IA preguntará solo lo necesario y generará un único JSON para importar.
</Text>

{/* Checkboxes de módulos */}
<View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 12 }}>
  {/* Seleccionar todo */}
  <TouchableOpacity
    onPress={() => {
      if (modulosSeleccionados.size === TODOS_MODULOS.length) {
        setModulosSeleccionados(new Set());
      } else {
        setModulosSeleccionados(new Set(TODOS_MODULOS));
      }
    }}
    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: tema.borde ?? '#333', marginBottom: 4 }}
  >
    <View style={{
      width: 20, height: 20, borderRadius: 4, borderWidth: 2,
      borderColor: tema.acento, marginRight: 10, alignItems: 'center', justifyContent: 'center',
      backgroundColor: modulosSeleccionados.size === TODOS_MODULOS.length ? tema.acento : 'transparent',
    }}>
      {modulosSeleccionados.size === TODOS_MODULOS.length && (
        <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text>
      )}
    </View>
    <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>Seleccionar todo</Text>
  </TouchableOpacity>

  {/* Opciones individuales */}
  {([
    { id: 'carrera'      as ModuloIA, label: 'Plan de carrera',        desc: 'Materias, semestres, previas, créditos' },
    { id: 'horarios'     as ModuloIA, label: 'Horarios',               desc: 'Bloques de clase por materia' },
    { id: 'evaluaciones' as ModuloIA, label: 'Evaluaciones',           desc: 'Parciales, finales, trabajos y sus pesos' },
    { id: 'config'       as ModuloIA, label: 'Configuración de la app',desc: 'Umbrales, etiquetas, tarjetas' },
    { id: 'colores'      as ModuloIA, label: 'Colores del horario',    desc: 'Colores por materia y tipo de bloque' },
  ] as const).map(({ id, label, desc }) => (
    <TouchableOpacity
      key={id}
      onPress={() => setModulosSeleccionados(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      })}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
    >
      <View style={{
        width: 20, height: 20, borderRadius: 4, borderWidth: 2,
        borderColor: modulosSeleccionados.has(id) ? tema.acento : tema.textoSecundario,
        marginRight: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: modulosSeleccionados.has(id) ? tema.acento : 'transparent',
      }}>
        {modulosSeleccionados.has(id) && (
          <Text style={{ color: '#fff', fontSize: 12, lineHeight: 14 }}>✓</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 13 }}>{label}</Text>
        <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 1 }}>{desc}</Text>
      </View>
    </TouchableOpacity>
  ))}
</View>

{/* Preview y botón copiar */}
{modulosSeleccionados.size === 0 ? (
  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20, alignItems: 'center' }}>
    <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Seleccioná al menos un módulo para generar el prompt.</Text>
  </View>
) : (
  <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 20 }}>
    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
      <Text style={{ color: tema.textoSecundario, fontSize: 11, fontFamily: 'monospace' }}>
        {generarPromptCombinado(modulosSeleccionados, config, materias)}
      </Text>
    </ScrollView>
    <TouchableOpacity
      onPress={() => Clipboard.setStringAsync(generarPromptCombinado(modulosSeleccionados, config, materias))}
      style={{ marginTop: 10, backgroundColor: tema.acento, padding: 10, borderRadius: 8, alignItems: 'center' }}
    >
      <Text style={{ color: '#fff', fontWeight: '600' }}>📋 Copiar prompt</Text>
    </TouchableOpacity>
  </View>
)}
</>
)}
```

> **Nota:** El `TODOS_MODULOS` constante debe ser accesible en el JSX. Si se declaró dentro de la función del componente en Task 3, ya está disponible.

**Step 3: Verificar que la variable `borde` existe en el tema**

En el estilo del separador se usa `tema.borde`. Verificar si existe en el tipo del tema. Si no existe, reemplazar `tema.borde ?? '#333'` con el color de separador apropiado que ya use la app (buscar en el archivo cómo se hacen otros separadores).

**Step 4: Commit**

```bash
git add src/screens/ConfigScreen.tsx
git commit -m "feat(prompts-ia): replace 6 accordions with checkbox-based combined prompt UI"
```

---

## Task 5: Verificación manual

**Step 1: Arrancar la app y navegar a Config → pestaña Datos**

Verificar:
- [ ] Se ven los 5 checkboxes con labels y descripciones
- [ ] "Seleccionar todo" marca/desmarca todos
- [ ] El preview se actualiza en tiempo real al marcar/desmarcar
- [ ] Con todo seleccionado, el prompt incluye las 5 secciones
- [ ] Con un solo módulo seleccionado, el prompt es idéntico al individual anterior
- [ ] Con ninguno seleccionado, aparece el mensaje de "seleccioná al menos un módulo"
- [ ] "Copiar prompt" copia el texto visible al portapapeles

**Step 2: Verificar módulo único colores sin materias cursando**

Si no hay materias en estado "Cursando" con bloques definidos, el prompt de colores debe decir "No hay materias con horarios definidos para configurar colores." en vez de crashear.

**Step 3: Commit final si se necesitan ajustes**

```bash
git add src/screens/ConfigScreen.tsx src/utils/importExport.ts
git commit -m "fix(prompts-ia): adjust edge cases from manual testing"
```
