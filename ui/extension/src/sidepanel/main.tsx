import { createRoot } from 'react-dom/client'
import { Sidebar } from '../sidebar/Sidebar'
import '../styles/sidebar.css'

createRoot(document.getElementById('root')!).render(<Sidebar />)
