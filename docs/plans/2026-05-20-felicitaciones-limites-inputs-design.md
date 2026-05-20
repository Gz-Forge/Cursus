# Design: Felicitaciones por semestre + límites de caracteres en inputs

**Fecha:** 2026-05-20
**Branch objetivo:** fix/horario-eval-layout-handles

---

## Bloque 1 — Felicitaciones al completar semestre

### Detección

En `CarreraScreen`, un `useEffect` que observa `[materias, config]`:
- Calcula la lista de semestres donde TODAS las materias tienen `calcularEstadoFinal === 'exonerado'`.
- Compara contra un `useRef` que guarda los semestres ya completados en sesión (`prevSemestresCompletados`).
- Si aparece un semestre nuevo → disparar modal de felicitaciones.
- El ref se inicializa con los semestres ya completos al montar (sin disparar modal), para no saludar en cada apertura de app.

### Frases sin repetir

- Array de 60 frases hardcodeadas en `src/utils/frases.ts` (extraídas de `frases.md`).
- Nuevo campo en `Config`: `frasesUsadas: number[]` (default `[]`).
- Al elegir frase: filtrar índices no usados → elegir uno aleatorio → guardarlo con `actualizarConfig({ frasesUsadas: [...usadas, idx] })`.
- Cuando `frasesUsadas.length === FRASES.length` → resetear a `[]` antes de elegir.

### Modal

- Usar el `ConfirmModal` existente con un solo botón "¡Gracias!" (sin `onCancelar`).
- Título: `🎉 ¡Semestre N° X completo!`
- Mensaje: la frase seleccionada.
- Solo se muestra si `config.mostrarFelicitaciones !== false`.

### Toggle en Config

- Nuevo campo: `mostrarFelicitaciones: boolean` (default `true`).
- Ubicación: panel **App** de `ConfigScreen`, al final de la sección APARIENCIA.
- Label: `"Felicitaciones por semestre completo"`.
- Descripción: `"Mostrá un mensaje motivacional cuando exonerás todas las materias de un semestre"`.
- Usar el helper `toggle()` existente — requiere extender su type union para aceptar `'mostrarFelicitaciones'`.

---

## Bloque 2 — Límites de caracteres con contadores

### Helper `CharInput` (inline, no componente global)

Cada screen afectada implementa su propio helper local o usa un patrón de wrapper simple:
- Envuelve el `TextInput` en un `View`.
- Debajo a la derecha: `<Text style={{ color: textoSecundario, fontSize: 11, textAlign: 'right' }}>{value.length}/{MAX}</Text>`.
- Solo se renderiza si el input tiene `maxLength` definido.

### Tabla de límites

| Campo | Límite | Archivo |
|---|---|---|
| Nombre de materia | 100 | `EditMateriaScreen` |
| Nombre de evaluación (simple y sub-eval) | 20 | `EvaluacionItem` |
| Nombre de estado de materia | 20 | `ConfigScreen` |
| Tipo de formación (nuevo + edición) | 50 | `ConfigScreen` + `EditMateriaScreen` |
| Título completo tipo de bloque de horario | 35 | `ConfigScreen` |

### Validaciones adicionales (sin contador)

- **Asistencias** (`EditMateriaScreen`): `keyboardType="numeric"`, clamp `[1, 99]` en `onBlur`. Si el valor es vacío o 0 al salir, se deja como estaba.
- **Nota manual** (`EditMateriaScreen`): validación en `onChangeText` — si el número supera `config.notaMaxima`, se trunca al máximo. Mostrar feedback visual (borde rojo) si se intenta ingresar un valor superior.

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/types.ts` | Agregar `mostrarFelicitaciones?: boolean` y `frasesUsadas?: number[]` a `Config` |
| `src/store/useStore.ts` | Agregar defaults a `CONFIG_DEFAULT` |
| `src/utils/perfiles.ts` | Agregar defaults a `CONFIG_DEFAULT_PARCIAL` |
| `src/utils/frases.ts` | Nuevo archivo con array `FRASES: string[]` |
| `src/screens/CarreraScreen.tsx` | useEffect de detección + modal de felicitaciones |
| `src/screens/ConfigScreen.tsx` | Toggle `mostrarFelicitaciones` + contadores en estados y tipos de bloque |
| `src/screens/EditMateriaScreen.tsx` | Límites en nombre, asistencias, nota manual |
| `src/components/EvaluacionItem.tsx` | Límite 20 en nombre de evaluación |
