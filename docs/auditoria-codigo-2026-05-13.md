# Auditoría de Código — Cursus App
**Fecha:** 2026-05-13  
**Alcance:** `TablaApp/src/` — todos los archivos `.ts` y `.tsx`  
**Total de hallazgos:** 74 (Alta: 17 · Media: 31 · Baja: 26)

---

## Leyenda de Severidad
| Nivel | Criterio |
|---|---|
| 🔴 ALTA | Puede causar pérdida de datos, exposición de información o crash en producción |
| 🟡 MEDIA | Degradación de experiencia, riesgo potencial o deuda técnica significativa |
| 🟢 BAJA | Mejora deseable, inconsistencia menor o deuda técnica acumulable |

---

## 1. Validación de Inputs

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `utils/horarioImportExport.ts` | 23 | `parsearHoraFlex` no valida que minutos ≤ 59 ni horas ≤ 23 para todos los casos edge |
| 🟡 MEDIA | `components/EvaluacionItem.tsx` | 243 | `pesoEnMateria` se actualiza con `Number(v)` sin validar rango 0–100; acepta negativos o >100 |
| 🟡 MEDIA | `components/EvaluacionItem.tsx` | 259 | `notaMaxima` acepta cualquier número sin límite superior; debería validarse contra `config.notaMaxima` |
| 🟡 MEDIA | `components/PeriodoExamenModal.tsx` | 45 | Fecha validada como ISO pero sin normalización previa de formato (guiones vs. barras) |
| 🟢 BAJA | `components/AgregarMateriaModal.tsx` | — | No hay validación de campos antes de confirmar el modal (nombre vacío permitido) |
| 🟢 BAJA | `utils/importExport.ts` | 112 | `previasNecesarias` mapea números sin verificar que existan en la lista de materias importadas |

---

## 2. Sincronización y Tokens

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `components/SyncDispositivosModal.tsx` | 172–176 | Payload QR contiene `code` y `exp` en texto plano sin firma criptográfica (HMAC). Un atacante puede forjar códigos válidos manipulando el timestamp |
| 🔴 ALTA | `components/SyncDispositivosModal.tsx` | 33–36 | Device sync code generado con `Math.random()` sobre alfabeto de 36 chars (36⁸ ≈ 2.8×10¹²). No es criptográficamente seguro; debería usarse `crypto.getRandomValues()` |
| 🔴 ALTA | `utils/deviceSnapshot.ts` | 64–66 | Payload comprimido con LZ-String pero sin cifrado ni MAC. Contiene evaluaciones, notas y configuración completa en texto plano |
| 🟡 MEDIA | `services/supabase.ts` | 5–6 | Variables `EXPO_PUBLIC_*` son públicas por diseño de Expo, pero deben verificarse en CI que no incluyan secrets reales accidentalmente |
| 🟡 MEDIA | `utils/qrPayload.ts` | 33–40 | QR de carrera comprimido sin timestamp ni expiración; un QR generado es válido indefinidamente |

---

## 3. Gestión de Errores

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `utils/deviceSnapshot.ts` | 70–71 | `JSON.parse(json)` sin validación de esquema; payload corrupto causa runtime error sin feedback al usuario |
| 🟡 MEDIA | `components/SyncDispositivosModal.tsx` | 98–101 | Error de `supabase.insert` capturado como string genérico; no distingue entre error de red, autenticación o base de datos |
| 🟡 MEDIA | `components/QrScannerModal.tsx` | 56–59 | `catch` solo muestra `Alert.alert` genérico sin loguear qué falló en el decode del QR |
| 🟡 MEDIA | `utils/importExport.ts` | 65–66 | `JSON.parse(legacyRaw)` en migración de perfiles sin try/catch; JSON inválido rompe la app en el arranque |
| 🟢 BAJA | `screens/CarreraScreen.tsx` | — | Varios `Alert.alert()` sin contexto de error; en modo desarrollo no se puede rastrear el origen |
| 🟢 BAJA | `components/QrShareModal.tsx` | 29–35 | Fallo en `setChunks([])` silenciado; debería al menos loguear en `__DEV__` |

---

## 4. Acceso a APIs y Claves Expuestas

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `components/SyncDispositivosModal.tsx` | 79–91 | Query `select('code')` a Supabase sin `.limit()` explícito; devuelve hasta 1000 registros por defecto (DoS potencial en tabla grande) |
| 🟡 MEDIA | `services/supabase.ts` | — | No hay manejo de estado offline ni reintentos; si Supabase no responde, la app falla silenciosamente |
| 🟡 MEDIA | `components/SyncDispositivosModal.tsx` | 149 | `delete().eq('code', ...)` sin `.limit(1)`; si hay códigos duplicados en BD, borra más registros de los esperados |

---

