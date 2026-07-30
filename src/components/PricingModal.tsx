// Upgrade / pricing modal — 4 plans (Free, Starter, Pro, Enterprise).

import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Rocket, Building2, X, Zap } from "lucide-react";
import { Modal } from "./Modal";
import { useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  icon: typeof Sparkles;
  highlight?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "Everything you need to manage one Buffer account.",
    icon: Sparkles,
    cta: "Current plan",
    features: [
      "1 Buffer account (BYOK)",
      "Live queue management",
      "Real-time analytics dashboard",
      "3 AI content templates",
      "Basic threshold alerts",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "₹499",
    period: "/ month",
    description: "For creators growing their presence across platforms.",
    icon: Zap,
    cta: "Upgrade to Starter",
    features: [
      "Everything in Free",
      "Unlimited AI content templates",
      "Smart scheduling recommendations",
      "Weekly performance reports (PDF + CSV)",
      "5 threshold alerts",
    ],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹1,499",
    period: "/ month",
    description: "For power users managing multiple channels and clients.",
    icon: Rocket,
    cta: "Upgrade to Pro",
    features: [
      "Everything in Starter",
      "3 Buffer accounts",
      "Advanced engagement trends",
      "Unlimited threshold alerts",
      "Priority email support",
      "Custom posting schedules",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For agencies and teams managing high-volume pipelines.",
    icon: Building2,
    cta: "Contact sales",
    features: [
      "Everything in Pro",
      "Unlimited Buffer accounts",
      "Team seats & roles",
      "Dedicated success manager",
      "SLA & uptime guarantees",
      "Custom integrations & API access",
    ],
  },
];

export function PricingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<string>("free");

  return (
    <Modal open={open} onClose={onClose} title="Upgrade Atlas" subtitle="Pick the plan that grows with you" maxWidth="max-w-5xl">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PLANS.map((plan, i) => (
          <PlanCard key={plan.id} plan={plan} index={i} selected={selected === plan.id} onSelect={() => setSelected(plan.id)} />
        ))}
      </div>
    </Modal>
  );
}

function PlanCard({ plan, index, selected, onSelect }: { plan: Plan; index: number; selected: boolean; onSelect: () => void }) {
  const Icon = plan.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      onClick={onSelect}
      className={`relative flex flex-col rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-accent/40 bg-accent/[0.04] shadow-glow"
          : plan.highlight
            ? "border-atlas-400/30 bg-atlas-400/[0.03] hover:border-atlas-400/50"
            : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]"
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-atlas-400 to-accent px-2.5 py-0.5 text-[10px] font-semibold text-black">
          POPULAR
        </span>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${plan.highlight ? "bg-atlas-400/15" : "bg-white/[0.06]"}`}>
          <Icon size={16} className={plan.highlight ? "text-atlas-300" : "text-white/70"} />
        </div>
        <span className="text-sm font-semibold text-white">{plan.name}</span>
      </div>

      <div className="mb-1">
        <span className="text-2xl font-semibold text-white tabular-nums">{plan.price}</span>
        {plan.period && <span className="text-xs text-white/40 ml-1">{plan.period}</span>}
      </div>
      <p className="text-xs text-white/50 mb-4 min-h-[32px]">{plan.description}</p>

      <ul className="space-y-2 mb-4 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-white/70">
            <Check size={13} className="text-accent mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div
        className={`w-full rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${
          plan.id === "free"
            ? "bg-white/[0.06] text-white/50 cursor-default"
            : selected
              ? "bg-white text-black"
              : "bg-white/[0.08] text-white hover:bg-white/[0.14]"
        }`}
      >
        {plan.cta}
      </div>
    </motion.button>
  );
}
