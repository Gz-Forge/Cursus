import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ScrollView, Platform, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useStore } from '../store/useStore';
import { temaOscuro, temaClaro } from '../theme/colors';
import { useAlert } from '../contexts/AlertContext';

// ── Reemplazá estas URLs cuando estén disponibles ──────────────────────────
const PAYPAL_URL        = 'https://www.paypal.com/donate/?hosted_button_id=VNC65GKZYCJWL';
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/Gz-Forge';
const PLAY_STORE_URL    = 'https://play.google.com/store/apps/details?id=com.gzforge.cursus';
const MICROSOFT_STORE_URL = 'https://apps.microsoft.com/detail/9PJGCNX9R9BG';
const APP_STORE_URL     = 'https://apps.apple.com/app/id/TU_APP_ID';
const GOOGLE_FORM_URL   = 'https://forms.gle/257Bf5rb4MMyt6TVA';

const TIENDAS = [
  { nombre: 'Play Store', url: PLAY_STORE_URL },
  { nombre: 'Microsoft Store', url: MICROSOFT_STORE_URL },
] as const;

interface SliderTiendasProps {
  indice: number;
  onCambiar: (i: number) => void;
  paginas?: React.ReactNode[];
  acento: string;
  texto: string;
  textoSecundario: string;
  borde: string;
}

