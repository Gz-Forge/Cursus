import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Evaluacion, EvaluacionSimple, GrupoEvaluacion, SubEvaluacion, TipoNota } from '../types';
import { useTema } from '../theme/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import {
  calcularPorcentajeEvaluacion,
  contribucionParcialEvaluacion,
  contribucionSubEvaluacion,
  pesoSubEvaluacion,
} from '../utils/calculos';
import { parsearMes } from '../utils/fecha';
import { confirmacionBorrarEvaluacion } from '../utils/ayudas';
import { ultimoMaximo, ajustarNota } from '../utils/numerosNotas';
import { SelectorFecha } from './SelectorFecha';
import { SelectorHorario } from './SelectorHorario';
import { esIsoValida } from '../utils/calendario';
import { HorarioSugerido } from '../utils/horarioSelector';

// ── Constantes ────────────────────────────────────────────────────────────────
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Helpers de formato ────────────────────────────────────────────────────────
function fmtHoraEval(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

function isoToDisplay(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

// ── Fecha y hora de una evaluación (puntos 1/11 y selector de hora D) ────────
function FechaHoraPicker({
  fecha,
  hora,
  horaFin,
  onActualizar,
  sugeridos = [],
  ocupadosDe,
  excluirId,
  diasMarcados,
}: {
  fecha?: string;
  hora?: number;
  horaFin?: number;
  onActualizar: (p: { fecha?: string; hora?: number; horaFin?: number }) => void;
  sugeridos?: HorarioSugerido[];
  /** Horarios ocupados en una fecha (otros bloques y evaluaciones), sin esta evaluación. */
  ocupadosDe?: (fecha: string, excluirId?: string) => { inicio: number; fin: number }[];
  excluirId?: string;
  diasMarcados?: string[];
}) {
  const tema = useTema();
  const [expandido, setExpandido] = useState(false);
  const tieneFecha = esIsoValida(fecha);

  // Sin hora todavía: el primer horario sugerido o 08:00, sin hora de fin
  const inicio = hora ?? sugeridos[0]?.inicio ?? 480;
  const fin: number | null = hora === undefined ? null : (horaFin ?? null);

  // Se guarda en cada cambio, como antes
  const cambiarFecha = (iso: string) => onActualizar({ fecha: iso, hora: inicio, horaFin: fin ?? undefined });
  const cambiarHora = (v: { inicio: number; fin: number | null }) =>
    onActualizar({ fecha, hora: v.inicio, horaFin: v.fin ?? undefined });
  const limpiar = () => {
    onActualizar({ fecha: undefined, hora: undefined, horaFin: undefined });
    setExpandido(false);
  };

  const labelFecha = tieneFecha
    ? `📅 ${isoToDisplay(fecha!)}${hora !== undefined ? `  ${fmtHoraEval(hora)}` : ''}`
    : null;

  return (
    <View style={{ marginTop: 6 }}>
      {labelFecha || expandido ? (
        <TouchableOpacity
          onPress={() => setExpandido(v => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ color: tema.textoSecundario, fontSize: 12, flex: 1 }}>{labelFecha ?? '📅 Fecha en el horario'}</Text>
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 11 }}>{expandido ? '▲' : '▼'}</Text>
        </TouchableOpacity>
      ) : (
        /* Punto 69: sin fecha, un botón claro en vez de "Sin fecha en horario" */
        <TouchableOpacity
          onPress={() => setExpandido(true)}
          accessibilityRole="button"
          style={{
            alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
            borderWidth: 1, borderStyle: 'dashed', borderColor: tema.acentoLineas ?? tema.acento,
          }}
        >
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12, fontWeight: '600' }}>＋ Agregar al horario</Text>
        </TouchableOpacity>
      )}

      {expandido && (
        <View style={{ marginTop: 6, gap: 8 }}>
          <SelectorFecha fecha={fecha} onCambiar={cambiarFecha} diasMarcados={diasMarcados} />
          {tieneFecha ? (
            <SelectorHorario
              inicio={inicio}
              fin={fin}
              onCambiar={cambiarHora}
              sugeridos={sugeridos}
              ocupados={ocupadosDe ? ocupadosDe(fecha!, excluirId) : []}
              permiteSinFin
            />
          ) : (
            <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center' }}>Elegí el día para poner la hora.</Text>
          )}
          {tieneFecha && (
            <TouchableOpacity onPress={limpiar} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar del horario</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Input de nota con estado local string (evita borrar el punto decimal) ──
interface NotaInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  style?: object;
  placeholder?: string;
  placeholderTextColor?: string;
}
function NotaInput({ value, onChange, style, placeholder, placeholderTextColor }: NotaInputProps) {
  const [str, setStr] = useState<string>(value !== null ? String(value) : '');

  React.useEffect(() => {
    const parsed = parseFloat(str);
    const externalChanged = value === null ? str !== '' : parsed !== value;
    if (externalChanged && !str.endsWith('.')) {
      setStr(value !== null ? String(value) : '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      style={style}
      value={str}
      keyboardType="decimal-pad"
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      onChangeText={v => {
        const cleaned = v.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        const normalized = parts.length > 2
          ? `${parts[0]}.${parts.slice(1).join('')}`
          : cleaned;
        setStr(normalized);
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          onChange(num);
        } else if (normalized === '' || normalized === '.') {
          onChange(null);
        }
      }}
    />
  );
}

// ── Componente principal ──
interface Props {
  evaluacion: Evaluacion;
  onChange: (ev: Evaluacion) => void;
  onEliminar: () => void;
  isColapsada: (id: string) => boolean;
  onToggleColapso: (id: string) => void;
  /** Punto 64: máximo para una prueba nueva si el grupo todavía no tiene ninguna en modo Número. */
  maximoSugerido?: number;
  /** Selector de hora D: horarios de la materia, ocupados del día y días con clase. */
  horariosSugeridos?: HorarioSugerido[];
  ocupadosDe?: (fecha: string, excluirId?: string) => { inicio: number; fin: number }[];
  diasConClase?: string[];
}

export function EvaluacionItem({ evaluacion, onChange, onEliminar, isColapsada, onToggleColapso, maximoSugerido, horariosSugeridos, ocupadosDe, diasConClase }: Props) {
  const tema = useTema();
  const { showAlert, showConfirm } = useAlert();
  const contribucion = calcularPorcentajeEvaluacion(evaluacion);

  // Punto 67: si tiene nota cargada, se confirma antes de borrar
  const pedirEliminar = () => {
    const c = confirmacionBorrarEvaluacion(evaluacion, evaluacion.tipo === 'grupo' ? 'este grupo' : 'esta evaluación');
    if (!c) { onEliminar(); return; }
    showConfirm(c.titulo, c.mensaje, onEliminar, { labelConfirmar: 'Borrar', destructivo: true });
  };
  // id (evaluación, grupo o sub-evaluación) cuyo nombre está en edición — null = ninguno
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const actualizarSimple = (campo: Partial<EvaluacionSimple>) => {
    onChange({ ...evaluacion, ...campo } as EvaluacionSimple);
  };

  const actualizarSub = (idx: number, campo: Partial<SubEvaluacion>) => {
    const grupo = evaluacion as GrupoEvaluacion;
    const subs = grupo.subEvaluaciones.map((s, i) => i === idx ? { ...s, ...campo } : s);
    onChange({ ...grupo, subEvaluaciones: subs });
  };

  // Al cambiar el tipo de nota, convierte el valor ya ingresado para que la
  // contribución no salte de golpe, y fija/libera el máximo (100 en porcentaje).
  const cambiarTipoNotaSimple = (nuevoTipo: TipoNota) => {
    const simple = evaluacion as EvaluacionSimple;
    if (nuevoTipo === simple.tipoNota) return;
    if (nuevoTipo === 'porcentaje') {
      const convertida = simple.nota !== null
        ? Math.round((simple.nota / simple.notaMaxima) * 10000) / 100
        : null;
      actualizarSimple({ tipoNota: 'porcentaje', nota: convertida, notaMaxima: 100 });
    } else {
      const nuevoMax = 10;
      const convertida = simple.nota !== null
        ? Math.round((simple.nota / 100) * nuevoMax * 100) / 100
        : null;
      actualizarSimple({ tipoNota: 'numero', nota: convertida, notaMaxima: nuevoMax });
    }
  };

  const cambiarTipoNotaSub = (idx: number, nuevoTipo: TipoNota) => {
    const grupo = evaluacion as GrupoEvaluacion;
    const sub = grupo.subEvaluaciones[idx];
    if (nuevoTipo === sub.tipoNota) return;
    if (nuevoTipo === 'porcentaje') {
      const convertida = sub.nota !== null
        ? Math.round((sub.nota / sub.notaMaxima) * 10000) / 100
        : null;
      actualizarSub(idx, { tipoNota: 'porcentaje', nota: convertida, notaMaxima: 100 });
    } else {
      const nuevoMax = 10;
      const convertida = sub.nota !== null
        ? Math.round((sub.nota / 100) * nuevoMax * 100) / 100
        : null;
      actualizarSub(idx, { tipoNota: 'numero', nota: convertida, notaMaxima: nuevoMax });
    }
  };

  const eliminarSub = (idx: number) => {
    const grupo = evaluacion as GrupoEvaluacion;
    const borrar = () => onChange({ ...grupo, subEvaluaciones: grupo.subEvaluaciones.filter((_, i) => i !== idx) });
    const c = confirmacionBorrarEvaluacion(grupo.subEvaluaciones[idx], `Prueba ${idx + 1}`);
    if (!c) { borrar(); return; }
    showConfirm(c.titulo, c.mensaje, borrar, { labelConfirmar: 'Borrar', destructivo: true });
  };

  const agregarSub = () => {
    const grupo = evaluacion as GrupoEvaluacion;
    if (grupo.subEvaluaciones.length >= 50) {
      showAlert('Límite alcanzado', 'Máximo 50 pruebas por grupo.');
      return;
    }
    // Punto 64: la prueba nueva trae el máximo de la anterior del grupo (o el último usado)
    const maxPrevio = ultimoMaximo([grupo], []);
    const tieneNumero = grupo.subEvaluaciones.some(s => s.tipoNota === 'numero');
    const nueva: SubEvaluacion = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, nombre: '', tipoNota: 'numero', nota: null,
      notaMaxima: tieneNumero ? maxPrevio : (maximoSugerido ?? maxPrevio),
    };
    onChange({ ...grupo, subEvaluaciones: [...grupo.subEvaluaciones, nueva] });
  };

  const estilos = StyleSheet.create({
    contenedor: { backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 8 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    input: { backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, fontSize: 14, flex: 1 },
    label: { color: tema.textoSecundario, fontSize: 12 },
    resultado: { color: tema.acentoTexto ?? tema.acento, fontSize: 12, marginTop: 4 },
  });

  if (evaluacion.tipo === 'simple') {
    const colapsada = isColapsada(evaluacion.id);
    return (
      <View style={estilos.contenedor}>
        {/* Header: tocar el nombre/peso extiende o contrae; el lápiz (solo visible extendida) edita el nombre */}
        <TouchableOpacity
          onPress={() => onToggleColapso(evaluacion.id)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: colapsada ? 0 : 6 }}
        >
          {editandoId === evaluacion.id ? (
            <TextInput
              autoFocus
              style={{ color: tema.texto, fontSize: 14, fontWeight: '600', flex: 1, padding: 0 }}
              placeholder="Sin nombre" placeholderTextColor={tema.textoSecundario}
              value={evaluacion.nombre} onChangeText={nombre => actualizarSimple({ nombre })} maxLength={20}
              onBlur={() => setEditandoId(null)} onSubmitEditing={() => setEditandoId(null)}
            />
          ) : (
            <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {evaluacion.nombre || 'Sin nombre'}
            </Text>
          )}
          {!colapsada && editandoId !== evaluacion.id && (
            <TouchableOpacity onPress={() => setEditandoId(evaluacion.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={{ fontSize: 13 }}>✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
            {contribucion !== null ? `${contribucion.toFixed(2)} / ${evaluacion.pesoEnMateria}` : `${evaluacion.pesoEnMateria}%`}
          </Text>
          <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>{colapsada ? '▼' : '▲'}</Text>
          <TouchableOpacity onPress={pedirEliminar} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={{ color: '#F44336' }}>🗑️</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {!colapsada && (<>
        {/* Fila: Peso% */}
        <View style={estilos.fila}>
          <Text style={estilos.label}>Peso%</Text>
          <NotaInput
            style={[estilos.input, { flex: 0, width: 70 }]}
            value={evaluacion.pesoEnMateria}
            onChange={v => {
              const n = v ?? 0;
              actualizarSimple({ pesoEnMateria: Math.round(Math.min(100, Math.max(0, n)) * 100) / 100 });
            }}
            placeholder="0"
            placeholderTextColor={tema.textoSecundario}
          />
        </View>
        {/* Fila: Tipo de nota */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          {(['numero', 'porcentaje'] as TipoNota[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => cambiarTipoNotaSimple(t)}
              style={{
                flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                backgroundColor: evaluacion.tipoNota === t ? (tema.acentoFondo ?? tema.acento) : tema.fondo,
              }}
            >
              <Text style={{ color: evaluacion.tipoNota === t ? '#fff' : tema.textoSecundario, fontSize: 12, fontWeight: '600' }}>
                {t === 'numero' ? '🔢 Número' : '% Porcentaje'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Fila: Nota / Máx */}
        <View style={estilos.fila}>
          <Text style={estilos.label}>Nota</Text>
          <NotaInput
            style={[estilos.input, { flex: 0, width: 70 }]}
            value={evaluacion.nota}
            onChange={nota => actualizarSimple({
              // Punto 65: una nota mayor que el máximo se ajusta sola (15/12 → 12/12)
              nota: ajustarNota(nota, evaluacion.tipoNota === 'porcentaje' ? 100 : evaluacion.notaMaxima),
            })}
            placeholder="—"
            placeholderTextColor={tema.textoSecundario}
          />
          {evaluacion.tipoNota === 'numero' ? (
            <>
              <Text style={estilos.label}>/ Máx</Text>
              <NotaInput
                style={[estilos.input, { flex: 0, width: 70 }]}
                value={evaluacion.notaMaxima}
                onChange={notaMaxima => {
                  const n = notaMaxima ?? 10;
                  actualizarSimple({ notaMaxima: Math.min(9999, Math.max(0.01, n)) });
                }}
              />
            </>
          ) : (
            <Text style={estilos.label}>%</Text>
          )}
        </View>
        <FechaHoraPicker
          fecha={evaluacion.fecha}
          hora={evaluacion.hora}
          horaFin={evaluacion.horaFin}
          onActualizar={actualizarSimple}
          sugeridos={horariosSugeridos}
          ocupadosDe={ocupadosDe}
          excluirId={evaluacion.id}
          diasMarcados={diasConClase}
        />
        <View style={{ marginTop: 6 }}>
          <Text style={estilos.label}>Salón (opcional)</Text>
          <TextInput
            style={[estilos.input, { marginTop: 4 }]}
            placeholder="Ej: Aula 3, Lab 201..."
            placeholderTextColor={tema.textoSecundario}
            value={evaluacion.salon ?? ''}
            onChangeText={salon => actualizarSimple({ salon: salon || undefined })}
          />
        </View>
        {contribucion !== null && <Text style={estilos.resultado}>→ Contribuye: {contribucion.toFixed(2)}% a la nota final</Text>}
        </>)}
      </View>
    );
  }

  // Grupo
  const grupo = evaluacion as GrupoEvaluacion;
  const grupoColapsado = isColapsada(grupo.id);
  const parcialGrupo = contribucionParcialEvaluacion(grupo);
  return (
    <View style={[estilos.contenedor, { borderLeftWidth: 3, borderLeftColor: tema.acentoLineas ?? tema.acento }]}>
      {/* Header: tocar el nombre/peso extiende o contrae; el lápiz (solo visible extendido) edita el nombre */}
      <TouchableOpacity
        onPress={() => onToggleColapso(grupo.id)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: grupoColapsado ? 0 : 6 }}
      >
        {editandoId === grupo.id ? (
          <TextInput
            autoFocus
            style={{ color: tema.texto, fontSize: 14, fontWeight: '600', flex: 1, padding: 0 }}
            placeholder="Nombre del grupo" placeholderTextColor={tema.textoSecundario}
            value={grupo.nombre} onChangeText={nombre => onChange({ ...grupo, nombre })} maxLength={20}
            onBlur={() => setEditandoId(null)} onSubmitEditing={() => setEditandoId(null)}
          />
        ) : (
          <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {grupo.nombre || 'Sin nombre'}
          </Text>
        )}
        {!grupoColapsado && editandoId !== grupo.id && (
          <TouchableOpacity onPress={() => setEditandoId(grupo.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={{ fontSize: 13 }}>✏️</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>
          {parcialGrupo !== null ? `${parcialGrupo.toFixed(2)} / ${fmtNum(grupo.pesoEnMateria)}` : `${fmtNum(grupo.pesoEnMateria)}%`}
        </Text>
        <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 12 }}>{grupoColapsado ? '▼' : '▲'}</Text>
        <TouchableOpacity onPress={pedirEliminar} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={{ color: '#F44336' }}>🗑️</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {!grupoColapsado && (<>
      <View style={estilos.fila}>
        <Text style={estilos.label}>Peso total del grupo en materia (%)</Text>
        <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
          value={String(grupo.pesoEnMateria)} onChangeText={v => { const n = Number(v); if (!isNaN(n)) onChange({ ...grupo, pesoEnMateria: Math.round(Math.min(100, Math.max(0, n)) * 100) / 100 }); }} />
      </View>
      {grupo.subEvaluaciones.map((sub, i) => {
        const subColapsada = isColapsada(sub.id);
        const pesoSub = pesoSubEvaluacion(grupo);
        const aporteSub = contribucionSubEvaluacion(grupo, sub);
        return (
          <View key={sub.id} style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginBottom: 4 }}>
            {/* Header: tocar el nombre extiende o contrae; el lápiz (solo visible extendida) edita el nombre */}
            <TouchableOpacity
              onPress={() => onToggleColapso(sub.id)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: subColapsada ? 0 : 6 }}
            >
              {editandoId === sub.id ? (
                <TextInput
                  autoFocus
                  style={{ color: tema.texto, fontSize: 13, fontWeight: '600', flex: 1, padding: 0 }}
                  placeholder={`Prueba ${i + 1}`} placeholderTextColor={tema.textoSecundario}
                  value={sub.nombre} onChangeText={nombre => actualizarSub(i, { nombre })} maxLength={20}
                  onBlur={() => setEditandoId(null)} onSubmitEditing={() => setEditandoId(null)}
                />
              ) : (
                <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {sub.nombre || `Prueba ${i + 1}`}
                </Text>
              )}
              {!subColapsada && editandoId !== sub.id && (
                <TouchableOpacity onPress={() => setEditandoId(sub.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={{ fontSize: 12 }}>✏️</Text>
                </TouchableOpacity>
              )}
              <Text style={{ color: tema.textoSecundario, fontSize: 11 }}>
                {aporteSub !== null ? `${aporteSub.toFixed(2)} / ${fmtNum(pesoSub)}` : `${fmtNum(pesoSub)}%`}
              </Text>
              <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 11 }}>{subColapsada ? '▼' : '▲'}</Text>
              <TouchableOpacity onPress={() => eliminarSub(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={{ color: '#F44336', fontSize: 13 }}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {!subColapsada && (<>
            {/* Fila: Tipo de nota */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              {(['numero', 'porcentaje'] as TipoNota[]).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => cambiarTipoNotaSub(i, t)}
                  style={{
                    flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center',
                    backgroundColor: sub.tipoNota === t ? (tema.acentoFondo ?? tema.acento) : tema.tarjeta,
                  }}
                >
                  <Text style={{ color: sub.tipoNota === t ? '#fff' : tema.textoSecundario, fontSize: 11, fontWeight: '600' }}>
                    {t === 'numero' ? '🔢 Número' : '% Porcentaje'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={estilos.fila}>
              <Text style={estilos.label}>Nota</Text>
              <NotaInput
                style={[estilos.input, { flex: 0, width: 70 }]}
                value={sub.nota}
                onChange={nota => actualizarSub(i, {
                  nota: ajustarNota(nota, sub.tipoNota === 'porcentaje' ? 100 : sub.notaMaxima),
                })}
                placeholder="—"
                placeholderTextColor={tema.textoSecundario}
              />
              {sub.tipoNota === 'numero' ? (
                <>
                  <Text style={estilos.label}>/ Máx</Text>
                  <NotaInput
                    style={[estilos.input, { flex: 0, width: 70 }]}
                    value={sub.notaMaxima}
                    onChange={notaMaxima => actualizarSub(i, { notaMaxima: notaMaxima ?? 10 })}
                  />
                </>
              ) : (
                <Text style={estilos.label}>%</Text>
              )}
            </View>
            <FechaHoraPicker
              fecha={sub.fecha}
              hora={sub.hora}
              horaFin={sub.horaFin}
              onActualizar={p => actualizarSub(i, p)}
              sugeridos={horariosSugeridos}
              ocupadosDe={ocupadosDe}
              excluirId={sub.id}
              diasMarcados={diasConClase}
            />
            <View style={{ marginTop: 6 }}>
              <Text style={estilos.label}>Salón (opcional)</Text>
              <TextInput
                style={[estilos.input, { marginTop: 4 }]}
                placeholder="Ej: Aula 3, Lab 201..."
                placeholderTextColor={tema.textoSecundario}
                value={sub.salon ?? ''}
                onChangeText={salon => actualizarSub(i, { salon: salon || undefined })}
              />
            </View>
            </>)}
          </View>
        );
      })}
      <TouchableOpacity onPress={agregarSub} style={{ padding: 6 }}>
        <Text style={{ color: tema.acentoTexto ?? tema.acento, fontSize: 13 }}>+ Añadir prueba al grupo</Text>
      </TouchableOpacity>
      {contribucion !== null && <Text style={estilos.resultado}>→ Contribuye: {contribucion.toFixed(2)}% a la nota final</Text>}
      </>)}
    </View>
  );
}