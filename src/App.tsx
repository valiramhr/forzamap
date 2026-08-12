import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireAdmin } from "./components/Guards";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import StartInvite from "./pages/StartInvite";
import Assessment from "./pages/Assessment";
import ParadoxAssessment from "./pages/ParadoxAssessment";
import CandidateLanding from "./pages/CandidateLanding";
import Result from "./pages/Result";
import Invites from "./pages/admin/Invites";
import Candidates from "./pages/admin/Candidates";
import CandidateReport from "./pages/admin/CandidateReport";
import PreviewParadox from "./pages/PreviewParadox";

function DefaultRoute() {
  const { session, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  // a candidate goes to whatever they have been assigned
  return <CandidateLanding />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Unguarded: an invite link is opened by someone with no session, and the
          token in the path is the credential it is opened with. */}
      <Route path="/start/:token" element={<StartInvite />} />
      <Route path="/assessment" element={<RequireAuth><Assessment /></RequireAuth>} />
      <Route path="/paradox" element={<RequireAuth><ParadoxAssessment /></RequireAuth>} />
      <Route path="/result" element={<RequireAuth><Result /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><Invites /></RequireAdmin>} />
      <Route path="/admin/candidates" element={<RequireAdmin><Candidates /></RequireAdmin>} />
      <Route path="/admin/assignments/:id" element={<RequireAdmin><CandidateReport /></RequireAdmin>} />
      {/* Layout preview for the Paradox Profile — mock data, no database, but it
          renders the full report, so it is admin-only like every other report. */}
      <Route path="/preview/paradox" element={<RequireAdmin><PreviewParadox /></RequireAdmin>} />
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  );
}
