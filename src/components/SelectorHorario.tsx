import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, PanResponder } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import {
  normalizarRango, moverRango, moverInicio, moverFin, rangoLinea, fmtMin, fmtDuracion,
  seSuperpone, unirConY, redondear15, FIN_DIA, HorarioSugerido,
} from '../utils/horarioSelector';

interface Props {
  inicio: number;
  /** null = sin hora de fin (solo con permiteSinFin). */
  fin: number | null;
  onCambiar: (v: { inicio: number; fin: number | null }) => void;
  sugeridos?: HorarioSugerido[];
  ocupados?: { inicio: number; fin: number }[];
  permiteSinFin?: boolean;
  /** Arranca mostrando solo el resumen con "Cambiar ▾" (edición rápida). */
  plegado?: boolean;
}

type Zona = 'inicio' | 'cuerpo' | 'fin';

/**
 * Selector de hora con línea de tiempo (opción D): resumen, horarios de la materia,
 * línea de 7 a 23 h que se arrastra de a 15 min, ocupados del día y ajuste fino ±15.
 */
export function SelectorHorario({ inicio, fin, onCambiar, sugeridos = [], ocupados = [], permiteSinFin, plegado }: Props) {
  const tema = useTema();
  const acento = tema.acentoFondo ?? tema.acento;
  const [abierto, setAbierto] = useState(!plegado);
  const [ancho, setAncho] = useState(0);
  const pistaRef = useRef<View>(null);
  const pistaX = useRef(0);
  const arrastre = useRef<{ zona: Zona; inicio: number; fin: number } | null>(null);

  const sinFin = fin === null;
  const { desde, hasta } = rangoLinea(inicio, fin);
  const total = hasta - desde;
  const pxMin = ancho > 0 ? ancho / total : 0;
  const x = (m: number) => (m - desde) * pxMin;

  // Refs con los valores actuales para el PanResponder (se crea una sola vez)
  const actual = useRef({ inicio, fin, desde, pxMin, sinFin, onCambiar });
  actual.current = { inicio, fin, desde, pxMin, sinFin, onCambiar };

  const emitir = (v: { inicio: number; fin: number | null }) => {
    if (v.fin === null) actual.current.onCambiar({ inicio: Math.max(0, Math.min(FIN_DIA - 15, redondear15(v.inicio))), fin: null });
    else actual.current.onCambiar(normalizarRango(v.inicio, v.fin));
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false, // que el ScrollView no se lleve el gesto
    onPanResponderGrant: (_e, g) => {
      const a = actual.current;
      if (!a.pxMin) return;
      pistaRef.current?.measureInWindow?.((px: number) => { if (typeof px === 'number') pistaX.current = px; });
      const minToque = a.desde + (g.x0 - pistaX.current) / a.pxMin;
      const finA = a.fin ?? a.inicio;
      const margen = 22 / a.pxMin; // 44 px de zona táctil en los bordes
      let zona: Zona = 'cuerpo';
      if (a.sinFin) zona = 'inicio';
      else if (Math.abs(minToque - a.inicio) <= margen && minToque < (a.inicio + finA) / 2) zona = 'inicio';
      else if (Math.abs(minToque - finA) <= margen) zona = 'fin';
      else if (minToque < a.inicio || minToque > finA) {
        // Tocar afuera del bloque lo lleva ahí (centrado), manteniendo la duración
        const dur = finA - a.inicio;
        const nuevo = moverRango(a.inicio, finA, minToque - dur / 2 - a.inicio);
        emitir(a.sinFin ? { inicio: redondear15(minToque), fin: null } : nuevo);
        arrastre.current = { zona: 'cuerpo', inicio: a.sinFin ? redondear15(minToque) : nuevo.inicio, fin: a.sinFin ? redondear15(minToque) : nuevo.fin };
        return;
      }
      arrastre.current = { zona, inicio: a.inicio, fin: finA };
    },
    onPanResponderMove: (_e, g) => {
      const a = actual.current;
      const d = arrastre.current;
      if (!d || !a.pxMin) return;
      const delta = g.dx / a.pxMin;
      if (a.sinFin) { emitir({ inicio: d.inicio + delta, fin: null }); return; }
      if (d.zona === 'inicio') emitir(moverInicio(d.inicio, d.fin, delta));
      else if (d.zona === 'fin') emitir(moverFin(d.inicio, d.fin, delta));
      else emitir(moverRango(d.inicio, d.fin, delta));
    },
    onPanResponderRelease: () => { arrastre.current = null; },
    onPanResponderTerminate: () => { arrastre.current = null; },
  })).current;

  const resumen = sinFin
    ? `${fmtMin(inicio)} · sin hora de fin`
    : `${fmtMin(inicio)} → ${fmtMin(fin!)} · ${fmtDuracion(fin! - inicio)}`;
  const superpone = !sinFin && seSuperpone(inicio, fin!, ocupados);

  const ajuste = (label: string, onMenos: () => void, onMas: () => void, etiqueta: string) => (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>{label}</Text>
      {(['−15', '+15'] as const).map(t => (
        <TouchableOpacity
          key={t}
          onPress={t === '−15' ? onMenos : onMas}
          accessibilityRole="button"
          accessibilityLabel={`${t === '−15' ? 'Adelantar' : 'Retrasar'} ${etiqueta} 15 minutos`}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: tema.fondo, borderWidth: 1, borderColor: tema.borde }}
        >
          <Text style={{ color: tema.texto, fontSize: 12, fontWeight: '600' }}>{t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const chip = (activo: boolean, texto: string, onPress: () => void, key: string) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={{
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
        backgroundColor: activo ? acento : tema.fondo, borderWidth: 1, borderColor: activo ? acento : tema.borde,
      }}
    >
      <Text style={{ color: activo ? '#fff' : tema.texto, fontSize: 12, fontWeight: activo ? '700' : '500' }}>{texto}</Text>
    </TouchableOpacity>
  );

  // Marcas de hora cada 2 h (cada 3 si la línea es larga)
  const pasoMarca = total > 18 * 60 ? 180 : 120;
  const marcas: number[] = [];
  for (let m = Math.ceil(desde / pasoMarca) * pasoMarca; m <= hasta; m += pasoMarca) marcas.push(m);

  return (
    <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 10 }}>
      {/* Resumen */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: tema.texto, fontSize: 15, fontWeight: '700' }} accessibilityLiveRegion="polite">{resumen}</Text>
        {plegado && (
          <TouchableOpacity onPress={() => setAbierto(v => !v)} accessibilityRole="button">
            <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600' }}>{abierto ? 'Listo ▴' : 'Cambiar ▾'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {abierto && (
        <>
          {permiteSinFin && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {chip(!sinFin, 'Con hora de fin', () => { if (sinFin) emitir({ inicio, fin: Math.min(FIN_DIA, inicio + 120) }); }, 'con')}
              {chip(sinFin, 'Sin hora de fin', () => { if (!sinFin) onCambiar({ inicio, fin: null }); }, 'sin')}
            </View>
          )}

          {sugeridos.length > 0 && (
            <>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 10, marginBottom: 6 }}>Usar un horario de esta materia</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {sugeridos.map(s => chip(
                  inicio === s.inicio && (sinFin || fin === s.fin),
                  `${fmtMin(s.inicio)}–${fmtMin(s.fin)} · ${unirConY(s.dias)} · ${unirConY(s.tipos)}`,
                  () => onCambiar(sinFin ? { inicio: s.inicio, fin: null } : { inicio: s.inicio, fin: s.fin }),
                  `${s.inicio}-${s.fin}`,
                ))}
              </View>
            </>
          )}

          {/* Línea de tiempo: se arrastra el bloque o sus bordes, de a 15 min */}
          <View
            ref={pistaRef}
            onLayout={e => {
              setAncho(e.nativeEvent.layout.width);
              pistaRef.current?.measureInWindow?.((px: number) => { if (typeof px === 'number') pistaX.current = px; });
            }}
            {...responder.panHandlers}
            accessibilityLabel={`Línea de tiempo: ${resumen}. Arrastrá para cambiar o usá los botones de 15 minutos.`}
            style={{ height: 52, marginTop: 14, marginBottom: 4, justifyContent: 'center' }}
          >
            {/* fondo */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: 14, height: 24, borderRadius: 6, backgroundColor: tema.fondo }} />
            {/* ocupados (rayados) */}
            {pxMin > 0 && ocupados.map((o, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute', top: 14, height: 24, left: x(Math.max(o.inicio, desde)),
                  width: Math.max(2, x(Math.min(o.fin, hasta)) - x(Math.max(o.inicio, desde))),
                  backgroundColor: tema.textoSecundario + '33', borderLeftWidth: 1, borderRightWidth: 1,
                  borderColor: tema.textoSecundario + '66', borderStyle: 'dashed',
                }}
              />
            ))}
            {/* bloque elegido */}
            {pxMin > 0 && (sinFin ? (
              <View pointerEvents="none" style={{ position: 'absolute', top: 8, height: 36, left: x(inicio) - 2, width: 4, borderRadius: 2, backgroundColor: acento }} />
            ) : (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: 10, height: 32, left: x(inicio), width: Math.max(6, x(fin!) - x(inicio)),
                  borderRadius: 6, backgroundColor: acento + 'CC', borderWidth: 2, borderColor: superpone ? '#FF9800' : acento,
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: '#fff', marginLeft: 2 }} />
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: '#fff', marginRight: 2 }} />
              </View>
            ))}
            {/* marcas de hora */}
            {pxMin > 0 && marcas.map(m => (
              <Text key={m} pointerEvents="none" style={{ position: 'absolute', top: 40, left: x(m) - 14, width: 28, textAlign: 'center', color: tema.textoSecundario, fontSize: 9 }}>
                {Math.floor(m / 60)}h
              </Text>
            ))}
          </View>

          {/* Ajuste fino */}
          <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
            {ajuste('Inicio',
              () => emitir(sinFin ? { inicio: inicio - 15, fin: null } : moverInicio(inicio, fin!, -15)),
              () => emitir(sinFin ? { inicio: inicio + 15, fin: null } : moverInicio(inicio, fin!, 15)),
              'el inicio')}
            {!sinFin && ajuste('Fin',
              () => emitir(moverFin(inicio, fin!, -15)),
              () => emitir(moverFin(inicio, fin!, 15)),
              'el fin')}
          </View>

          {superpone && (
            <Text style={{ color: '#FF9800', fontSize: 12, marginTop: 8 }}>
              ⚠ Se superpone con otro bloque de ese día. Podés guardarlo igual.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
