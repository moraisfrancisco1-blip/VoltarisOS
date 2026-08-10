"use client";

import { motion } from "framer-motion";
import { Award, Cpu, Plug, Radio, Gauge, Sun, Database } from "lucide-react";
import { cn } from "@/lib/utils";

const hardwareItems = [
  {
    title: "Inversores Híbridos",
    description: "Compatível com Huawei, Sungrow, GoodWe, SMA e outros protocolos Modbus/RTU e TCP.",
    icon: Plug,
  },
  {
    title: "Medidores de Campo",
    description: "Integração com medidores bidirecionais, piranómetros e sensores meteorológicos IEC 61724.",
    icon: Gauge,
  },
  {
    title: "Carregadores EV",
    description: "Suporte para Wallbox, Zappi, ChargePoint e protocolos OCPP 1.6/2.0.",
    icon: Plug,
  },
  {
    title: "BMS & Baterias",
    description: "Monitorização de SOC, SOH e ciclos para baterias LFP, NMC — CAN Bus e RS485.",
    icon: Database,
  },
  {
    title: "Comunicação IoT",
    description: "Gateways edge com MQTT, LoRaWAN e OPC-UA para telemetria redundante.",
    icon: Radio,
  },
  {
    title: "Certificado & Seguro",
    description: "Cifra TLS 1.3, RBAC, autenticação 2FA e audit trail completo para compliance.",
    icon: Award,
  },
];

const stats = [
  {
    value: "250+",
    label: "Hardware Compatível",
    description: "Dispositivos testados e certificados",
  },
  {
    value: "< 100ms",
    label: "Latência de Campo",
    description: "Telemetria em tempo real",
  },
  {
    value: "99.9%",
    label: "Disponibilidade",
    description: "Infraestrutura redundante",
  },
  {
    value: "+40%",
    label: "Poupança Média",
    description: "Redução de custos operacionais",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function SocialProof() {
  return (
    <section id="beneficios" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-500/5 rounded-full blur-[120px]" />
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
            <Cpu className="h-3.5 w-3.5" />
            <span className="font-medium">Compatibilidade e Transparência</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Hardware que{" "}
            <span className="text-gradient">conhece e confia</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            O VoltarisOS integra-se com os principais fabricantes de inversores, medidores, baterias e 
            carregadores EV. Zero vendor lock-in, total transparência.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-20"
        >
          {stats.map((stat) => {
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="group relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm p-6 text-center overflow-hidden"
              >
                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />
                
                <div className="relative z-10">
                  {/* Value */}
                  <div className="text-3xl sm:text-4xl font-bold text-gradient mb-2">
                    {stat.value}
                  </div>
                  
                  {/* Label */}
                  <div className="text-sm font-medium text-white mb-1">
                    {stat.label}
                  </div>
                  
                  {/* Description */}
                  <div className="text-xs text-surface-500">
                    {stat.description}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Hardware Partners Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {hardwareItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm p-6 overflow-hidden hover:border-primary-500/30 transition-all"
              >
                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 mb-4">
                    <Icon className="h-5 w-5 text-primary-400" />
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-base font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}