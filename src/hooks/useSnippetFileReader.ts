import {ChangeEvent, useRef, useState} from 'react';
import {useGetFileTypes} from '../utils/queries';
import {useSnackbarContext} from '../contexts/snackbarContext';
import {SnippetDraft} from '../utils/snippet';
import {readSnippetFile} from '../utils/upload';

export type FileReadMessages = {catalogUnavailable: string; unreadable: string};

export function useSnippetFileReader(onRead: (file: SnippetDraft) => void, messages: FileReadMessages) {
  const [reading, setReading] = useState(false);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const {data: types} = useGetFileTypes();
  const {createSnackbar} = useSnackbarContext();
  async function read(element: HTMLInputElement) {
    const file = element.files?.[0];
    if (!file || busy.current) return;
    busy.current = true; setReading(true);
    try {
      if (!types?.length) throw new Error(messages.catalogUnavailable);
      onRead(await readSnippetFile(file, types));
    } catch (error) {
      createSnackbar('error', error instanceof Error ? error.message : messages.unreadable);
    } finally {element.value = ''; busy.current = false; setReading(false);}
  }
  return {
    reading,
    choose: () => input.current?.click(),
    input: {
      ref: input, hidden: true, type: 'file', disabled: reading,
      accept: types?.map(type => '.' + type.extension).join(','),
      onChange: (event: ChangeEvent<HTMLInputElement>) => void read(event.currentTarget),
    },
  };
}
