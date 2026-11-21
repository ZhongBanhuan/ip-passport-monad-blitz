import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../app/ui/workspace';
import '../app/styles.css';
const page=location.pathname.replace(/\/$/,'').split('/').pop();
const view=page==='verify'||page==='author'?page:'check';
createRoot(document.getElementById('root')).render(<Workspace view={view}/>);

