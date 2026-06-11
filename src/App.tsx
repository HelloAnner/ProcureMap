import React from 'react';
import { Routes, Route, Navigate, MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { WorkspacePage } from '@/pages/WorkspacePage';
import { NewAnalysisPage } from '@/pages/NewAnalysisPage';
import { ProcessingPage } from '@/pages/ProcessingPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { MyAnalysesPage } from '@/pages/MyAnalysesPage';
import './styles/global.css';

const App: React.FC = () => {
  return (
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/new-analysis" element={<NewAnalysisPage />} />
          <Route path="/processing/:taskId" element={<ProcessingPage />} />
          <Route path="/my-analyses" element={<MyAnalysesPage />} />
          <Route path="/results/:taskId" element={<ResultsPage />} />
          <Route path="/results/:taskId/company/:creditCode" element={<ResultsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Routes>
    </MemoryRouter>
  );
};

export default App;
