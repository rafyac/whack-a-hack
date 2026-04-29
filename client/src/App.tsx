import { Routes, Route, Navigate } from 'react-router-dom';
import { PageShell } from './components/PageShell';
import LoginPage from './pages/LoginPage';
import VotePage from './pages/VotePage';
import ResultsPage from './pages/ResultsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<Navigate to="/vote" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/vote" element={<VotePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/vote" replace />} />
      </Routes>
    </PageShell>
  );
}
