"use client";

import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, CheckCircle, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function LeadCapture() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setLoading(false);
    setSubmitted(true);
  };

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary-500/5 rounded-full blur-[150px]" />
        <div className="absolute inset-0 dot-pattern opacity-20" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 lg:px-8">
        <div className="relative rounded-3xl border border-surface-700/50 bg-surface-900/80 backdrop-blur-xl overflow-hidden">
          {/* Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-accent-500/5" />
          
          <div className="relative p-8 sm:p-12 lg:p-14">
            {/* Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm text-primary-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="font-medium">Acesso Antecipado</span>
              </div>
            </div>

            {!submitted ? (
              <>
                {/* Header */}
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold font-display tracking-tight sm:text-4xl">
                    Pronto para{" "}
                    <span className="text-gradient">revolucionar a sua energia?</span>
                  </h2>
                  <p className="mt-4 text-lg text-surface-400 max-w-xl mx-auto">
                    Seja um dos primeiros a testar o VoltarisOS. Deixe-nos o seu email e 
                    entraremos em contacto com acesso prioritário e condições especiais.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
                  <div className="space-y-2">
                    <label htmlFor="lead-name" className="block text-sm font-medium text-surface-300">
                      Nome
                    </label>
                    <input
                      id="lead-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="O seu nome"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-surface-700 bg-surface-800/50 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="lead-email" className="block text-sm font-medium text-surface-300">
                      Email profissional
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
                      <input
                        id="lead-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@empresa.com"
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-surface-700 bg-surface-800/50 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="relative group w-full mt-6"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className={cn(
                      "relative flex items-center justify-center gap-2 w-full px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-600 rounded-xl shadow-xl shadow-primary-500/25 transition-all",
                      loading && "opacity-70 cursor-not-allowed"
                    )}>
                      {loading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          A processar...
                        </>
                      ) : (
                        <>
                          Garantir Acesso Prioritário
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </div>
                  </button>

                  <p className="text-xs text-surface-500 text-center mt-4">
                    Sem spam. Apenas informação relevante sobre o VoltarisOS. Pode cancelar a qualquer momento.
                  </p>
                </form>
              </>
            ) : (
              /* Success State */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-8"
              >
                <div className="flex justify-center mb-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Pedido registado com sucesso!
                </h3>
                <p className="text-surface-400 max-w-sm mx-auto">
                  Obrigado pelo seu interesse. Em breve receberá um email com instruções de acesso 
                  ao VoltarisOS.
                </p>
                <div className="mt-8 flex items-center justify-center gap-2 text-sm text-primary-400">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Bem-vindo à nova era da energia inteligente</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}