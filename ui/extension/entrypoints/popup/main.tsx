import React from 'react'
import { createRoot } from 'react-dom/client'
import { Popup } from '@/popup/Popup'
import '@/styles/popup.css'

const root = document.getElementById('root')!
createRoot(root).render(<Popup />)
