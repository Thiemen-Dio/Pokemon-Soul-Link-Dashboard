// Test playground: a clean sheet to try new ideas on before they go to prod (src/pages/prod).
// Same database as prod: anything that saves here changes the real runs.
import { Navigate } from 'react-router-dom'

export default function Test() {
  return (
    <section className="home-soon">
      <h2>Test</h2>
      <p className="status">A clean sheet. New ideas show up here first.</p>
    </section>
  )
}

/** Old /test/run/... links go back to the empty Test page. */
export function TestRun() {
  return <Navigate to="/test" replace />
}
