import {ComponentType} from 'react';
import {Navbar} from './Navbar';
import {Container} from '@mui/material';

export const withNavbar = <P extends object>(Screen: ComponentType<P>) => (props: P) => <>
  <Navbar/>
  <Container component="main" id="main-content" tabIndex={-1} maxWidth="xl" sx={{py: {xs: 3, md: 5}}}>
    <Screen {...props}/>
  </Container>
</>;
