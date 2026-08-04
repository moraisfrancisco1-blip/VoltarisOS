"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize2, Zap, TrendingUp, Battery, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function VideoShowcase() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  // Simulate video progress
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 0.5));
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <section id="video" className="relative py-24 sm:py-32 overflow-hidden">
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
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="font-medium">Product Walkthrough</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            See it in{" "}
            <span className="text-gradient">action</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            Watch how VoltarisOS transforms energy management in less than 60 seconds.
            From AI forecasting to automated trading — all in one platform.
          </p>
        </motion.div>

        {/* Video Player */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Glow Border */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-2xl blur-lg opacity-30 animate-gradient bg-[length:200%_200%]" />
          
          {/* Video Container */}
          <div className="relative rounded-2xl border border-surface-700/50 bg-surface-900 overflow-hidden shadow-2xl">
            {/* Demo Content - Animated Dashboard Simulation */}
            <div className="relative aspect-video bg-surface-950">
              {/* Animated Dashboard Demo */}
              <div className="absolute inset-0 p-6 sm:p-8">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">VoltarisOS Dashboard</div>
                      <div className="text-xs text-surface-500">Real-time energy optimization</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-400">
                      <Activity className="h-3 w-3" />
                      <span className="animate-pulse">Live</span>
                    </div>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Power Output", value: "2.4", unit: "MW", change: "+12%", icon: Zap },
                    { label: "Grid Demand", value: "1.8", unit: "MW", change: "-5%", icon: Activity },
                    { label: "Battery SOC", value: "78", unit: "%", change: "+3%", icon: Battery },
                    { label: "Revenue", value: "12.4", unit: "K€", change: "+18%", icon: TrendingUp },
                  ].map((metric, index) => {
                    const Icon = metric.icon;
                    return (
                      <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="rounded-xl border border-surface-700/50 bg-surface-800/50 p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-3 w-3 text-primary-400" />
                          <span className="text-xs text-surface-500">{metric.label}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <motion.span
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                            className="text-lg font-bold text-white"
                          >
                            {metric.value}
                          </motion.span>
                          <span className="text-xs text-surface-500">{metric.unit}</span>
                        </div>
                        <div className={cn(
                          "text-xs font-medium mt-1",
                          metric.change.startsWith("+") ? "text-green-400" : "text-red-400"
                        )}>
                          {metric.change}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Main Chart Area */}
                <div className="rounded-xl border border-surface-700/50 bg-surface-800/30 p-4 h-[45%]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-surface-300">Power Forecast vs Actual</div>
                    <div className="flex gap-2">
                      <div className="rounded-md bg-primary-500/10 px-2 py-0.5 text-xs text-primary-400">24h</div>
                      <div className="rounded-md bg-surface-700/50 px-2 py-0.5 text-xs text-surface-500">7d</div>
                    </div>
                  </div>
                  
                  {/* Animated Chart */}
                  <div className="relative h-[calc(100%-2rem)]">
                    <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="chartGradient2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-accent-500)" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="var(--color-accent-500)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid Lines */}
                      {[0, 25, 50, 75, 100].map((y) => (
                        <line
                          key={y}
                          x1="0"
                          y1={y}
                          x2="400"
                          y2={y}
                          stroke="var(--color-surface-700)"
                          strokeWidth="0.5"
                          strokeDasharray="4 4"
                        />
                      ))}
                      
                      {/* Forecast Line (Actual) */}
                      <motion.path
                        d="M0,80 C30,75 60,60 100,55 C140,50 180,40 220,45 C260,50 300,35 340,30 C370,28 390,32 400,35"
                        fill="none"
                        stroke="var(--color-primary-500)"
                        strokeWidth="2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: isPlaying ? 1 : progress / 100 }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                      />
                      <motion.path
                        d="M0,80 C30,75 60,60 100,55 C140,50 180,40 220,45 C260,50 300,35 340,30 C370,28 390,32 400,35 L400,120 L0,120 Z"
                        fill="url(#chartGradient1)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isPlaying ? 0.5 : progress / 200 }}
                        transition={{ duration: 1 }}
                      />
                      
                      {/* Actual Line (Forecast) */}
                      <motion.path
                        d="M0,85 C30,80 60,65 100,60 C140,55 180,45 220,50 C260,55 300,40 340,35 C370,33 390,37 400,40"
                        fill="none"
                        stroke="var(--color-accent-500)"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: isPlaying ? 1 : progress / 100 }}
                        transition={{ duration: 2, ease: "easeInOut", delay: 0.3 }}
                      />
                      <motion.path
                        d="M0,85 C30,80 60,65 100,60 C140,55 180,45 220,50 C260,55 300,40 340,35 C370,33 390,37 400,40 L400,120 L0,120 Z"
                        fill="url(#chartGradient2)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isPlaying ? 0.3 : progress / 300 }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                      
                      {/* Animated Data Point */}
                      <motion.circle
                        cx={progress * 4}
                        cy={50 - Math.sin(progress * 0.1) * 20}
                        r="4"
                        fill="var(--color-primary-500)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isPlaying ? 1 : 0 }}
                      />
                      <motion.circle
                        cx={progress * 4}
                        cy={50 - Math.sin(progress * 0.1) * 20}
                        r="8"
                        fill="var(--color-primary-500)"
                        opacity="0.3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isPlaying ? 0.3 : 0, scale: [1, 1.5, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    </svg>
                    
                    {/* Legend */}
                    <div className="absolute bottom-0 left-0 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-4 rounded bg-primary-500" />
                        <span className="text-surface-400">Actual</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-4 rounded bg-accent-500 opacity-60" />
                        <span className="text-surface-400">Forecast</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-surface-950/90 to-transparent">
                {/* Progress Bar */}
                <div className="mb-3 h-1 w-full rounded-full bg-surface-700/50 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4 text-white" />
                      ) : (
                        <Play className="h-4 w-4 text-white fill-current ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4 text-white" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-white" />
                      )}
                    </button>
                    <span className="text-xs text-surface-400">
                      {Math.floor(progress * 0.6)}s / 60s
                    </span>
                  </div>
                  <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <Maximize2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Subtitle / Value Props */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-surface-400 text-sm">
            ✨ See how our AI engine processes 10,000+ data points per second to optimize your energy portfolio
          </p>
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            "AI Forecasting",
            "Real-time Optimization",
            "Automated Trading",
            "Grid Balancing",
          ].map((feature) => (
            <div
              key={feature}
              className="rounded-full border border-surface-700/50 bg-surface-800/50 px-4 py-2 text-sm text-surface-300"
            >
              {feature}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}