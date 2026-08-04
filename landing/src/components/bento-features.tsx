"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Brain,
  LineChart,
  Shield,
  Battery,
  Globe,
  Clock,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "AI-Powered Forecasting",
    description: "Neural networks process weather, market, and grid data for 95%+ accurate predictions.",
    icon: Brain,
    size: "large",
    gradient: "from-primary-500 to-blue-600",
    metrics: { value: "95%", label: "Accuracy" },
  },
  {
    title: "Real-time Optimization",
    description: "MILP algorithms optimize battery dispatch every 5 minutes.",
    icon: Zap,
    size: "medium",
    gradient: "from-accent-500 to-purple-600",
    metrics: { value: "5min", label: "Interval" },
  },
  {
    title: "Energy Trading",
    description: "Automated bidding on day-ahead and intraday markets.",
    icon: TrendingUp,
    size: "medium",
    gradient: "from-green-500 to-emerald-600",
    metrics: { value: "+40%", label: "Revenue" },
  },
  {
    title: "Grid Services",
    description: "Participate in frequency regulation and demand response programs.",
    icon: Globe,
    size: "small",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    title: "Battery Health",
    description: "Advanced degradation models extend battery lifespan by 30%.",
    icon: Battery,
    size: "small",
    gradient: "from-orange-500 to-red-600",
  },
  {
    title: "99.9% Uptime",
    description: "Enterprise-grade infrastructure with automatic failover.",
    icon: Shield,
    size: "small",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    title: "Analytics Dashboard",
    description: "Comprehensive insights with customizable widgets and reports.",
    icon: BarChart3,
    size: "medium",
    gradient: "from-pink-500 to-rose-600",
    metrics: { value: "50+", label: "Metrics" },
  },
  {
    title: "24/7 Monitoring",
    description: "Round-the-clock system monitoring with instant alerts.",
    icon: Clock,
    size: "small",
    gradient: "from-yellow-500 to-orange-600",
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

export function BentoFeatures() {
  return (
    <section id="features" className="relative py-24 sm:py-32 overflow-hidden">
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
            <Zap className="h-3.5 w-3.5" />
            <span className="font-medium">Powerful Features</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Everything you need to{" "}
            <span className="text-gradient">dominate energy markets</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            A complete platform for Virtual Power Plant management, from forecasting to trading.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isLarge = feature.size === "large";
            const isMedium = feature.size === "medium";

            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className={cn(
                  "group relative rounded-2xl border border-surface-700/50 bg-surface-900/50 backdrop-blur-sm p-6 overflow-hidden transition-all duration-300 hover:border-primary-500/30 hover:bg-surface-800/50",
                  isLarge && "md:col-span-2 lg:col-span-2 lg:row-span-2",
                  isMedium && "md:col-span-1 lg:col-span-2"
                )}
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-accent-500/0 group-hover:from-primary-500/5 group-hover:to-accent-500/5 transition-all duration-500" />
                
                {/* Content */}
                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon */}
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br shadow-lg",
                    feature.gradient
                  )}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-sm text-surface-400 flex-1">
                    {feature.description}
                  </p>

                  {/* Metrics (if available) */}
                  {feature.metrics && (
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gradient">
                        {feature.metrics.value}
                      </span>
                      <span className="text-xs text-surface-500">
                        {feature.metrics.label}
                      </span>
                    </div>
                  )}

                  {/* Visual Element for Large Card */}
                  {isLarge && (
                    <div className="mt-6 relative h-40 rounded-xl border border-surface-700/30 bg-surface-800/30 overflow-hidden">
                      {/* Simulated Neural Network Visualization */}
                      <svg className="w-full h-full" viewBox="0 0 400 160">
                        <defs>
                          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="var(--color-primary-500)" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0.2" />
                          </linearGradient>
                        </defs>
                        {/* Neural Network Lines */}
                        {[...Array(8)].map((_, i) => (
                          <path
                            key={i}
                            d={`M${50 + i * 40},80 Q${150 + i * 20},${40 + i * 10} ${350},${80 + (i % 3 - 1) * 20}`}
                            fill="none"
                            stroke="url(#lineGradient)"
                            strokeWidth="1"
                            opacity={0.3 + (i % 3) * 0.2}
                          />
                        ))}
                        {/* Nodes */}
                        {[...Array(5)].map((_, i) => (
                          <circle
                            key={`node-${i}`}
                            cx={80 + i * 70}
                            cy={80 + (i % 2 === 0 ? -10 : 10)}
                            r="4"
                            fill="var(--color-primary-500)"
                            opacity={0.6}
                          />
                        ))}
                      </svg>
                      {/* Animated Pulse */}
                      <motion.div
                        animate={{ x: ["0%", "100%", "0%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute top-0 left-0 w-20 h-full bg-gradient-to-r from-transparent via-primary-500/20 to-transparent"
                      />
                    </div>
                  )}
                </div>

                {/* Corner Accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}