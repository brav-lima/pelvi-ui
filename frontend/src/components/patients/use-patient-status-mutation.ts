import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientsApi } from '@/lib/api';
import type { PatientStatus } from '@/types/clinic';

/**
 * Centraliza a troca de status (ACTIVE/INACTIVE) de um paciente:
 * chama PATCH /patients/:id, invalida as listagens que dependem do status
 * e dá o feedback via toast. Usado pelo perfil do paciente e pela listagem.
 */
export function usePatientStatusMutation(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: PatientStatus) => patientsApi.update(patientId, { status }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-select'] });
      toast.success(
        status === 'INACTIVE' ? 'Paciente marcado como inativo' : 'Paciente reativado',
      );
    },
    onError: () => toast.error('Erro ao alterar status do paciente'),
  });
}
