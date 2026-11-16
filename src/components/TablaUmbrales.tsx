import React, { useState, useEffect } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useStore } from '../store/useStore';
import { useTema } from '../theme/ThemeContext';
import { useEstadoEstilo } from '../hooks/useEstadoEstilo';
import { fmtNum } from '../utils/ayudas';
import { pctANota, notaAPct, validarUmbrales, tramosUmbrales, Umbrales } from '../utils/numerosNotas';
import { EstadoMateria } from '../types';

type ClaveUmbral = keyof Umbrales;

/**
 * Punto 3: umbrales de estado como barra de 0 a 100% (solo lectura) y tabla
 * editable con "desde %" y "nota" por estado. Un valor que rompe el orden
 * (Exoneración > Aprobación > Examen > 0, Exoneración ≤ 100) no se guarda.
 */
export function TablaUmbrales() {
  const { config, actualizarConfig } = useStore();
  const tema = useTema();
  const { getColor, getIcono, getLabelSingular } = useEstadoEstilo();
  const usarAprobado = !!config.usarEstadoAprobado;
  const max = config.notaMaxima;

  const actuales: Umbrales = {
    umbralExoneracion: config.umbralExoneracion,
    umbralAprobacion: config.umbralAprobacion,
    umbralPorExamen: config.umbralPorExamen,
  };

  // Texto de cada campo (para poder escribir libremente) y el error de validación
  const textos = (u: Umbrales) => Object.fromEntries(
    (Object.keys(u) as ClaveUmbral[]).flatMap(k => [[`${k}:pct`, String(u[k])], [`${k}:nota`, fmtNum(pctANota(u[k], max), 1)]]),
  ) as Record<string, string>;
  const [campos, setCampos] = useState<Record<string, string>>(() => textos(actuales));
  const [error, setError] = useState<string | null>(null);

  // Si cambian desde afuera (otra pantalla, importación, nota máxima), se resincroniza
  useEffect(() => {
    setCampos(textos(actuales));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.umbralExoneracion, config.umbralAprobacion, config.umbralPorExamen, max, usarAprobado]);

  const intentar = (clave: ClaveUmbral, pct: number) => {
    const candidato = { ...actuales, [clave]: pct };
    const problema = validarUmbrales(candidato, usarAprobado);
    setError(problema);
    if (!problema) actualizarConfig({ [clave]: pct });
  };

  const onPct = (clave: ClaveUmbral, txt: string) => {
    setCampos(c => ({ ...c, [`${clave}:pct`]: txt }));
    const n = parseFloat(txt.replace(',', '.'));
    if (isNaN(n)) return;
    setCampos(c => ({ ...c, [`${clave}:nota`]: fmtNum(pctANota(n, max), 1) }));
    intentar(clave, n);
  };

  const onNota = (clave: ClaveUmbral, txt: string) => {
    setCampos(c => ({ ...c, [`${clave}:nota`]: txt }));
    const n = parseFloat(txt.replace(',', '.'));
    if (isNaN(n)) return;
    const pct = notaAPct(n, max);
    setCampos(c => ({ ...c, [`${clave}:pct`]: String(pct) }));
    intentar(clave, pct);
  };

  const filas: { estado: EstadoMateria; clave: ClaveUmbral; nota?: string }[] = [
    { estado: 'exonerado', clave: 'umbralExoneracion' },
    ...(usarAprobado ? [{ estado: 'aprobado' as EstadoMateria, clave: 'umbralAprobacion' as ClaveUmbral }] : []),
    { estado: 'reprobado', clave: 'umbralPorExamen', nota: 'va a examen' },
  ];
  const tramos = tramosUmbrales(actuales, usarAprobado);
  const cortes = tramos.slice(1).map(t => t.desde);

  const input = (valor: string, onChange: (t: string) => void, label: string) => (
    <TextInput
      value={valor}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      accessibilityLabel={label}
      selectTextOnFocus
      style={{
        width: 64, backgroundColor: tema.fondo, color: tema.texto, borderRadius: 6,
        paddingVertical: 6, paddingHorizontal: 6, textAlign: 'center', fontSize: 14, fontWeight: '600',
        borderWidth: 1, borderColor: error ? '#F44336' : tema.borde,
      }}
    />
  );

  return (
    <View style={{ marginBottom: 14 }}>
      {/* Barra de 0 a 100% con los tramos de cada estado (no se arrastra) */}
      <View
        style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 4 }}
        accessibilityLabel={`Umbrales: ${tramos.map(t => `${getLabelSingular(t.estado)} desde ${t.desde}%`).join(', ')}`}
      >
        {tramos.map(t => (
          <View key={t.estado} style={{ flex: t.hasta - t.desde, backgroundColor: getColor(t.estado) }} />
        ))}
      </View>
      <View style={{ height: 30, marginBottom: 8 }}>
        {cortes.map(c => (
          <View key={c} style={{ position: 'absolute', left: `${c}%`, width: 60, marginLeft: -30, alignItems: 'center' }}>
            <Text style={{ color: tema.textoSecundario, fontSize: 10, lineHeight: 12 }}>▲{c}%</Text>
            <Text style={{ color: tema.texto, fontSize: 10, fontWeight: '700', lineHeight: 12 }}>{fmtNum(pctANota(c, max), 1)}</Text>
          </View>
        ))}
      </View>

      {/* Tabla: una fila por estado con "desde %" y "nota" */}
      <View style={{ backgroundColor: tema.tarjeta, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ flex: 1, color: tema.textoSecundario, fontSize: 11 }}>Estado</Text>
          <Text style={{ width: 64, color: tema.textoSecundario, fontSize: 11, textAlign: 'center' }}>desde %</Text>
          <Text style={{ width: 64, marginLeft: 8, color: tema.textoSecundario, fontSize: 11, textAlign: 'center' }}>nota / {max}</Text>
        </View>
        {filas.map(f => (
          <View key={f.clave} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: tema.borde }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getColor(f.estado) }} />
              <Text style={{ color: tema.texto, fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                {getIcono(f.estado)} {getLabelSingular(f.estado)}
                {f.nota ? <Text style={{ color: tema.textoSecundario, fontSize: 11 }}> ({f.nota})</Text> : null}
              </Text>
            </View>
            {input(campos[`${f.clave}:pct`] ?? '', t => onPct(f.clave, t), `${getLabelSingular(f.estado)} desde porcentaje`)}
            <View style={{ width: 8 }} />
            {input(campos[`${f.clave}:nota`] ?? '', t => onNota(f.clave, t), `${getLabelSingular(f.estado)} desde nota`)}
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: tema.borde }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getColor('recursar'), marginRight: 6 }} />
          <Text style={{ color: tema.texto, fontSize: 13 }}>
            {getIcono('recursar')} {getLabelSingular('recursar')}
            <Text style={{ color: tema.textoSecundario }}>
              {' '}· menos de {config.umbralPorExamen}% ({fmtNum(pctANota(config.umbralPorExamen, max), 1)})
            </Text>
          </Text>
        </View>
      </View>
      {error && (
        <Text style={{ color: '#F44336', fontSize: 12, marginTop: 6 }} accessibilityLiveRegion="polite">
          ⚠️ {error} No se guardó el cambio.
        </Text>
      )}
    </View>
  );
}
