"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How does the 14-day free trial work?",
    answer: "You get full access to all Professional features for 14 days. No credit card required. At the end of the trial, you can choose a plan or continue with limited free access.",
  },
  {
    question: "Can I switch plans at any time?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any differences in billing.",
  },
  {
    question: "What types of energy assets does VoltarisOS support?",
    answer: "VoltarisOS supports solar PV, wind turbines, battery storage (all major chemistries), EV chargers, and conventional generators. Our flexible platform adapts to any asset type.",
  },
  {
    question: "How does the AI forecasting work?",
    answer: "Our AI models combine weather data, historical performance, market prices, and grid signals to generate highly accurate forecasts. The system improves continuously with more data.",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use enterprise-grade encryption (AES-256), SOC 2 Type II certified infrastructure, and regular security audits. Your data is stored in isolated, encrypted databases.",
  },
  {
    question: "Do you offer on-premise deployment?",
    answer: "Yes, our Enterprise plan includes on-premise deployment options for organizations with strict data sovereignty requirements. Contact our sales team for details.",
  },
  {
    question: "What integrations are available?",
    answer: "We offer REST APIs, webhooks, and pre-built integrations with major SCADA systems, energy trading platforms, and grid operators. Custom integrations available on Professional and Enterprise plans.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-primary-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm text-primary-300 mb-6">
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="font-medium">FAQ</span>
          </div>
          <h2 className="text-4xl font-bold font-display tracking-tight sm:text-5xl">
            Frequently asked{" "}
            <span className="text-gradient">questions</span>
          </h2>
          <p className="mt-6 text-lg text-surface-400">
            Everything you need to know about VoltarisOS.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={cn(
                  "rounded-xl border transition-all duration-300",
                  isOpen
                    ? "border-primary-500/30 bg-primary-500/5"
                    : "border-surface-700/50 bg-surface-900/50 hover:border-surface-600"
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <span className="text-base font-medium text-white pr-4">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className={cn(
                      "h-5 w-5 transition-colors",
                      isOpen ? "text-primary-400" : "text-surface-500"
                    )} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 text-surface-400 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-surface-400 mb-4">
            Still have questions?
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Contact our support team
          </a>
        </motion.div>
      </div>
    </section>
  );
}