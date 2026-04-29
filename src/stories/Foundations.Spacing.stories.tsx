import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = {
  title: "Foundations/Spacing",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

const SCALE = [
  { name: "0",   px: 0 },
  { name: "0.5", px: 2 },
  { name: "1",   px: 4 },
  { name: "1.5", px: 6 },
  { name: "2",   px: 8 },
  { name: "3",   px: 12 },
  { name: "4",   px: 16 },
  { name: "5",   px: 20 },
  { name: "6",   px: 24 },
  { name: "8",   px: 32 },
  { name: "10",  px: 40 },
  { name: "12",  px: 48 },
  { name: "16",  px: 64 },
];

export const Scale: Story = {
  render: () => (
    <div className="space-y-2 max-w-2xl">
      {SCALE.map((s) => (
        <div key={s.name} className="flex items-center gap-4">
          <span className="text-xs font-medium text-muted-foreground w-16 tabular-nums">space-{s.name}</span>
          <div style={{ width: Math.max(s.px, 1), height: 24 }} className="bg-primary rounded" />
          <span className="text-xs text-muted-foreground tabular-nums">{s.px}px</span>
        </div>
      ))}
    </div>
  ),
};

const RADIUS = [
  { name: "sm",   classes: "rounded-sm",   px: 6 },
  { name: "md",   classes: "rounded-md",   px: 8 },
  { name: "lg",   classes: "rounded-lg",   px: 10 },
  { name: "xl",   classes: "rounded-xl",   px: 12 },
  { name: "full", classes: "rounded-full", px: 9999 },
];

export const Radius: Story = {
  render: () => (
    <div className="flex gap-6 flex-wrap">
      {RADIUS.map((r) => (
        <div key={r.name} className="flex flex-col items-center gap-2">
          <div className={`w-24 h-24 bg-primary ${r.classes}`} />
          <span className="text-xs font-medium text-foreground">{r.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{r.px === 9999 ? "9999" : r.px} px</span>
        </div>
      ))}
    </div>
  ),
};

const SHADOWS = [
  { name: "shadow-1", desc: "Card" },
  { name: "shadow-2", desc: "Sticky / destaque" },
  { name: "shadow-3", desc: "Popover / Dropdown" },
  { name: "shadow-4", desc: "Modal / Sheet" },
];

export const Elevation: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 max-w-xl">
      {SHADOWS.map((s) => (
        <div key={s.name} className="flex flex-col items-center gap-3">
          <div className={`w-32 h-24 bg-card border border-border rounded-lg ${s.name}`} />
          <div className="text-center">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </div>
        </div>
      ))}
    </div>
  ),
};
