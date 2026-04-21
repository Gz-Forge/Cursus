import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Evaluacion, EvaluacionSimple, GrupoEvaluacion, SubEvaluacion } from '../types';
import { useTema } from '../theme/ThemeContext';
import { calcularPorcentajeEvaluacion } from '../utils/calculos';

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
        <View style={estilos.fila}>
          <TextInput style={estilos.input} placeholder="Nombre" placeholderTextColor={tema.textoSecundario}
            value={evaluacion.nombre} onChangeText={nombre => actualizarSimple({ nombre })} />
          <TouchableOpacity onPress={onEliminar}><Text style={{ color: '#F44336' }}>🗑️</Text></TouchableOpacity>
        </View>
        <View style={estilos.fila}>
          <Text style={estilos.label}>Peso%</Text>
          <TextInput style={[estilos.input, { flex: 0, width: 60 }]} keyboardType="numeric"
            value={String(evaluacion.pesoEnMateria)} onChangeText={v => actualizarSimple({ pesoEnMateria: Number(v) })} />
          <Text style={estilos.label}>Nota</Text>
          <TextInput style={[estilos.input, { flex: 0, width: 60 }]} keyboardType="numeric"
            value={evaluacion.nota !== null ? String(evaluacion.nota) : ''}
            onChangeText={v => actualizarSimple({ nota: v ? Number(v) : null })} />
          <Text style={estilos.label}>/ Máx</Text>
          <TextInput style={[estilos.input, { flex: 0, width: 60 }]} keyboardType="numeric"
            value={String(evaluacion.notaMaxima)} onChangeText={v => actualizarSimple({ notaMaxima: Number(v) })} />
        </View>
        <TouchableOpacity onPress={() => actualizarSimple({ tipoNota: evaluacion.tipoNota === 'numero' ? 'porcentaje' : 'numero' })}>
          <Text style={estilos.label}>Tipo: {evaluacion.tipoNota === 'numero' ? '🔢 Número' : '% Porcentaje'} (tocar para cambiar)</Text>
        </TouchableOpacity>
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
        <TextInput style={[estilos.input, { flex: 0, width: 60 }]} keyboardType="numeric"
          value={String(grupo.pesoEnMateria)} onChangeText={v => onChange({ ...grupo, pesoEnMateria: Number(v) })} />
      </View>
      {grupo.subEvaluaciones.map((sub, i) => (
        <View key={sub.id} style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginBottom: 4 }}>
          <View style={estilos.fila}>
            <TextInput style={estilos.input} placeholder={`Prueba ${i + 1}`} placeholderTextColor={tema.textoSecundario}
              value={sub.nombre} onChangeText={nombre => actualizarSub(i, { nombre })} />
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.label}>Nota</Text>
            <TextInput style={[estilos.input, { flex: 0, width: 60 }]} keyboardType="numeric"
              value={sub.nota !== null ? String(sub.nota) : ''}
              onChangeText={v => actualizarSub(i, { nota: v ? Number(v) : null })} />
            <Text style={estilos.label}>/ Máx</Text>
            <TextInput style={[estilos.input, { flex: 0, width: 60 }]} keyboardType="numeric"
              value={String(sub.notaMaxima)} onChangeText={v => actualizarSub(i, { notaMaxima: Number(v) })} />
            <TouchableOpacity onPress={() => actualizarSub(i, { tipoNota: sub.tipoNota === 'numero' ? 'porcentaje' : 'numero' })}>
              <Text style={{ color: tema.acento, fontSize: 11 }}>{sub.tipoNota === 'numero' ? '🔢' : '%'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={agregarSub} style={{ padding: 6 }}>
        <Text style={{ color: tema.acento, fontSize: 13 }}>+ Añadir prueba al grupo</Text>
      </TouchableOpacity>
      {contribucion !== null && <Text style={estilos.resultado}>→ Contribuye: {contribucion.toFixed(2)}% a la nota final</Text>}
    </View>
  );
}
