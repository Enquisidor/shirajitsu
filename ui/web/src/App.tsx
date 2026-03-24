import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { DashboardPage } from './pages/DashboardPage'
import { ApiKeysPage } from './pages/ApiKeysPage'
import { UsagePage } from './pages/UsagePage'
import { RegistryPage } from './pages/RegistryPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/registry" element={<RegistryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </SignedIn>
    </>
  )
}
