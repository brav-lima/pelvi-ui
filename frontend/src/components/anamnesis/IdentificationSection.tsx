import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatIsoDate } from '@/lib/gestational-age';
import { formatPhone } from '@/lib/formatters';
import { maritalStatusLabel } from '@/lib/marital-status';
import type { Patient } from '@/types/clinic';

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="text-[13.5px] font-medium">{value?.trim() ? value : 'Não informado'}</span>
    </div>
  );
}

/**
 * Patient data is read from the registry (never copied into the anamnesis).
 * Only the referral is stored with the assessment.
 */
export function IdentificationSection({
  patient, referral, onReferralChange, onEditPatient,
}: {
  patient?: Patient;
  referral: string;
  onReferralChange: (value: string) => void;
  onEditPatient: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Info label="Nome da paciente" value={patient?.name} />
        <Info label="Data de nascimento" value={formatIsoDate(patient?.birthDate?.slice(0, 10))} />
        <Info label="Telefone" value={patient?.phone ? formatPhone(patient.phone) : null} />
        <Info label="Profissão" value={patient?.occupation} />
        <Info label="Estado civil" value={maritalStatusLabel(patient?.maritalStatus)} />
      </div>
      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-[12px]" onClick={onEditPatient}>
        Editar cadastro da paciente
      </Button>
      <div className="space-y-2">
        <label htmlFor="identification-referral" className="block text-[12.5px] font-medium text-muted-foreground">
          Encaminhamento / profissional solicitante
        </label>
        <Input
          id="identification-referral"
          value={referral}
          onChange={(e) => onReferralChange(e.target.value)}
        />
      </div>
    </div>
  );
}
