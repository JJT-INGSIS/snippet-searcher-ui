import {useMutation} from 'react-query';
import {useApi} from '../contexts/apiContext';
import {FormattedSnippet, formattedFileName} from '../utils/api/formattedSnippet';
import {saveTextFile} from '../utils/fileDownload';

export function useFormattedDownload(snippetId: string) {
  const {operations} = useApi();
  return useMutation<FormattedSnippet, Error>(() => operations.getFormattedSnippet(snippetId), {
    retry: false,
    onSuccess: formatted => saveTextFile(formattedFileName(formatted), formatted.code),
  });
}
