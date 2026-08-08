import { Zap, Mail, Globe, MessageCircle, Users } from "lucide-react";
import Image from "next/image";

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
    { label: "Partners", href: "#" },
  ],
  resources: [
    { label: "Community", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "Status", href: "#" },
    { label: "Security", href: "#" },
    { label: "Privacy Policy", href: "#" },
  ],
  legal: [
    { label: "Terms of Service", href: "/legal/terms-of-service" },
    { label: "Privacy Policy", href: "/legal/privacy-policy" },
    { label: "Cookie Policy", href: "/legal/cookie-policy" },
    { label: "GDPR", href: "/legal/privacy-policy#6-your-rights-gdpr" },
    { label: "DPA", href: "/legal/terms-of-service#8-data-processing" },
  ],
};

const socialLinks = [
  { icon: Globe, href: "#", label: "Website" },
  { icon: MessageCircle, href: "#", label: "Twitter" },
  { icon: Users, href: "#", label: "LinkedIn" },
  { icon: Mail, href: "#", label: "Email" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-surface-800 bg-surface-950">
      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-accent-500/5 to-primary-500/5" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold font-display tracking-tight sm:text-4xl lg:text-5xl">
              Ready to transform your{" "}
              <span className="text-gradient">energy operations?</span>
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-surface-400">
              Join hundreds of companies already using VoltarisOS to optimize their energy portfolio.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#pricing"
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-600 rounded-full shadow-xl shadow-primary-500/25">
                  Start Free Trial
                  <Zap className="h-4 w-4" />
                </div>
              </a>
              <a
                href="#"
                className="px-8 py-4 text-base font-medium text-surface-300 hover:text-white transition-colors"
              >
                Schedule Demo
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Links */}
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <a href="#" className="relative flex items-center group">
              {/* V dourado atrás do logo */}
              <div className="absolute -inset-12 flex items-center justify-center pointer-events-none">
                <span className="text-[200px] font-black text-yellow-500/20 blur-[4px] select-none leading-none" style={{ fontFamily: 'serif' }}>V</span>
              </div>
              <Image
                src="/logo_full.png"
                alt="VoltarisOS"
                width={192}
                height={192}
                className="rounded-2xl relative z-10"
              />
            </a>
            <p className="mt-4 text-sm text-surface-500 max-w-xs">
              The next-generation Virtual Power Plant platform for energy intelligence.
            </p>
            {/* Social Links */}
            <div className="mt-6 flex items-center gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-700/50 bg-surface-800/50 text-surface-400 hover:text-white hover:border-primary-500/30 hover:bg-primary-500/10 transition-all"
                    aria-label={social.label}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link Columns */}
          <div>
            <h3 className="text-sm font-semibold text-white">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-surface-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-surface-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Resources</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-surface-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-surface-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-surface-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-surface-500">
            © {new Date().getFullYear()} VoltarisOS. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="/legal/terms-of-service" className="text-sm text-surface-500 hover:text-white transition-colors">
              Terms
            </a>
            <a href="/legal/privacy-policy" className="text-sm text-surface-500 hover:text-white transition-colors">
              Privacy
            </a>
            <a href="/legal/cookie-policy" className="text-sm text-surface-500 hover:text-white transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}