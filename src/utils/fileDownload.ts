export type FileSaver = {
  createUrl: (blob: Blob) => string;
  open: (url: string, fileName: string) => void;
  release: (url: string) => void;
};

export const browserFileSaver: FileSaver = {
  createUrl: blob => URL.createObjectURL(blob),
  open: (url, fileName) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  },
  release: url => {setTimeout(() => URL.revokeObjectURL(url));},
};

export function saveTextFile(fileName: string, content: string, saver: FileSaver = browserFileSaver) {
  const url = saver.createUrl(new Blob([content], {type: 'text/plain;charset=utf-8'}));
  try {
    saver.open(url, fileName);
  } finally {
    saver.release(url);
  }
}
