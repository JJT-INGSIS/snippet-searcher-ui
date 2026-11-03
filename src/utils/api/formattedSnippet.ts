import {invalidResponse} from './dto';

export type VariantSource = 'stored' | 'on-demand';
export type FormattedSnippet = {
  snippetId: string; name: string; language: string; version: string; extension: string; code: string;
  source: VariantSource; rulesRevision: string; processorRevision: string;
};

const revision = /^sha256-v1:[0-9a-f]{64}$/;
const extension = /^[A-Za-z0-9]+$/;
const sources: VariantSource[] = ['stored', 'on-demand'];
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export function fromFormattedSnippetDto(value: unknown, snippetId: string): FormattedSnippet {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (dto.snippetId !== snippetId || !text(dto.name) || !text(dto.language) || !text(dto.version) ||
      !text(dto.extension) || !extension.test(dto.extension) || typeof dto.code !== 'string' ||
      !sources.includes(dto.source as VariantSource) || !text(dto.rulesRevision) || !revision.test(dto.rulesRevision) ||
      !text(dto.processorRevision) || !revision.test(dto.processorRevision)) throw invalidResponse();
  return {
    snippetId, name: dto.name, language: dto.language, version: dto.version, extension: dto.extension, code: dto.code,
    source: dto.source as VariantSource, rulesRevision: dto.rulesRevision, processorRevision: dto.processorRevision,
  };
}

export function formattedFileName(snippet: {name: string; extension: string}): string {
  return snippet.name + '-formateado.' + snippet.extension;
}
