"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Settings, BarChart3, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    title: "Command Center",
    description: "Monitor all your energy assets in real-time with comprehensive dashboards.",
    features: ["Real-time power flow", "Live metrics", "Customizable widgets"],
  },
  {
    id: "automation",
    label: "Automation",
    icon: Zap,
    title: "Smart Automation",
    description: "Set up intelligent rules and let the system optimize automatically.",
    features: ["Rule-based control", "AI optimization", "Scheduled actions"],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    title: "Deep Analytics",
    description: "Uncover insights with advanced analytics and reporting tools.",
    features: ["Historical analysis", "Forecast accuracy", "Revenue attribution"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    title: "Flexible Configuration",
    description: "Customize every aspect of the platform to fit your needs.",
    features: ["Multi-site management", "User roles", "API integrations"],
  },
];

export function ScreenshotsGallery() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const activeContent = tabs.find((tab) => tab.id === activeTab);

  return (
    <section id="product" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 right-0 w-[600px] h-[400px] bg-primary-500/5 rounded-full blur-[120px]" />
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
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="font-medium">Interface Deep Dive</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl lg:text-6xl">
            Powerful interface,{" "}
            <span className="text-gradient">zero complexity</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
            Explore the intuitive interface that makes complex energy management feel simple.
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                  isActive
                    ? "text-white bg-gradient-to-r from-primary-500 to-accent-600 shadow-lg shadow-primary-500/25"
                    : "text-surface-400 hover:text-white bg-surface-800/50 hover:bg-surface-700/50 border border-surface-700/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid lg:grid-cols-2 gap-8 items-center"
          >
            {/* Text Content */}
            <div className="order-2 lg:order-1">
              <h3 className="text-3xl font-bold text-white mb-4">
                {activeContent?.title}
              </h3>
              <p className="text-lg text-surface-400 mb-6">
                {activeContent?.description}
              </p>
              <ul className="space-y-3">
                {activeContent?.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500/10">
                      <div className="h-2 w-2 rounded-full bg-primary-500" />
                    </div>
                    <span className="text-surface-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Screenshot */}
            <div className="order-1 lg:order-2">
              <div
                className="relative group cursor-pointer"
                onClick={() => setIsLightboxOpen(true)}
              >
                {/* Glow Border */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-500 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity animate-gradient bg-[length:200%_200%]" />
                
                {/* Screenshot Container */}
                <div className="relative rounded-2xl border border-surface-700/50 bg-surface-900 overflow-hidden shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]">
                  {/* Browser Chrome */}
                  <div className="flex items-center gap-2 border-b border-surface-700/50 bg-surface-800/50 px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-500/80" />
                      <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                      <div className="h-3 w-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 text-center text-xs text-surface-500">
                      app.voltaris.io/{activeTab}
                    </div>
                  </div>

                  {/* Screenshot Content - Placeholder */}
                  <div className="aspect-[4/3] bg-surface-950 p-6">
                    {/* Simulated UI based on active tab */}
                    {activeTab === "dashboard" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-surface-300">Overview</div>
                          <div className="flex gap-2">
                            <div className="h-6 w-16 rounded bg-primary-500/20" />
                            <div className="h-6 w-16 rounded bg-surface-700/50" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-lg border border-surface-700/30 bg-surface-800/30 p-3">
                              <div className="h-3 w-12 rounded bg-surface-700/50 mb-2" />
                              <div className="h-5 w-16 rounded bg-primary-500/30" />
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-surface-700/30 bg-surface-800/30 p-4 h-32">
                          <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                            <path
                              d="M0,80 C50,60 100,40 150,50 C200,60 250,30 300,40"
                              fill="none"
                              stroke="var(--color-primary-500)"
                              strokeWidth="2"
                              opacity="0.5"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                    {activeTab === "automation" && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-surface-300">Automation Rules</div>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center gap-3 rounded-lg border border-surface-700/30 bg-surface-800/30 p-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
                              <Zap className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="h-3 w-24 rounded bg-surface-700/50 mb-1" />
                              <div className="h-2 w-32 rounded bg-surface-700/30" />
                            </div>
                            <div className="h-5 w-10 rounded-full bg-green-500/20" />
                          </div>
                        ))}
                      </div>
                    )}
                    {activeTab === "analytics" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-surface-300">Performance</div>
                          <div className="h-6 w-20 rounded bg-surface-700/50" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="rounded-lg border border-surface-700/30 bg-surface-800/30 p-3 h-20">
                              <div className="h-2 w-10 rounded bg-surface-700/50 mb-2" />
                              <div className="h-4 w-14 rounded bg-accent-500/30" />
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-surface-700/30 bg-surface-800/30 p-4 h-24">
                          <div className="flex items-end justify-between h-full gap-1">
                            {[40, 60, 30, 80, 50, 70, 45].map((h, i) => (
                              <div key={i} className="flex-1 bg-gradient-to-t from-primary-500/50 to-primary-500/20 rounded-t" style={{ height: `${h}%` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === "settings" && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-surface-300">Configuration</div>
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-surface-700/30 bg-surface-800/30 p-3">
                            <div>
                              <div className="h-3 w-20 rounded bg-surface-700/50 mb-1" />
                              <div className="h-2 w-32 rounded bg-surface-700/30" />
                            </div>
                            <div className={cn("h-5 w-10 rounded-full", i % 2 === 0 ? "bg-primary-500/50" : "bg-surface-700/50")} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Zoom Hint */}
                <div className="absolute inset-0 flex items-center justify-center bg-surface-950/0 group-hover:bg-surface-950/50 transition-all duration-300">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm text-white bg-surface-900/80 px-4 py-2 rounded-full backdrop-blur-sm">
                    Click to expand
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/90 backdrop-blur-xl"
            onClick={() => setIsLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="absolute -top-12 right-0 p-2 text-surface-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              <div className="rounded-2xl border border-surface-700/50 bg-surface-900 overflow-hidden shadow-2xl">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 border-b border-surface-700/50 bg-surface-800/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 text-center text-xs text-surface-500">
                    app.voltaris.io/{activeTab}
                  </div>
                </div>
                <div className="aspect-[16/10] bg-surface-950 p-8">
                  <div className="h-full rounded-lg border border-surface-700/30 bg-surface-800/30 flex items-center justify-center">
                    <p className="text-surface-500">
                      [High-resolution screenshot of {activeContent?.label} module]
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}