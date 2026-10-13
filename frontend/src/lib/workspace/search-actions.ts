/** Open, save, or print a file the browser already has as a blob. */
export async function presentBlob(
  blob: Blob,
  mode: 'view' | 'download' | 'print',
  filename?: string,
): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    if (mode === 'download') {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename || 'document';
      anchor.click();
      return;
    }
    if (mode === 'print') {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', filename || 'Print');
      iframe.style.position = 'fixed';
      iframe.style.inset = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      document.body.appendChild(iframe);
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error('Could not open this file.')),
          12_000,
        );
        iframe.onload = () => {
          window.clearTimeout(timer);
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve();
        };
      });
      window.setTimeout(() => iframe.remove(), 60_000);
      return;
    }
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.click();
    }
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
