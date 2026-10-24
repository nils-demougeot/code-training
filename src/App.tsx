import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { checkRunner, initBrowserEngine } from './lib/engine'
import { useSettings } from './lib/settings'
import Dashboard from './pages/Dashboard'
import ExerciseList from './pages/ExerciseList'

const ExercisePage = lazy(() => import('./pages/ExercisePage'))
const Memory = lazy(() => import('./pages/Memory'))
const Review = lazy(() => import('./pages/Review'))
const Quiz = lazy(() => import('./pages/Quiz'))
const Labs = lazy(() => import('./pages/Labs'))
const LabPage = lazy(() => import('./pages/LabPage'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const Fiches = lazy(() => import('./pages/Fiches'))
const FichePage = lazy(() => import('./pages/FichePage'))
const Interview = lazy(() => import('./pages/Interview'))
const Profile = lazy(() => import('./pages/Profile'))
const DocPage = lazy(() => import('./pages/DocPage'))
const Design = lazy(() => import('./pages/Design'))
const DesignCasePage = lazy(() => import('./pages/DesignCasePage'))
const Stats = lazy(() => import('./pages/Stats'))
const Blocks = lazy(() => import('./pages/Blocks'))
const ParsonsPage = lazy(() => import('./pages/ParsonsPage'))

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
    </div>
  )
}

export default function App() {
  const engine = useSettings((s) => s.engine)

  useEffect(() => {
    // Warm up Python in the background so the first run feels instant.
    if (engine === 'browser') {
      const t = setTimeout(() => initBrowserEngine().catch(() => {}), 600)
      return () => clearTimeout(t)
    }
    checkRunner()
  }, [engine])

  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/exercices" element={<ExerciseList />} />
          <Route path="/exercices/:id" element={<ExercisePage />} />
          <Route path="/memoire" element={<Memory />} />
          <Route path="/memoire/revision" element={<Review />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/labs/:id" element={<LabPage />} />
          <Route path="/projets" element={<Projects />} />
          <Route path="/projets/:id" element={<ProjectPage />} />
          <Route path="/fiches" element={<Fiches />} />
          <Route path="/fiches/:id" element={<FichePage />} />
          <Route path="/entretien" element={<Interview />} />
          <Route path="/entretien/session" element={<Interview />} />
          <Route path="/doc" element={<DocPage />} />
          <Route path="/design" element={<Design />} />
          <Route path="/design/:id" element={<DesignCasePage />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/blocs" element={<Blocks />} />
          <Route path="/blocs/:id" element={<ParsonsPage />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
