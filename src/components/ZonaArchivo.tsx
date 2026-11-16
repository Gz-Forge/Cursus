import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTema } from '../theme/ThemeContext';
import { useAlert } from '../contexts/AlertContext';

interface Props {
  onArchivo: (texto: string, nombreArchivo: string) => void;
  /** Abre el selector de archivos (el botón de siempre). */
  onElegir: () => void;
  extensiones: string[];
  etiquetaBoton?: string;
  texto?: string;
  cargando?: boolean;
  compacta?: boolean;
  /** 'secundario': botón con fondo de tarjeta, como los botones chicos de las secciones. */
  estiloBoton?: 'principal' | 'secundario';
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Puntos 128 y 130: zona para soltar archivos (web y escritorio) con el botón
 * de elegir archivo. En celular se muestra solo el botón.
 */
export function ZonaArchivo({
  onArchivo, onElegir, extensiones,
  etiquetaBoton = '📂 Elegir archivo',
  texto = 'Arrastrá el archivo acá',
  cargando = false,
  compacta = false,
  estiloBoton = 'principal',
}: Props) {
  const tema = useTema();
  const { showAlert } = useAlert();
  const esWeb = Platform.OS === 'web';
  const zonaRef = useRef<any>(null);
  const [encima, setEncima] = useState(false);

  // Los handlers del drop siempre ven la última versión de las props.
  const propsRef = useRef({ onArchivo, extensiones, showAlert });
  propsRef.current = { onArchivo, extensiones, showAlert };

  useEffect(() => {
    if (!esWeb) return;
    const el = zonaRef.current as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;

    // dragenter/dragleave se disparan también al pasar sobre los hijos: se cuentan.
    let contador = 0;

    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      contador++;
      setEncima(true);
    };
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      contador = Math.max(0, contador - 1);
      if (contador === 0) setEncima(false);
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      contador = 0;
      setEncima(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const { onArchivo: cb, extensiones: exts, showAlert: alerta } = propsRef.current;
      const punto = file.name.lastIndexOf('.');
      const ext = punto >= 0 ? file.name.slice(punto).toLowerCase() : '';
      if (!exts.map(x => x.toLowerCase()).includes(ext)) {
        alerta('Formato no admitido', `Soltá un archivo ${exts.join(', ')}.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        alerta('Archivo demasiado grande', 'El máximo es 5 MB.');
        return;
      }
      try {
        const contenido = await file.text();
        cb(contenido, file.name);
      } catch {
        alerta('No se pudo leer el archivo', 'Probá de nuevo o elegilo con el botón.');
      }
    };

    el.addEventListener('dragenter', onEnter);
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragenter', onEnter);
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('dragleave', onLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [esWeb]);

  const boton = (
    <TouchableOpacity
      onPress={onElegir}
      disabled={cargando}
      style={{
        backgroundColor: estiloBoton === 'secundario' ? tema.tarjeta : (tema.acentoFondo ?? tema.acento),
        padding: estiloBoton === 'secundario' ? 10 : 14, borderRadius: estiloBoton === 'secundario' ? 8 : 10,
        alignItems: 'center',
        alignSelf: esWeb ? 'stretch' : undefined,
      }}
    >
      {cargando
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: estiloBoton === 'secundario' ? tema.texto : '#fff', fontWeight: estiloBoton === 'secundario' ? '400' : '700' }}>{etiquetaBoton}</Text>
      }
    </TouchableOpacity>
  );

  if (!esWeb) return boton;

  const colorEncima = tema.acentoLineas ?? tema.acento;
  return (
    <View
      ref={zonaRef}
      style={{
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: encima ? colorEncima : tema.borde,
        backgroundColor: encima ? colorEncima + '18' : 'transparent',
        borderRadius: 12,
        padding: compacta ? 10 : 18,
        alignItems: 'center',
        gap: compacta ? 6 : 8,
      }}
    >
      <Text style={{ color: tema.texto, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{texto}</Text>
      <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center' }}>
        Formatos: {extensiones.join(', ')}
      </Text>
      <View style={{ alignSelf: 'stretch' }}>{boton}</View>
    </View>
  );
}
