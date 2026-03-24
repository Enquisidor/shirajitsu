import React from 'react'
import { createRoot } from 'react-dom/client'
import { Sidebar } from '@/sidebar/Sidebar'
import '@/styles/sidebar.css'

const root = document.getElementById('root')!
createRoot(root).render(<Sidebar />)
