import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import HomeSoon from './pages/prod/HomeSoon.jsx'
import Login, { useSession } from './pages/prod/Login.jsx'
import Pokedex from './pages/prod/Pokedex.jsx'
import AbilitiesTab from './pages/prod/pokedex/AbilitiesTab.jsx'
import MovesTab from './pages/prod/pokedex/MovesTab.jsx'
import PokemonTab from './pages/prod/pokedex/PokemonTab.jsx'
import TypesTab from './pages/prod/pokedex/TypesTab.jsx'
import ReleaseNotes from './pages/prod/ReleaseNotes.jsx'
import MyRuns, { RunPage } from './pages/prod/my-runs/MyRuns.jsx'
import OverlayPage from './pages/prod/my-runs/OverlayPage.jsx'

/** Header + page frame for every normal page. Logged out: the login page instead. */
function Layout() {
  const session = useSession()
  if (session === undefined) return null
  if (!session) return <Login />
  return (
    <>
      <SiteHeader email={session?.user.email} />
      <main className="page">
        <Outlet />
      </main>
      <ScrollToTop />
    </>
  )
}

// Test playground (src/pages/test): only downloaded when opened, so prod never loads its code or styles.
const Test = lazy(() => import('./pages/test/Test.jsx'))
const loading = <p className="status">Loading…</p>

// "Dashboard" was renamed to "My runs": old links keep working.
function OldRunLink() {
  const { runName } = useParams()
  return <Navigate to={`/my-runs/${encodeURIComponent(runName)}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Stream overlay for OBS: no header, no login (it only reads), see-through background. */}
        <Route path="/overlay" element={<OverlayPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomeSoon />} />
          <Route path="/my-runs" element={<MyRuns />} />
          <Route path="/my-runs/:runName" element={<RunPage />} />
          <Route path="/dashboard" element={<Navigate to="/my-runs" replace />} />
          <Route path="/dashboard/run/:runName" element={<OldRunLink />} />
          <Route path="/release-notes" element={<ReleaseNotes />} />
          <Route path="/pokedex" element={<Pokedex />}>
            <Route index element={<PokemonTab />} />
            <Route path="types" element={<TypesTab />} />
            <Route path="types/:typeName" element={<TypesTab />} />
            <Route path="abilities" element={<AbilitiesTab />} />
            <Route path="abilities/:abilityName" element={<AbilitiesTab />} />
            <Route path="moves" element={<MovesTab />} />
          </Route>
          <Route path="/test" element={<Suspense fallback={loading}><Test /></Suspense>} />
          <Route path="/test/:project" element={<Suspense fallback={loading}><Test /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