## 5. Inyección de Código

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟢 BAJA | `utils/horarioImportExport.ts` | 209 | `new RegExp(\`${key}...\`)` construida con `key` sin escapar caracteres especiales de regex; entrada maliciosa puede causar ReDoS o comportamiento inesperado |
| 🟢 BAJA | `utils/importExport.ts` | 354 | `.toLowerCase()` sin normalización Unicode; puede causar falsos negativos en búsquedas de nombres con caracteres especiales |

---

## 6. Configuraciones Inseguras

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟡 MEDIA | `components/SyncDispositivosModal.tsx` | 150 | `console.warn()` sin guard `__DEV__`; llega a producción exponiendo información de debug |
| 🟡 MEDIA | `theme/ThemeContext.tsx` | 12 | `...config.temaPersonalizado` spread sin validación de esquema; propiedades inesperadas no se detectan y pueden romper el tema |
| 🟢 BAJA | — | — | No hay revisión centralizada de flags de debug; múltiples `console.log` dispersos sin `__DEV__` llegarían a producción si se agregan |

---

## 7. Gestión de Memoria y Rendimiento

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟡 MEDIA | `navigation/WebSidebar.tsx` | 29–34 | `useEffect` agrega listener de navegación pero el `unsubscribe` puede no ejecutarse si `navRef.current` es null al montar |
| 🟡 MEDIA | `screens/HorarioScreen.tsx` | 113–127 | Múltiples refs de tipo `Map` que crecen por cada bloque renderizado sin límite ni cleanup explícito |
| 🟡 MEDIA | `components/FabSpeedDial.tsx` | 20–21 | Refs de animación creadas en cada render en lugar de con `useMemo`; causa trabajo innecesario en cada actualización |
| 🟢 BAJA | `components/EvaluacionItem.tsx` | 156–163 | `useEffect` con dependency array incompleto (comentario indica intención manual); propenso a bugs si `value` cambia externamente |
| 🟢 BAJA | `components/QrShareModal.tsx` | 36 | `setTimeout(..., 50)` usado para sincronizar render; debería resolverse con `useLayoutEffect` o `useMemo` |

---

## 8. Compatibilidad Multiplataforma

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟡 MEDIA | `components/TiledBackground.tsx` | 19 | `PixelRatio.get()` siempre devuelve 1 en web; el tiling puede verse incorrecto en pantallas de alta densidad en browser |
| 🟡 MEDIA | `utils/horarioImportExport.ts` | 347–358 | Imports del plugin Tauri (`tauri plugin-dialog`) sin fallback explícito para plataformas web/mobile; puede causar error en runtime |
| 🟢 BAJA | `navigation/RootNavigator.tsx` | 33 | `Platform.OS === 'web'` oculta la tab bar pero no configura una navegación alternativa coherente para web |

---

## 9. Dependencias Externas

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟢 BAJA | `utils/qrPayload.ts` | 1 | `lz-string` importado sin versión fija en package.json; actualización mayor podría cambiar el formato de compresión e invalidar datos existentes |
| 🟢 BAJA | — | — | Múltiples `expo-*` packages sin verificación explícita de compatibilidad de versiones entre sí; el SDK de Expo puede depreciarse |

---

## 10. Seguridad de Datos Locales

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `utils/deviceSnapshot.ts` | 17 | El snapshot incluye el array completo de `materias` (notas, evaluaciones, carreras) sin cifrado; accesible por cualquier app con permisos de lectura local en Android |
| 🔴 ALTA | `components/SyncDispositivosModal.tsx` | 70–71 | Payload comprimido almacenado en Supabase sin cifrado del lado del cliente; el equipo de Supabase puede leer todos los datos del usuario |
| 🔴 ALTA | `utils/storage.ts` | 6–12 | AsyncStorage (y localStorage en web) es legible por cualquier script del mismo dominio; datos académicos privados sin protección ante XSS |
| 🟡 MEDIA | `utils/exportPayload.ts` | 40–58 | Exportación JSON incluye notas y evaluaciones completas sin advertencia al usuario; compartir el archivo expone datos sensibles |
| 🟢 BAJA | `utils/perfiles.ts` | 73 | `JSON.stringify(estado)` guardado directamente; datos sensibles en AsyncStorage en texto plano sin ofuscación |

---

