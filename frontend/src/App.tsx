import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import EditorPage from './pages/EditorPage'
import OptionsPage from './pages/settings/Options'
import TrainingPage from './pages/settings/Training'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<EditorPage />} />
        <Route path="/settings/options" element={<OptionsPage />} />
        <Route path="/settings/training" element={<TrainingPage />} />
        <Route path="/settings" element={<OptionsPage />} />
      </Route>
    </Routes>
  )
}
export default App
