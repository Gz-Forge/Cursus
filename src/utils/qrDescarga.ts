import QRCode from 'qrcode';
import { Platform } from 'react-native';

/** Genera un array de data URLs, uno por chunk QR.
 *  Web: PNG (data:image/png;base64,...)
 *  Nativo: SVG (data:image/svg+xml;base64,...) — no hay Canvas en RN
 */
export async function generarQrDataUrls(chunks: { i: number; t: number; d: string }[]): Promise<string[]> {
  const urls: string[] = [];
  for (const chunk of chunks) {
    const data = JSON.stringify(chunk);
    if (Platform.OS === 'web') {
      const url = await QRCode.toDataURL(data, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      urls.push(url);
    } else {
      // React Native no tiene Canvas — usar SVG puro (no requiere DOM)
      const svg: string = await QRCode.toString(data, {
        type: 'svg',
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      urls.push(`data:image/svg+xml;base64,${btoa(svg)}`);
    }
  }
  return urls;
}

/** Descarga / comparte cada QR como imagen separada */
export async function descargarQrsPng(
  dataUrls: string[],
  nombreBase: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    dataUrls.forEach((url, i) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nombreBase}-qr-${i + 1}de${dataUrls.length}.png`;
      a.click();
    });
  } else {
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    for (let i = 0; i < dataUrls.length; i++) {
      const isSvg = dataUrls[i].startsWith('data:image/svg+xml;base64,');
      const ext = isSvg ? 'svg' : 'png';
      const mimeType = isSvg ? 'image/svg+xml' : 'image/png';
      const prefix = isSvg ? 'data:image/svg+xml;base64,' : 'data:image/png;base64,';
      const base64 = dataUrls[i].replace(prefix, '');
      const ruta = `${FileSystem.documentDirectory}${nombreBase}-qr-${i + 1}.${ext}`;
      await FileSystem.writeAsStringAsync(ruta, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(ruta, { mimeType });
    }
  }
}

/** Descarga todos los QRs en un ZIP (web) o comparte individualmente (móvil) */
export async function descargarQrsZip(
  dataUrls: string[],
  nombreBase: string,
): Promise<void> {
  if (Platform.OS !== 'web') {
    await descargarQrsPng(dataUrls, nombreBase);
    return;
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  dataUrls.forEach((url, i) => {
    const base64 = url.replace(/^data:image\/png;base64,/, '');
    zip.file(`${nombreBase}-qr-${i + 1}de${dataUrls.length}.png`, base64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreBase}-qrs.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga todos los QRs en un PDF (SVG data URLs funcionan en WebView de expo-print) */
export async function descargarQrsPdf(
  dataUrls: string[],
  nombreBase: string,
): Promise<void> {
  const html = `
    <html><body style="margin:0;padding:0;background:#fff;">
      ${dataUrls.map((url, i) => `
        <div style="page-break-after:always;display:flex;flex-direction:column;
          align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <p style="margin-bottom:16px;font-size:18px;color:#333;">
            QR ${i + 1} de ${dataUrls.length}
          </p>
          <img src="${url}" style="width:300px;height:300px;" />
        </div>
      `).join('')}
    </body></html>
  `;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    } else {
      alert('El navegador bloqueó la ventana emergente. Habilitá los popups para esta página y volvé a intentarlo.');
    }
  } else {
    const Print = await import('expo-print');
    await Print.printAsync({ html });
  }
}
