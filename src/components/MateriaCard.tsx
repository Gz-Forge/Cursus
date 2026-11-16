import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Materia, Config, EstadoMateria } from '../types';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { obtenerNotaFinal, calcularEstadoFinal, creditosAcumulados } from '../utils/calculos';
import { partirCoincidencia } from '../utils/busqueda';
import { hexOpacity } from '../utils/useFondoPantalla';


function badgeCreditos(materia: Materia, config: Config): string {
  const badge = config.tarjetaCreditosBadge ?? 'da';
  const orden = config.tarjetaBadgeOrden ?? 'da_primero';
  const da = `${materia.creditosQueDA}cr`;
  const nec = `${materia.creditosNecesarios}cr`;
  if (badge === 'da') return da;
  if (badge === 'necesita') return nec;
  return orden === 'da_primero' ? `${da} | ${nec}` : `${nec} | ${da}`;
}

function notaDisplayTarjeta(notaPct: number | null, config: Config): string {
  if (notaPct === null) return '—';
  const tipo = config.tarjetaNota ?? config.mostrarNotaComo ?? 'numero';
  if (tipo === 'porcentaje') return `${notaPct.toFixed(1)}%`;
  return `${((notaPct / 100) * config.notaMaxima).toFixed(1)}/${config.notaMaxima}`;
}

function previasParaMostrar(
  previas: { num: number; nombre: string; ok: boolean }[],
  config: Config,
): { num: number; nombre: string; ok: boolean }[] {
  const modo = config.tarjetaPrevias ?? 'todas';
  if (modo === 'faltantes') return previas.filter(p => !p.ok);
  return previas;
}

interface Props {
  materia: Materia;
  todasLasMaterias: Materia[];
  config: Config;
  onEditar: () => void;
  onToggleCursando?: (v: boolean) => void;
  mostrarToggleCursando?: boolean;
  onLongPress?: () => void;
  pinned?: boolean;
  /** Texto buscado: se resalta en el nombre de la materia. */
  resaltar?: string;
}

