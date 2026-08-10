"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  Shield,
  BatteryCharging,
  Gauge,
  Lock,
  Server,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Telemetria em Tempo Real",
    description: "Monitorização contínua de todos os ativos energéticos com latência inferior a 100ms. Visualize painéis solares, baterias e carregadores EV num único dashboard unificado.",
    icon: Activity,
    size: "large",
    gradient: "from-primary-500 to-cyan-600",
    highlights: [
      { icon: Gauge, text: "Latência < 100ms" },
      { icon: Eye, text: "Dashboard unificado" },
      { icon: Activity, text: "Alertas inteligentes" },
    ],
  },
  {
    title: "Otimização Dinâmica de Cargas",
    description: "Algoritmos MILP que otimizam o despacho de baterias e o carregamento de VE a cada 5 minutos, maximizando autoconsumo e minimizando custos de rede.",
    icon: BatteryCharging,
    size: "medium",
    gradient: "from-green-500 to-emerald-600",
    highlights: [
      { icon: Brain, text: "Otimização MILP a cada 5 min" },
      { icon: Gauge, text: "Autoconsumo maximizado" },
      { icon: BatteryCharging, text: "Gestão inteligente de EV" },
    ],
  },
  {
    title: "Arquitetura Robusta e Segura",
    description: "Controlo de acesso granular (RBAC), autenticação de dois fatores, cifra TLS 1.3 e audit trail completo. Infraestrutura redundante com 99,9% de disponibilidade.",
    icon: Shield,
    size: "medium",
    gradient: "from-purple-500 to-violet-600",
    highlights: [
      { icon: Lock, text: "RBAC + 2FA + TLS 1.3" },
      { icon: Server, text: "99,9% disponibilidade" },
      { icon: Eye, text: "Audit trail completo" },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
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

export function BentoFeatures() {
  return (
    <section id="funcionalidades" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-primary-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-accent-500/5 rounded-full blur-[100px]" />
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
            <Activity className="h-3.5 w-3.5" />
            <span className="font-medium">Funcionalidades Técnicas</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Tecnologia de ponta para{" "}
            <span className="text-gradient">gerir energia</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            Três pilares fundamentais que transformam dados de campo em decisões inteligentes 
            para o seu portefólio energético descentralizado.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isLarge = feature.size === "large";

            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className={cn(
                  "group relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm p-8 overflow-hidden transition-all duration-300 hover:border-primary-500/30 hover:bg-surface-800/50",
                  isLarge && "lg:col-span-1 lg:row-span-1"
                )}
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />
                
                {/* Content */}
                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon */}
                  <div className={cn(
                    "flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br shadow-lg mb-6",
                    feature.gradient
                  )}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-surface-400 leading-relaxed flex-1 mb-6">
                    {feature.description}
                  </p>

                  {/* Highlights */}
                  {feature.highlights && (
                    <div className="space-y-3 border-t border-surface-700/50 pt-5">
                      {feature.highlights.map((highlight, idx) => {
                        const HiIcon = highlight.icon;
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500/10">
                              <HiIcon className="h-4 w-4 text-primary-400" />
                            </div>
                            <span className="text-sm text-surface-300">{highlight.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Corner Accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}