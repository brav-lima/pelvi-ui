import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatusBadge, type DomainStatus } from "@/components/ui/status-badge";

const meta: Meta<typeof StatusBadge> = {
  title: "Primitives/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: [
        "SCHEDULED", "CONFIRMED", "CANCELED", "DONE",
        "ACTIVE", "COMPLETED",
        "PENDING", "PAID",
        "INCOME", "EXPENSE",
      ] satisfies DomainStatus[],
    },
  },
  args: { status: "SCHEDULED" },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Default: Story = {};

export const Appointment: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="SCHEDULED" />
      <StatusBadge status="CONFIRMED" />
      <StatusBadge status="CANCELED" />
      <StatusBadge status="DONE" />
    </div>
  ),
};

export const TreatmentPackage: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="ACTIVE" />
      <StatusBadge status="COMPLETED" />
      <StatusBadge status="CANCELED" />
    </div>
  ),
};

export const Financial: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="PENDING" />
      <StatusBadge status="PAID" />
      <StatusBadge status="INCOME" />
      <StatusBadge status="EXPENSE" />
    </div>
  ),
};

export const AllDomains: Story = {
  name: "Todos os domínios",
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Appointment</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="SCHEDULED" />
          <StatusBadge status="CONFIRMED" />
          <StatusBadge status="CANCELED" />
          <StatusBadge status="DONE" />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Treatment Package</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="ACTIVE" />
          <StatusBadge status="COMPLETED" />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Financial Status</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="PENDING" />
          <StatusBadge status="PAID" />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Financial Type</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="INCOME" />
          <StatusBadge status="EXPENSE" />
        </div>
      </div>
    </div>
  ),
};
