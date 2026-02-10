import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Tooltip,
  CssBaseline
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Business as BusinessIcon,
  Map as MapIcon,
  Payment as PaymentIcon,
  AccountBalance as AccountBalanceIcon,
  Add as AddIcon,
  Place as PlaceIcon,
  FolderOpen as FolderOpenIcon,
  AttachMoney as BudgetIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { API_BASE_URL } from '../config';

const drawerWidth = 260;

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  React.useEffect(() => {
    fetchLogo();
  }, []);

  const fetchLogo = async () => {
    try {
      const response = await api.get('/settings/logo');
      if (response.data.url) {
        setLogoUrl(`${API_BASE_URL}${response.data.url}`);
      }
    } catch (error) {
      console.error('Erreur chargement logo:', error);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const getProfilePath = (role?: string) => {
    return '/profile';
  };

  const menuItems = [
    { text: 'Tableau de bord', icon: <DashboardIcon />, path: '/dashboard', roles: ['all'] },
    { text: 'Espace Analyste', icon: <AssignmentIcon />, path: '/analyst-profile', roles: ['analyste', 'admin'] },
    { text: 'Mes Réquisitions', icon: <AssignmentIcon />, path: '/requisitions', roles: ['all'] },
    { text: 'Nouvelle demande', icon: <AddIcon />, path: '/requisitions/new', roles: ['emetteur', 'admin'] },
    { text: 'Utilisateurs', icon: <PeopleIcon />, path: '/users', roles: ['admin'] },
    { text: 'Sites', icon: <PlaceIcon />, path: '/sites', roles: ['admin'] },
    { text: 'Services', icon: <BusinessIcon />, path: '/services', roles: ['admin'] },
    { text: 'Zones', icon: <MapIcon />, path: '/zones', roles: ['admin'] },
    { text: 'Gestion des fonds', icon: <PaymentIcon />, path: '/payments', roles: ['comptable', 'admin', 'gm'] },
    { text: 'Budgets', icon: <BudgetIcon />, path: '/budgets', roles: ['admin', 'comptable', 'pm', 'analyste'] },
    { text: 'Compilations', icon: <FolderOpenIcon />, path: '/compilations', roles: ['compilateur', 'admin', 'comptable', 'gm', 'analyste'] },
    { text: 'Trésorerie', icon: <AccountBalanceIcon />, path: '/funds', roles: ['comptable', 'admin', 'gm'] },
    { text: 'Paramètres', icon: <SettingsIcon />, path: '/settings', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes('all') || (user && item.roles.includes(user.role))
  );

  const drawer = (
    <div>
      <Toolbar sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        px: 2,
        bgcolor: 'primary.main',
        color: 'white',
        py: 1
      }}>
        {logoUrl ? (
          <Box sx={{ 
            bgcolor: 'white', 
            borderRadius: '50%', 
            p: 0.5, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: 50,
            height: 50,
            overflow: 'hidden',
            boxShadow: 2
          }}>
            <Box 
              component="img" 
              src={logoUrl} 
              alt="Logo" 
              sx={{ 
                width: '100%', 
                height: '100%',
                objectFit: 'contain'
              }} 
            />
          </Box>
        ) : (
          <>
            <BusinessIcon sx={{ mr: 1 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
              Requisitions App
            </Typography>
          </>
        )}
      </Toolbar>
      <Divider />
      
      {/* User Info in Drawer */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'background.default' }}>
        <Avatar 
          sx={{ width: 64, height: 64, mb: 1, bgcolor: 'secondary.main', fontSize: '1.5rem' }}
        >
          {user?.nom_complet?.charAt(0) || 'U'}
        </Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {user?.nom_complet}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {user?.role}
        </Typography>
      </Box>
      <Divider />

      <List sx={{ px: 2, py: 2 }}>
        {filteredMenuItems.map((item) => (
          <ListItemButton
            key={item.text}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setMobileOpen(false);
            }}
            selected={location.pathname === item.path}
            sx={{
              borderRadius: 2,
              mb: 1,
              '&.Mui-selected': {
                bgcolor: 'primary.light',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.main',
                },
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: location.pathname === item.path ? 'inherit' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
      
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <List sx={{ px: 2 }}>
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Déconnexion" primaryTypographyProps={{ fontWeight: 500 }} />
        </ListItemButton>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold', color: 'primary.main' }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Application'}
          </Typography>

          <Box>
            <Tooltip title="Paramètres du compte">
              <IconButton onClick={handleMenuOpen} size="small" sx={{ ml: 2 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  {user?.nom_complet?.charAt(0)}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              onClick={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={() => navigate(getProfilePath(user?.role))}>
                <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
                Mon Profil
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                Déconnexion
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid #e0e0e0' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          backgroundColor: '#f4f6f8',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
