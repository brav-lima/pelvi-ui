import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useFeature } from "@/contexts/SubscriptionContext";
import { Loader2 } from "lucide-react";
import type { PlanFeature } from "@/types/clinic";

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
const Settings = lazy(() => import("./pages/Settings"));
const PerinealAssessmentPage = lazy(() => import("./pages/PerinealAssessmentPage"));
const AnamnesisEditorPage = lazy(() => import("./pages/AnamnesisEditorPage"));
const Documents = lazy(() => import("./pages/Documents"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function FeatureRoute({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const allowed = useFeature(feature);
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
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
                    <Route path="/agenda" element={<FeatureRoute feature="AGENDA"><Agenda /></FeatureRoute>} />
                    <Route path="/patients" element={<FeatureRoute feature="PATIENTS"><Patients /></FeatureRoute>} />
                    <Route path="/patients/:id" element={<FeatureRoute feature="PATIENTS"><PatientProfile /></FeatureRoute>} />
                    <Route path="/patients/:patientId/perineal-assessment/new" element={<FeatureRoute feature="PERINEAL_ASSESSMENT"><PerinealAssessmentPage /></FeatureRoute>} />
                    <Route path="/patients/:patientId/perineal-assessment/:assessmentId" element={<FeatureRoute feature="PERINEAL_ASSESSMENT"><PerinealAssessmentPage /></FeatureRoute>} />
                    <Route path="/patients/:patientId/anamnesis/new" element={<FeatureRoute feature="ANAMNESIS"><AnamnesisEditorPage /></FeatureRoute>} />
                    <Route path="/patients/:patientId/anamnesis/:anamnesisId" element={<FeatureRoute feature="ANAMNESIS"><AnamnesisEditorPage /></FeatureRoute>} />
                    <Route path="/professionals" element={<ProtectedRoute roles={['ADMIN']}><FeatureRoute feature="MULTI_PROFESSIONAL"><Professionals /></FeatureRoute></ProtectedRoute>} />
                    <Route path="/procedures" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><Procedures /></ProtectedRoute>} />
                    <Route path="/anamnesis" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><FeatureRoute feature="ANAMNESIS"><Anamnesis /></FeatureRoute></ProtectedRoute>} />
                    <Route path="/evolutions" element={<ProtectedRoute roles={['ADMIN', 'PROFESSIONAL']}><FeatureRoute feature="EVOLUTIONS"><Evolutions /></FeatureRoute></ProtectedRoute>} />
                    <Route path="/financial" element={<ProtectedRoute roles={['ADMIN']}><FeatureRoute feature="FINANCIAL_BASIC"><Financial /></FeatureRoute></ProtectedRoute>} />
                    <Route path="/documents" element={<FeatureRoute feature="DOCUMENTS"><Documents /></FeatureRoute>} />
                    <Route path="/settings" element={<ProtectedRoute roles={['ADMIN']}><Settings /></ProtectedRoute>} />
                  </Route>

                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
