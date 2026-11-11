
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './features/auth/Login'
import Signup from './features/auth/Signup'
import Onboarding from './features/profile/Onboarding'
import JobSubmission from './features/jobs/JobSubmission'
import JobResults from './features/jobs/JobResults'

function ProfilePage() {
  const { user, signOut } = useAuth()

  async function handleLogout() {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Welcome to KariyalyAI!</h1>
      <p>You are logged in as {user?.email}</p>

      <button
        onClick={handleLogout}
        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Log out
      </button>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/app/profile" element={<ProfilePage />} />

          <Route path="/app/jobs/new" element={<JobSubmission />} />
          <Route path="/app/jobs/:id" element={<JobResults />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
