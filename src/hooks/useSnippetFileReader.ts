import {ChangeEvent, useRef, useState} from 'react';
import {useGetFileTypes} from '../utils/queries';
import {useSnackbarContext} from '../contexts/snackbarContext';
import {SnippetDraft} from '../utils/snippet';
import {readSnippetFile} from '../utils/upload';

export type FileReadErrorMessages = {catalogUnavailable: string; unreadable: string};

export function useSnippetFileReader(onFileRead: (file: SnippetDraft) => void, messages: FileReadErrorMessages) {
  const [isReading, setIsReading] = useState(false);
  const readInProgress = useRef(false);
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const {data: types} = useGetFileTypes();
  const {createSnackbar} = useSnackbarContext();
  async function readSelectedFile(element: HTMLInputElement) {
    const file = element.files?.[0];
    if (!file || readInProgress.current) return;
    readInProgress.current = true; setIsReading(true);
    try {
      if (!types?.length) throw new Error(messages.catalogUnavailable);
      onFileRead(await readSnippetFile(file, types));
    } catch (error) {
      createSnackbar('error', error instanceof Error ? error.message : messages.unreadable);
    } finally {element.value = ''; readInProgress.current = false; setIsReading(false);}
  }
  return {
    isReading,
    openFileChooser: () => hiddenFileInput.current?.click(),
    hiddenFileInputProps: {
      ref: hiddenFileInput, hidden: true, type: 'file', disabled: isReading,
      accept: types?.map(type => '.' + type.extension).join(','),
      onChange: (event: ChangeEvent<HTMLInputElement>) => void readSelectedFile(event.currentTarget),
    },
  };
}
