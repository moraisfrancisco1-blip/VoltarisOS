"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Play, ArrowRight, Sparkles, Zap, Shield, Activity } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Grid Pattern */}
        <div className="absolute inset-0 grid-pattern opacity-30" />
        
        {/* Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] bg-accent-500/10 rounded-full blur-[100px]" />
        
        {/* Floating Orbs */}
        <motion.div
          animate={{ y: [-20, 20, -20], x: [-10, 10, -10] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/4 w-2 h-2 bg-primary-400 rounded-full shadow-glow"
        />
        <motion.div
          animate={{ y: [20, -20, 20], x: [10, -10, 10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-2/3 right-1/3 w-3 h-3 bg-accent-400 rounded-full shadow-glow"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative mb-8"
          >
            <div className="relative flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm text-primary-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-medium">v2.0 is live — AI-Powered Forecasting</span>
            </div>
            {/* Shimmer effect on badge */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-shimmer bg-[length:300%_100%] animate-shimmer" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-5xl text-5xl font-bold font-display tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl"
          >
            <span className="block">The Future of</span>
            <span className="block mt-2 text-gradient-hero">
              Energy Intelligence
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg text-surface-400 sm:text-xl"
          >
            VoltarisOS is the next-generation Virtual Power Plant platform that combines 
            AI forecasting, real-time optimization, and automated trading to maximize 
            your energy portfolio performance.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center gap-4"
          >
            {/* Primary CTA with Glow */}
            <motion.a
              href="#pricing"
              className="relative group w-full sm:w-auto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full blur-lg opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-600 rounded-full shadow-xl shadow-primary-500/25">
                Start Free Trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.a>

            {/* Secondary CTA - Watch Demo */}
            <motion.a
              href="#video"
              className="group flex items-center gap-3 px-6 py-4 text-base font-medium text-surface-300 hover:text-white transition-colors w-full sm:w-auto justify-center"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-700 bg-surface-800/50 group-hover:border-primary-500/50 group-hover:bg-primary-500/10 transition-all">
                <Play className="h-4 w-4 fill-current" />
              </div>
              Watch Demo
            </motion.a>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
          >
            {[
              { value: "99.9%", label: "Uptime" },
              { value: "500+", label: "Active Sites" },
              { value: "40%", label: "Cost Savings" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-white sm:text-3xl">
                  {stat.value}
                </div>
                <div className="text-sm text-surface-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Hero Visual - 3D Tilt Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative mt-20 w-full max-w-5xl"
          >
            <div
              ref={cardRef}
              className="relative"
              style={{
                transform: `perspective(1000px) rotateY(${mousePosition.x * 5}deg) rotateX(${-mousePosition.y * 5}deg)`,
                transition: "transform 0.1s ease-out",
              }}
            >
              {/* Glow Border Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-2xl blur-lg opacity-50 animate-gradient bg-[length:200%_200%]" />
              
              {/* Dashboard Mockup Container */}
              <div className="relative rounded-2xl border border-surface-700/50 bg-surface-900/90 backdrop-blur-xl overflow-hidden shadow-2xl">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 border-b border-surface-700/50 bg-surface-800/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="flex items-center gap-2 rounded-lg bg-surface-700/50 px-3 py-1 text-xs text-surface-400">
                      <Shield className="h-3 w-3 text-green-500" />
                      app.voltaris.io/dashboard
                    </div>
                  </div>
                </div>

                {/* Dashboard Content */}
                <div className="p-6 space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div className="relative flex items-center">
                      {/* V dourado atrás do logo */}
                      <div className="absolute -inset-16 flex items-center justify-center pointer-events-none">
                        <span className="text-[240px] font-black text-yellow-500/20 blur-[5px] select-none leading-none" style={{ fontFamily: 'serif' }}>V</span>
                      </div>
                      <Image
                        src="/logo_full.png"
                        alt="VoltarisOS"
                        width={168}
                        height={168}
                        className="rounded-2xl relative z-10"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-400">
                        <Activity className="h-3 w-3" />
                        Live
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Power Output", value: "2.4 MW", change: "+12%" },
                      { label: "Grid Demand", value: "1.8 MW", change: "-5%" },
                      { label: "Battery SOC", value: "78%", change: "+3%" },
                      { label: "Revenue Today", value: "€12.4K", change: "+18%" },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-xl border border-surface-700/50 bg-surface-800/50 p-3"
                      >
                        <div className="text-xs text-surface-500">{metric.label}</div>
                        <div className="mt-1 text-lg font-bold text-white">{metric.value}</div>
                        <div className={cn(
                          "text-xs font-medium",
                          metric.change.startsWith("+") ? "text-green-400" : "text-red-400"
                        )}>
                          {metric.change}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chart Placeholder */}
                  <div className="rounded-xl border border-surface-700/50 bg-surface-800/30 p-4 h-40">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-surface-300">Power Forecast</div>
                      <div className="flex gap-2">
                        <div className="rounded-md bg-primary-500/10 px-2 py-0.5 text-xs text-primary-400">24h</div>
                        <div className="rounded-md bg-surface-700/50 px-2 py-0.5 text-xs text-surface-500">7d</div>
                      </div>
                    </div>
                    {/* Simulated Chart */}
                    <div className="relative h-20">
                      <svg className="w-full h-full" viewBox="0 0 400 80" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary-500)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--color-primary-500)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0,60 C50,50 100,30 150,35 C200,40 250,20 300,25 C350,30 380,40 400,35 L400,80 L0,80 Z"
                          fill="url(#chartGradient)"
                        />
                        <path
                          d="M0,60 C50,50 100,30 150,35 C200,40 250,20 300,25 C350,30 380,40 400,35"
                          fill="none"
                          stroke="var(--color-primary-500)"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}