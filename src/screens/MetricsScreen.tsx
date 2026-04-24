import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Platform, ImageBackground } from 'react-native';
import { useFondoPantalla } from '../utils/useFondoPantalla';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { estadoColores } from '../theme/colors';
import { obtenerNotaFinal, creditosAcumulados, calcularEstadoFinal } from '../utils/calculos';
import { EstadoMateria } from '../types';

const PALETA_TIPOS = ['#7C4DFF','#00BCD4','#4CAF50','#FF9800','#F44336','#FFD700','#2196F3','#E91E63','#009688','#FF5722'];

const ESTADO_LABELS: Record<EstadoMateria, string> = {
  aprobado: '✅ Aprobadas', exonerado: '⭐ Exoneradas',
  cursando: '🔵 Cursando', por_cursar: '⬜ Por cursar',
  reprobado: '🟠 Reprobadas', recursar: '🔴 Recursar',
};

const ORDEN_ESTADOS: EstadoMateria[] = ['exonerado', 'aprobado', 'cursando', 'reprobado', 'recursar', 'por_cursar'];

type Panel = 'general' | 'graficos';

function yAxis(maxVal: number): { maxValue: number; noOfSections: number } {
  const n = Math.max(1, maxVal);
  const sections = Math.min(n, 5);
  return { maxValue: Math.ceil(n / sections) * sections, noOfSections: sections };
}

