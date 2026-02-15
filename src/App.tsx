import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/Login"));
const SelectClinic = lazy(() => import("./pages/SelectClinic"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientProfile = lazy(() => import("./pages/PatientProfile"));
const Professionals = lazy(() => import("./pages/Professionals"));
const Procedures = lazy(() => import("./pages/Procedures"));
const Anamnesis = lazy(() => import("./pages/Anamnesis"));
const Evolutions = lazy(() => import("./pages/Evolutions"));
const Financial = lazy(() => import("./pages/Financial"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
