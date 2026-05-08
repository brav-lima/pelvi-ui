import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const meta: Meta<typeof PageHeader> = {
  title: "Composite/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "Pacientes",
    description: "Gerencie os pacientes da sua clínica.",
  },
};

export const WithAction: Story = {
  args: {
    title: "Pacientes",
    description: "Gerencie os pacientes da sua clínica.",
    actions: <Button><Plus />Novo paciente</Button>,
  },
};

export const WithMultipleActions: Story = {
  args: {
    title: "Agenda",
    description: "Visualize e gerencie consultas.",
    actions: (
      <>
        <Button variant="outline">Hoje</Button>
        <Button><Plus />Novo agendamento</Button>
      </>
    ),
  },
};

export const TitleOnly: Story = {
  args: { title: "Configurações" },
};
