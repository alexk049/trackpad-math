import { Routes, Route } from 'react-router-dom'
import EditorPage from './pages/EditorPage'
import SettingsLayout from './pages/SettingsLayout'
import OptionsPage from './pages/settings/Options'
import TrainingPage from './pages/settings/Training'

function App() {
  return (
    <Routes>
      <Route path="/" element={<EditorPage />} />
      <Route path="/settings" element={<SettingsLayout />}>
        <Route path="options" element={<OptionsPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route index element={<OptionsPage />} />
      </Route>
    </Routes>
  )
}
export default App
