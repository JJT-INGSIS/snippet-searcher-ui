import {useState} from 'react';
import {Box, Stack, Tab, Tabs, Typography} from '@mui/material';
import {withNavbar} from '../components/navbar/withNavbar';
import {FormattingSettings} from '../components/formatting-rules/FormattingSettings';
import {LintingSettings} from '../components/linting-rules/LintingSettings';

type RulesTab = 'format' | 'lint';

const SCREEN_SPACING = 2;

const RulesScreen = () => {
  const [tab, setTab] = useState<RulesTab>('format');
  return <Stack spacing={SCREEN_SPACING}>
    <Typography variant="h1">Reglas de código</Typography>
    <Typography color="text.secondary">Elegí un lenguaje y una versión para configurar el formato y el lint de tus snippets.</Typography>
    <Tabs value={tab} onChange={(_, next: RulesTab) => setTab(next)} aria-label="Tipo de reglas">
      <Tab value="format" label="Formato" id="rules-tab-format" aria-controls="rules-panel-format"/>
      <Tab value="lint" label="Lint" id="rules-tab-lint" aria-controls="rules-panel-lint"/>
    </Tabs>
    <Box role="tabpanel" id="rules-panel-format" aria-labelledby="rules-tab-format" hidden={tab !== 'format'}>
      <FormattingSettings/>
    </Box>
    <Box role="tabpanel" id="rules-panel-lint" aria-labelledby="rules-tab-lint" hidden={tab !== 'lint'}>
      <LintingSettings/>
    </Box>
  </Stack>;
};
export default withNavbar(RulesScreen);
