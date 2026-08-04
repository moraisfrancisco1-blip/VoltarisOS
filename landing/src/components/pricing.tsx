"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap, Star, Building2, Home, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Home",
    description: "Para instalações residenciais pequenas",
    icon: Home,
    monthlyPrice: 69,
    yearlyPrice: 55,
    color: "#10b981",
    features: [
      "1 site",
      "Até 50 kWh",
      "Monitoramento básico",
      "Suporte por email",
      "Dashboard padrão",
    ],
    cta: "Começar",
    popular: false,
  },
  {
    name: "Starter",
    description: "Para operações em crescimento",
    icon: Zap,
    monthlyPrice: 279,
    yearlyPrice: 223,
    color: "#6366f1",
    features: [
      "5 sites",
      "Até 500 kWh",
      "AI forecasting básico",
      "Suporte prioritário",
      "Analytics avançado",
      "API access",
    ],
    cta: "Começar",
    popular: true,
  },
  {
    name: "Pro",
    description: "Para operações com AI avançada",
    icon: Rocket,
    monthlyPrice: 1099,
    yearlyPrice: 879,
    color: "#f59e0b",
    features: [
      "20 sites",
      "AI avançada",
      "Trading automatizado",
      "Otimização em tempo real",
      "Integrações customizadas",
      "Colaboração em equipe",
      "Suporte 24/7",
    ],
    cta: "Começar",
    popular: false,
  },
  {
    name: "Enterprise",
    description: "Para grandes operações com white-label",
    icon: Building2,
    monthlyPrice: 3999,
    yearlyPrice: 3199,
    color: "#ec4899",
    features: [
      "Sites ilimitados",
      "White-label completo",
      "Modelos AI customizados",
      "SLA garantido",
      "Deploy on-premise",
      "Treinamento dedicado",
      "Gerente de conta",
    ],
    cta: "Contactar Vendas",
    popular: false,
  },
];

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-primary-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm text-primary-300 mb-6">
            <Star className="h-3.5 w-3.5" />
            <span className="font-medium">Preços Simples</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Escolha o seu{" "}
            <span className="text-gradient">plano</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            Comece grátis com o plano Beta. Todos os planos incluem 14 dias de teste gratuito.
          </p>

          {/* Billing Toggle */}
          <div className="mt-10 flex items-center justify-center gap-4">
            <span className={cn(
              "text-sm font-medium transition-colors",
              !isYearly ? "text-white" : "text-surface-500"
            )}>
              Mensal
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative h-7 w-14 rounded-full bg-surface-800 border border-surface-700 transition-colors hover:border-primary-500/50"
            >
              <motion.div
                animate={{ x: isYearly ? 28 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 h-5 w-5 rounded-full bg-gradient-to-r from-primary-500 to-accent-600 shadow-lg"
              />
            </button>
            <span className={cn(
              "text-sm font-medium transition-colors",
              isYearly ? "text-white" : "text-surface-500"
            )}>
              Anual
            </span>
            {isYearly && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full bg-green-500/10 border border-green-500/30 px-3 py-1 text-xs font-medium text-green-400"
              >
                Poupe 20%
              </motion.span>
            )}
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn(
                  "group relative rounded-2xl border p-6 overflow-hidden",
                  plan.popular
                    ? "border-primary-500/50 bg-gradient-to-b from-primary-500/10 to-surface-900/50"
                    : "border-surface-700/50 bg-surface-900/50"
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 blur-md opacity-50" />
                      <div className="relative rounded-bl-xl bg-gradient-to-r from-primary-500 to-accent-600 px-3 py-1 text-xs font-semibold text-white">
                        Mais Popular
                      </div>
                    </div>
                  </div>
                )}

                {/* Glow Effect for Popular */}
                {plan.popular && (
                  <div className="absolute -inset-px bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-2xl blur-sm opacity-20 animate-gradient bg-[length:200%_200%]" />
                )}

                <div className="relative z-10">
                  {/* Icon */}
                  <div 
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4"
                    style={{ background: `${plan.color}20`, border: `1px solid ${plan.color}40` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: plan.color }} />
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-lg font-bold text-white mb-1">
                    {plan.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-surface-400 mb-4">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">
                        €{price}
                      </span>
                      <span className="text-surface-500 text-sm">/mês</span>
                    </div>
                    {isYearly && (
                      <p className="mt-1 text-xs text-surface-500">
                        Faturado anualmente
                      </p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-xl py-2.5 px-4 text-sm font-semibold transition-all duration-300 mb-6"
                    style={{
                      background: plan.popular 
                        ? `linear-gradient(to right, ${plan.color}, ${plan.color}dd)` 
                        : `${plan.color}15`,
                      color: plan.popular ? "white" : plan.color,
                      border: plan.popular ? "none" : `1px solid ${plan.color}40`,
                      boxShadow: plan.popular ? `0 10px 30px ${plan.color}25` : "none",
                    }}
                  >
                    {plan.cta}
                  </motion.button>

                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <div 
                          className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: `${plan.color}20` }}
                        >
                          <Check className="h-2.5 w-2.5" style={{ color: plan.color }} />
                        </div>
                        <span className="text-xs text-surface-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Beta Plan CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
              <Star className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Plano Beta Gratuito</p>
              <p className="text-xs text-surface-400">Acesso antecipado com código beta necessário</p>
            </div>
            <a
              href="#"
              className="ml-4 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
            >
              Solicitar Acesso
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}