"use client";

import { motion } from "framer-motion";
import { TrendingUp, Users, Clock, Award, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  {
    value: "99.9%",
    label: "Platform Uptime",
    icon: Clock,
    description: "Enterprise-grade reliability",
  },
  {
    value: "500+",
    label: "Active Sites",
    icon: Users,
    description: "Across 15 countries",
  },
  {
    value: "40%",
    label: "Cost Savings",
    icon: TrendingUp,
    description: "Average reduction",
  },
  {
    value: "2.5GW",
    label: "Managed Capacity",
    icon: Award,
    description: "And growing daily",
  },
];

const testimonials = [
  {
    quote: "VoltarisOS transformed our energy trading operations. The AI forecasting alone saved us €2M in the first year.",
    author: "Maria Santos",
    role: "CEO, GreenPower Iberia",
    avatar: "MS",
  },
  {
    quote: "The real-time optimization is incredible. We've seen a 35% improvement in battery efficiency since switching.",
    author: "Thomas Mueller",
    role: "CTO, EnergyStack GmbH",
    avatar: "TM",
  },
  {
    quote: "Best VPP platform we've evaluated. The interface is intuitive and the support team is exceptional.",
    author: "Sophie Laurent",
    role: "Director, SolarFrance",
    avatar: "SL",
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
    <section className="relative py-24 sm:py-32 overflow-hidden">
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
            <Award className="h-3.5 w-3.5" />
            <span className="font-medium">Trusted by Industry Leaders</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Proven results,{" "}
            <span className="text-gradient">real impact</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            Join hundreds of companies already transforming their energy operations with VoltarisOS.
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
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="group relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm p-6 text-center overflow-hidden"
              >
                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />
                
                <div className="relative z-10">
                  {/* Icon */}
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 mb-4">
                    <Icon className="h-5 w-5 text-primary-400" />
                  </div>
                  
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

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm p-6 overflow-hidden"
            >
              {/* Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />
              
              <div className="relative z-10">
                {/* Quote Icon */}
                <Quote className="h-8 w-8 text-primary-500/30 mb-4" />
                
                {/* Quote Text */}
                <p className="text-surface-300 mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                
                {/* Author */}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-600 text-sm font-semibold text-white">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {testimonial.author}
                    </div>
                    <div className="text-xs text-surface-500">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Logos/Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 text-center"
        >
          <p className="text-sm text-surface-500 mb-8">
            Trusted by leading energy companies worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
            {["Energia Corp", "GreenPower", "SolarTech", "WindCo", "BatteryPlus"].map((company) => (
              <div
                key={company}
                className="text-lg font-semibold text-surface-400 hover:text-surface-200 transition-colors"
              >
                {company}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}