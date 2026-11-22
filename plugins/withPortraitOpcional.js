// Marca android.hardware.screen.portrait como opcional en el AndroidManifest.
// La app sigue bloqueada en vertical (orientation: "portrait"), pero Google Play
// ya no limita la instalación a dispositivos con pantalla vertical.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withPortraitOpcional(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    const existente = features.find(f => f.$?.['android:name'] === FEATURE);
    if (existente) {
      existente.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    }
    manifest['uses-feature'] = features;
    return cfg;
  });
};
