import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";

import ProtectedRoute from "./components/ProtectedRoute";
import { LanguageSelector } from "./i18n";

function App() {

  return (
    <BrowserRouter>

      <LanguageSelector />

      <Routes>

        {/* Authentication */}

        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/doctor"
          element={
            <ProtectedRoute requiredRole="doctor">
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />


        {/* Patient */}

        <Route
          path="/patient"
          element={
            <ProtectedRoute
              requiredRole="patient"
            >
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;