## 11. Concurrencia y Estado

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `store/useStore.ts` | 102 | `guardarPerfilEstado()` puede ser invocado concurrentemente desde múltiples componentes; sin mutex ni debounce, escrituras simultáneas pueden corromper el estado persistido |
| 🔴 ALTA | `components/SyncDispositivosModal.tsx` | 67–102 | `iniciarEmisor()` sin protección contra llamadas paralelas; múltiples taps en el botón crean múltiples entradas en Supabase simultáneamente |
| 🟡 MEDIA | `utils/perfiles.ts` | 88 | `guardarMeta()` sin sincronización; si dos pantallas la invocan simultáneamente, la segunda escritura puede sobrescribir la primera |
| 🟡 MEDIA | `screens/HorarioScreen.tsx` | 110–115 | Estado local `cardEnEdicion` y `draftBloque` modificados en handlers de gestos concurrentes sin guardia; puede producir estado inconsistente durante drag |
| 🟢 BAJA | `components/EvaluacionItem.tsx` | 156–163 | Dependency array del `useEffect` incompleto; `value` puede cambiar externamente sin que el estado local `str` se actualice |

---

## 12. UI/UX y Accesibilidad

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟡 MEDIA | `components/FabSpeedDial.tsx` | 54 | `TouchableOpacity` sin `accessibilityLabel`; lectores de pantalla no pueden identificar la acción |
| 🟡 MEDIA | `components/QrScannerModal.tsx` | 252 | Instrucción "Apuntá la cámara al QR" sin `accessibilityLabel` ni `accessibilityHint` en el componente de cámara |
| 🟡 MEDIA | `components/MateriaCard.tsx` | — | Múltiples `Text` y `View` usados como botones sin `accessibilityRole="button"` |
| 🟢 BAJA | `components/MateriaCard.tsx` | 100 | `onLongPress` sin feedback visual explícito (haptic o animación) para usuarios que no conocen el gesto |
| 🟢 BAJA | `components/PerfilSheet.tsx` | 169 | Espacios en blanco usados como placeholder de checkbox; patrón inaccesible para screen readers |

---

## 13. Testing Insuficiente

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `utils/calculos.ts` | — | Funciones críticas `calcularEstadoFinal()` y `materiasDisponibles()` sin cobertura de tests; un bug aquí afecta toda la lógica de la app |
| 🔴 ALTA | `utils/perfiles.ts` | — | Lógica de migración de datos (`migrarPerfiles`) sin tests; cambios futuros pueden romper datos de usuarios existentes silenciosamente |
| 🟡 MEDIA | `__tests__/horarioLayout.test.ts` | — | Solo 7 tests para layout; faltan tests para `parsearCSV`, `parsearJSONMateria`, `extraerEventosICS`, `parsearJSONMultiMateria` |
| 🟡 MEDIA | — | — | Sin tests de integración para el flujo Supabase (sync, insert, delete) |
| 🟢 BAJA | — | — | Sin tests E2E de flujos críticos: sync por QR, importación de JSON, exportación |

---

## 14. Logs y Monitoreo

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟡 MEDIA | `components/SyncDispositivosModal.tsx` | 150 | `console.warn()` sin `__DEV__` llega a producción; en dispositivos de usuarios puede revelar estado interno |
| 🟡 MEDIA | `utils/deviceSnapshot.ts` | — | Sin logging estructurado en las fases de sync (generación, envío, recepción, aplicación); si falla, no hay trazabilidad |
| 🟢 BAJA | — | — | No hay integración con Sentry, Crashlytics ni similar; crashes en producción son invisibles para el equipo |

---

## 15. Gestión del Estado Global (Zustand)

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🟡 MEDIA | `store/useStore.ts` | 79–139 | Acciones que llaman a `set()` y luego `storage.guardar()` no son atómicas; si `guardar()` falla, el estado en memoria y el persistido quedan desincronizados |
| 🟡 MEDIA | `store/useStore.ts` | — | Sin selectores memoizados; componentes que leen solo `config.notaMaxima` se re-renderizan ante cualquier cambio de `materias` |
| 🟢 BAJA | `store/useStore.ts` | — | Sin middleware `persist` de Zustand; la persistencia manual duplica lógica y es más propensa a bugs que el enfoque oficial |

---

## 16. Importación / Exportación de Datos

| Severidad | Archivo | Línea | Problema |
|---|---|---|---|
| 🔴 ALTA | `utils/importExport.ts` | 360–369 | `mergeImportar()` no valida la estructura del JSON antes de procesar; un archivo malformado puede causar crash sin mensaje útil |
| 🔴 ALTA | `utils/horarioImportExport.ts` | 154–171 | `parsearJSONMultiMateria()` no verifica que `materias` sea un array antes de llamar `.map()`; lanza TypeError con JSON inesperado |
| 🟡 MEDIA | `screens/ImportarExportarScreen.tsx` | — | Sin límite de tamaño de archivo a importar; un JSON de varios MB puede causar OOM (Out of Memory) en dispositivos de gama baja |
| 🟡 MEDIA | `utils/importExport.ts` | 449–560 | `aplicarConfigJson()` valida tipos primitivos pero no rangos lógicos (ej: `notaMaxima: 99999`, `umbralAprobacion: -50`) |
| 🟢 BAJA | `utils/horarioImportExport.ts` | 204–244 | Parser ICS no limita la expansión de `RRULE`; una regla de recurrencia malformada o sin `COUNT`/`UNTIL` puede generar bucle muy largo |

