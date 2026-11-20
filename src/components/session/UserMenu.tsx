import {useState} from 'react';
import {Avatar, Box, Button, Chip, Divider, ListItemIcon, Menu, MenuItem, Typography} from '@mui/material';
import {DeveloperModeRounded, KeyboardArrowDownRounded, LogoutRounded} from '@mui/icons-material';
import {SessionUser, useSession} from './SessionContext';
import {initialsOf} from '../../utils/auth/sessionMessages';

const AVATAR_SIZE = 32;
const NAME_WIDTH = 180;
const MENU_ID = 'user-menu';

function UserAvatar({user}: {user: SessionUser}) {
  return <Avatar src={user.picture ?? undefined} alt="" imgProps={{referrerPolicy: 'no-referrer'}}
    sx={{width: AVATAR_SIZE, height: AVATAR_SIZE, bgcolor: 'primary.main', fontSize: '0.85rem'}}>
    {initialsOf(user.name)}
  </Avatar>;
}

export function UserMenu() {
  const session = useSession();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (session.kind === 'dev' && session.user) {
    return <Chip icon={<DeveloperModeRounded/>} color="warning" variant="outlined" label={'Desarrollo · ' + session.user.name}/>;
  }
  if (session.kind !== 'auth0' || !session.user || !session.logout) return null;
  const {user, logout} = session;
  return <>
    <Button id="user-menu-button" aria-haspopup="menu" aria-controls={anchor ? MENU_ID : undefined} aria-expanded={!!anchor}
      onClick={event => setAnchor(event.currentTarget)} startIcon={<UserAvatar user={user}/>} endIcon={<KeyboardArrowDownRounded/>}
      sx={{color: 'text.primary'}}>
      <Box component="span" sx={{display: {xs: 'none', md: 'inline'}, maxWidth: NAME_WIDTH, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
        {user.name}
      </Box>
    </Button>
    <Menu id={MENU_ID} anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
      MenuListProps={{'aria-labelledby': 'user-menu-button'}} anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
      transformOrigin={{vertical: 'top', horizontal: 'right'}}>
      <Box sx={{px: 2, py: 1.5, maxWidth: 280}}>
        <Typography fontWeight={600} sx={{overflowWrap: 'anywhere'}}>{user.name}</Typography>
        {user.email && <Typography variant="body2" color="text.secondary" sx={{overflowWrap: 'anywhere'}}>{user.email}</Typography>}
      </Box>
      <Divider/>
      <MenuItem onClick={() => {setAnchor(null); logout();}}>
        <ListItemIcon><LogoutRounded fontSize="small"/></ListItemIcon>Cerrar sesión
      </MenuItem>
    </Menu>
  </>;
}
