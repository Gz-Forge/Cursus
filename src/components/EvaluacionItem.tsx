import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Evaluacion, EvaluacionSimple, GrupoEvaluacion, SubEvaluacion } from '../types';
import { useTema } from '../theme/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { calcularPorcentajeEvaluacion } from '../utils/calculos';
import { parsearMes } from '../utils/fecha';

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

// ── HoraPicker: botones ▲/▼ para hora, botones :00/:30 para minutos ───────────
function HoraPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const tema = useTema();
  const h = Math.floor(value / 60);
  const m = value % 60 === 30 ? 30 : 0;
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <View style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 10, alignItems: 'center' }}>
        <TouchableOpacity onPress={() => onChange(((h + 1) % 24) * 60 + m)} style={{ paddingVertical: 2 }}>
          <Text style={{ color: tema.acento, fontSize: 18, textAlign: 'center' }}>▲</Text>
        </TouchableOpacity>
        <Text style={{ color: tema.texto, fontSize: 26, fontWeight: '700', letterSpacing: 1, minWidth: 64, textAlign: 'center' }}>
          {h.toString().padStart(2, '0')}:{m === 0 ? '00' : '30'}
        </Text>
        <TouchableOpacity onPress={() => onChange(((h - 1 + 24) % 24) * 60 + m)} style={{ paddingVertical: 2 }}>
          <Text style={{ color: tema.acento, fontSize: 18, textAlign: 'center' }}>▼</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {([0, 30] as const).map(min => (
            <TouchableOpacity
              key={min}
              onPress={() => onChange(h * 60 + min)}
              style={{ flex: 1, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6,
                backgroundColor: m === min ? tema.acento : tema.tarjeta, alignItems: 'center' }}
            >
              <Text style={{ color: m === min ? '#fff' : tema.textoSecundario, fontWeight: '600', fontSize: 13 }}>
                :{min === 0 ? '00' : '30'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
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

  // Inicializar día/mes desde ISO YYYY-MM-DD
  const parsarFechaInicial = (iso?: string): { dia: string; mes: string } => {
    if (!iso) return { dia: '', mes: '' };
    const parts = iso.split('-');
    if (parts.length !== 3) return { dia: '', mes: '' };
    const [, mo, d] = parts;
    const dia = parseInt(d, 10);
    const mes = parseInt(mo, 10);
    if (isNaN(dia) || isNaN(mes)) return { dia: '', mes: '' };
    return { dia: String(dia), mes: String(mes) };
  };

  const inicial = parsarFechaInicial(fecha);

  const [expandido, setExpandido] = useState(false);
  const [diaStr, setDiaStr] = useState(inicial.dia);
  const [mesStr, setMesStr] = useState(inicial.mes);
  const [dropdownDia, setDropdownDia] = useState(false);
  const [dropdownMes, setDropdownMes] = useState(false);
  const [mostrarHora, setMostrarHora] = useState(hora !== undefined);
  const [horaInicio, setHoraInicio] = useState<number>(hora !== undefined ? hora : 480);
  const [horaFinVal, setHoraFinVal] = useState<number>(horaFin !== undefined ? horaFin : 600);
  // Refs para acceder al valor actual sin depender del closure del render
  const diaRef = useRef(inicial.dia);
  const mesRef = useRef(inicial.mes);
  const horaInicioRef = useRef(hora !== undefined ? hora : 480);
  const horaFinRef = useRef(horaFin !== undefined ? horaFin : 600);

  const setDia = (v: string) => { diaRef.current = v; setDiaStr(v); };
  const setMes = (v: string) => { mesRef.current = v; setMesStr(v); };

  const construirFechaISO = (): string | undefined => {
    const dia = parseInt(diaRef.current, 10);
    const mes = parsearMes(mesRef.current) ?? 0;
    if (isNaN(dia) || dia < 1 || dia > 31 || mes < 1 || mes > 12) return undefined;
    const anio = new Date().getFullYear();
    const d = new Date(anio, mes - 1, dia);
    if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return undefined;
    return `${anio}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
  };

  const guardar = () => {
    onActualizar({
      fecha: construirFechaISO(),
      ...(mostrarHora ? { hora: horaInicioRef.current, horaFin: horaFinRef.current } : {}),
    });
  };

  const limpiar = () => {
    setDia(''); setMes('');
    onActualizar({ fecha: undefined, hora: undefined, horaFin: undefined });
  };

  const fechaISO = construirFechaISO();
  const labelFecha = fechaISO
    ? `📅 ${isoToDisplay(fechaISO)}${hora !== undefined ? `  ${fmtHoraEval(hora)}` : ''}`
    : '📅 Sin fecha en horario';

  return (
    <View style={{ marginTop: 6 }}>
      <TouchableOpacity
        onPress={() => setExpandido(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Text style={{ color: tema.textoSecundario, fontSize: 12, flex: 1 }}>{labelFecha}</Text>
        <Text style={{ color: tema.acento, fontSize: 11 }}>{expandido ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expandido && (
        <View style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginTop: 6 }}>

          {/* ── Fecha: día + mes ── */}
          <Text style={{ color: tema.textoSecundario, fontSize: 12, marginBottom: 6 }}>Fecha</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>

            {/* Día */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 3 }}>Día</Text>
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6, textAlign: 'center' }}
                value={diaStr}
                onChangeText={v => { setDia(v.replace(/\D/g, '').slice(0, 2)); setDropdownMes(false); }}
                onFocus={() => { setDropdownDia(true); setDropdownMes(false); }}
                onBlur={guardar}
                onSubmitEditing={guardar}
                placeholder="DD"
                placeholderTextColor={tema.textoSecundario}
                keyboardType="number-pad"
                maxLength={2}
              />
              {dropdownDia && (
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 6, marginTop: 2, maxHeight: 150, borderWidth: 1, borderColor: tema.borde }}>
                  <ScrollView nestedScrollEnabled>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => { setDia(String(d)); setDropdownDia(false); guardar(); }}
                        style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: tema.borde }}
                      >
                        <Text style={{ color: tema.texto, textAlign: 'center' }}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Mes */}
            <View style={{ flex: 2 }}>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginBottom: 3 }}>Mes</Text>
              <TextInput
                style={{ backgroundColor: tema.tarjeta, color: tema.texto, padding: 8, borderRadius: 6 }}
                value={mesStr}
                onChangeText={v => { setMes(v); setDropdownDia(false); }}
                onFocus={() => { setDropdownMes(true); setDropdownDia(false); }}
                onBlur={() => {
                  const n = parsearMes(mesRef.current);
                  if (n !== null) setMes(String(n));
                  setDropdownMes(false);
                  guardar();
                }}
                onSubmitEditing={() => {
                  const n = parsearMes(mesRef.current);
                  if (n !== null) setMes(String(n));
                  guardar();
                }}
                placeholder="MM o mes"
                placeholderTextColor={tema.textoSecundario}
                maxLength={20}
              />
              {mesStr && !isNaN(parseInt(mesStr, 10)) && parseInt(mesStr, 10) >= 1 && parseInt(mesStr, 10) <= 12 && (
                <Text style={{ color: tema.acento, fontSize: 10, marginTop: 2 }}>
                  {MESES[parseInt(mesStr, 10) - 1]}
                </Text>
              )}
              {dropdownMes && (
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 6, marginTop: 2, maxHeight: 180, borderWidth: 1, borderColor: tema.borde }}>
                  <ScrollView nestedScrollEnabled>
                    {MESES.map((nombre, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => { setMes(String(i + 1)); setDropdownMes(false); guardar(); }}
                        style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: tema.borde }}
                      >
                        <Text style={{ color: tema.texto }}>{i + 1} — {nombre}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <Text style={{ color: tema.textoSecundario, fontSize: 10, marginBottom: 10, textAlign: 'right' }}>
            Año: {new Date().getFullYear()}
          </Text>

          {/* ── Hora ── */}
          <TouchableOpacity
            onPress={() => {
              const nuevo = !mostrarHora;
              setMostrarHora(nuevo);
              if (!nuevo) onActualizar({ fecha: construirFechaISO(), hora: undefined, horaFin: undefined });
              else onActualizar({ fecha: construirFechaISO(), hora: horaInicioRef.current, horaFin: horaFinRef.current });
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
          >
            <View style={{
              width: 16, height: 16, borderRadius: 3, borderWidth: 1.5,
              borderColor: mostrarHora ? tema.acento : tema.textoSecundario,
              backgroundColor: mostrarHora ? tema.acento : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {mostrarHora && <Text style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>✓</Text>}
            </View>
            <Text style={{ color: tema.textoSecundario, fontSize: 12 }}>Incluir hora en horario</Text>
          </TouchableOpacity>
          {mostrarHora && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <HoraPicker
                label="Hora inicio"
                value={horaInicio}
                onChange={v => { horaInicioRef.current = v; setHoraInicio(v); onActualizar({ fecha: construirFechaISO(), hora: v, horaFin: horaFinRef.current }); }}
              />
              <HoraPicker
                label="Fin"
                value={horaFinVal}
                onChange={v => { horaFinRef.current = v; setHoraFinVal(v); onActualizar({ fecha: construirFechaISO(), hora: horaInicioRef.current, horaFin: v }); }}
              />
            </View>
          )}

          {(fecha || hora !== undefined) && (
            <TouchableOpacity onPress={limpiar} style={{ marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#F44336', fontSize: 12 }}>Quitar del horario</Text>
            </TouchableOpacity>
          )}

          {/* Botón guardar fecha */}
          <TouchableOpacity
            onPress={guardar}
            style={{ marginTop: 10, backgroundColor: tema.acento, borderRadius: 6, padding: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Guardar fecha</Text>
          </TouchableOpacity>
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

// ── Componente principal ──────────────────────────────────────────────────────
interface Props {
  evaluacion: Evaluacion;
  onChange: (ev: Evaluacion) => void;
  onEliminar: () => void;
}

export function EvaluacionItem({ evaluacion, onChange, onEliminar }: Props) {
  const tema = useTema();
  const { showAlert } = useAlert();
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
    if (grupo.subEvaluaciones.length >= 50) {
      showAlert('Límite alcanzado', 'Máximo 50 pruebas por grupo.');
      return;
    }
    const nueva: SubEvaluacion = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, nombre: '', tipoNota: 'numero', nota: null, notaMaxima: 10 };
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
            value={evaluacion.nombre} onChangeText={nombre => actualizarSimple({ nombre })} maxLength={20} />
          <TouchableOpacity onPress={onEliminar}><Text style={{ color: '#F44336' }}>🗑️</Text></TouchableOpacity>
        </View>
        <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
          {evaluacion.nombre.length}/20
        </Text>
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
        {/* Fila: Nota / Máx */}
        <View style={estilos.fila}>
          <Text style={estilos.label}>Nota</Text>
          <NotaInput
            style={[estilos.input, { flex: 0, width: 70 }]}
            value={evaluacion.nota}
            onChange={nota => actualizarSimple({ nota })}
            placeholder="—"
            placeholderTextColor={tema.textoSecundario}
          />
          <Text style={estilos.label}>/ Máx</Text>
          <NotaInput
            style={[estilos.input, { flex: 0, width: 70 }]}
            value={evaluacion.notaMaxima}
            onChange={notaMaxima => {
              const n = notaMaxima ?? 10;
              actualizarSimple({ notaMaxima: Math.min(9999, Math.max(0.01, n)) });
            }}
          />
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
      </View>
    );
  }

  // Grupo
  const grupo = evaluacion as GrupoEvaluacion;
  return (
    <View style={[estilos.contenedor, { borderLeftWidth: 3, borderLeftColor: tema.acento }]}>
      <View style={estilos.fila}>
        <TextInput style={estilos.input} placeholder="Nombre del grupo" placeholderTextColor={tema.textoSecundario}
          value={grupo.nombre} onChangeText={nombre => onChange({ ...grupo, nombre })} maxLength={20} />
        <TouchableOpacity onPress={onEliminar}><Text style={{ color: '#F44336' }}>🗑️</Text></TouchableOpacity>
      </View>
      <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
        {grupo.nombre.length}/20
      </Text>
      <View style={estilos.fila}>
        <Text style={estilos.label}>Peso total del grupo en materia (%)</Text>
        <TextInput style={[estilos.input, { flex: 0, width: 70 }]} keyboardType="numeric"
          value={String(grupo.pesoEnMateria)} onChangeText={v => { const n = Number(v); if (!isNaN(n)) onChange({ ...grupo, pesoEnMateria: Math.round(Math.min(100, Math.max(0, n)) * 100) / 100 }); }} />
      </View>
      {grupo.subEvaluaciones.map((sub, i) => (
        <View key={sub.id} style={{ backgroundColor: tema.fondo, borderRadius: 8, padding: 8, marginBottom: 4 }}>
          <View style={estilos.fila}>
            <TextInput style={estilos.input} placeholder={`Prueba ${i + 1}`} placeholderTextColor={tema.textoSecundario}
              value={sub.nombre} onChangeText={nombre => actualizarSub(i, { nombre })} maxLength={20} />
            <TouchableOpacity onPress={() => eliminarSub(i)}>
              <Text style={{ color: '#F44336', fontSize: 13 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'right', marginTop: 2 }}>
            {sub.nombre.length}/20
          </Text>
          <View style={estilos.fila}>
            <Text style={estilos.label}>Nota</Text>
            <NotaInput
              style={[estilos.input, { flex: 0, width: 70 }]}
              value={sub.nota}
              onChange={nota => actualizarSub(i, { nota })}
              placeholder="—"
              placeholderTextColor={tema.textoSecundario}
            />
            <Text style={estilos.label}>/ Máx</Text>
            <NotaInput
              style={[estilos.input, { flex: 0, width: 70 }]}
              value={sub.notaMaxima}
              onChange={notaMaxima => actualizarSub(i, { notaMaxima: notaMaxima ?? 10 })}
            />
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
        </View>
      ))}
      <TouchableOpacity onPress={agregarSub} style={{ padding: 6 }}>
        <Text style={{ color: tema.acento, fontSize: 13 }}>+ Añadir prueba al grupo</Text>
      </TouchableOpacity>
      {contribucion !== null && <Text style={estilos.resultado}>→ Contribuye: {contribucion.toFixed(2)}% a la nota final</Text>}
    </View>
  );
}
