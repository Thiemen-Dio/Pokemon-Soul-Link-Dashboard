import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import Home from './pages/Home.jsx'
import Pokedex from './pages/Pokedex.jsx'
import AbilitiesTab from './pages/pokedex/AbilitiesTab.jsx'
import MovesTab from './pages/pokedex/MovesTab.jsx'
import PokemonTab from './pages/pokedex/PokemonTab.jsx'
import TypesTab from './pages/pokedex/TypesTab.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <SiteHeader />
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pokedex" element={<Pokedex />}>
            <Route index element={<PokemonTab />} />
            <Route path="types" element={<TypesTab />} />
            <Route path="types/:typeName" element={<TypesTab />} />
            <Route path="abilities" element={<AbilitiesTab />} />
            <Route path="abilities/:abilityName" element={<AbilitiesTab />} />
            <Route path="moves" element={<MovesTab />} />
          </Route>
        </Routes>
      </main>
      <ScrollToTop />
    </BrowserRouter>
  )
}
