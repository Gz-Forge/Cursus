# Design: Búsqueda por nombre/número + relaciones de previas

**Fecha:** 2026-04-27

---

## Objetivo
Agregar un campo de búsqueda al panel "Búsqueda" de CarreraScreen que permita encontrar materias por nombre o número, y explorar sus relaciones de previas en dos direcciones.

## UX

### Barra de búsqueda (siempre visible en el tab Búsqueda)
- `TextInput` con placeholder "Buscar por nombre o número..."
- Con botón ✕ para limpiar (visible solo cuando hay texto)

### Cuando `textoBusqueda` está vacío
- La barra existe pero el panel muestra el contenido actual sin cambios (Todas / Disponibles)

### Cuando `textoBusqueda` tiene texto
- Se ocultan los toggles Todas/Disponibles y sus contenidos
- Aparecen 3 chips de modo debajo de la barra:
  - **Nombre** — filtra materias que coinciden con el texto (por nombre o número)
  - **Es previa de** — muestra las materias que *requieren directamente* a la(s) encontrada(s)
  - **Sus previas** — muestra las materias que la(s) encontrada(s) *requiere(n) directamente*
- Se muestran los resultados según el modo activo
- El modo por defecto al escribir es **Nombre**

---

## Lógica de filtrado

### Función de coincidencia
```typescript
function matchBusqueda(m: Materia, q: string): boolean {
  return (
    m.nombre.toLowerCase().includes(q.toLowerCase()) ||
    String(m.numero).includes(q)
  );
}
```

### Modo "Nombre"
```
resultados = materias.filter(m => matchBusqueda(m, query))
```

### Modo "Es previa de"
```
matches = materias.filter(m => matchBusqueda(m, query))
nums    = Set(matches.map(m => m.numero))
resultados = materias.filter(m => m.previasNecesarias.some(n => nums.has(n)))
```
→ "Estas materias requieren a la que buscaste"

### Modo "Sus previas"
```
matches = materias.filter(m => matchBusqueda(m, query))
nums    = Set(matches.flatMap(m => m.previasNecesarias))
resultados = materias.filter(m => nums.has(m.numero))
```
→ "Estas materias son requisito de la que buscaste"

---

## Estados vacíos
- No hay coincidencia de búsqueda: "No se encontró ninguna materia con ese nombre o número"
- Modo "Es previa de" sin resultados: "Esta materia no es requisito de ninguna otra"
- Modo "Sus previas" sin resultados: "Esta materia no tiene previas requeridas"

---

## Estado nuevo en CarreraScreen
```typescript
const [textoBusqueda, setTextoBusqueda] = useState('');
const [modoBusqueda, setModoBusqueda] = useState<'nombre' | 'es_previa_de' | 'sus_previas'>('nombre');
```
- `modoBusqueda` se resetea a `'nombre'` cuando `textoBusqueda` se vacía

---

## Archivos afectados
- `src/screens/CarreraScreen.tsx` — único archivo modificado