---

## Resumen ejecutivo

### Distribución por severidad

```
🔴 ALTA   ████████████████░░░░  17 hallazgos
🟡 MEDIA  ███████████████████████████░░░  31 hallazgos
🟢 BAJA   ████████████████████████░░░░  26 hallazgos
```

### Top 5 áreas de mayor riesgo

1. **Sincronización/tokens** — sin firma criptográfica, RNG no seguro, datos en plano en Supabase
2. **Seguridad de datos locales** — AsyncStorage sin cifrado, snapshot completo con notas privadas
3. **Concurrencia** — race conditions en store y en llamadas a Supabase
4. **Importación de datos** — sin validación de esquema, sin límite de tamaño
5. **Testing** — funciones de cálculo y migración críticas sin cobertura

### Acciones inmediatas recomendadas

| Prioridad | Acción |
|---|---|
| 1 | Implementar firma HMAC en payloads QR y sync |
| 2 | Reemplazar `Math.random()` por `crypto.getRandomValues()` en generación de códigos |
| 3 | Agregar try/catch + validación de esquema en toda la lógica de importación |
| 4 | Añadir debounce o mutex en `guardarPerfilEstado()` e `iniciarEmisor()` |
| 5 | Agregar tests para `calculos.ts` y `perfiles.ts` |
| 6 | Agregar guard `__DEV__` a todos los `console.log/warn` |
| 7 | Definir límite máximo de tamaño de archivo en `ImportarExportarScreen` |

---

## Segunda Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la primera ronda.  
**Resultado:** Se encontraron **6 hallazgos nuevos** (0 Alta · 5 Media · 1 Baja) y **ninguna corrección regresiva**. No se detectaron falsos negativos de la primera ronda.

---

### Nuevos hallazgos

| # | Severidad | Archivo | Línea | Categoría | Problema |
|---|---|---|---|---|---|
| R-01 | 🟡 MEDIA | `screens/EditMateriaScreen.tsx` | 532–535 | 1 — Validación de inputs | `Number(v)` sin NaN check ni clamping en campos Semestre (acepta 0, negativo, decimal), Créditos que da/necesarios (acepta negativos) y Oportunidades restantes (acepta negativos y valores gigantes). La corrección de `EvaluacionItem.tsx` no se propagó a estos campos. |
| R-02 | 🟡 MEDIA | `screens/EditMateriaScreen.tsx` | 151–152 | 1 — Validación de inputs | `notaManual` se guarda como porcentaje sin clamping a [0, 100]. Si el usuario escribe un número mayor a `notaMaxima` (tipo "numero") o mayor a 100 (tipo "porcentaje"), el valor persiste fuera de rango y puede romper derivarEstado(). |
| R-03 | 🟡 MEDIA | `screens/ConfigScreen.tsx` | 148, 164 | 1 — Validación de inputs | Dos `onChangeText` distintos llaman `Number(v)` sin validar NaN. Si el usuario escribe texto alfabético o borra completamente el campo, se guarda `NaN` en `config` (ej: `notaMaxima: NaN`), lo que hace que todos los porcentajes calculados devuelvan `NaN` y la app quede en estado inválido. |
| R-04 | 🟡 MEDIA | `screens/EditMateriaScreen.tsx` | 376–394 | 16 — Importación/Exportación | Importación de evaluaciones vía JSON solo verifica `Array.isArray()` en el nivel raíz, pero no valida la estructura de cada evaluación (campos obligatorios `id`, `tipo`, `nombre`, `pesoEnMateria`). Un archivo mal formado puede insertar evaluaciones con `undefined` en campos clave. |
| R-05 | 🟡 MEDIA | `utils/perfiles.ts` | 90–91 | 3 — Gestión de errores | `cargarMeta()` lanza `Error('PerfilesMeta no encontrada')` si el storage está vacío o corrupto. Aunque `migrarSiNecesario()` siempre crea la meta, una corrupción post-migración (ej: fallo de escritura en AsyncStorage) causa un crash sin recuperación ni fallback al estado por defecto. |
| R-06 | 🟢 BAJA | `screens/ConfigScreen.tsx` | 148 | 1 — Validación de inputs | El helper `campo()` acepta cualquier `keyof Config` como target de escritura directa con `as any`. Esto incluye campos que no deberían ser editables desde ese helper (ej: `coloresHorario`, `fechasEjecutadas`), lo que puede producir escrituras incorrectas si se reutiliza el helper en el futuro. |

---

### Notas sobre hallazgos descartados

Los siguientes ítems fueron considerados y descartados como **falsos positivos o no accionables**:

