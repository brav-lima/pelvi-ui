# 🏥 Clinic Scheduler – Project Overview

## 1. Visão Geral

Este projeto consiste em um **sistema web de agendamento e gestão clínica**, voltado para clínicas de pequeno e médio porte (ex.: fisioterapia, psicologia, clínica médica), com foco em:

* Agenda da clínica
* Gestão de profissionais
* Gestão de pacientes
* Registro clínico (anamnese e evolução)
* Controle financeiro simples

O sistema será **multi-clínica (multi-tenant)**, permitindo que um mesmo profissional atue em mais de uma clínica usando o **mesmo CPF**, escolhendo o contexto da clínica após o login.

O foco inicial é **usabilidade, clareza de domínio e arquitetura evolutiva**, evitando complexidade desnecessária.

---

## 2. Objetivos do Sistema

* Centralizar o agendamento e prontuário do paciente
* Facilitar a rotina de profissionais e recepção
* Garantir isolamento de dados por clínica
* Servir como base para evolução futura (SaaS)

---

## 3. Requisitos Funcionais

### 3.1 Autenticação

* Login via **CPF + senha**
* Um CPF pode estar vinculado a **múltiplas clínicas**
* Após login, o usuário deve:

  * Entrar diretamente se houver apenas uma clínica
  * Ou escolher a clínica, se houver mais de uma

### 3.2 Agenda da Clínica

* Visualização por:

  * Dia
  * Semana
  * Mês
* Agendamentos por profissional
* Status do agendamento:

  * Agendado
  * Confirmado
  * Cancelado
  * Realizado

### 3.3 Gestão de Profissionais

* Cadastro de profissionais
* Vínculo do profissional com a clínica
* Definição de papéis:

  * Admin
  * Profissional
  * Recepção
* Visualização de horários de trabalho

### 3.4 Gestão de Pacientes

* Cadastro de pacientes por clínica
* Busca e listagem
* Perfil do paciente contendo:

  * Dados básicos
  * Histórico de agendamentos
  * Anamnese
  * Evoluções

### 3.5 Procedimentos

* Cadastro de procedimentos por clínica
* Informações:

  * Nome
  * Duração
  * Valor
  * Status ativo/inativo

### 3.6 Anamnese

* Registro estruturado
* Vinculada ao paciente e à clínica
* Associada ao profissional responsável
* Deve permitir leitura clara e impressão

### 3.7 Evolução do Paciente

* Registro contínuo da evolução clínica
* Visualização em formato de **timeline**
* Cada registro contém:

  * Data
  * Profissional
  * Descrição

### 3.8 Controle Financeiro (Simples)

* Registro de entradas e saídas
* Vínculo com:

  * Paciente
  * Agendamento (quando aplicável)
* Status:

  * Pendente
  * Pago
* Visão mensal resumida

---

## 4. Requisitos Não Funcionais

* Aplicação Web responsiva
* Interface clara e profissional
* Dados isolados por clínica
* Backend autoritativo
* Escalável para SaaS

---

## 5. Modelo de Domínio (Conceitual)

### 5.1 Organization (Clínica)

Representa a clínica / empresa.

* id
* name
* settings

---

### 5.2 Person (Usuário / Profissional)

Entidade global, identificada por CPF.

* id
* cpf (único)
* name
* email
* active

---

### 5.3 OrganizationUser (Vínculo)

Relaciona uma pessoa a uma clínica.

* id
* organization_id
* person_id
* role
* permissions
* active

---

### 5.4 Patient

Paciente pertence a uma única clínica.

* id
* organization_id
* name
* cpf (opcional)
* birth_date
* contact

---

### 5.5 Procedure

Procedimentos oferecidos pela clínica.

* id
* organization_id
* name
* duration_minutes
* price
* active

---

### 5.6 Appointment

Agendamento clínico.

* id
* organization_id
* patient_id
* professional_id
* procedure_id
* start_at
* end_at
* status
* notes

---

### 5.7 Anamnese

Registro inicial ou periódico do paciente.

* id
* organization_id
* patient_id
* professional_id
* data
* created_at

---

### 5.8 Evolution

Evolução clínica contínua.

* id
* organization_id
* patient_id
* professional_id
* appointment_id (opcional)
* description
* created_at

---

### 5.9 FinancialRecord

Controle financeiro básico.

* id
* organization_id
* patient_id
* appointment_id
* amount
* type (income | expense)
* status
* payment_method
* created_at

---

## 6. Arquitetura Técnica (Visão Geral)

* Frontend Web (SPA)
* Backend API
* Banco de dados relacional

### Princípios

* Multi-tenant por `organization_id`
* Autorização baseada em papel e clínica
* Contexto da clínica definido no login

---

## 7. Frontend – Diretrizes de UI/UX

* Layout SaaS moderno
* Sidebar de navegação
* Top bar com clínica ativa
* Light/Dark mode
* Estados de loading e empty states
* Modais para criação/edição

---

## 8. Escopo Inicial (MVP)

1. Autenticação + seleção de clínica
2. Agenda da clínica
3. Cadastro de pacientes
4. Cadastro de profissionais
5. Procedimentos
6. Evolução do paciente
7. Financeiro simples

---

## 9. Observações Finais

Este documento serve como **fonte de verdade do domínio e visão do produto**, devendo ser utilizado como base para:

* Desenvolvimento frontend
* Desenvolvimento backend
* Geração de código assistida por IA (ex.: Claude)
* Evolução futura para modelo SaaS

O sistema deve priorizar clareza, simplicidade e boa experiência do usuário, evitando complexidade prematura.