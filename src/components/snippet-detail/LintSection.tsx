import {Alert, AlertTitle, Box, Stack, Typography} from '@mui/material';
import {LintResult} from '../../utils/api/lintResult';
import {diagnosticText, lintExplanation, lintLabel, lintSeverity} from '../../utils/lintPresentation';

const SECTION_SPACING = 1;
const LIST_INDENT = 2.5;

type Props = {lint: LintResult; shared: boolean; dirty: boolean};

export function LintSection({lint, shared, dirty}: Props) {
  const explanation = lintExplanation(lint);
  return <Stack spacing={SECTION_SPACING} component="section" aria-label="Lint" data-testid="lint-section">
    <Typography component="h3" variant="h6">Lint</Typography>
    <Alert severity={lintSeverity(lint)}>
      <AlertTitle>{lintLabel(lint)}</AlertTitle>
      {explanation && <Typography variant="body2">{explanation}</Typography>}
      {lint.diagnostics.length > 0 && <Box component="ul" sx={{m: 0, pl: LIST_INDENT}} aria-label="Infracciones de lint">
        {lint.diagnostics.map(diagnostic => <li key={diagnosticText(diagnostic)}>
          <Typography variant="body2" fontFamily="monospace">{diagnosticText(diagnostic)}</Typography>
        </li>)}
      </Box>}
    </Alert>
    {shared && <Typography variant="body2" color="text.secondary">Evaluado con las reglas del propietario.</Typography>}
    {dirty && <Typography variant="body2" color="text.secondary">
      El resultado corresponde a la versión guardada: tus cambios sin guardar se evalúan al guardarlos.
    </Typography>}
  </Stack>;
}