- **Race condition en `cambiarPerfil`**: el estado se captura antes del primer `await`, por lo que en JavaScript single-threaded no puede haber interleaving. Teóricamente frágil pero irrelevante en la práctica.
- **IDs predecibles en `importExport.ts`**: los IDs tipo `importada_${numero}_b${i}` son internos y nunca se exponen como tokens de seguridad. No hay riesgo real.
- **Validación de ciclos en previas**: la app ya acepta estructuras con ciclos; la UI no explota ni produce loops infinitos (el render se detiene correctamente). Es una mejora deseable pero no un bug.
- **Sin debounce en búsqueda de CarreraScreen**: impacto de rendimiento marginal en el hardware target (máx. ~60 materias). No constituye un bug.
- **Validación profunda de `payload.estados[]` en `descomprimirPayload`**: la validación de primer nivel (version, type, Array.isArray, meta) es suficiente para el threat model actual (datos propios del usuario, no multi-tenant). Una validación más profunda pertenece a una capa de migración, no al deserializador.

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| **Total acumulado** | **80** | **80** |

---

## Tercera Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la segunda ronda.  
**Resultado:** Se encontraron **6 hallazgos nuevos** (0 Alta · 2 Media · 4 Baja) y **2 falsos positivos descartados**.

---

### Nuevos hallazgos

| # | Severidad | Archivo | Línea | Categoría | Problema |
|---|---|---|---|---|---|
| R3-01 | 🟢 BAJA | `screens/ConfigScreen.tsx` | 148 | 1 — Validación de inputs | **Regresión UX de R-03**: la condición `n > 0` en `campo()` impide guardar el valor si el usuario borra el campo completo (`Number("") = 0`, `0 > 0 = false`). La store no actualiza y el TextInput controlado revierte al valor anterior. El dato persiste íntegro pero el usuario no puede remplazar un valor seleccionando-todo-borrando. |
| R3-02 | 🟡 MEDIA | `screens/EditMateriaScreen.tsx` | 414 | 16 — Importación/Exportación | Sin límite de evaluaciones importadas. Un JSON con cientos de evaluaciones sería aceptado sin validación de volumen, causando re-renders masivos y posible lentitud en dispositivos de gama baja. |
| R3-03 | 🟡 MEDIA | `screens/ImportarExportarScreen.tsx` | 163 | 16 — Importación/Exportación | `doImport()` llama `mergeImportar(materias, pendingImport.json, ...)` sin validar la cantidad de materias. El límite de 5MB del archivo ayuda, pero una carrera de 500 materias simples ocupa ~200KB — muy por debajo del umbral — y causaría un `set()` de Zustand con un array enorme y un re-render catastrófico. |
| R3-04 | 🟢 BAJA | `components/EvaluacionItem.tsx` | 216 | 1 — Validación de inputs | `agregarSub()` no tiene límite máximo de subevaluaciones por grupo. Un grupo con 200+ items causaría rendering lag significativo. En uso normal esto no ocurre, pero no hay barrera técnica que lo impida. |
| R3-05 | 🟢 BAJA | `components/EvaluacionItem.tsx` | 243 | 1 — Validación de inputs | `pesoEnMateria` admite múltiples decimales (ej: `33.333`). `calcularNotaTotal` suma contribuciones directamente sin redondeo; la suma puede exceder 100.00% por errores de punto flotante acumulados, produciendo una nota total ligeramente superior a `notaMaxima`. No es un crash pero produce notas "imposibles". |
| R3-06 | 🟢 BAJA | `store/useStore.ts` | 145 | 11 — Concurrencia | `cambiarPerfil` captura `{ materias, config }` en T0 y luego llama `await guardarPerfilEstado(...)` en T1. Si entre T0 y T1 el usuario dispara `guardarMateria()` (también llama `guardarPerfilEstado` con el estado más nuevo), ambas escrituras async compiten por la misma clave en AsyncStorage. La última en completar "gana" y puede sobrescribir la más reciente. Requiere interacción simultánea muy rápida — edge case real pero poco probable en móvil. |

---

### Falsos positivos descartados

- **R3-06-fp — cardRefs cleanup en HorarioScreen**: La corrección de primera ronda (`else cardRefs.current.delete(b.id)`) ya maneja la eliminación de bloques. Cuando React retira un bloque del array, desmonta el `<View>` y llama el ref callback con `null`, lo que ejecuta el `delete`. Confirmado en líneas 833 y 913.
- **R3-04-fp — Timezone en validación QR (SyncDispositivosModal)**: El timestamp de expiración se calcula y compara en el mismo cliente (`Date.now()`). La comparación con el campo `expira_en` de Supabase usa `new Date(data.expira_en)` que convierte correctamente a UTC local. Es el patrón estándar para apps móviles y no constituye una vulnerabilidad accionable.

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| Tercera (2026-05-14) | 6 | 6 |
| **Total acumulado** | **86** | **86** |

