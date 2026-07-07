import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ChevronRight, Stethoscope } from 'lucide-react';
import { formatCNPJ } from '@/lib/formatters';

export default function SelectClinic() {
  const { user, selectedClinic, clinics, selectClinic, switchClinic } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Mid-session switch when a clinic is already selected; otherwise this is
  // the post-login pick (selectedClinic is null until the user chooses).
  const availableClinics = clinics.filter((c) => c.id !== selectedClinic?.id);

  const handleSelectClinic = async (organizationId: string) => {
    setLoading(organizationId);
    const success = selectedClinic
      ? await switchClinic(organizationId)
      : await selectClinic(organizationId);
    if (success) {
      navigate('/dashboard');
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Stethoscope className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            <span className="font-medium opacity-50">Sou</span>{' '}
            <span className="text-primary">Pelvi</span>
          </h1>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Selecione uma Clínica</CardTitle>
            <CardDescription>
              Escolha a clínica em que deseja trabalhar hoje
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableClinics.map((clinic) => (
              <Button
                key={clinic.id}
                variant="outline"
                className="w-full h-auto p-4 justify-start hover:bg-accent hover:border-primary/30 transition-all"
                onClick={() => handleSelectClinic(clinic.id)}
                disabled={loading !== null}
              >
                <div className="flex items-center gap-4 w-full">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent shrink-0">
                    <Building2 className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{clinic.name}</p>
                    {clinic.cnpj && (
                      <p className="text-sm text-muted-foreground mt-1">
                        CNPJ: {formatCNPJ(clinic.cnpj)}
                      </p>
                    )}
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
