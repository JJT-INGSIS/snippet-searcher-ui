import {describe, expect, it} from 'vitest';
import {fromDetailDto, fromMetadataDto, fromPageDto, toWriteDto} from './dto';
const metadata = {id: 'id', name: 'Name', description: null, language: 'printscript', version: '1.1'};
const descriptor = {...metadata, extension: 'prs', ownerId: 'dev-ana', relation: 'shared' as const, lint: {status: 'not-implemented' as const}};
describe('SNI-26 mappings', () => {
  it('sends only permitted fields, preserves whitespace, empty code and description semantics', () => {
    const input = {...metadata, content: '', author: 'not-an-owner', extension: 'ps'};
    expect(toWriteDto(input)).toEqual({name: 'Name', description: null, language: 'printscript', version: '1.1', code: ''});
    expect(toWriteDto({...input, description: '', content: '  println(1);\r\n'}).code).toBe('  println(1);\r\n');
    expect(toWriteDto({...input, description: ''}).description).toBe('');
  });
  it('does not fabricate content, capabilities or owner on a write acknowledgment', () => {
    expect(fromMetadataDto(metadata)).toEqual(metadata);
    expect(fromMetadataDto(metadata)).not.toHaveProperty('content');
    expect(fromMetadataDto(metadata)).not.toHaveProperty('capabilities');
  });
  it('maps a descriptor without loading content, including an empty page', () => {
    const result = fromPageDto({page: 0, page_size: 10, count: 1, snippets: [descriptor]});
    expect(result.snippets[0]).toMatchObject({author: 'dev-ana', relation: 'shared', compliance: 'not-implemented'});
    expect(result.snippets[0]).not.toHaveProperty('content');
    expect(fromPageDto({page: 2, page_size: 10, count: 0, snippets: []})).toEqual({page: 2, page_size: 10, count: 0, snippets: []});
  });
  it('keeps backend read-only capabilities and code exactly', () => {
    expect(fromDetailDto({...descriptor, code: '\n println(1);', capabilities: {modify: false, share: false}}))
      .toMatchObject({content: '\n println(1);', author: 'dev-ana', capabilities: {modify: false, share: false}});
  });
});

describe('unexpected response data is never a confirmed save', () => {
  it('rejects incomplete metadata and retains an uncertain result for safe retry', () => {
    expect(() => fromMetadataDto({id: 'id'} as Parameters<typeof fromMetadataDto>[0])).toThrow('not confirmed');
    try {fromMetadataDto({id: 'id'} as Parameters<typeof fromMetadataDto>[0]);}
    catch (error) {expect(error).toMatchObject({uncertain: true});}
  });
  it('does not invent an empty code field for a broken detail', () => {
    expect(() => fromDetailDto({...descriptor, capabilities: {modify: false, share: false}} as Parameters<typeof fromDetailDto>[0])).toThrow();
  });
});