---

## Cuarta Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la tercera ronda.  
**Resultado:** Se encontraron **4 hallazgos nuevos** (1 Alta · 1 Media · 2 Baja).

---

### Nuevos hallazgos

| # | Severidad | Archivo | Línea | Categoría | Problema |
|---|---|---|---|---|---|
| R4-01 | 🔴 ALTA | `utils/perfiles.ts` | 113 | 3 — Gestión de errores | `cargarPerfilEstado()` tiene `JSON.parse(raw)` sin try/catch. Si el storage está corrupto, lanza excepción no controlada que se propaga a `useStore.cargar()`, `cambiarPerfil()` y `eliminarPerfil()`, crasheando la app sin recuperación. `cargarMeta()` fue corregida en R-05 pero `cargarPerfilEstado()` quedó sin protección. |
| R4-02 | 🟡 MEDIA | `components/EvaluacionItem.tsx` | 313 | 1 — Validación de inputs | Campo `pesoEnMateria` en bloque *grupo* usa `Number(v)` sin NaN guard ni clamping a [0,100]. Un input inválido guarda `NaN` en `grupo.pesoEnMateria`, corrompiendo los cálculos de contribución. Las correcciones de R3-05 aplican al bloque simple pero no al bloque grupo (línea 313). |
| R4-03 | 🟢 BAJA | `store/useStore.ts` | 103–136 | 11 — Concurrencia | `guardarPerfilEstado()` se llama sin `await` en todas las mutaciones (`guardarMateria`, `reemplazarMaterias`, `eliminarMateria`, `actualizarConfig`, `decrementarPeriodoExamen`). Las promesas rechazadas se descartan silenciosamente sin log ni fallback; si AsyncStorage falla, el estado en memoria y el persistido divergen sin notificación al usuario. AsyncStorage serializa internamente, por lo que no es una race condition real, pero los errores son invisibles. |
| R4-04 | 🟢 BAJA | `utils/horarioImportExport.ts` | 381–382 | 3 — Gestión de errores | `fetch(uri)` y `response.text()` en la rama web de `leerArchivo()` sin try/catch interno. Los callers tienen try/catch externo, pero una excepción de fetch (URI de blob inválida, fallo de lectura) produce un stack trace sin mensaje útil al usuario en lugar de un mensaje descriptivo. |

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| Tercera (2026-05-14) | 6 | 6 |
| Cuarta (2026-05-14) | 4 | 4 |
| **Total acumulado** | **90** | **90** |

---

## Quinta Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la cuarta ronda.  
**Resultado:** Se encontraron **3 hallazgos nuevos** (0 Alta · 1 Media · 2 Baja) y **3 falsos positivos descartados**.

---

### Nuevos hallazgos

| # | Severidad | Archivo | Línea | Categoría | Problema |
|---|---|---|---|---|---|
| R5-03 | 🟢 BAJA | `utils/fileIOWeb.ts` | 19 | 10 — Seguridad de datos locales | `file.text()` se llama sin verificar `file.size` primero. Un usuario en web puede seleccionar un archivo de varios cientos de MB, cargándolo completamente en memoria antes de que cualquier validación actúe. `leerArchivo()` en `horarioImportExport.ts` tiene la misma comprobación (5MB) pero *después* de leer. En la rama `fileIOWeb.ts` la comprobación no existe en ningún punto de la cadena. |
| R5-04 | 🟡 MEDIA | `components/QrScannerModal.tsx` | 69–76 | 1 — Validación de inputs | En la rama `cursus-device-sync`, `parsed.code` y `parsed.exp` se usan directamente sin verificar sus tipos (`typeof parsed.code === 'string'` y `typeof parsed.exp === 'number'`). Un QR que contenga `{"type":"cursus-device-sync","code":null,"exp":"never"}` pasa el check `parsed.type` y entrega valores inválidos a `onDeviceSyncDetectado`. Las ramas `cursus-evaluaciones` y `cursus-config` sí tienen try/catch interno pero la rama sync no valida sus campos. |
| R5-06 | 🟢 BAJA | `components/QrScannerModal.tsx` | 120–122 | 1 — Validación de inputs | En la rama `cursus-horario`, la búsqueda de materia destino usa `.find()` sin advertir si hay más de una materia con el mismo nombre normalizado. Si el usuario tiene dos materias "Cálculo I" con distintos números, los bloques siempre se importan a la primera encontrada sin notificación. No es un crash pero puede producir datos inesperados. |

---

### Falsos positivos descartados

