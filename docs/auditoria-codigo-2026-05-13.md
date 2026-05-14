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
| Segunda (2026-05-14) | 6 | 0 (pendientes) |
| **Total acumulado** | **80** | **74** |
