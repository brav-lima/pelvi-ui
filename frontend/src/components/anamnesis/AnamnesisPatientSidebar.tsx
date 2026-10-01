import type { JSX } from 'react';
import { Card } from '@/components/ui/card';
import { formatCPFMasked } from '@/lib/formatters';
import type { Patient, TreatmentPackage } from '@/types/clinic';

export interface AnamnesisShortcut {
  icon: JSX.Element;
  label: string;
  to: string;
}

export function AnamnesisPatientSidebar({
  patient, activePackage, shortcuts, onNavigate,
}: {
  patient?: Patient;
  activePackage?: TreatmentPackage;
  shortcuts: AnamnesisShortcut[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-4">
      <Card>
        <div className="px-4 py-3 border-b border-border">
          <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Paciente</div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {patient && (
            <>
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0"
                  style={{
                    background: 'hsl(296 30% 94%)',
                    color: 'hsl(296 28% 26%)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {patient.name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                </div>
                <div>
                  <div className="text-[13.5px] font-medium">{patient.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {patient.birthDate
                      ? `${Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 86400000))} anos`
                      : '—'}
                    {patient.cpf && ` · ${formatCPFMasked(patient.cpf)}`}
                  </div>
                </div>
              </div>
              {activePackage && (
                <div className="border-t border-border pt-3 flex flex-col gap-0.5">
                  <div className="text-[11.5px] text-muted-foreground">Pacote</div>
                  <div className="text-[13px] font-medium">
                    {activePackage.name} · {activePackage.usedSessions}/{activePackage.totalSessions}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {shortcuts.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Atalhos de avaliação
            </div>
          </div>
          <div className="p-3 flex flex-col gap-1">
            {shortcuts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.to)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full text-left"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
