import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireAdmin } from "./components/Guards";
import Login from "./pages/Login";
import Assessment from "./pages/Assessment";
import Result from "./pages/Result";
import Invites from "./pages/admin/Invites";
import Candidates from "./pages/admin/Candidates";
import CandidateReport from "./pages/admin/CandidateReport";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/assessment" element={<RequireAuth><Assessment /></RequireAuth>} />
      <Route path="/result" element={<RequireAuth><Result /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><Invites /></RequireAdmin>} />
      <Route path="/admin/candidates" element={<RequireAdmin><Candidates /></RequireAdmin>} />
      <Route path="/admin/candidates/:id" element={<RequireAdmin><CandidateReport /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/assessment" replace />} />
    </Routes>
  );
}
