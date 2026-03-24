import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const { user } = useUser()

  return (
    <main>
      <h1>Welcome, {user?.firstName ?? 'there'}</h1>
      <nav>
        <Link to="/api-keys">API Keys</Link>
        <Link to="/usage">Usage</Link>
        <Link to="/registry">Source Registry</Link>
      </nav>
    </main>
  )
}
