import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import Login from "./pages/Login";
import SelectClinic from "./pages/SelectClinic";
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/Agenda";
import Patients from "./pages/Patients";
import PatientProfile from "./pages/PatientProfile";
import Professionals from "./pages/Professionals";
import Procedures from "./pages/Procedures";
import Anamnesis from "./pages/Anamnesis";
import Evolutions from "./pages/Evolutions";
import Financial from "./pages/Financial";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/select-clinic" element={<SelectClinic />} />
              
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/patients/:id" element={<PatientProfile />} />
                <Route path="/professionals" element={<ProtectedRoute roles={['ADMIN']}><Professionals /></ProtectedRoute>} />
                <Route path="/procedures" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><Procedures /></ProtectedRoute>} />
                <Route path="/anamnesis" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><Anamnesis /></ProtectedRoute>} />
                <Route path="/evolutions" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><Evolutions /></ProtectedRoute>} />
                <Route path="/financial" element={<ProtectedRoute roles={['ADMIN']}><Financial /></ProtectedRoute>} />
              </Route>

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
