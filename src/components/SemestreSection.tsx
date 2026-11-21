import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
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
  /** Agregar materia a este semestre: toque largo de 3 s en el encabezado (clic derecho en web). */
  onAgregar?: (semestre: number) => void;
}

export function SemestreSection({ semestre, materias, totalMaterias, todasLasMaterias, config, colorAcento, onEditar, expandidoExterno, onToggle, webGrid, onToggleCursando, onAgregar }: Props) {
  const [expandidoLocal, setExpandidoLocal] = useState(true);
  const expandido = expandidoExterno !== undefined ? expandidoExterno : expandidoLocal;
  const toggleExpandido = onToggle ?? (() => setExpandidoLocal(v => !v));
  const tema = useTema();

  // Agregar materia: toque largo (3 s) en celular, clic derecho en web y escritorio.
  const esWeb = Platform.OS === 'web';
  const encabezadoRef = useRef<View>(null);
  const onAgregarRef = useRef(onAgregar);
  onAgregarRef.current = onAgregar;
  const agregable = !!onAgregar;
  useEffect(() => {
    if (!esWeb || !agregable) return;
    const nodo = encabezadoRef.current as unknown as HTMLElement | null;
    if (!nodo || typeof nodo.addEventListener !== 'function') return;
    const alClicDerecho = (e: Event) => {
      e.preventDefault();
      onAgregarRef.current?.(semestre);
    };
    nodo.addEventListener('contextmenu', alClicDerecho);
    return () => nodo.removeEventListener('contextmenu', alClicDerecho);
  }, [esWeb, agregable, semestre]);

  return (
    <View style={{ marginBottom: 8 }}>
      <View ref={encabezadoRef}>
      <TouchableOpacity
        onPress={toggleExpandido}
        onLongPress={onAgregar && !esWeb ? () => onAgregar(semestre) : undefined}
        delayLongPress={3000}
        accessibilityHint={onAgregar ? 'Mantené presionado para agregar una materia a este semestre' : undefined}
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
      </View>
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
          </>
        )
      )}
    </View>
  );
}