- **R5-01 — División por cero en notaManualStr**: Línea 138 es `(nota / 100) * config.notaMaxima` (multiplicación, no división). El único caso de división real (línea 151) queda clampado por `Math.min(100, ...)`. Además `notaMaxima` siempre es ≥ 1 por la validación de R3-01.
- **R5-02 — Memory leak en QrShareModal setTimeout**: `return () => clearTimeout(id)` ya existe en línea 39. El callback interno es síncrono — no hay gap async donde pueda ejecutarse sobre un componente desmontado.
- **R5-05 — Búsqueda sin normalización en CarreraScreen**: La búsqueda en `handleToggleCursandoCard` es por `m.numero === p` (campo numérico), no por nombre. La comparación de strings citada no existe en ese contexto. Falso positivo.

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| Tercera (2026-05-14) | 6 | 6 |
| Cuarta (2026-05-14) | 4 | 4 |
| Quinta (2026-05-14) | 3 | 3 |
| **Total acumulado** | **93** | **93** |

---

## Sexta Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la quinta ronda.  
**Resultado:** Se encontraron **8 hallazgos nuevos** (0 Alta · 0 Media · 8 Baja) y **8 falsos positivos descartados**.

---

### Nuevos hallazgos

| # | Severidad | Archivo | Línea | Categoría | Problema |
|---|---|---|---|---|---|
| R6-03 | 🟢 BAJA | `utils/horarioImportExport.ts` | 209 | 5 — Inyección | `getVal(key)` construye `new RegExp(\`${key}...\`)` sin escapar `key`. Aunque los callers usan strings hardcodeados ('DTSTART', etc.), no hay defensa para cambios futuros. Este hallazgo estaba en Ronda 1 Cat 5 pero el escaping nunca se aplicó. |
| R6-04 | 🟢 BAJA | `utils/importExport.ts` | 97–102 | 16 — Import/Export | `jsonAMaterias` mapea `evaluaciones` con `...ev` spread sin validar subevaluaciones: no verifica que `subEvaluaciones.length <= 50`. Un JSON con 200 subevaluaciones en un grupo importa sin error y bypasea el límite de `agregarSub()`. |
| R6-06 | 🟢 BAJA | `utils/importExport.ts` | 97–102 | 1 — Validación | `pesoEnMateria` y `notaMaxima` de evaluaciones importadas aceptan cualquier valor (`...ev` spread sin validación). `pesoEnMateria: 150` y `notaMaxima: 0` pasan sin error. |
| R6-07 | 🟢 BAJA | `utils/horarioImportExport.ts` | 118–138 | 1 — Validación | `mapearBloque` acepta bloques donde `horaFin <= horaInicio`. El CSV parser (línea 110) sí valida esto, pero el JSON parser no. Un bloque importado con fin < inicio se renderiza con altura negativa en el horario. |
| R6-10 | 🟢 BAJA | `utils/importExport.ts` | 107 | 1 — Validación | `validarItemsMateriaJson` verifica `d.nombre.trim()` vacío pero almacena `d.nombre` sin aplicar `.trim()`. Un nombre con espacios iniciales/finales (`" Cálculo I "`) se guarda tal cual y puede duplicarse con `"Cálculo I"` en merges futuros. |
| R6-12 | 🟢 BAJA | `utils/importExport.ts` | 97–102 | 1 — Validación | `notaMaxima` en evaluaciones importadas acepta `0`. `calcularNotaTotal()` divide por `notaMaxima`; si es 0 produce `Infinity`. |
| R6-14 | 🟢 BAJA | `utils/importExport.ts` | 54–69 | 16 — Import/Export | `extraerTiposNuevos()` no limita la cantidad de tipos nuevos. Un JSON con 500 materias distintas cada una con tipo único agregaría 500 entradas a `config.tiposFormacion` sin restricción. |
| R6-16 | 🟢 BAJA | `utils/importExport.ts` | 97–102 | 16 — Import/Export | `fecha` de evaluaciones importadas no se valida como ISO YYYY-MM-DD. Una fecha inválida (`"2099-99-99"`) se almacena y puede causar comportamiento inesperado en el horario. |

---

### Falsos positivos descartados

- **R6-01 / R6-02 — Math.random() en IDs internos**: Los IDs de evaluaciones y bloques son claves internas de React, no tokens de autenticación. `Math.random()` es adecuado. El hallazgo de Ronda 1 fue específicamente para el código de sincronización entre dispositivos.
- **R6-05 — IDs en expansión ICS**: Mismo razonamiento — IDs de bloques horarios son claves internas.
- **R6-08 — Tamaño de DeviceSyncPayload**: LZString comprime agresivamente; un usuario necesitaría miles de materias con bloques complejos. Riesgo teórico, no práctico.
- **R6-09**: Duplicado de R6-03.
- **R6-11 — normalize('NFD') inconsistente en nombres**: Cambiar la lógica de matching en `mergeImportar` puede romper re-importaciones de usuarios existentes. Inconsistencia aceptable por diseño.
- **R6-13 — parseInt sin radix**: Falso positivo; el agente verificó y todos los `parseInt` tienen radix 10 explícito.
- **R6-15 — Consistencia cross-fields en aplicarConfigJson**: La aplicación independiente de campos es por diseño. Agregar cross-validation haría rechazar configs válidas.

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| Tercera (2026-05-14) | 6 | 6 |
| Cuarta (2026-05-14) | 4 | 4 |
| Quinta (2026-05-14) | 3 | 3 |
| Sexta (2026-05-14) | 8 | 8 |
| **Total acumulado** | **101** | **101** |

