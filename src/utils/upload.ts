import {FileType} from '../types/FileType';
import {SnippetDraft} from './snippet';

export async function readSnippetFile(file: File, types: FileType[]): Promise<SnippetDraft> {
  const dot = file.name.lastIndexOf('.');
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  const type = types.find(item => item.extension.toLowerCase() === extension);
  if (!type) throw new Error('La extensión del archivo no está disponible en el catálogo.');
  // File.text() strips a UTF-8 BOM; preserve it just like other source characters.
  const content = new TextDecoder('utf-8', {ignoreBOM: true}).decode(await file.arrayBuffer());
  return {name: dot > 0 ? file.name.slice(0, dot) : file.name, language: type.language, content};
}
