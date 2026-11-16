import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Materia, Config } from '../types';
import { useTema } from '../theme/ThemeContext';
import { MateriaCard } from './MateriaCard';
import { AnilloProgreso } from './AnilloProgreso';
import { resumenSemestre } from '../utils/calculos';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { EstadoMateria } from '../types';

const ORDEN_ESTADOS: EstadoMateria[] = ['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'];

interface ResumenProps {
  materias: Materia[];
  totalMaterias?: number;
  config: Config;
  colorAcento: string;
}

/** Contenido de la derecha del encabezado de semestre (también se usa en la vista previa de Ajustes). */
export function ResumenEncabezado({ materias, totalMaterias, config, colorAcento }: ResumenProps) {
  const tema = useTema();
  const { getColor, getIcono } = useEstadoEstilo();
  const estilo = config.encabezadoSemestreEstilo ?? 'materias';
  const r = resumenSemestre(materias, config);
  const sufijoCred = config.encabezadoSemestreCreditos ? ` · ${r.creditos} cr` : '';
  const estados = ORDEN_ESTADOS.filter(e => (e !== 'aprobado' || config.usarEstadoAprobado) && r.conteo[e] > 0);
  const txt = { color: tema.textoSecundario, fontSize: 13 };

  if (estilo === 'barra') {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={txt}>{`${r.completadas}/${r.total}${sufijoCred}`}</Text>
        <View style={{ flexDirection: 'row', width: 80, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 3, backgroundColor: tema.borde }}>
          {estados.map(e => (
            <View key={e} style={{ width: `${(r.conteo[e] / Math.max(1, r.total)) * 100}%`, height: 4, backgroundColor: getColor(e) }} />
          ))}
        </View>
      </View>
    );
  }
  if (estilo === 'iconos') {
    return <Text style={txt}>{estados.map(e => `${getIcono(e)}${r.conteo[e]}`).join(' ') + sufijoCred}</Text>;
  }
  if (estilo === 'anillo') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={txt}>{`${r.pct}%${sufijoCred}`}</Text>
        <AnilloProgreso pct={r.pct} tamano={18} grosor={3} color={colorAcento} colorFondo={tema.borde} />
      </View>
    );
  }
  const base = totalMaterias !== undefined && totalMaterias > materias.length
    ? `${materias.length} de ${totalMaterias} materias`
    : `${materias.length} materias`;
  return <Text style={txt}>{base + sufijoCred}</Text>;
}

interface Props {
  semestre: number;
  materias: Materia[];
  totalMaterias?: number;
  todasLasMaterias: Materia[];
  config: Config;
  colorAcento: string;
  onEditar: (m: Materia) => void;
  expandidoExterno?: boolean;
  onToggle?: () => void;
  webGrid?: boolean;
  onToggleCursando?: (m: Materia, v: boolean) => void;
  /** Punto 48: tarjeta "＋ Agregar materia" al final del semestre. */
  onAgregar?: (semestre: number) => void;
}

export function SemestreSection({ semestre, materias, totalMaterias, todasLasMaterias, config, colorAcento, onEditar, expandidoExterno, onToggle, webGrid, onToggleCursando, onAgregar }: Props) {
  const [expandidoLocal, setExpandidoLocal] = useState(true);
  const expandido = expandidoExterno !== undefined ? expandidoExterno : expandidoLocal;
  const toggleExpandido = onToggle ?? (() => setExpandidoLocal(v => !v));
  const tema = useTema();

  const tarjetaAgregar = onAgregar ? (
    <TouchableOpacity
      onPress={() => onAgregar(semestre)}
      accessibilityRole="button"
      accessibilityLabel={`Agregar materia al ${semestre}° semestre`}
      style={{
        borderRadius: 10, padding: 12, marginVertical: 4, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderStyle: 'dashed', borderColor: colorAcento, minHeight: 48,
      }}
    >
      <Text style={{ color: colorAcento, fontWeight: '700', fontSize: 14 }}>＋ Agregar materia</Text>
    </TouchableOpacity>
  ) : null;

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={toggleExpandido}
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingVertical: 10, paddingHorizontal: 4,
          borderBottomWidth: 2, borderBottomColor: colorAcento,
        }}
      >
        <Text style={{ color: colorAcento, fontWeight: '700', fontSize: 15 }}>
          {expandido ? '▼' : '▶'} {semestre}° Semestre
        </Text>
        <ResumenEncabezado materias={materias} totalMaterias={totalMaterias} config={config} colorAcento={colorAcento} />
      </TouchableOpacity>
      {expandido && (
        webGrid ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {materias.map(m => (
              <View key={m.id} style={{ width: '50%', paddingHorizontal: 4 }}>
                <MateriaCard
                  materia={m}
                  todasLasMaterias={todasLasMaterias}
                  config={config}
                  onEditar={() => onEditar(m)}
                  mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
                  onToggleCursando={onToggleCursando ? (v) => onToggleCursando(m, v) : undefined}
                />
              </View>
            ))}
            {tarjetaAgregar && <View style={{ width: '50%', paddingHorizontal: 4 }}>{tarjetaAgregar}</View>}
          </View>
        ) : (
          <>
          {materias.map(m => (
            <MateriaCard
              key={m.id}
              materia={m}
              todasLasMaterias={todasLasMaterias}
              config={config}
              onEditar={() => onEditar(m)}
              mostrarToggleCursando={config.tarjetaMostrarToggleCursando ?? true}
              onToggleCursando={onToggleCursando ? (v) => onToggleCursando(m, v) : undefined}
            />
          ))}
          {tarjetaAgregar}
          </>
        )
      )}
    </View>
  );
}
