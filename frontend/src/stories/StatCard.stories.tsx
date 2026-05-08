import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCard } from "@/components/ui/stat-card";
import { Users, DollarSign, Calendar, TrendingUp } from "lucide-react";

const meta: Meta<typeof StatCard> = {
  title: "Composite/StatCard",
  component: StatCard,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    title: "Pacientes ativos",
    value: 142,
    icon: Users,
  },
  render: (args) => (
    <div className="w-72">
      <StatCard {...args} />
    </div>
  ),
};

export const WithCurrency: Story = {
  args: {
    title: "Receita do mês",
    value: "R$ 12.450,00",
    description: "Abril de 2026",
    icon: DollarSign,
  },
  render: (args) => (
    <div className="w-72">
      <StatCard {...args} />
    </div>
  ),
};

export const WithTrend: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-2xl">
      <StatCard
        title="Receita"
        value="R$ 18.230,00"
        icon={TrendingUp}
        trend={{ value: 12, positive: true }}
      />
      <StatCard
        title="Cancelamentos"
        value={3}
        icon={Calendar}
        trend={{ value: 8, positive: false }}
      />
    </div>
  ),
};

export const Dashboard: Story = {
  name: "Grid (Dashboard)",
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
      <StatCard title="Consultas hoje" value={8} icon={Calendar} />
      <StatCard title="Pacientes ativos" value={142} icon={Users} />
      <StatCard
        title="Receita"
        value="R$ 12.450,00"
        icon={DollarSign}
        trend={{ value: 12, positive: true }}
      />
      <StatCard
        title="Pendente"
        value="R$ 3.200,00"
        icon={DollarSign}
      />
    </div>
  ),
};
