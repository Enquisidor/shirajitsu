import React from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={clerkPublishableKey}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ClerkProvider>,
)
