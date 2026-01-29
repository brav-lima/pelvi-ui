🔹 Organization (Clínica / Empresa)
id
name
cnpj (opcional)
settings (horários, duração padrão, etc)
👉 É o tenant do sistema

🔹 Person (Profissional / Médico / Fisio)
id
cpf (único global)
name
email
phone
active
❗ Importante: Person não pertence diretamente a uma clínica

🔹 OrganizationUser (Vínculo Profissional ↔ Clínica)
Resolve o problema do profissional em várias clínicas.
id
organization_id
person_id
role (admin, profissional, recepção)
permissions
active
📌 Essa tabela é chave para login e autorização

🔹 Patient
id
organization_id
name
cpf (opcional, nem todo paciente tem)
birth_date
contact
notes
Paciente sempre pertence a uma clínica.

🔹 Procedure
id
organization_id
name
duration_minutes
price
active

🔹 Appointment (Agenda)
id
organization_id
patient_id
professional_id (OrganizationUser)
procedure_id
start_at
end_at
status (scheduled, confirmed, canceled, done)
notes

🔹 Anamnese
id
patient_id
organization_id
professional_id
data (JSON ou campos estruturados)
created_at

🔹 Evolution (Evolução do paciente)
id
patient_id
organization_id
professional_id
appointment_id (opcional)
description
created_at

🔹 FinancialRecord (bem simples)
id
organization_id
patient_id
appointment_id
amount
type (income | expense)
status (pending | paid)
payment_method
created_at