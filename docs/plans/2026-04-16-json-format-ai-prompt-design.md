# JSON Format Simplification + Prompt para IA — Design

**Date:** 2026-04-16

## Objetivo

Simplificar el formato JSON de importación/exportación de materias y agregar en ConfigScreen un acordeón con un prompt copiable para que una IA genere el `.json`.

---

## Cambios al formato JSON

### Campos eliminados
- `oportunidades_examen` — siempre se usa `config.oportunidadesExamenDefault` al importar; no se exporta
- `numero` pasa a ser **opcional** — si está presente se usa; si no, se auto-asigna por orden de semestre

### Semántica corregida de `previas`
- **Antes:** `previas` = nombres de materias que necesito para cursar esta (`previasNecesarias`)
- **Ahora:** `previas` = nombres de materias para las cuales esta materia es prerequisito (`esPreviaDe`)
- Al importar: se lee `previas` → `esPreviaDe`; `previasNecesarias` se deriva invirtiendo la relación

### Interfaz `MateriaJson` resultante
```typescript
interface MateriaJson {
  nombre: string;
  semestre: number;
  creditos_da: number;
  creditos_necesarios: number;
  previas: string[];   // nombres de materias que esta materia desbloquea
  numero?: number;     // opcional; si ausente, se auto-asigna
}
```

### Export (`materiasAJson`)
- Elimina `oportunidades_examen`
- Mantiene `numero` (para compatibilidad al compartir entre usuarios)

---

## Lógica de import (`jsonAMaterias`)

1. Recibe `datos: MateriaJson[]` y `oportunidadesDefault: number`
2. Si algún item no tiene `numero`: ordenar por semestre y asignar 1..N
3. Si todos tienen `numero`: usar los provistos
4. Construir `esPreviaDe` directamente desde `previas`
5. Derivar `previasNecesarias` invirtiendo: para cada materia M, buscar todas las materias que en su `esPreviaDe` incluyen a M

---

## ConfigScreen — acordeón "Prompt para IA"

**Ubicación:** debajo de la sección "DATOS DE LA CARRERA"

**Comportamiento:** colapsado por defecto; se expande al tapear el header

**Contenido expandido:**
- Texto del prompt (ScrollView horizontal o con scroll si es largo)
- Botón "📋 Copiar" que copia al clipboard usando `Clipboard` de React Native

### Texto del prompt
```
Generá un archivo JSON con el plan de estudios de mi carrera.
Devolvé solo el JSON, sin explicaciones.

Formato: array de objetos con estos campos:
- nombre (string): nombre de la materia
- semestre (número): semestre en que se cursa
- creditos_da (número): créditos que otorga al aprobarla
- creditos_necesarios (número): créditos acumulados necesarios para poder cursarla (0 si no aplica)
- previas (array de strings): nombres exactos de las materias que esta materia desbloquea (vacío si ninguna)
- numero (número, opcional): solo si querés mantener un orden específico al compartir con otros

Ejemplo:
[
  { "nombre": "Cálculo I", "semestre": 1, "creditos_da": 6, "creditos_necesarios": 0, "previas": ["Cálculo II"] },
  { "nombre": "Cálculo II", "semestre": 2, "creditos_da": 6, "creditos_necesarios": 0, "previas": [] }
]

Materias de mi carrera:
[describí tu carrera acá]
```

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/utils/importExport.ts` | Actualizar `MateriaJson`, `jsonAMaterias`, `materiasAJson` |
| `src/screens/ConfigScreen.tsx` | Agregar acordeón con prompt y botón copiar |
| `__tests__/importExport.test.ts` | Actualizar tests para nuevo formato |
