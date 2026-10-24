// Route table: the 13 MVP pages (docs/11-build-layout.md §5.1).
import { Navigate, Route, Routes } from 'react-router';
import { ClinicianShell } from './components/ClinicianShell.jsx';
import { PatientShell } from './components/PatientShell.jsx';
import { PublicOnly, RequireRole, homeFor } from './components/RequireRole.jsx';
import { useAuth } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import CarePlan from './pages/patient/CarePlan.jsx';
import FollowUps from './pages/patient/FollowUps.jsx';
import Home from './pages/patient/Home.jsx';
import Medicines from './pages/patient/Medicines.jsx';
import ReportSymptom from './pages/patient/ReportSymptom.jsx';
import Dashboard from './pages/clinician/Dashboard.jsx';
import EscalationDetail from './pages/clinician/EscalationDetail.jsx';
import EscalationQueue from './pages/clinician/EscalationQueue.jsx';
import PatientDetail from './pages/clinician/PatientDetail.jsx';
import PatientList from './pages/clinician/PatientList.jsx';
import PlanEditor from './pages/clinician/PlanEditor.jsx';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<RequireRole role="patient" />}>
        <Route path="/p" element={<PatientShell />}>
          <Route index element={<Home />} />
          <Route path="plan" element={<CarePlan />} />
          <Route path="medicines" element={<Medicines />} />
          <Route path="report" element={<ReportSymptom />} />
          <Route path="followups" element={<FollowUps />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="clinician" />}>
        <Route path="/d" element={<ClinicianShell />}>
          <Route index element={<Dashboard />} />
          <Route path="escalations" element={<EscalationQueue />} />
          <Route path="escalations/:escalationId" element={<EscalationDetail />} />
          <Route path="patients" element={<PatientList />} />
          <Route path="patients/:patientId" element={<PatientDetail />} />
          <Route path="plans/new" element={<PlanEditor />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor(user) : '/login'} replace />} />
    </Routes>
  );
}
