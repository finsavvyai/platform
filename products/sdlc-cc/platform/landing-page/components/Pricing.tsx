import { motion } from "framer-motion";
import { Check, Shield } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { PricingPlan } from "../types";

const Pricing = () => {
  const plans: PricingPlan[] = [
    {
      name: "Developer",
      price: "Free",
      description: "For individual builders and proof-of-concept teams.",
      features: [
        "1M protected chunks / month",
        "1K RPS envelope",
        "Core redaction rules",
        "Standard audit log",
        "Community support",
        "Single seat",
      ],
      lemonsqueezyId: "SDLC_Developer",
    },
    {
      name: "Startup",
      price: "$99",
      description: "For production teams that need controls and speed.",
      features: [
        "50M protected chunks / month",
        "10K RPS envelope",
        "Advanced redaction + policy packs",
        "Extended audit evidence",
        "Email support",
        "10 seats",
        "Slack integration",
      ],
      highlighted: true,
      lemonsqueezyId: "SDLC_Startup",
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For regulated orgs with advanced governance requirements.",
      features: [
        "Unlimited throughput",
        "Dedicated architecture review",
        "HIPAA / FINRA controls",
        "Custom SLA",
        "Private deployment options",
        "White-label + advanced integrations",
      ],
      lemonsqueezyId: "SDLC_Enterprise",
    },
  ];

  const handleSubscribe = (planName: string) => {
    if (planName === "Enterprise") {
      window.location.href = "/checkout/enterprise";
      return;
    }
    if (planName === "Startup") {
      window.location.href = "/checkout/startup";
      return;
    }
    window.location.href = "/checkout/developer";
  };

  return (
    <section id="pricing" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            Pricing with clear guardrails
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            Choose a plan that matches your data volume, governance model, and
            rollout speed.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className={plan.highlighted ? "md:-translate-y-2" : ""}
            >
              <Card
                className={`h-full ${plan.highlighted ? "ring-2 ring-primary/30" : ""}`}
              >
                {plan.highlighted && (
                  <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary mb-4">
                    <Shield className="h-3.5 w-3.5" />
                    Recommended
                  </div>
                )}

                <h3 className="text-2xl font-semibold text-slate-900 mb-1">
                  {plan.name}
                </h3>
                <div className="text-4xl font-bold tracking-tight text-slate-950 mb-2">
                  {plan.price}
                </div>
                <p className="text-slate-600 mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.name)}
                  variant={plan.highlighted ? "primary" : "secondary"}
                  size="lg"
                  className="w-full"
                >
                  {plan.name === "Enterprise" ? "Contact sales" : "Get started"}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center text-sm text-slate-600">
          SOC2 architecture, GDPR-ready controls, and audit trails are available
          on every tier.
        </div>
      </div>
    </section>
  );
};

export default Pricing;
