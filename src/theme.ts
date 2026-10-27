import {createTheme} from '@mui/material/styles';
export const theme = createTheme({
  palette: {
    primary: {main: '#1769aa', light: '#4ea8ff', dark: '#104d80'},
    background: {default: '#f5f7fa', paper: '#ffffff'},
    text: {primary: '#17212f', secondary: '#526173'},
    success: {main: '#237a40'}, warning: {main: '#946000'}, error: {main: '#bc2935'},
    divider: '#dce3eb',
  },
  typography: {
    fontFamily: 'Geist Sans, system-ui, sans-serif',
    h1: {fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.04em'},
    h2: {fontSize: '1.35rem', fontWeight: 650, letterSpacing: '-0.02em'},
    h3: {fontSize: '1.1rem', fontWeight: 600},
    button: {textTransform: 'none', fontWeight: 600},
    body1: {lineHeight: 1.6},
  },
  shape: {borderRadius: 10},
  components: {
    MuiCssBaseline: {styleOverrides: {
      body: {minWidth: 320},
      'a, button, input, textarea, [role="combobox"]': {scrollMarginBlock: '5rem'},
      ':focus-visible': {outline: '3px solid #1769aa', outlineOffset: 3},
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': {animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important'},
      },
    }},
    MuiButton: {defaultProps: {disableElevation: true}, styleOverrides: {root: {minHeight: 42, borderRadius: 8}}},
    MuiIconButton: {styleOverrides: {root: {minWidth: 44, minHeight: 44}}},
    MuiTextField: {defaultProps: {variant: 'outlined', size: 'small'}},
    MuiTableCell: {styleOverrides: {
      head: {fontWeight: 600, color: '#526173', backgroundColor: '#f8fafc'},
      body: {borderColor: '#e8edf3'},
    }},
    MuiDialog: {styleOverrides: {paper: {backgroundImage: 'none'}}},
    MuiAlert: {styleOverrides: {root: {overflowWrap: 'anywhere', alignItems: 'flex-start'}}},
  },
});
