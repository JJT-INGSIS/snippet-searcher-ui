import {describe, expect, it} from 'vitest';
import {FileSaver, saveTextFile} from './fileDownload';

function recordingSaver() {
  const events: string[] = [];
  const blobs: Blob[] = [];
  const saver: FileSaver = {
    createUrl: blob => {blobs.push(blob); events.push('create'); return 'blob:formatted';},
    open: (url, fileName) => {events.push('open ' + url + ' ' + fileName);},
    release: url => {events.push('release ' + url);},
  };
  return {saver, events, blobs};
}

describe('saving a text file', () => {
  it('opens the file with its name and releases the Blob URL afterwards', () => {
    const {saver, events} = recordingSaver();

    saveTextFile('Saludo-formateado.prs', 'println(1);', saver);

    expect(events).toEqual(['create', 'open blob:formatted Saludo-formateado.prs', 'release blob:formatted']);
  });

  it('keeps unicode and line breaks byte for byte as UTF-8 text', async () => {
    const {saver, blobs} = recordingSaver();
    const content = 'let saludo = "¡Hola, señor! 🚀";\r\nprintln(saludo);\n';

    saveTextFile('Saludo-formateado.prs', content, saver);

    expect(blobs[0].type).toBe('text/plain;charset=utf-8');
    expect(new Uint8Array(await blobs[0].arrayBuffer())).toEqual(new TextEncoder().encode(content));
  });

  it('releases the Blob URL even when the browser fails to open it', () => {
    const {saver, events} = recordingSaver();
    saver.open = () => {throw new Error('blocked');};

    expect(() => saveTextFile('a.prs', 'x', saver)).toThrow('blocked');
    expect(events).toEqual(['create', 'release blob:formatted']);
  });
});
