import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Phone, ChevronRight, Stethoscope } from 'lucide-react';

export default function SelectClinic() {
  const { isAuthenticated, clinics, selectClinic } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSelectClinic = (clinicId: string) => {
    const clinic = clinics.find((c) => c.id === clinicId);
    if (clinic) {
      selectClinic(clinic);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Stethoscope className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ClinicFlow</h1>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Selecione uma Clínica</CardTitle>
            <CardDescription>
              Escolha a clínica em que deseja trabalhar hoje
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {clinics.map((clinic) => (
              <Button
                key={clinic.id}
                variant="outline"
                className="w-full h-auto p-4 justify-start hover:bg-accent hover:border-primary/30 transition-all"
                onClick={() => handleSelectClinic(clinic.id)}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent shrink-0">
                    <Building2 className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{clinic.name}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{clinic.address}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{clinic.phone}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