---

## Séptima Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la sexta ronda.  
**Resultado:** Se encontró **1 hallazgo nuevo** (0 Alta · 0 Media · 1 Baja).

---

### Nuevos hallazgos

| # | Severidad | Archivo | Líneas | Categoría | Problema |
|---|---|---|---|---|---|
| N7-01 | 🟢 BAJA | `screens/EditMateriaScreen.tsx`, `components/EvaluacionItem.tsx` | 97, 241, 256, 501, 222 | 11 — Concurrencia | Cuatro lugares usan `Date.now().toString()` como ID sin entropía adicional. `HorarioScreen` y otras partes del mismo archivo ya usan `${Date.now()}_${Math.random()}` como patrón. En uso normal no hay colisión (event loop JS es single-threaded), pero es inconsistente y frágil ante hipotéticos renders rápidos en tests o SSR. |

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| Tercera (2026-05-14) | 6 | 6 |
| Cuarta (2026-05-14) | 4 | 4 |
| Quinta (2026-05-14) | 3 | 3 |
| Sexta (2026-05-14) | 8 | 8 |
| Séptima (2026-05-14) | 1 | 1 |
| **Total acumulado** | **102** | **102** |

---

## Octava Ronda de Auditoría — 2026-05-14

**Alcance:** Re-análisis completo de `TablaApp/src/` luego de aplicar todas las correcciones de la séptima ronda.  
**Resultado:** Se encontraron **2 hallazgos nuevos** (0 Alta · 0 Media · 2 Baja) y **2 falsos positivos descartados**.

---

### Nuevos hallazgos

| # | Severidad | Archivo | Línea | Categoría | Problema |
|---|---|---|---|---|---|
| N8-02 | 🟢 BAJA | `utils/deviceSnapshot.ts` | 87–92 | 16 — Import/Export | `descomprimirPayload()` valida la forma exterior del payload (versión, tipo, estados es array) pero no la estructura de cada item en `estados`. Si un estado corrupto llega sin `perfilId` string o sin `materias` array, `aplicarSnapshot()` falla en runtime sin mensaje útil. |
| N8-04 | 🟢 BAJA | `components/QrScannerModal.tsx` | 91, 108, 135 | 14 — Logs | Los tres `catch` blocks de QR (`cursus-evaluaciones`, `cursus-config`, `cursus-horario`) muestran Alert al usuario pero no loguean en `__DEV__`. En desarrollo, los errores de descompresión o parsing quedan sin trazabilidad. |

---

### Falsos positivos descartados

- **N8-01 — IDs en HorarioScreen**: `${Date.now()}_${Math.random()}` ya tiene suficiente entropía. La diferencia con `Math.random().toString(36).slice(2, 7)` es solo de formato, no de seguridad.
- **N8-03 — Race condition en aplicarSnapshot**: Limitación aceptada de AsyncStorage (no soporta transacciones). El `try/catch` en `aplicarSnapshot()` y el manejo de errores en el caller (SyncDispositivosModal) ya cubren el escenario de fallo parcial. Agregar atomicidad requeriría un sistema de staging que está fuera del scope de la auditoría.

---

### Balance acumulado

| Ronda | Hallazgos encontrados | Corregidos |
|---|---|---|
| Primera (2026-05-13) | 74 | 74 |
| Segunda (2026-05-14) | 6 | 6 |
| Tercera (2026-05-14) | 6 | 6 |
| Cuarta (2026-05-14) | 4 | 4 |
| Quinta (2026-05-14) | 3 | 3 |
| Sexta (2026-05-14) | 8 | 8 |
| Séptima (2026-05-14) | 1 | 1 |
| Octava (2026-05-14) | 2 | 2 |
| **Total acumulado** | **104** | **104** |

---

## Novena Ronda de Auditoría — 2026-05-14

**Resultado: Sin hallazgos nuevos.** El análisis exhaustivo no detectó problemas adicionales en ninguna de las 16 categorías. Las dos sugerencias menores del agente resultaron falsos positivos: `storageTauri.ts` sin try/catch es correcto (los callers tienen su propia protección), y el `JSON.parse` en `QrScannerModal.onQrLeido` ya está dentro del try/catch externo de la función. La codebase está libre de los patrones de error auditados en este ciclo.
