import { Zap, Mail, Globe, MessageCircle, Users } from "lucide-react";

const footerLinks = {
  produto: [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Arquitetura", href: "#arquitetura" },
    { label: "Benefícios", href: "#beneficios" },
    { label: "Documentação", href: "#" },
    { label: "API Reference", href: "#" },
  ],
  empresa: [
    { label: "Sobre", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Carreiras", href: "#" },
    { label: "Imprensa", href: "#" },
    { label: "Parceiros", href: "#" },
  ],
  recursos: [
    { label: "Comunidade", href: "#" },
    { label: "Centro de Ajuda", href: "#" },
    { label: "Estado do Sistema", href: "#" },
    { label: "Segurança", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  legal: [
    { label: "Termos de Serviço", href: "/legal/terms-of-service" },
    { label: "Política de Privacidade", href: "/legal/privacy-policy" },
    { label: "Política de Cookies", href: "/legal/cookie-policy" },
    { label: "RGPD", href: "/legal/privacy-policy#6-your-rights-gdpr" },
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
      {/* Footer Links */}
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <a href="#" className="flex items-center gap-3 group">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 shadow-lg shadow-primary-500/30">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold font-display text-white">
                Voltaris<span className="text-primary-400">OS</span>
              </span>
            </a>
            <p className="mt-4 text-sm text-surface-500 max-w-xs">
              A plataforma inteligente de gestão de energia descentralizada. Solar, baterias e EV — unificados.
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
            <h3 className="text-sm font-semibold text-white">Produto</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.produto.map((link) => (
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
            <h3 className="text-sm font-semibold text-white">Empresa</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.empresa.map((link) => (
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
            <h3 className="text-sm font-semibold text-white">Recursos</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.recursos.map((link) => (
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
            © {new Date().getFullYear()} VoltarisOS. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <a href="/legal/terms-of-service" className="text-sm text-surface-500 hover:text-white transition-colors">
              Termos
            </a>
            <a href="/legal/privacy-policy" className="text-sm text-surface-500 hover:text-white transition-colors">
              Privacidade
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