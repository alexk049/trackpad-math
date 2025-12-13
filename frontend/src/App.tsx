import { Routes, Route } from 'react-router-dom'
import EditorPage from './pages/EditorPage'
import SettingsLayout from './pages/SettingsLayout'
import AppearancePage from './pages/settings/Appearance'
import OptionsPage from './pages/settings/Options'
import TrainingPage from './pages/settings/Training'
import DataViewerPage from './pages/settings/DataViewer'

function App() {
  return (
    <Routes>
      <Route path="/" element={<EditorPage />} />
      <Route path="/settings" element={<SettingsLayout />}>
        <Route path="appearance" element={<AppearancePage />} />
        <Route path="options" element={<OptionsPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="dataviewer" element={<DataViewerPage />} />
        {/* Default redirect or show something? */}
        <Route index element={<AppearancePage />} />
      </Route>
    </Routes>
  )
}
export default App
