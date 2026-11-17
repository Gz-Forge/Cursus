// Cursus/src/components/PeriodoExamenModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../theme/ThemeContext';
import { useStore } from '../store/useStore';
import { useAlert } from '../contexts/AlertContext';
import { PeriodoExamen } from '../types';
import { ordenarPeriodos, inicioAIso, finAIso } from '../utils/periodosExamen';
import {
  grillaMes, encabezadoDias, sumarMeses, tituloMes, hoyIso, mismoMes, isoAFecha, fechaLarga,
} from '../utils/calendario';

interface Props {
  visible: boolean;
  onCerrar: () => void;
}

const MESES_INICIAL = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const RE_DDMM = /^\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' -> 'DD-MM' */
const isoADdmm = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

/** Texto de una fecha de período: 'DD/MM' (ciclo) o 'DD/MM/AAAA'. */
function textoFecha(f: string): string {
  if (RE_DDMM.test(f)) return `${f.slice(0, 2)}/${f.slice(3, 5)}`;
  return `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
}

/** "01/07 – 20/07", o "15/07" si inicio = fin. */
function textoPeriodo(p: PeriodoExamen): string {
  return p.inicio === p.fin ? textoFecha(p.inicio) : `${textoFecha(p.inicio)} – ${textoFecha(p.fin)}`;
}

/** Día del año (0 = 1 de enero) de una fecha ISO. */
function diaDelAnio(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
}

/** Línea del año: 12 meses y cada período como un tramo proporcional. */
function LineaDelAnio({ periodos, ciclo, anio }: { periodos: PeriodoExamen[]; ciclo: boolean; anio: number }) {
  const tema = useTema();
  const acento = tema.acentoFondo ?? tema.acento;
  const total = diaDelAnio(`${anio}-12-31`) + 1;
  const tramos = periodos.flatMap(p => {
    let ini = inicioAIso(p.inicio, ciclo, anio);
    let fin = finAIso(p.fin, ciclo, anio);
    if (fin < `${anio}-01-01` || ini > `${anio}-12-31`) return [];
    if (ini < `${anio}-01-01`) ini = `${anio}-01-01`;
    if (fin > `${anio}-12-31`) fin = `${anio}-12-31`;
    const desde = diaDelAnio(ini);
    const largo = Math.max(1, diaDelAnio(fin) - desde + 1);
    return [{ key: `${p.inicio}_${p.fin}`, izq: (desde / total) * 100, ancho: Math.max((largo / total) * 100, 1.2) }];
  });
  return (
    <View style={{ marginBottom: 14 }} accessibilityLabel={`Línea del año ${anio} con ${tramos.length} períodos`}>
      <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 4 }}>{ciclo ? 'Cada año' : `Año ${anio}`}</Text>
      <View style={{ height: 14, backgroundColor: tema.tarjeta, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
        {MESES_INICIAL.map((_, i) => (
          <View key={i} style={{ flex: 1, borderRightWidth: i < 11 ? 1 : 0, borderRightColor: tema.borde }} />
        ))}
        {tramos.map(t => (
          <View
            key={t.key}
            style={{
              position: 'absolute', top: 0, bottom: 0, backgroundColor: acento, borderRadius: 2,
              left: `${t.izq}%` as any, width: `${Math.min(t.ancho, 100 - t.izq)}%` as any,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {MESES_INICIAL.map((m, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', color: tema.textoSecundario, fontSize: 10 }}>{m}</Text>
        ))}
      </View>
    </View>
  );
}

export function PeriodoExamenModal({ visible, onCerrar }: Props) {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const safeBottomModal = Math.max(bottomInset, Platform.OS === 'android' ? 24 : 0);
  const tema = useTema();
  const { config, actualizarConfig } = useStore();
  const { showAlert } = useAlert();
  const hoy = hoyIso();
  const [ancla, setAncla] = useState<string>(`${hoy.slice(0, 7)}-01`);
  const [selInicio, setSelInicio] = useState<string | null>(null);
  const [selFin, setSelFin] = useState<string | null>(null);

  const modo = config.modoExamen;
  const periodos = ordenarPeriodos(config.periodosExamen ?? []);
  const ciclo = config.examenRepetirCiclo ?? false;
  const acento = tema.acentoFondo ?? tema.acento;
  const anioActual = parseInt(hoy.slice(0, 4), 10);
  const anioLinea = ciclo ? anioActual : parseInt(ancla.slice(0, 4), 10);
  const primerDia = config.horarioPrimerDia ?? 'lunes';

  const setModo = (m: 'manual' | 'automatico') => actualizarConfig({ modoExamen: m });

  const limpiarSeleccion = () => { setSelInicio(null); setSelFin(null); };

  const tocarDia = (dia: string) => {
    if (!selInicio || selFin) {
      setSelInicio(dia);
      setSelFin(null);
    } else if (dia < selInicio) {
      setSelFin(selInicio);
      setSelInicio(dia);
    } else {
      setSelFin(dia);
    }
  };

  const agregarPeriodo = () => {
    if (!selInicio) return;
    const iniIso = selInicio;
    const finIsoSel = selFin ?? selInicio;
    const nuevo: PeriodoExamen = ciclo
      ? { inicio: isoADdmm(iniIso), fin: isoADdmm(finIsoSel) }
      : { inicio: iniIso, fin: finIsoSel };
    if (periodos.some(p => p.inicio === nuevo.inicio && p.fin === nuevo.fin)) {
      showAlert('Período duplicado', 'Ese período ya está en la lista.');
      return;
    }
    actualizarConfig({ periodosExamen: ordenarPeriodos([...periodos, nuevo]) });
    limpiarSeleccion();
  };

  const eliminarPeriodo = (p: PeriodoExamen) => {
    const finEjecutado = finAIso(p.fin, ciclo, anioActual);
    actualizarConfig({
      periodosExamen: periodos.filter(x => !(x.inicio === p.inicio && x.fin === p.fin)),
      fechasEjecutadas: config.fechasEjecutadas.filter(x => x !== finEjecutado),
    });
  };

  /** Convierte los períodos existentes al formato del nuevo modo de ciclo. */
  const cambiarCiclo = (v: boolean) => {
    const conv = (f: string): string => {
      if (v) return RE_DDMM.test(f) ? f : isoADdmm(f);
      return RE_DDMM.test(f) ? `${anioActual}-${f.slice(3, 5)}-${f.slice(0, 2)}` : f;
    };
    const vistos = new Set<string>();
    const convertidos = periodos
      .map(p => ({ inicio: conv(p.inicio), fin: conv(p.fin) }))
      .filter(p => {
        const k = `${p.inicio}_${p.fin}`;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
    actualizarConfig({ examenRepetirCiclo: v, periodosExamen: ordenarPeriodos(convertidos) });
    limpiarSeleccion();
  };

  const semanas = grillaMes(ancla, primerDia);
  const rangoFin = selFin ?? selInicio;

  const isWeb = Platform.OS === 'web';

  const contenido = (
    <ScrollView keyboardShouldPersistTaps="handled" style={isWeb ? { maxHeight: 560 } : undefined}>
      {/* Toggle Manual / Automático */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.tarjeta, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
        {(['manual', 'automatico'] as const).map(m => (
          <TouchableOpacity
            key={m}
            onPress={() => setModo(m)}
            style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: modo === m ? (tema.acentoFondo ?? tema.acento) : 'transparent' }}
          >
            <Text style={{ color: modo === m ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 13 }}>
              {m === 'manual' ? '✋ Manual' : '🗓️ Automático'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {modo === 'manual' ? (
        <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Modo manual</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 13, lineHeight: 20 }}>
            El botón "📅 Período de examen" en la pantalla Carrera descuenta manualmente 1 oportunidad a cada materia aprobada o reprobada, cada vez que lo presionás.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: tema.texto, fontWeight: '600', marginBottom: 6 }}>Modo automático</Text>
            <Text style={{ color: tema.textoSecundario, fontSize: 13, lineHeight: 20 }}>
              Al abrir la app después de terminar un período, se descuenta automáticamente 1 oportunidad. El botón manual desaparece del FAB.
            </Text>
          </View>

          {/* Switch Repetir ciclo */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: tema.texto, fontWeight: '600', fontSize: 14 }}>Repetir ciclo</Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 2 }}>
                {ciclo ? 'Los períodos se repiten cada año automáticamente.' : 'Los períodos son de un año puntual.'}
              </Text>
            </View>
            <Switch
              value={ciclo}
              onValueChange={cambiarCiclo}
              trackColor={{ true: acento }}
            />
          </View>

          <LineaDelAnio periodos={periodos} ciclo={ciclo} anio={anioLinea} />

          {/* Calendario para elegir un rango */}
          <View style={{ backgroundColor: tema.fondo, borderRadius: 10, padding: 8, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <TouchableOpacity
                onPress={() => setAncla(a => sumarMeses(a, -1))}
                accessibilityRole="button"
                accessibilityLabel="Mes anterior"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 14, paddingVertical: 2 }}
              >
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 22 }}>‹</Text>
              </TouchableOpacity>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>{tituloMes(ancla)}</Text>
              <TouchableOpacity
                onPress={() => setAncla(a => sumarMeses(a, 1))}
                accessibilityRole="button"
                accessibilityLabel="Mes siguiente"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ paddingHorizontal: 14, paddingVertical: 2 }}
              >
                <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 22 }}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 2 }}>
              {encabezadoDias(primerDia).map(d => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', color: tema.textoSecundario, fontSize: 10 }}>{d}</Text>
              ))}
            </View>
            {semanas.map(semana => (
              <View key={semana[0]} style={{ flexDirection: 'row' }}>
                {semana.map(dia => {
                  const fuera = !mismoMes(dia, ancla);
                  const extremo = dia === selInicio || dia === selFin;
                  const enRango = !!selInicio && !!rangoFin && dia >= selInicio && dia <= rangoFin;
                  return (
                    <TouchableOpacity
                      key={dia}
                      onPress={() => tocarDia(dia)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: enRango }}
                      accessibilityLabel={fechaLarga(dia)}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 2, backgroundColor: enRango && !extremo ? acento + '33' : 'transparent' }}
                    >
                      <View style={{
                        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: extremo ? acento : 'transparent',
                        borderWidth: dia === hoy && !extremo ? 1 : 0, borderColor: tema.acentoLineas ?? tema.acento,
                      }}>
                        <Text style={{
                          color: extremo ? '#fff' : fuera ? tema.textoSecundario : tema.texto,
                          opacity: fuera && !extremo ? 0.45 : 1,
                          fontSize: 13, fontWeight: extremo || dia === hoy ? '700' : '400',
                        }}>
                          {isoAFecha(dia).getDate()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <Text style={{ color: selInicio ? tema.texto : tema.textoSecundario, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
              {!selInicio
                ? 'Tocá el primer día del período'
                : !selFin
                  ? `Desde ${fechaLarga(selInicio)}. Tocá el último día, o agregá un período de un día.`
                  : `${fechaLarga(selInicio)} a ${fechaLarga(selFin)}`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={agregarPeriodo}
            disabled={!selInicio}
            accessibilityRole="button"
            accessibilityState={{ disabled: !selInicio }}
            style={{ backgroundColor: acento, paddingVertical: 10, borderRadius: 8, alignItems: 'center', opacity: selInicio ? 1 : 0.4, marginBottom: 16 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar período</Text>
          </TouchableOpacity>

          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
            Períodos ({periodos.length})
          </Text>

          {periodos.length === 0 && (
            <Text style={{ color: tema.textoSecundario, fontSize: 13, marginBottom: 12 }}>
              Sin períodos configurados.
            </Text>
          )}

          {periodos.map(p => {
            const yaEjecutado = config.fechasEjecutadas.includes(finAIso(p.fin, ciclo, anioActual));
            const texto = textoPeriodo(p);
            return (
              <View key={`${p.inicio}_${p.fin}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
                <Text style={{ flex: 1, color: yaEjecutado ? tema.textoSecundario : tema.texto, fontSize: 15 }}>
                  {texto}{yaEjecutado ? '  ✓' : ''}
                </Text>
                {!yaEjecutado && (
                  <TouchableOpacity onPress={() => eliminarPeriodo(p)} accessibilityRole="button" accessibilityLabel={`Borrar período ${texto}`} style={{ padding: 4 }}>
                    <Text style={{ color: '#F44336', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 10 }}>
            La oportunidad se descuenta al terminar el período.
          </Text>
        </>
      )}

      <TouchableOpacity onPress={onCerrar} style={{ alignItems: 'center', marginTop: 20, paddingBottom: 8 }}>
        <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cerrar</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (isWeb) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={onCerrar}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: tema.superficie, borderRadius: 16, padding: 24, width: 420, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}>
              <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
                Períodos de examen
              </Text>
              {contenido}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onCerrar} />
      <View style={{ backgroundColor: tema.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 + safeBottomModal }}>
        <Text style={{ color: tema.texto, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
          Períodos de examen
        </Text>
        {contenido}
      </View>
    </Modal>
  );
}
