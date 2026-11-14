import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Admin from './Admin.jsx';
import SellerPortal from './SellerPortal.jsx';
import './style.css';
const path = window.location.pathname.replace(/\/$/,'');
const Root = path === '/admin' ? Admin : path === '/seller' ? SellerPortal : App;
createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);