# Integrar o EnergyOS Dashboard no teu projecto

## O que mudou nesta versão

- **Zero shadcn/ui** — componentes UI (Tooltip, Slider, Switch) são custom, incluídos
- **Zero Tailwind** — todo o styling usa inline styles + 1 ficheiro CSS
- **`import React`** em todos os ficheiros — compatível com `"jsx": "react"`
- **Imports relativos** — sem `@/` aliases, funciona em qualquer projecto

---

## Passo 1 — Instalar dependências (3 packages)

```bash
npm install recharts zustand lucide-react
```

Já tens no package.json. Se já instalaste, salta.

---

## Passo 2 — Copiar a pasta para o teu projecto

Copia a pasta `energy-dashboard-v2` inteira para dentro do teu `src/`:

```
src/
├── modules/
│   └── energy-dashboard/     ← RENOMEIA a pasta como quiseres
│       ├── EnergyDashboard.tsx
│       ├── energy-dashboard.css
│       ├── components/
│       │   ├── dashboard/    (11 ficheiros)
│       │   └── ui/           (3 ficheiros)
│       └── lib/              (3 ficheiros)
```

---

## Passo 3 — Adicionar fontes ao index.html

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

---

## Passo 4 — Usar na tua página

```tsx
import EnergyDashboard from './modules/energy-dashboard/EnergyDashboard';

// Na tua página ou rota:
function MinhaPageDeEnergia() {
  return <EnergyDashboard />;
}
```

---

## Passo 5 — Correr

```bash
npm start
```

Pronto. Sem configurações extras, sem aliases, sem tailwind config.

---

## Se tiveres erros

| Erro | Solução |
|------|---------|
| `Cannot find module 'recharts'` | `npm install recharts` |
| `Cannot find module 'zustand'` | `npm install zustand` |
| `Cannot find module 'lucide-react'` | `npm install lucide-react` |
| `Cannot find name 'React'` | Já não deve acontecer, mas verifica que tens `import React from 'react'` no topo |
| Fontes não aparecem | Verifica os links no index.html |