export function MateriaCard({ materia, todasLasMaterias, config, onEditar, onToggleCursando, mostrarToggleCursando, onLongPress, pinned, resaltar }: Props) {
  const [expandida, setExpandida] = useState(false);
  const tema = useTema();
  const { getColor, getIcono, getLabel } = useEstadoEstilo();

  const notaPct = obtenerNotaFinal(materia);
  const estado = calcularEstadoFinal(materia, config);
  const icono = getIcono(estado);
  const color = getColor(estado);

  const previasObj = materia.previasNecesarias.map(num => {
    const m = todasLasMaterias.find(x => x.numero === num);
    const ok = m ? (
      calcularEstadoFinal(m, config) === 'exonerado' ||
      (config.aprobadoHabilitaPrevias && calcularEstadoFinal(m, config) === 'aprobado')
    ) : false;
    return { num, nombre: m?.nombre ?? `Materia ${num}`, ok };
  });

  const previasPendientes = previasObj.filter(p => !p.ok);
  const previasAMostrar = previasParaMostrar(previasObj, config);

  const creditosAcum = creditosAcumulados(todasLasMaterias, config);
  const creditosFaltantes = materia.creditosNecesarios > 0
    ? Math.max(0, materia.creditosNecesarios - creditosAcum)
    : 0;
  const mostrarAvisoCreditos =
    creditosFaltantes > 0 &&
    estado !== 'cursando' &&
    estado !== 'aprobado' &&
    estado !== 'exonerado';

  const s = StyleSheet.create({
    tarjeta: {
      backgroundColor: tema.tarjeta,
      borderRadius: 10,
      padding: 12,
      marginVertical: 4,
      borderLeftWidth: 4,
      borderLeftColor: color,
      ...(pinned ? { borderWidth: 2, borderColor: tema.acentoLineas ?? tema.acento } : {}),
    },
    fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    nombre: { color: tema.texto, fontSize: 15, fontWeight: '600', flex: 1 },
    badge: { color: tema.textoSecundario, fontSize: 13 },
    detalle: { marginTop: 10, borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: 8 },
    label: { color: tema.textoSecundario, fontSize: 13 },
    valor: { color: tema.texto, fontSize: 13 },
    advertencia: { color: '#FF9800', fontSize: 12, marginTop: 4 },
    botonEditar: {
      marginTop: 8, backgroundColor: tema.acentoFondo ?? tema.acento,
      padding: 8, borderRadius: 6, alignSelf: 'flex-end',
    },
  });

  const dosLineas = config.tarjetaDiseno === 'dos_lineas';

  const titulo = partirCoincidencia(`${materia.numero} · ${materia.nombre}`, resaltar ?? '').map((p, i) => (
    p.coincide
      ? <Text key={i} style={{ backgroundColor: (tema.acentoFondo ?? tema.acento) + hexOpacity(35), color: tema.texto, fontWeight: '800' }}>{p.texto}</Text>
      : <Text key={i}>{p.texto}</Text>
  ));

  // Línea 2 del diseño "dos líneas": partes separadas por " · "
  const partesLinea2: React.ReactNode[] = [];
  if (dosLineas) {
    partesLinea2.push(
      <Text key="estado">{icono} <Text style={{ color }}>{getLabel(estado)}</Text></Text>,
    );
    if ((config.tarjetaMostrarNota ?? true) && notaPct !== null) {
      partesLinea2.push(<Text key="nota">{notaDisplayTarjeta(notaPct, config)}</Text>);
    }
    partesLinea2.push(<Text key="cred">{badgeCreditos(materia, config)}</Text>);
    let clave: string | null = null;
    if (estado === 'reprobado') {
      clave = `${materia.oportunidadesExamen} ${materia.oportunidadesExamen === 1 ? 'oportunidad' : 'oportunidades'}`;
    } else if (estado === 'aprobado') {
      clave = `${materia.oportunidadesExamen} oport. de examen`;
    } else if (estado === 'cursando') {
      if (notaPct !== null) clave = `${notaPct.toFixed(0)}% acumulado`;
    } else if (estado === 'por_cursar') {
      if (previasPendientes.length > 0) {
        clave = `faltan ${previasPendientes.length} ${previasPendientes.length === 1 ? 'previa' : 'previas'}`;
      }
    }
    if (clave) partesLinea2.push(<Text key="clave">{clave}</Text>);
    if ((config.tarjetaTipoFormacion ?? true) && materia.tipoFormacion) {
      partesLinea2.push(<Text key="tipo">{materia.tipoFormacion}</Text>);
    }
  }

  return (
    <TouchableOpacity style={s.tarjeta} onPress={() => setExpandida(!expandida)} onLongPress={onLongPress} activeOpacity={0.75}>
      {dosLineas ? (
        <View>
          <Text style={[s.nombre, { fontWeight: '700', flex: undefined }]}>{titulo}</Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
            {partesLinea2.map((parte, i) => (
              <React.Fragment key={i}>{i > 0 ? ' · ' : ''}{parte}</React.Fragment>
            ))}
          </Text>
        </View>
      ) : (
        <View style={s.fila}>
          <Text style={s.nombre}>{titulo}</Text>
          <Text style={s.badge}>{icono} {badgeCreditos(materia, config)}</Text>
        </View>
      )}

        {(config.tarjetaAvisoPrevias ?? true) && previasPendientes.length > 0 && (
          <Text style={s.advertencia}>⚠️ Faltan previas N°: {previasPendientes.map(p => p.num).join(', ')}</Text>
        )}

        {(config.tarjetaAvisoCreditos ?? true) && mostrarAvisoCreditos && (
          <Text style={s.advertencia}>⚠️ Faltan {creditosFaltantes} créditos para cursarla</Text>
        )}

      {expandida && (
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
        <View style={s.detalle}>
          {(config.tarjetaAvisoCreditosExtendida ?? true) && mostrarAvisoCreditos && (
            <Text style={[s.advertencia, { marginBottom: 6 }]}>⚠️ Faltan {creditosFaltantes} créditos para cursarla</Text>
          )}

          {(config.tarjetaMostrarNota ?? true) && (
            <Text style={s.label}>Nota: <Text style={s.valor}>{notaDisplayTarjeta(notaPct, config)}</Text></Text>
          )}

          {(estado === 'aprobado' || estado === 'reprobado') && (
            <Text style={s.label}>Oport. examen: <Text style={s.valor}>{materia.oportunidadesExamen}</Text></Text>
          )}

          {(config.tarjetaTipoFormacion ?? true) && materia.tipoFormacion && (
            <Text style={[s.label, { marginTop: 4 }]}>
              Tipo: <Text style={s.valor}>{materia.tipoFormacion}</Text>
            </Text>
          )}

          {(() => {
            const modo = config.tarjetaCreditosExtendida ?? 'ambos';
            return (
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                {(modo === 'da' || modo === 'ambos') && (
                  <Text style={s.label}>Créditos que da: <Text style={s.valor}>{materia.creditosQueDA}</Text></Text>
                )}
                {(modo === 'necesita' || modo === 'ambos') && materia.creditosNecesarios > 0 && (
                  <Text style={s.label}>Necesita: <Text style={s.valor}>{materia.creditosNecesarios}</Text></Text>
                )}
              </View>
            );
          })()}

          {(config.tarjetaPrevias ?? 'todas') !== 'ninguna' && previasAMostrar.length > 0 && (
            <>
              <Text style={[s.label, { marginTop: 6 }]}>Previas:</Text>
              {previasAMostrar.map(p => (
                <Text key={p.num} style={s.valor}>
                  {p.ok ? '✅' : '❌'} {(config.tarjetaPreviasFormato ?? 'numero_nombre') === 'numero_nombre'
                    ? `${p.num} · ${p.nombre}`
                    : p.nombre}
                </Text>
              ))}
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
            {(mostrarToggleCursando ?? true) && onToggleCursando && (() => {
              const activo = materia.cursando ?? false;
              const colorCursando = getColor('cursando');
              return (
                <TouchableOpacity
                  onPress={() => onToggleCursando(!activo)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: activo }}
                  aria-checked={activo}
                  accessibilityLabel={getLabel('cursando')}
                  style={{
                    marginTop: 8, marginRight: 'auto', flexShrink: 1,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
                    borderWidth: 1, borderColor: colorCursando,
                    backgroundColor: activo ? colorCursando : 'transparent',
                  }}
                >
                  <View style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: activo ? '#fff' : colorCursando,
                  }} />
                  <Text style={{ color: activo ? '#fff' : colorCursando, fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                    {activo ? `${getLabel('cursando')} ✓` : getLabel('cursando')}
                  </Text>
                </TouchableOpacity>
              );
            })()}
            <TouchableOpacity style={s.botonEditar} onPress={onEditar}>
              <Text style={{ color: '#fff', fontSize: 13 }}>✏️ Editar</Text>
            </TouchableOpacity>
          </View>
        </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