function SliderTiendas({ indice, onCambiar, paginas, acento, texto, textoSecundario, borde }: SliderTiendasProps) {
  const [ancho, setAncho] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const seleccionar = (i: number) => {
    onCambiar(i);
    if (paginas && ancho > 0) scrollRef.current?.scrollTo({ x: i * ancho, animated: true });
  };

  const alTerminarScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (ancho <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / ancho);
    if (i !== indice && i >= 0 && i < TIENDAS.length) onCambiar(i);
  };

  return (
    <View style={{ width: '100%' }} onLayout={e => setAncho(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: borde, marginBottom: paginas ? 16 : 14 }}>
        {TIENDAS.map((t, i) => {
          const activa = i === indice;
          return (
            <TouchableOpacity
              key={t.nombre}
              onPress={() => seleccionar(i)}
              activeOpacity={0.7}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 10,
                borderBottomWidth: 2, borderBottomColor: activa ? acento : 'transparent', marginBottom: -1,
              }}
            >
              <Text style={{ color: activa ? texto : textoSecundario, fontWeight: activa ? '700' : '500', fontSize: 14 }}>
                {t.nombre}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {paginas && ancho > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={alTerminarScroll}
          contentOffset={{ x: indice * ancho, y: 0 }}
          scrollEventThrottle={16}
        >
          {paginas.map((p, i) => (
            <View key={i} style={{ width: ancho, alignItems: 'center' }}>{p}</View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function DonacionScreen() {
  // Siempre usa el tema base (claro u oscuro), nunca el tema personalizado
  const configTema = useStore(s => s.config.tema);
  const tema = configTema === 'claro' ? temaClaro : temaOscuro;
  const isWeb = Platform.OS === 'web';
  const { showAlert } = useAlert();
  const [tiendaResena, setTiendaResena] = useState(0);
  const [tiendaQr, setTiendaQr] = useState(0);

  const abrir = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      showAlert('Error', 'No se pudo abrir el enlace. Verificá tu conexión.');
    }
  };

  const verAnuncio = () => {
    showAlert('Próximamente', 'Esta función estará disponible en una próxima versión.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.fondo }}>
      <ScrollView contentContainerStyle={{ padding: 28, alignItems: 'center' }}>
        <View style={isWeb ? { maxWidth: 480, width: '100%', alignItems: 'center' } : { width: '100%', alignItems: 'center' }}>

          {/* ── Donar con PayPal ── */}
          <Text style={{ fontSize: 48, marginBottom: 12 }}>❤️</Text>
          <Text style={{ color: tema.texto, fontSize: 20, fontWeight: '700', marginBottom: 14, textAlign: 'center' }}>
            Apoyar la app
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 28 }}>
            Solo si la app te sirvió y te lo podés permitir, podés donar.{'\n'}
            Desde ya, ¡gracias!
          </Text>

          <TouchableOpacity
            onPress={() => abrir(PAYPAL_URL)}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#0070BA',
              paddingVertical: 15, paddingHorizontal: 48,
              borderRadius: 12, width: '100%', alignItems: 'center',
              shadowColor: '#0070BA', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
              elevation: 4, marginBottom: 12,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 }}>
              💙  Donar con PayPal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => abrir(GITHUB_SPONSORS_URL)}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#24292F',
              paddingVertical: 15, paddingHorizontal: 48,
              borderRadius: 12, width: '100%', alignItems: 'center',
              shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 }}>
              🤍  Apoyar en GitHub Sponsors
            </Text>
          </TouchableOpacity>

          <View style={{ width: '100%', height: 1, backgroundColor: tema.borde, marginVertical: 32 }} />

          {/* ── Dejar reseña ── */}
          <Text style={{ fontSize: 38, marginBottom: 10 }}>⭐</Text>
          <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
            Dejar una reseña
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 }}>
            Una reseña de 5 estrellas ayuda mucho a que más estudiantes encuentren la app.
          </Text>

          <SliderTiendas
            indice={tiendaResena}
            onCambiar={setTiendaResena}
            acento={tema.acento}
            texto={tema.texto}
            textoSecundario={tema.textoSecundario}
            borde={tema.borde}
          />
          <TouchableOpacity
            onPress={() => abrir(TIENDAS[tiendaResena].url)}
            activeOpacity={0.85}
            style={{
              backgroundColor: tema.tarjeta, paddingVertical: 14,
              borderRadius: 12, width: '100%', alignItems: 'center',
              borderWidth: 1.5, borderColor: tema.acento,
            }}
          >
            <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 15 }}>
              ⭐  Reseñar en {TIENDAS[tiendaResena].nombre}
            </Text>
          </TouchableOpacity>

          {Platform.OS !== 'android' && (
            <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              Próximamente disponible en App Store.
            </Text>
          )}

          <View style={{ width: '100%', height: 1, backgroundColor: tema.borde, marginVertical: 32 }} />

          {/* ── Compartir la app ── */}
          <Text style={{ fontSize: 38, marginBottom: 10 }}>📲</Text>
          <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
            Compartir la app
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 }}>
            Mostrá este QR a un compañero para que descargue Cursus.
          </Text>
          <SliderTiendas
            indice={tiendaQr}
            onCambiar={setTiendaQr}
            acento={tema.acento}
            texto={tema.texto}
            textoSecundario={tema.textoSecundario}
            borde={tema.borde}
            paginas={TIENDAS.map(t => (
              <View
                key={t.nombre}
                style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 10,
                  shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}
              >
                <QRCode
                  value={t.url}
                  size={160}
                  color="#121212"
                  backgroundColor="#ffffff"
                />
              </View>
            ))}
          />
          <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', lineHeight: 17, marginBottom: 4 }}>
            Al escanearlo lo lleva a la {TIENDAS[tiendaQr].nombre} para descargar la app.{'\n'}Por ahora disponible para Android y Windows.{'\n'}
          </Text>

          <View style={{ width: '100%', height: 1, backgroundColor: tema.borde, marginVertical: 32 }} />

          {/* ── Reportar bug / sugerir feature ── */}
          <Text style={{ fontSize: 38, marginBottom: 10 }}>🐛</Text>
          <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
            Reportar un problema o sugerencia
          </Text>
          <Text style={{ color: tema.textoSecundario, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 20 }}>
            ¿Encontraste un error o tenés una idea?{'\n'}Tu feedback nos ayuda a mejorar la app.
          </Text>

          <TouchableOpacity
            onPress={() => abrir(GOOGLE_FORM_URL)}
            activeOpacity={0.85}
            style={{
              backgroundColor: tema.tarjeta, paddingVertical: 14,
              borderRadius: 12, width: '100%', alignItems: 'center',
              borderWidth: 1.5, borderColor: tema.acento,
            }}
          >
            <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 15 }}>
              📝  Abrir formulario
            </Text>
          </TouchableOpacity>

          {/* ── Ver anuncio (solo móvil) ── */}
          {!isWeb && (
            <>
              <View style={{ width: '100%', height: 1, backgroundColor: tema.borde, marginVertical: 32 }} />
              <Text style={{ fontSize: 38, marginBottom: 10 }}>📺</Text>
              <Text style={{ color: tema.texto, fontSize: 18, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
                Colaborar mirando un anuncio
              </Text>
              <Text style={{ color: tema.textoSecundario, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
                Si no podés donar, podés ayudarnos mirando un breve anuncio.{'\n'}
                Es gratis para vos y nos ayuda a mantener la app activa.
              </Text>
              <TouchableOpacity
                onPress={verAnuncio}
                activeOpacity={0.85}
                style={{
                  backgroundColor: tema.tarjeta, paddingVertical: 14,
                  borderRadius: 12, width: '100%', alignItems: 'center',
                  borderWidth: 1.5, borderColor: tema.acento,
                }}
              >
                <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 15 }}>▶  Ver anuncio</Text>
              </TouchableOpacity>
              <Text style={{ color: tema.textoSecundario, fontSize: 11, marginTop: 8 }}>
                Próximamente disponible
              </Text>
            </>
          )}

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
