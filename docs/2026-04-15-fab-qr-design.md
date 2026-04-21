# FAB Speed-Dial + Compartir Carrera por QR — Diseño

**Fecha:** 2026-04-15  
**Estado:** Aprobado

---

## Objetivo

Agregar un botón flotante (FAB) con menú speed-dial en `CarreraScreen` que permita:
1. Crear una materia nueva
2. Generar QR(s) para compartir la carrera
3. Escanear QR(s) para importar una carrera

---

## Componentes nuevos

| Archivo | Rol |
|---------|-----|
| `src/components/FabSpeedDial.tsx` | FAB animado con 3 mini-botones |
| `src/components/QrShareModal.tsx` | Modal con carrusel de QR(s) + botón .json |
| `src/components/QrScannerModal.tsx` | Modal con cámara, colector de chunks, confirmación |
| `src/utils/qrPayload.ts` | Compresión/descompresión + split/join de chunks |

---

## Flujo — Generar QR

1. Usuario toca FAB → speed-dial se expande
2. Toca "📤 Compartir QR"
3. Se abre `QrShareModal`:
   - Comprime la carrera: claves cortas + `lz-string.compressToBase64`
   - Si payload ≤ 2,800 chars → 1 QR
   - Si payload > 2,800 chars → divide en chunks de 2,800, genera N QRs con header `{"i":<idx>,"t":<total>,"d":"<chunk>"}`
   - Muestra carrusel paginado ("QR 1 de N") con botón Siguiente/Anterior
   - Botón "Compartir .json" siempre visible como alternativa

## Flujo — Escanear QR

1. Usuario toca "📷 Escanear QR" en el speed-dial
2. Se abre `QrScannerModal` con cámara
3. Al leer un QR:
   - Si es payload simple (no tiene campo `t`) → importa directo
   - Si tiene `{"i","t","d"}` → modo multi-QR: muestra progreso "Scaneado X de N", espera los restantes
4. Una vez completo → descomprime → muestra Alert de confirmación con cantidad de materias
5. Confirma → llama `guardarMateria` para cada una

---

## Compresión (qrPayload.ts)

**Formato compacto de materia:**
```typescript
// Claves cortas para minimizar tamaño antes de comprimir
{ n, s, nm, cd, cn, p, oe }
// numero, semestre, nombre, creditos_da, creditos_necesarios, previas, oportunidades_examen
```

**Pipeline encode:**
```
MateriaJson[] → clave-corta[] → JSON.stringify → lz-string.compressToBase64 → split chunks
```

**Pipeline decode:**
```
chunks → join → lz-string.decompressFromBase64 → JSON.parse → clave-larga[] → jsonAMaterias()
```

**Tabla de decisión:**
| Tamaño comprimido | Resultado |
|-------------------|-----------|
| ≤ 2,800 chars | 1 QR |
| > 2,800 chars | N QRs en carrusel |

---

## FAB Speed-Dial

- Botón principal: `+` (rota 45° cuando abierto) con `Animated.spring`
- 3 mini-botones aparecen escalonados hacia arriba al abrir
- Overlay semitransparente detrás cierra el menú al tocarlo
- Posición: bottom-right, sobre el contenido del ScrollView

---

## Librerías nuevas

| Librería | Uso |
|----------|-----|
| `react-native-qrcode-svg` | Generar QR (usa react-native-svg ya instalado) |
| `expo-camera` | Escanear QR con cámara |
| `lz-string` | Comprimir/descomprimir payload |

---

## Testing

- `__tests__/qrPayload.test.ts`: encode/decode roundtrip con 1, 30 y 60 materias; split/join de chunks; manejo de previas
