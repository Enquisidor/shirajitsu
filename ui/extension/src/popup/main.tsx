import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/chrome-extension'
import { Popup } from './Popup'
import '../styles/popup.css'

// Validate ClerkPublishableKey at startup.
// The extension MUST NOT start a Clerk SDK instance if this value is undefined
// or malformed (does not begin with "pk_"). Invariant: ClerkPublishableKey.
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

if (!clerkPublishableKey || !clerkPublishableKey.startsWith('pk_')) {
  throw new Error(
    '[Shirajitsu] VITE_CLERK_PUBLISHABLE_KEY is missing or invalid. ' +
      'Set a valid Clerk publishable key (must start with "pk_") in your .env file before building.',
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <Popup />
    </ClerkProvider>
  </StrictMode>,
)
