import { exportToBlob } from '@excalidraw/excalidraw';

function blobToBase64Png(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).replace(/^data:image\/png;base64,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('PNG変換に失敗しました'));
    reader.readAsDataURL(blob);
  });
}

window.renderAndExport = async function renderAndExport(doc, scale) {
  const blob = await exportToBlob({
    elements: Array.isArray(doc.elements) ? doc.elements : [],
    appState: {
      ...doc.appState,
      exportBackground: true,
      exportWithDarkMode: false,
    },
    files: {},
    mimeType: 'image/png',
    quality: 1,
    scale,
  });
  return blobToBase64Png(blob);
};
