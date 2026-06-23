import { z } from 'zod';

// Escalas reutilizáveis
export const escala3 = z.enum(['UP', 'N', 'DOWN']);
export type Escala3 = z.infer<typeof escala3>;

export const presenca = z.enum(['PRESENTE', 'AUSENTE']);
export type Presenca = z.infer<typeof presenca>;

export const lateralidade = z.enum(['D>E', '=', 'E>D']);
export type Lateralidade = z.infer<typeof lateralidade>;

export const sinal = z.enum(['+', '-', 'N']);
export type Sinal = z.infer<typeof sinal>;

export const movDirecao = z.enum(['CRANIAL', 'PRESENTE', 'AUSENTE', 'CAUDAL']);
export type MovDirecao = z.infer<typeof movDirecao>;

export const tempoTriple = z.enum(['CRANIAL', 'AUSENTE', 'CAUDAL']);
export type TempoTriple = z.infer<typeof tempoTriple>;

const tempoBlock = z
  .object({
    main: tempoTriple.optional(),
    quando: z.enum(['ANTES', 'DURANTE', 'DEPOIS']).optional(),
  })
  .partial();

const superficialMuscle = z
  .object({
    atividade: presenca.optional(),
    assimetria: sinal.optional(),
  })
  .partial();

export const perinealAssessmentSchema = z.object({
  // 1. Inspeção Estática
  inspecaoEstatica: z
    .object({
      tonusBulbocav: z.enum(['<0.5', '=0.5', '>0.5']).optional(),
      corpoPerineal: z.enum(['<2', '=2', '>2']).optional(),
      aberturaUretral: z.enum(['+', '-']).optional(),
    })
    .partial()
    .optional(),

  // 2. Inspeção Dinâmica
  inspecaoDinamica: z
    .object({
      superficiais: z
        .object({
          isquiocavernosos: superficialMuscle,
          bulbocavernosos: superficialMuscle,
          transversosPerineais: superficialMuscle,
          esfincterAnalExterno: superficialMuscle,
        })
        .partial(),
      levantadores: z
        .object({
          contracaoMovCranial: movDirecao.optional(),
          coContracoes: z
            .array(
              z.enum([
                'RESPIRATORIOS',
                'ABDOMINAIS',
                'ADUTORES',
                'GLUTEOS',
                'AUSENTE',
              ]),
            )
            .optional(),
          relaxamentoMovCaudal: movDirecao.optional(),
          relaxamentoAtraso: sinal.optional(),
          abertura: movDirecao.optional(),
          preContracaoTosse: tempoBlock,
          preContracaoValsalva: tempoBlock,
        })
        .partial(),
      escapeIntraTeste: z
        .object({
          tosseUretral: z.boolean().optional(),
          tosseAnal: z.boolean().optional(),
          valsalvaUretral: z.boolean().optional(),
          valsalvaAnal: z.boolean().optional(),
          aberturaUretral: z.boolean().optional(),
          aberturaAnal: z.boolean().optional(),
        })
        .partial(),
    })
    .partial()
    .optional(),

  // 3. Testes Neurológicos
  testesNeurologicos: z
    .object({
      sensibilidade: z
        .object({
          quadriceps: lateralidade.optional(),
          adutores: lateralidade.optional(),
          isquiotibiais: lateralidade.optional(),
          pudendo: lateralidade.optional(),
          cutFemoral: lateralidade.optional(),
          ilioinguinal: lateralidade.optional(),
          iliohipogastrico: lateralidade.optional(),
        })
        .partial(),
      atividadeReflexa: z
        .object({
          clitoridianoE: escala3.optional(),
          clitoridianoD: escala3.optional(),
          cutaneoanal: escala3.optional(),
          cremasterico: escala3.optional(),
          levantadores: escala3.optional(),
        })
        .partial(),
      coccix: z
        .object({
          lateral: z.enum(['E', 'C', 'D']).optional(),
          sagital: z.enum(['ANT', 'N', 'PST']).optional(),
        })
        .partial(),
      tinel: z
        .object({
          direito: z.enum(['I', 'II', 'III', 'IV']).optional(),
          direitoSacro: z.enum(['S2', 'S3', 'S4']).optional(),
          esquerdo: z.enum(['I', 'II', 'III', 'IV']).optional(),
          esquerdoSacro: z.enum(['S2', 'S3', 'S4']).optional(),
        })
        .partial(),
    })
    .partial()
    .optional(),

  // 4. Palpação Estática (Anatomia Palpatória 3D®)
  palpacaoEstatica: z
    .object({
      trofismo: escala3.optional(),
      superficiais: sinal.optional(),
      rabdo: escala3.optional(),
      pubovaginalPuboperineal: z
        .object({
          tonus: escala3.optional(),
          sinal: sinal.optional(),
        })
        .partial(),
      puboanal: escala3.optional(),
      puborretal: escala3.optional(),
      iliococcigeos: escala3.optional(),
      piriformes: escala3.optional(),
      obturadores: escala3.optional(),
      musculaturaSuperficial: z.string().optional(),
      rabdosfincter: z.string().optional(),
      musculaturaProfunda: z.string().optional(),
      rotadoresQuadril: z.string().optional(),
      tecidosConectivosSuperficiais: z.string().optional(),
      tecidosConnectivosProfundos: z.string().optional(),
    })
    .partial()
    .optional(),

  // 5. Palpação Dinâmica
  palpacaoDinamica: z
    .object({
      movimento: z.enum(['COMPLETO', 'PVS_PR_ICS', 'PVS_PR', 'PVS', 'AUSENTE']).optional(),
      relaxamento: z.enum(['COMPLETO', 'INCOMPLETO', 'PARCIAL_DOWN', 'PARCIAL_UP', 'AUSENTE']).optional(),
      relaxamentoAtraso: z.enum(['+', '-']).optional(),
      abertura: movDirecao.optional(),
      forca: z.enum(['FORTE', 'RAZOAVEL', 'FRACO', 'ESBOCO', 'AUSENTE']).optional(),
      potencia: z.enum(['GT20', 'DE20A11', 'DE10A6', 'DE4A1', 'ZERO']).optional(),
      endurance: z.enum(['GT10S', 'DE9A7S', 'DE6A4S', 'DE3A1S', 'ZERO']).optional(),
      involuntariaTosse: tempoBlock,
      involuntariaValsalva: tempoBlock,
      simetria: lateralidade.optional(),
    })
    .partial()
    .optional(),

  // 6. Diagnóstico
  diagnostico: z
    .object({
      classificacoes: z
        .array(
          z.enum([
            'IMPERCEBIDO',
            'HIPERTONICO',
            'HIPERATIVO',
            'HIPOTROFICO',
            'HIPOTONICO',
            'INCOORDENADO',
            'DESPROGRAMADO',
          ]),
        )
        .optional(),
      superficiaisDetalhe: z
        .object({
          bc: escala3.optional(),
          ic: escala3.optional(),
          tp: escala3.optional(),
          eas: escala3.optional(),
          rbd: escala3.optional(),
        })
        .partial(),
      levantadoresDetalhe: z
        .object({
          pv: escala3.optional(),
          pp: escala3.optional(),
          pa: escala3.optional(),
          pr: escala3.optional(),
          ic: escala3.optional(),
        })
        .partial(),
      rotadoresDetalhe: z
        .object({
          piriformes: escala3.optional(),
          obturadores: escala3.optional(),
        })
        .partial(),
      observacoes: z.string().optional(),
    })
    .partial()
    .optional(),
});

export type PerinealAssessmentFormData = z.infer<typeof perinealAssessmentSchema>;

export const STEP_TITLES = [
  '1. Inspeção Estática',
  '2. Inspeção Dinâmica',
  '3. Testes Neurológicos',
  '4. Palpação Estática',
  '5. Palpação Dinâmica',
  '6. Diagnóstico cinesiológico funcional',
] as const;
