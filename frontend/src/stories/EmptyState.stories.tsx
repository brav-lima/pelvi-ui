import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Calendar, FileQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";

const meta: Meta<typeof EmptyState> = {
  title: "Composite/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: Users,
    title: "Nenhum paciente cadastrado",
    description: "Comece adicionando o primeiro paciente da sua clínica.",
    action: { label: "Cadastrar paciente", onClick: () => alert("clicked") },
  },
};

export const WithoutAction: Story = {
  args: {
    icon: Calendar,
    title: "Nenhum agendamento hoje",
    description: "Aproveite para revisar os prontuários ou descansar.",
  },
};

export const InsideCard: Story = {
  render: () => (
    <Card className="w-96">
      <EmptyState
        icon={FileQuestion}
        title="Sem evoluções registradas"
        description="As evoluções aparecerão aqui em ordem cronológica."
        action={{ label: "Registrar evolução", onClick: () => {} }}
      />
    </Card>
  ),
};
