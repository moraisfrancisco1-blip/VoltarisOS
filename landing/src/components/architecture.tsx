"use client";

import { motion } from "framer-motion";
import { ArrowRight, Cpu, Cloud, Monitor, Zap, Database, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    title: "Hardware de Campo",
    description: "Sensores, inversores, baterias e carregadores EV comunicam via Modbus, CAN Bus, MQTT ou OPC-UA com gateways edge locais.",
    icon: Cpu,
    color: "from-yellow-500 to-orange-600",
    items: ["Painéis solares", "Baterias & BMS", "Carregadores EV", "Medidores IEC 61724"],
  },
  {
    number: "02",
    title: "VoltarisOS Core",
    description: "O motor de IA processa telemetria, executa otimização MILP e faz previsões em tempo real. Toda a lógica de negócio centralizada e segura.",
    icon: Cloud,
    color: "from-primary-500 to-accent-600",
    items: ["Previsão por IA", "Otimização MILP", "Agregação de dados", "Trading automatizado"],
  },
  {
    number: "03",
    title: "Dashboard Railway",
    description: "Interface web moderna com visualização em tempo real, relatórios e controlo remoto de todos os ativos. Aceda de qualquer lugar.",
    icon: Monitor,
    color: "from-green-500 to-emerald-600",
    items: ["Dashboard ao vivo", "Alertas configuráveis", "Relatórios PDF/CSV", "API REST aberta"],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function Architecture() {
  return (
    <section id="arquitetura" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-primary-500/3 rounded-full blur-[150px]" />
        {/* Grid Background */}
        <div className="absolute inset-0 grid-pattern opacity-20" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm text-primary-300 mb-6">
            <Zap className="h-3.5 w-3.5" />
            <span className="font-medium">Como Funciona</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Do hardware ao dashboard{" "}
            <span className="text-gradient">em 3 passos</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            Uma arquitetura modular e escalável que conecta o campo ao utilizador final 
            com segurança, baixa latência e inteligência em cada camada.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative"
        >
          {/* Connecting Line (desktop only) */}
          <div className="hidden md:block absolute top-1/3 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-yellow-500/30 via-primary-500/50 to-green-500/30" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="group relative"
              >
                {/* Arrow Connector (mobile) */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center mb-6">
                    <ArrowRight className="h-6 w-6 text-surface-700 rotate-90" />
                  </div>
                )}

                <div className="relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm overflow-hidden hover:border-primary-500/30 transition-all">
                  {/* Hover Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />

                  <div className="p-8 relative z-10">
                    {/* Step Number */}
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-5xl font-bold font-display text-surface-700 group-hover:text-primary-500/20 transition-colors">
                        {step.number}
                      </span>
                      {/* Step Connector Dot */}
                      <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-full border-2 border-surface-700 bg-surface-900 group-hover:border-primary-500/50 transition-colors">
                        <div className={cn(
                          "w-3 h-3 rounded-full bg-gradient-to-br",
                          step.color
                        )} />
                      </div>
                    </div>

                    {/* Icon */}
                    <div className={cn(
                      "flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br shadow-lg mb-5",
                      step.color
                    )}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-semibold text-white mb-3">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-surface-400 leading-relaxed mb-5">
                      {step.description}
                    </p>

                    {/* Items */}
                    <div className="space-y-2 border-t border-surface-700/50 pt-4">
                      {step.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-primary-400 flex-shrink-0" />
                          <span className="text-xs text-surface-400">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}