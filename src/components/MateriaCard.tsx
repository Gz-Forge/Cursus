import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Materia, Config, EstadoMateria } from '../types';
import { useTema } from '../theme/ThemeContext';
import { estadoColores } from '../theme/colors';
import { obtenerNotaFinal, calcularEstadoFinal } from '../utils/calculos';

const ICONOS: Record<EstadoMateria, string> = {
  aprobado: '✅', exonerado: '⭐', cursando: '🔵', por_cursar: '⬜', reprobado: '🟠', recursar: '🔴',
};

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
}

export function MateriaCard({ materia, todasLasMaterias, config, onEditar }: Props) {
  const [expandida, setExpandida] = useState(false);
  const tema = useTema();

  const notaPct = obtenerNotaFinal(materia);
  const estado = calcularEstadoFinal(materia, config);
  const icono = ICONOS[estado];
  const color = estadoColores[estado];

  const previasObj = materia.previasNecesarias.map(num => {
    const m = todasLasMaterias.find(x => x.numero === num);
    const ok = m ? (calcularEstadoFinal(m, config) === 'aprobado' || calcularEstadoFinal(m, config) === 'exonerado') : false;
    return { num, nombre: m?.nombre ?? `Materia ${num}`, ok };
  });

  const previasPendientes = previasObj.filter(p => !p.ok);

  const s = StyleSheet.create({
    tarjeta: {
      backgroundColor: tema.tarjeta,
      borderRadius: 10,
      padding: 12,
      marginVertical: 4,
      borderLeftWidth: 4,
      borderLeftColor: color,
    },
    fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    nombre: { color: tema.texto, fontSize: 15, fontWeight: '600', flex: 1 },
    badge: { color: tema.textoSecundario, fontSize: 13 },
    detalle: { marginTop: 10, borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: 8 },
    label: { color: tema.textoSecundario, fontSize: 13 },
    valor: { color: tema.texto, fontSize: 13 },
    advertencia: { color: '#FF9800', fontSize: 12, marginTop: 4 },
    botonEditar: {
      marginTop: 8, backgroundColor: tema.acento,
      padding: 8, borderRadius: 6, alignSelf: 'flex-end',
    },
  });

  return (
    <TouchableOpacity style={s.tarjeta} onPress={() => setExpandida(!expandida)}>
      <View style={s.fila}>
        <Text style={s.nombre}>{materia.numero} · {materia.nombre}</Text>
        <Text style={s.badge}>{icono} {badgeCreditos(materia, config)}</Text>
      </View>

      {(config.tarjetaAvisoPrevias ?? true) && previasPendientes.length > 0 && (
        <Text style={s.advertencia}>⚠️ Faltan previas: {previasPendientes.map(p => p.num).join(', ')}</Text>
      )}

      {expandida && (
        <View style={s.detalle}>
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

          {(config.tarjetaPrevias ?? 'todas') !== 'ninguna' && materia.previasNecesarias.length > 0 && (
            <>
              <Text style={[s.label, { marginTop: 6 }]}>Previas:</Text>
              {previasParaMostrar(previasObj, config).map(p => (
                <Text key={p.num} style={s.valor}>
                  {p.ok ? '✅' : '❌'} {(config.tarjetaPreviasFormato ?? 'numero_nombre') === 'numero_nombre'
                    ? `${p.num} · ${p.nombre}`
                    : p.nombre}
                </Text>
              ))}
            </>
          )}

          <TouchableOpacity style={s.botonEditar} onPress={onEditar}>
            <Text style={{ color: '#fff', fontSize: 13 }}>✏️ Editar</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}