export function MetricsScreen() {
  const { materias, config } = useStore();
  const tema = useTema();
  const { width } = useWindowDimensions();
  const [semestreTorta, setSemestreTorta] = useState<number | null>(null);
  const [panelActivo, setPanelActivo] = useState<Panel>('general');

  const isWeb = Platform.OS === 'web';
  const fondoPantalla = useFondoPantalla('metricas');

  // ── Base ─────────────────────────────────────────────────────────────────
  const semestres = [...new Set(materias.map(m => m.semestre))].sort((a, b) => a - b);
  const conteo: Record<EstadoMateria, number> = { aprobado: 0, exonerado: 0, cursando: 0, por_cursar: 0, reprobado: 0, recursar: 0 };
  materias.forEach(m => conteo[calcularEstadoFinal(m, config)]++);
  const total = materias.length || 1;
  const creditos = creditosAcumulados(materias, config);
  const creditosTotal = materias.reduce((a, m) => a + m.creditosQueDA, 0);

  // ── Promedio ponderado por créditos ───────────────────────────────────────
  const materiasConNota = materias.filter(m => obtenerNotaFinal(m) !== null);
  const creditosSumados = materiasConNota.reduce((a, m) => a + m.creditosQueDA, 0);
  const promedioGeneral: number | null = (() => {
    if (materiasConNota.length === 0) return null;
    if (creditosSumados === 0)
      return materiasConNota.reduce((a, m) => a + obtenerNotaFinal(m)!, 0) / materiasConNota.length;
    return materiasConNota.reduce((a, m) => a + obtenerNotaFinal(m)! * m.creditosQueDA, 0) / creditosSumados;
  })();
  const promedioEnEscala = promedioGeneral !== null
    ? parseFloat(((promedioGeneral / 100) * config.notaMaxima).toFixed(2))
    : null;

  // ── Avance por año ────────────────────────────────────────────────────────
  const años = [...new Set(materias.map(m => Math.ceil(m.semestre / 2)))].sort((a, b) => a - b);
  const avancesPorAño = años.map(año => {
    const mats = materias.filter(m => Math.ceil(m.semestre / 2) === año);
    const crTotal = mats.reduce((a, m) => a + m.creditosQueDA, 0);
    const crObt = mats.reduce((a, m) => {
      const e = calcularEstadoFinal(m, config);
      return (e === 'aprobado' || e === 'exonerado') ? a + m.creditosQueDA : a;
    }, 0);
    const pct = crTotal > 0 ? Math.round((crObt / crTotal) * 100) : 0;
    const conteoMats: Record<EstadoMateria, number> = { aprobado: 0, exonerado: 0, cursando: 0, por_cursar: 0, reprobado: 0, recursar: 0 };
    mats.forEach(m => conteoMats[calcularEstadoFinal(m, config)]++);
    return { año, mats, crTotal, crObt, pct, conteo: conteoMats };
  });

  // ── Ancho de gráficos ─────────────────────────────────────────────────────
  // En web: sidebar 200px + padding scroll 32 + padding tarjeta 28 + margen 20 → cada columna ≈ (width-200)/2 - 60
  // En móvil: padding scrollview 32 + padding tarjeta 28 + margen eje Y 20 = 80
  const chartWidth = isWeb ? Math.max(200, (width - 200) / 2 - 60) : width - 80;

  // ── Gráfico 1: Promedio por semestre (línea) ─────────────────────────────
  const datosLinea = semestres.map(sem => {
    const mats = materias.filter(m => m.semestre === sem && obtenerNotaFinal(m) !== null);
    if (mats.length === 0) return null;
    const avg = mats.reduce((a, m) => a + obtenerNotaFinal(m)!, 0) / mats.length;
    return { value: parseFloat(((avg / 100) * config.notaMaxima).toFixed(2)), label: `${sem}°` };
  }).filter(Boolean) as { value: number; label: string }[];
  const { maxValue: lineMax, noOfSections: lineSections } = yAxis(config.notaMaxima);

  // ── Gráfico 2: Distribución por rango ────────────────────────────────────
  const conteoRangos = { recursar: 0, reprobado: 0, aprobado: 0, exonerado: 0 };
  materiasConNota.forEach(m => {
    const n = obtenerNotaFinal(m)!;
    if (n >= config.umbralExoneracion)      conteoRangos.exonerado++;
    else if (n >= config.umbralAprobacion)  conteoRangos.aprobado++;
    else if (n >= config.umbralPorExamen)   conteoRangos.reprobado++;
    else                                    conteoRangos.recursar++;
  });
  const barrasRangos = [
    { value: conteoRangos.recursar,  label: 'Recursar',  frontColor: estadoColores.recursar },
    { value: conteoRangos.reprobado, label: 'Reprobado', frontColor: estadoColores.reprobado },
    { value: conteoRangos.aprobado,  label: 'Aprobado',  frontColor: estadoColores.aprobado },
    { value: conteoRangos.exonerado, label: 'Exonerado', frontColor: estadoColores.exonerado },
  ].filter(b => b.value > 0);
  const maxRangos = barrasRangos.length > 0 ? Math.max(...barrasRangos.map(b => b.value)) : 1;
  const { maxValue: rangosMax, noOfSections: rangosSections } = yAxis(maxRangos);
  const barWidthRangos = Math.min(56, Math.max(20, (chartWidth - 40) / Math.max(barrasRangos.length, 1) - 10));

  // ── Gráfico 3: Notas obtenidas (barras) ───────────────────────────────────
  const notasMap: Record<number, number> = {};
  materias.forEach(m => {
    const n = obtenerNotaFinal(m);
    if (n !== null) {
      const k = Math.round((n / 100) * config.notaMaxima);
      notasMap[k] = (notasMap[k] ?? 0) + 1;
    }
  });
  const barrasNotas = Array.from({ length: config.notaMaxima + 1 }, (_, i) => ({
    value: notasMap[i] ?? 0, label: String(i), frontColor: tema.acento,
  })).filter(b => b.value > 0);
  const maxNotas = barrasNotas.length > 0 ? Math.max(...barrasNotas.map(b => b.value)) : 1;
  const { maxValue: notasMax, noOfSections: notasSections } = yAxis(maxNotas);
  const barWidthNotas = Math.min(36, Math.max(12, (chartWidth - 30) / Math.max(barrasNotas.length, 1) - 6));

  // ── Gráfico 4: Tipos de formación (torta) ────────────────────────────────
  const materiasTorta = semestreTorta === null ? materias : materias.filter(m => m.semestre === semestreTorta);
  const conteoTipos: Record<string, number> = {};
  materiasTorta.forEach(m => { const t = m.tipoFormacion ?? 'Sin tipo'; conteoTipos[t] = (conteoTipos[t] ?? 0) + 1; });
  const datosTorta = Object.entries(conteoTipos).map(([tipo, cantidad], i) => ({
    value: cantidad, color: PALETA_TIPOS[i % PALETA_TIPOS.length], label: tipo,
  }));

  // ── Helper UI ─────────────────────────────────────────────────────────────
  const seccion = (titulo: string) => (
    <Text style={{ color: tema.acento, fontWeight: '600', fontSize: 14, marginBottom: 10, marginTop: 16 }}>
      {titulo}
    </Text>
  );

  const ejeY = (label: string) => (
    <View style={{ width: 18, alignItems: 'center', justifyContent: 'center', marginRight: 2 }}>
      <Text style={{ color: tema.textoSecundario, fontSize: 9, transform: [{ rotate: '-90deg' }], width: 60, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );

  const ejeX = (label: string) => (
    <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
      {label}
    </Text>
  );

  const sinDatos = (msg = 'Sin datos suficientes') => (
    <Text style={{ color: tema.textoSecundario, textAlign: 'center', paddingVertical: 12 }}>{msg}</Text>
  );

  // ── Estilo de columna web ─────────────────────────────────────────────────
  const col = isWeb
    ? { width: '50%' as const, paddingHorizontal: 6 }
    : { width: '100%' as const };

  const fondoStyle = fondoPantalla?.tipo === 'color' ? { backgroundColor: fondoPantalla.valor } : {};
  const innerContent = (
    <View style={{ flex: 1, backgroundColor: fondoPantalla ? 'transparent' : tema.fondo }}>

      {/* ── Pestañas ── */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.superficie,
        borderBottomWidth: 1, borderBottomColor: tema.borde }}>
        {(['general', 'graficos'] as Panel[]).map(p => (
          <TouchableOpacity key={p} onPress={() => setPanelActivo(p)}
            style={{ flex: 1, padding: 12, alignItems: 'center',
              borderBottomWidth: 2, borderBottomColor: panelActivo === p ? tema.acento : 'transparent' }}>
            <Text style={{ color: panelActivo === p ? tema.acento : tema.textoSecundario, fontWeight: '600' }}>
              {p === 'general' ? 'General' : 'Gráficos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* ══════════ PANEL GENERAL ══════════ */}
        {panelActivo === 'general' && (
          <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 } : {}}>

            {/* Progreso General */}
            <View style={col}>
              {seccion('PROGRESO GENERAL')}
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Créditos obtenidos</Text>
                  <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>
                    {creditos} / {creditosTotal}
                    {creditosTotal > 0 && (
                      <Text style={{ color: tema.textoSecundario }}> ({Math.round((creditos / creditosTotal) * 100)}%)</Text>
                    )}
                  </Text>
                </View>
                {creditosTotal > 0 && (
                  <View style={{ height: 6, backgroundColor: tema.borde, borderRadius: 3, marginBottom: 10 }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: tema.acento,
                      width: `${Math.round((creditos / creditosTotal) * 100)}%` as any }} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Créditos restantes</Text>
                  <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>{creditosTotal - creditos}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Exoneradas</Text>
                  <Text style={{ color: tema.texto, fontSize: 13, fontWeight: '600' }}>{conteo.exonerado} / {materias.length}</Text>
                </View>
                {promedioEnEscala !== null && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>Promedio ponderado</Text>
                    <Text style={{ color: tema.acento, fontSize: 13, fontWeight: '700' }}>
                      {promedioEnEscala} / {config.notaMaxima}
                    </Text>
                  </View>
                )}
                <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 17, marginTop: 8 }}>
                  {materias.length ? Math.round((conteo.exonerado / materias.length) * 100) : 0}% completado
                </Text>
              </View>
            </View>

            {/* Avance por Año */}
            <View style={col}>
              {seccion('AVANCE POR AÑO')}
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                {avancesPorAño.length === 0 && sinDatos('Sin materias cargadas aún')}
                {avancesPorAño.map(({ año, crTotal, crObt, pct, conteo: c }) => (
                  <View key={año} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: tema.texto, fontWeight: '600' }}>Año {año}</Text>
                      <Text style={{ color: pct === 100 ? '#4CAF50' : tema.acento, fontWeight: '700' }}>
                        {pct}%  <Text style={{ color: tema.textoSecundario, fontWeight: '400', fontSize: 12 }}>
                          ({crObt}/{crTotal} cr)
                        </Text>
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: tema.borde }}>
                      {ORDEN_ESTADOS.map(e =>
                        c[e] > 0 ? (
                          <View key={e} style={{ flex: c[e], backgroundColor: estadoColores[e] }} />
                        ) : null
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Materias por Estado */}
            <View style={col}>
              {seccion('MATERIAS POR ESTADO')}
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                <View style={{ flexDirection: 'row', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                  {ORDEN_ESTADOS.map(e =>
                    conteo[e] > 0 ? (
                      <View key={e} style={{ flex: conteo[e], backgroundColor: estadoColores[e] }} />
                    ) : null
                  )}
                </View>
                {ORDEN_ESTADOS.map(e => (
                  <View key={e} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: tema.texto, fontSize: 13 }}>{ESTADO_LABELS[e]}</Text>
                    <Text style={{ color: estadoColores[e], fontWeight: '700', fontSize: 13 }}>
                      {conteo[e]}  ({Math.round((conteo[e] / total) * 100)}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Créditos por Semestre */}
            <View style={col}>
              {seccion('CRÉDITOS POR SEMESTRE')}
              <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                {semestres.length === 0 && sinDatos('Sin materias cargadas aún')}
                {semestres.map(sem => {
                  const mats = materias.filter(m => m.semestre === sem);
                  const crObt = mats.reduce((a, m) => {
                    const e = calcularEstadoFinal(m, config);
                    return (e === 'aprobado' || e === 'exonerado') ? a + m.creditosQueDA : a;
                  }, 0);
                  const crTotal = mats.reduce((a, m) => a + m.creditosQueDA, 0);
                  const icono = crObt === crTotal && crTotal > 0 ? '✅' : crObt > 0 ? '🔵' : '⬜';
                  return (
                    <View key={sem} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: tema.texto }}>{sem}° Semestre</Text>
                      <Text style={{ color: tema.textoSecundario }}>{crObt} / {crTotal} {icono}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

          </View>
        )}

        {/* ══════════ PANEL GRÁFICOS ══════════ */}
        {panelActivo === 'graficos' && (
          <>
            <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 } : {}}>

              {/* 1. Promedio por semestre */}
              <View style={col}>
                {seccion('PROMEDIO POR SEMESTRE')}
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                  {datosLinea.length >= 1 ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {ejeY(`Nota (/${config.notaMaxima})`)}
                        <LineChart
                          data={datosLinea}
                          width={chartWidth}
                          height={150}
                          maxValue={lineMax}
                          noOfSections={lineSections}
                          color={tema.acento}
                          dataPointsColor={tema.acento}
                          dataPointsRadius={5}
                          thickness={2.5}
                          curved
                          hideRules
                          yAxisTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                          xAxisLabelTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                          startFillColor={tema.acento}
                          startOpacity={0.15}
                          endOpacity={0}
                          areaChart
                        />
                      </View>
                      {ejeX('Semestre')}
                    </>
                  ) : sinDatos('Necesitás al menos un semestre con notas')}
                </View>
              </View>

              {/* 2. Distribución por rango */}
              <View style={col}>
                {seccion('DISTRIBUCIÓN POR RANGO DE NOTA')}
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                  {barrasRangos.length > 0 ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {ejeY('Materias')}
                        <BarChart
                          data={barrasRangos}
                          barWidth={barWidthRangos}
                          height={150}
                          width={chartWidth}
                          maxValue={rangosMax}
                          noOfSections={rangosSections}
                          yAxisTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                          xAxisLabelTextStyle={{ color: tema.textoSecundario, fontSize: 10 }}
                          hideRules
                          barBorderRadius={4}
                        />
                      </View>
                      {ejeX('Rango de nota')}
                      <View style={{ marginTop: 8, gap: 2 }}>
                        <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>
                          Recursar {'<'} {((config.umbralPorExamen / 100) * config.notaMaxima).toFixed(1)}  ·
                          Reprobado {'<'} {((config.umbralAprobacion / 100) * config.notaMaxima).toFixed(1)}  ·
                          {config.usarEstadoAprobado
                            ? ` Aprobado < ${((config.umbralExoneracion / 100) * config.notaMaxima).toFixed(1)}  ·`
                            : ''}
                          {' '}Exonerado ≥ {((config.umbralExoneracion / 100) * config.notaMaxima).toFixed(1)}
                        </Text>
                      </View>
                    </>
                  ) : sinDatos('Sin notas registradas aún')}
                </View>
              </View>

              {/* 3. Mapa de carrera */}
              <View style={col}>
                {seccion('MAPA DE LA CARRERA')}
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                  {semestres.length === 0 ? sinDatos() : (
                    <>
                      {semestres.map(sem => (
                        <View key={sem} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                          <Text style={{ color: tema.textoSecundario, fontSize: 10, width: 22 }}>{sem}°</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, flex: 1 }}>
                            {materias.filter(m => m.semestre === sem).map(m => (
                              <View
                                key={m.id}
                                style={{
                                  width: 18, height: 18, borderRadius: 3,
                                  backgroundColor: estadoColores[calcularEstadoFinal(m, config)],
                                }}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10,
                        paddingTop: 10, borderTopWidth: 1, borderTopColor: tema.borde }}>
                        {ORDEN_ESTADOS.filter(e => conteo[e] > 0).map(e => (
                          <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: estadoColores[e] }} />
                            <Text style={{ color: tema.textoSecundario, fontSize: 10 }}>{ESTADO_LABELS[e].split(' ')[1]}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* 4. Notas obtenidas */}
              <View style={col}>
                {seccion('NOTAS OBTENIDAS')}
                <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14 }}>
                  {barrasNotas.length > 0 ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {ejeY('Materias')}
                        <BarChart
                          data={barrasNotas}
                          barWidth={barWidthNotas}
                          height={150}
                          width={chartWidth}
                          maxValue={notasMax}
                          noOfSections={notasSections}
                          yAxisTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                          xAxisLabelTextStyle={{ color: tema.textoSecundario, fontSize: 11 }}
                          hideRules
                          barBorderRadius={4}
                        />
                      </View>
                      {ejeX(`Nota obtenida (escala ${config.notaMaxima})`)}
                    </>
                  ) : sinDatos('Sin notas registradas aún')}
                </View>
              </View>

            </View>

            {/* 5. Tipos de formación — columna izquierda + columna fantasma */}
            <View style={isWeb ? { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 } : {}}>
            <View style={col}>
            {seccion('TIPOS DE FORMACIÓN')}
            <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => setSemestreTorta(null)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
                      backgroundColor: semestreTorta === null ? tema.acento : tema.superficie }}>
                    <Text style={{ color: semestreTorta === null ? '#fff' : tema.textoSecundario, fontSize: 12 }}>Global</Text>
                  </TouchableOpacity>
                  {semestres.map(s => (
                    <TouchableOpacity key={s} onPress={() => setSemestreTorta(s)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
                        backgroundColor: semestreTorta === s ? tema.acento : tema.superficie }}>
                      <Text style={{ color: semestreTorta === s ? '#fff' : tema.textoSecundario, fontSize: 12 }}>{s}° Sem</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {datosTorta.length === 0 ? sinDatos('Sin materias con tipo asignado') : (
                <View style={isWeb ? { flexDirection: 'row', alignItems: 'flex-start', gap: 32 } : {}}>
                  <View style={{ alignItems: 'center', marginBottom: isWeb ? 0 : 16 }}>
                    <PieChart
                      data={datosTorta}
                      radius={80}
                      innerRadius={40}
                      centerLabelComponent={() => (
                        <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 14 }}>{materiasTorta.length}</Text>
                      )}
                    />
                  </View>
                  <View style={{ flex: isWeb ? 1 : undefined }}>
                    {datosTorta.map((d, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.color }} />
                          <Text style={{ color: tema.texto, fontSize: 13 }}>{d.label}</Text>
                        </View>
                        <Text style={{ color: tema.textoSecundario, fontSize: 13 }}>
                          {d.value} ({Math.round((d.value / (materiasTorta.length || 1)) * 100)}%)
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
            </View>{/* cierre col */}
            {isWeb && <View style={col} />}{/* columna fantasma */}
            </View>{/* cierre row wrapper */}
          </>
        )}

      </ScrollView>
    </View>
  );

  if (fondoPantalla?.tipo === 'imagen' && fondoPantalla.valor) {
    return (
      <ImageBackground source={{ uri: fondoPantalla.valor }} style={{ flex: 1 }} imageStyle={{ opacity: 0.3 }}>
        {innerContent}
      </ImageBackground>
    );
  }
  return <View style={{ flex: 1, backgroundColor: tema.fondo, ...fondoStyle }}>{innerContent}</View>;
}
