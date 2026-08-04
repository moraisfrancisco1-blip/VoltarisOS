# VoltarisOS Landing Page

Landing page de nível "Elite" (World-Class SaaS UI) para o VoltarisOS - plataforma inteligente de Virtual Power Plant.

## 🚀 Stack Tecnológica

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS com variáveis CSS customizáveis
- **Animações:** Framer Motion
- **Ícones:** Lucide React

## 📁 Estrutura do Projeto

```
landing/
├── src/
│   ├── app/
│   │   ├── globals.css       # Design system com variáveis CSS
│   │   ├── layout.tsx        # Layout root com fontes Google
│   │   └── page.tsx          # Página principal
│   ├── components/
│   │   ├── navbar.tsx        # Navbar flutuante com glassmorphism
│   │   ├── hero.tsx          # Hero section com 3D tilt
│   │   ├── video-showcase.tsx # Seção de vídeo demonstrativo
│   │   ├── bento-features.tsx # Bento grid de funcionalidades
│   │   ├── screenshots-gallery.tsx # Galeria com tabs interativas
│   │   ├── social-proof.tsx  # Métricas e depoimentos
│   │   ├── pricing.tsx       # Pricing com toggle mensal/anual
│   │   ├── faq.tsx           # FAQ com acordeão
│   │   └── footer.tsx        # Footer de alta conversão
│   └── lib/
│       └── utils.ts          # Utility functions (cn helper)
├── tailwind.config.ts        # Configuração do Tailwind
└── package.json
```

## 🎨 Customização

### Cores

Edite as variáveis CSS em `src/app/globals.css`:

```css
:root {
  /* Primary Colors */
  --color-primary-500: #00b4d8;
  
  /* Accent Colors */
  --color-accent-500: #8b00e6;
  
  /* Surface Colors */
  --color-surface-950: #020617;
}
```

### Fontes

Edite o `layout.tsx` para usar fontes diferentes:

```tsx
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
```

## 🏃 Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar servidor de produção
npm start
```

## 📱 Seções da Landing Page

1. **Navbar** - Navegação flutuante com efeito glassmorphism
2. **Hero** - Seção principal com badge animado, headline com gradiente, CTAs e mockup 3D
3. **Video Showcase** - Player de vídeo customizado com controles
4. **Bento Features** - Grid de funcionalidades estilo Apple/Vercel
5. **Screenshots Gallery** - Tabs interativas com lightbox
6. **Social Proof** - Métricas de impacto e depoimentos
7. **Pricing** - Cards com toggle mensal/anual e badge "Most Popular"
8. **FAQ** - Acordeão com animações suaves
9. **Footer** - CTA final + links organizados

## ✨ Efeitos Visuais

- **Glassmorphism** - Navbar e cards com blur e transparência
- **3D Tilt** - Mockup do dashboard com efeito de perspectiva
- **Glow Borders** - Bordas com gradiente e brilho
- **Shimmer** - Efeito de brilho em movimento
- **Gradient Text** - Texto com gradiente animado
- **Border Beam** - Borda com luz em rotação
- **Float Animation** - Elementos flutuando suavemente

## 🔧 Próximos Passos

Para personalizar com seus dados:

1. **Nome do Software:** Edite os textos nos componentes
2. **Paleta de Cores:** Ajuste as variáveis CSS em `globals.css`
3. **Vídeo Demo:** Adicione o URL do vídeo em `video-showcase.tsx`
4. **Screenshots:** Substitua os placeholders em `screenshots-gallery.tsx`
5. **Depoimentos:** Edite em `social-proof.tsx`
6. **Preços:** Ajuste em `pricing.tsx`
7. **FAQ:** Edite as perguntas em `faq.tsx`

## 📄 Licença

Todos os direitos reservados © VoltarisOS