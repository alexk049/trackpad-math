import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import EditorPage from './pages/EditorPage'
import OptionsPage from './pages/Options'
import TrainingPage from './pages/Training'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route element={<MainLayout />}>
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/options" element={<OptionsPage />} />
        <Route path="/training" element={<TrainingPage />} />
      </Route>
    </Routes>
  )
}
export default App
