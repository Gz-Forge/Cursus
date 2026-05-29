# Diseño: Extras Config + Horario + IA

**Fecha:** 2026-05-22

Tres features independientes que se agregan al plan de implementación del día.

---

## Feature 1 — Centrar texto en inputs numéricos de ConfigScreen

**Archivo:** `TablaApp/src/screens/ConfigScreen.tsx`

Dos funciones afectadas:
- `campo()` (~línea 165): `TextInput` con `width: 80` → agregar `textAlign: 'center'`
- `campoUmbral()` (~línea 186): `TextInput` con `width: 80` → agregar `textAlign: 'center'`

Sin cambios de layout. Solo alineación interna del texto.

---

## Feature 2 — Doble tap abre modal de edición rápida en HorarioScreen

### Estado nuevo
```typescript
const [modalEdicionRapida, setModalEdicionRapida] = useState<{
  bloqueId: string;
  tipo: 'regular' | 'eval';
  fecha: string;   // YYYY-MM-DD
  salon: string;
} | null>(null);
```

### Interacción
- **Móvil (bloques regulares):** `TapGestureHandler numberOfTaps={2}` wrappea la zona central cuando `cardEnEdicion === b.id`
- **Móvil (bloques eval):** mismo patrón, `TapGestureHandler numberOfTaps={2}` en zona central cuando eval está en modo edición
- **Web:** `onDoubleClick` en el elemento del bloque (regular y eval) cuando está en modo edición

### Modal
Campos:
- Input `DD/MM` para el día — autoformatea igual que otros inputs de fecha de la app
- Input de texto para Salón

Botones: Cancelar / Guardar

### Al guardar
- Parsear `DD/MM` con año actual → ISO `YYYY-MM-DD`
- Si `tipo === 'regular'` → `persistirBloque({ ...bloque, fecha: nuevaFecha, salon: nuevoSalon })`
- Si `tipo === 'eval'` → función equivalente de persist para eval blocks

### Lo que NO hace el modal
- No toca horaInicio / horaFin (el usuario ajusta horas usando drag/resize en el modo edición normal)

---

## Feature 3 — Módulo "Revisar y corregir JSON exportado" en PROMPTS PARA IA

### Cambios en `importExport.ts`
- Agregar `'revisar'` al tipo `ModuloIA`
- Nueva función `generarPromptRevisar()`:

```typescript
export function generarPromptRevisar(): string {
  return `Voy a pegarte un JSON exportado desde mi app de seguimiento de carrera universitaria.
Devolvé solo el JSON corregido al final, sin explicaciones extras.

Tu tarea:
1. Pedime que pegue mi JSON exportado (formato array de materias con nombre, semestre, previas, créditos, etc.)
2. Pedime que describa mi malla curricular real (semestres correctos, previas, créditos)
3. Compará el JSON con la malla que te describo y detectá inconsistencias:
   - Semestres incorrectos
   - Previas faltantes, sobrantes o con nombre mal escrito
   - Créditos desfasados
4. Listá todos los problemas encontrados y preguntame cuáles corregir (uno por uno o en conjunto)
5. Una vez que confirme, devolvé el JSON completo corregido en el mismo formato original
   (compatible para reimportar a la app directamente)

Formato del JSON que reconoce la app:
[
  {
    "nombre": "Cálculo I",
    "semestre": 1,
    "creditos_da": 6,
    "previas": [],
    "tipo_formacion": "Básica",
    "bloques": [...],
    "evaluaciones": [...]
  },
  ...
]

Empezá pidiéndome el JSON exportado.`;
}
```

### Cambios en `ConfigScreen.tsx`
- Agregar a `TODOS_MODULOS`:
  ```typescript
  const TODOS_MODULOS: ModuloIA[] = ['carrera', 'horarios', 'evaluaciones', 'config', 'colores', 'revisar'];
  ```
- Agregar entrada en el array de checkboxes:
  ```typescript
  { id: 'revisar', label: 'Revisar y corregir datos', desc: 'Detecta errores en un JSON exportado y los corrige' }
  ```

### Comportamiento en `generarPromptCombinado`
- Si `'revisar'` es el único módulo seleccionado → delegar a `generarPromptRevisar()` directamente
- Si está combinado con otros módulos → anteponer las instrucciones de revisión al prompt combinado (el usuario quiere revisar Y también crear/modificar otras cosas)
