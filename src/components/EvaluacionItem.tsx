import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Evaluacion, EvaluacionSimple, GrupoEvaluacion, SubEvaluacion } from '../types';
import { useTema } from '../theme/ThemeContext';
import { calcularPorcentajeEvaluacion } from '../utils/calculos';

// ── Helpers de formato ────────────────────────────────────────────────────────
function autoFormatHora(next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function autoFormatFecha(next: string): string {
  const digits = next.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parsearFechaEval(str: string): string | undefined {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return isNaN(Date.parse(`${y}-${mo}-${d}T00:00:00`)) ? undefined : `${y}-${mo}-${d}`;
}

function parsearHoraEval(str: string): number | undefined {
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return undefined;
  return h * 60 + min;
}

function fmtHoraEval(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

function isoToDisplay(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}

// ── Subcomponente genérico: fecha y hora ──────────────────────────────────────
function FechaHoraPicker({
  fecha,
  hora,
  horaFin,
  onActualizar,
}: {
  fecha?: string;
  hora?: number;
  horaFin?: number;
  onActualizar: (p: { fecha?: string; hora?: number; horaFin?: number }) => void;
}) {
  const tema = useTema();

  const [expandido, setExpandido] = useState(!!fecha);
  const [fechaStr, setFechaStr] = useState(fecha ? isoToDisplay(fecha) : '');
  const [horaStr, setHoraStr] = useState(hora !== undefined ? fmtHoraEval(hora) : '');
  const [horaFinStr, setHoraFinStr] = useState(horaFin !== undefined ? fmtHoraEval(horaFin) : '');

  const guardar = () => {
    onActualizar({
      fecha: parsearFechaEval(fechaStr),
      hora: parsearHoraEval(horaStr),
      horaFin: parsearHoraEval(horaFinStr),
    });
  };

  const limpiar = () => {
    setFechaStr(''); setHoraStr(''); setHoraFinStr('');
    onActualizar({ fecha: undefined, hora: undefined, horaFin: undefined });
  };

  const inputStyle = {
    backgroundColor: tema.fondo, color: tema.texto,
    padding: 7, borderRadius: 6, fontSize: 13,
  };

  const label = fecha
    ? `📅 ${isoToDisplay(fecha)}${hora !== undefined ? `  ${fmtHoraEval(hora)}` : ''}`
    : '📅 Sin fecha en horario';

  return (
    <View style={{ marginTop: 6 }}>
      <TouchableOpacity
        onPress={() => setExpandido(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={{ color: tema.textoSecundario, fontSize: 12, flex: 1 }}>{label}</Text>
        <Text style={{ color: tema.acento, fontSize: 11 }}>{expandido ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandido && (
        <View style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginTop: 6 }}>
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Fecha (DD/MM/AAAA)</Text>
          <TextInput
            style={[inputStyle, { marginBottom: 8 }]}
            value={fechaStr}
            onChangeText={v => setFechaStr(autoFormatFecha(v))}
            onBlur={guardar}
            placeholder="15/04/2026"
            placeholderTextColor={tema.textoSecundario}
            keyboardType="numbers-and-punctuation"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Inicio (HH:MM)</Text>
              <TextInput
                style={inputStyle}
                value={horaStr}
                onChangeText={v => setHoraStr(autoFormatHora(v))}
                onBlur={guardar}
                placeholder="08:00"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 4 }}>Fin (HH:MM)</Text>
              <TextInput
                style={inputStyle}
                value={horaFinStr}
                onChangeText={v => setHoraFinStr(autoFormatHora(v))}
                onBlur={guardar}
                placeholder="10:00"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
          {(fecha || hora !== undefined) && (
            <TouchableOpacity onPress={limpiar} style={{ marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar del horario</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
interface Props {
  evaluacion: Evaluacion;
  onChange: (ev: Evaluacion) => void;
  onEliminar: () => void;
}

export function EvaluacionItem({ evaluacion, onChange, onEliminar }: Props) {
  const tema = useTema();
  const contribucion = calcularPorcentajeEvaluacion(evaluacion);

  const actualizarSimple = (campo: Partial<EvaluacionSimple>) => {
    onChange({ ...evaluacion, ...campo } as EvaluacionSimple);
  };

  const actualizarSub = (idx: number, campo: Partial<SubEvaluacion>) => {
    const grupo = evaluacion as GrupoEvaluacion;
    const subs = grupo.subEvaluaciones.map((s, i) => i === idx ? { ...s, ...campo } : s);
    onChange({ ...grupo, subEvaluaciones: subs });
  };

  const eliminarSub = (idx: number) => {
    const grupo = evaluacion as GrupoEvaluacion;
    onChange({ ...grupo, subEvaluaciones: grupo.subEvaluaciones.filter((_, i) => i !== idx) });
  };

  const agregarSub = () => {
    const grupo = evaluacion as GrupoEvaluacion;
    const nueva: SubEvaluacion = { id: Date.now().toString(), nombre: '', tipoNota: 'numero', nota: null, notaMaxima: 10 };
    onChange({ ...grupo, subEvaluaciones: [...grupo.subEvaluaciones, nueva] });
  };

  const estilos = StyleSheet.create({
    contenedor: { backgroundColor: tema.tarjeta, borderRadius: 10, padding: 12, marginBottom: 8 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    input: { backgroundColor: tema.fondo, color: tema.texto, padding: 8, borderRadius: 6, fontSize: 14, flex: 1 },
    label: { color: tema.textoSecundario, fontSize: 12 },
    resultado: { color: tema.acento, fontSize: 12, marginTop: 4 },
  });

  if (evaluacion.tipo === 'simple') {
    return (
      <View style={estilos.contenedor}>
        {/* Fila: Nombre + eliminar */}
        <View style={estilos.fila}>
          <TextInput style={estilos.input} placeholder="Nombre" placeholderTextColor={tema.textoSecundario}
            value={evaluacion.nombre} onChangeText={nombre => actualizarSimple({ nombre })} />
          <TouchableOpacity onPress={onEliminar}><Text style={{ color: '#F44336' }}>🗑️</Text></TouchableOpacity>
        </View>
        {/* Fila: Peso% */}
        <View style={estilos.fila}>
          <Text style={estilos.label}>Peso%</Text>
          <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
            value={String(evaluacion.pesoEnMateria)} onChangeText={v => actualizarSimple({ pesoEnMateria: Number(v) })} />
        </View>
        {/* Fila: Nota / Máx */}
        <View style={estilos.fila}>
          <Text style={estilos.label}>Nota</Text>
          <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
            value={evaluacion.nota !== null ? String(evaluacion.nota) : ''}
            onChangeText={v => actualizarSimple({ nota: v ? Number(v) : null })} />
          <Text style={estilos.label}>/ Máx</Text>
          <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
            value={String(evaluacion.notaMaxima)} onChangeText={v => actualizarSimple({ notaMaxima: Number(v) })} />
        </View>
        <TouchableOpacity onPress={() => actualizarSimple({ tipoNota: evaluacion.tipoNota === 'numero' ? 'porcentaje' : 'numero' })}>
          <Text style={estilos.label}>Tipo: {evaluacion.tipoNota === 'numero' ? '🔢 Número' : '% Porcentaje'} (tocar para cambiar)</Text>
        </TouchableOpacity>
        <FechaHoraPicker
          fecha={evaluacion.fecha}
          hora={evaluacion.hora}
          horaFin={evaluacion.horaFin}
          onActualizar={actualizarSimple}
        />
        {contribucion !== null && <Text style={estilos.resultado}>→ Contribuye: {contribucion.toFixed(2)}% a la nota final</Text>}
      </View>
    );
  }

  // Grupo
  const grupo = evaluacion as GrupoEvaluacion;
  return (
    <View style={[estilos.contenedor, { borderLeftWidth: 3, borderLeftColor: tema.acento }]}>
      <View style={estilos.fila}>
        <TextInput style={estilos.input} placeholder="Nombre del grupo" placeholderTextColor={tema.textoSecundario}
          value={grupo.nombre} onChangeText={nombre => onChange({ ...grupo, nombre })} />
        <TouchableOpacity onPress={onEliminar}><Text style={{ color: '#F44336' }}>🗑️</Text></TouchableOpacity>
      </View>
      <View style={estilos.fila}>
        <Text style={estilos.label}>Peso total del grupo en materia (%)</Text>
        <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
          value={String(grupo.pesoEnMateria)} onChangeText={v => onChange({ ...grupo, pesoEnMateria: Number(v) })} />
      </View>
      {grupo.subEvaluaciones.map((sub, i) => (
        <View key={sub.id} style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginBottom: 4 }}>
          <View style={estilos.fila}>
            <TextInput style={estilos.input} placeholder={`Prueba ${i + 1}`} placeholderTextColor={tema.textoSecundario}
              value={sub.nombre} onChangeText={nombre => actualizarSub(i, { nombre })} />
            <TouchableOpacity onPress={() => eliminarSub(i)}>
              <Text style={{ color: '#F44336', fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.label}>Nota</Text>
            <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
              value={sub.nota !== null ? String(sub.nota) : ''}
              onChangeText={v => actualizarSub(i, { nota: v ? Number(v) : null })} />
            <Text style={estilos.label}>/ Máx</Text>
            <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
              value={String(sub.notaMaxima)} onChangeText={v => actualizarSub(i, { notaMaxima: Number(v) })} />
            <TouchableOpacity onPress={() => actualizarSub(i, { tipoNota: sub.tipoNota === 'numero' ? 'porcentaje' : 'numero' })}>
              <Text style={{ color: tema.acento, fontSize: 11 }}>{sub.tipoNota === 'numero' ? '🔢' : '%'}</Text>
            </TouchableOpacity>
          </View>
          <FechaHoraPicker
            fecha={sub.fecha}
            hora={sub.hora}
            horaFin={sub.horaFin}
            onActualizar={p => actualizarSub(i, p)}
          />
        </View>
      ))}
      <TouchableOpacity onPress={agregarSub} style={{ padding: 6 }}>
        <Text style={{ color: tema.acento, fontSize: 13 }}>+ Añadir prueba al grupo</Text>
      </TouchableOpacity>
      {contribucion !== null && <Text style={estilos.resultado}>→ Contribuye: {contribucion.toFixed(2)}% a la nota final</Text>}
    </View>
  );
}
