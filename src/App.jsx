import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import HomeSoon from './pages/HomeSoon.jsx'
import Login, { useSession } from './pages/Login.jsx'
import Pokedex from './pages/Pokedex.jsx'
import AbilitiesTab from './pages/pokedex/AbilitiesTab.jsx'
import MovesTab from './pages/pokedex/MovesTab.jsx'
import PokemonTab from './pages/pokedex/PokemonTab.jsx'
import TypesTab from './pages/pokedex/TypesTab.jsx'
import ReleaseNotes from './pages/ReleaseNotes.jsx'
import Dashboard, { TestRun as DashboardRun } from './pages/test/Test.jsx'
import OverlayPage from './pages/test/OverlayPage.jsx'

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

// Old Test-tab links keep working.
function OldRunLink() {
  const { runName } = useParams()
  return <Navigate to={`/dashboard/run/${encodeURIComponent(runName)}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Stream overlay for OBS: no header, no login (it only reads), see-through background. */}
        <Route path="/overlay" element={<OverlayPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomeSoon />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/run/:runName" element={<DashboardRun />} />
          <Route path="/release-notes" element={<ReleaseNotes />} />
          <Route path="/pokedex" element={<Pokedex />}>
            <Route index element={<PokemonTab />} />
            <Route path="types" element={<TypesTab />} />
            <Route path="types/:typeName" element={<TypesTab />} />
            <Route path="abilities" element={<AbilitiesTab />} />
            <Route path="abilities/:abilityName" element={<AbilitiesTab />} />
            <Route path="moves" element={<MovesTab />} />
          </Route>
          <Route path="/test" element={<Navigate to="/dashboard" replace />} />
          <Route path="/test/run/:runName" element={<OldRunLink />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
