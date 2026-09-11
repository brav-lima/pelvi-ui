-- Desvincula evoluções duplicadas na mesma consulta (mantém a mais recente).
-- Não apaga nenhuma evolução; apenas zera o vínculo das excedentes.
UPDATE "evolutions"
SET "appointment_id" = NULL
WHERE "appointment_id" IS NOT NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("appointment_id") "id"
    FROM "evolutions"
    WHERE "appointment_id" IS NOT NULL
    ORDER BY "appointment_id", "evolution_date" DESC, "created_at" DESC, "id" DESC
  );

-- CreateIndex
CREATE UNIQUE INDEX "evolutions_appointment_id_key" ON "evolutions"("appointment_id");
