import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useTema } from '../theme/ThemeContext';

// ── Reemplazá estas URLs cuando estén disponibles ──────────────────────────
const PAYPAL_URL      = 'https://www.paypal.com/donate/?hosted_button_id=9TCFLYW98H8JA';
const PLAY_STORE_URL  = 'https://play.google.com/store/apps/details?id=TU_APP_ID';
const APP_STORE_URL   = 'https://apps.apple.com/app/id/TU_APP_ID';
const GOOGLE_FORM_URL = 'https://forms.gle/257Bf5rb4MMyt6TVA';

export function DonacionScreen() {
  const tema = useTema();
  const isWeb = Platform.OS === 'web';

  const abrir = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo abrir el enlace. Verificá tu conexión.');
    }
  };

  const verAnuncio = () => {
    Alert.alert('Próximamente', 'Esta función estará disponible en una próxima versión.');
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
              elevation: 4,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 }}>
              💙  Donar con PayPal
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

          {/* Android: botón Play Store */}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              onPress={() => abrir(PLAY_STORE_URL)}
              activeOpacity={0.85}
              style={{
                backgroundColor: tema.tarjeta, paddingVertical: 14,
                borderRadius: 12, width: '100%', alignItems: 'center',
                borderWidth: 1.5, borderColor: tema.acento,
              }}
            >
              <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 15 }}>⭐  Reseñar en Play Store</Text>
            </TouchableOpacity>
          )}

          {/* iOS: no disponible aún */}
          {Platform.OS === 'ios' && (
            <Text style={{ color: tema.textoSecundario, fontSize: 13, textAlign: 'center' }}>
              Próximamente disponible en App Store.
            </Text>
          )}

          {/* Web: Play Store + iOS próximamente */}
          {isWeb && (
            <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={() => abrir(PLAY_STORE_URL)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: tema.tarjeta, paddingVertical: 14,
                  borderRadius: 12, width: '100%', alignItems: 'center',
                  borderWidth: 1.5, borderColor: tema.acento,
                }}
              >
                <Text style={{ color: tema.acento, fontWeight: '700', fontSize: 15 }}>⭐  Reseñar en Play Store</Text>
              </TouchableOpacity>
              <Text style={{ color: tema.textoSecundario, fontSize: 12, textAlign: 'center' }}>
                Próximamente disponible en App Store.
              </Text>
            </View>
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
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 10,
            shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
            <QRCode
              value="https://TU_APP_URL/share.html"
              size={160}
              color="#121212"
              backgroundColor="#ffffff"
            />
          </View>
          <Text style={{ color: tema.textoSecundario, fontSize: 11, textAlign: 'center', lineHeight: 17, marginBottom: 4 }}>
            Al escanearlo lo lleva a descargar la app.{'\n'}Por ahora disponible para Android y PC/Laptop.{'\n'}Próximamente en iOS.
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
