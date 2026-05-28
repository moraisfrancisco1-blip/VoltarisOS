// VoltarisOS — i18n translations
// Languages: PT (default), EN, FR, ES, NL

export const LANGUAGES = {
  pt: { label: "Português", flag: "🇵🇹", code: "pt" },
  en: { label: "English",   flag: "🇬🇧", code: "en" },
  fr: { label: "Français",  flag: "🇫🇷", code: "fr" },
  es: { label: "Español",   flag: "🇪🇸", code: "es" },
  nl: { label: "Nederlands",flag: "🇳🇱", code: "nl" },
}

const T = {
  // ─── NAVIGATION ─────────────────────────────────────────────────────────────
  nav_core:        { pt:"Core",       en:"Core",       fr:"Core",         es:"Core",        nl:"Core" },
  nav_energy:      { pt:"Energia",    en:"Energy",     fr:"Énergie",      es:"Energía",     nl:"Energie" },
  nav_markets:     { pt:"Mercados",   en:"Markets",    fr:"Marchés",      es:"Mercados",    nl:"Markten" },
  nav_operations:  { pt:"Operações",  en:"Operations", fr:"Opérations",   es:"Operaciones", nl:"Operaties" },
  nav_admin:       { pt:"Admin",      en:"Admin",      fr:"Admin",        es:"Admin",       nl:"Admin" },

  nav_dashboard:   { pt:"Dashboard",  en:"Dashboard",  fr:"Tableau de bord", es:"Panel",    nl:"Dashboard" },
  nav_fleet:       { pt:"Frota",      en:"Fleet",      fr:"Flotte",       es:"Flota",       nl:"Vloot" },
  nav_map:         { pt:"Mapa",       en:"Map View",   fr:"Vue Carte",    es:"Mapa",        nl:"Kaart" },
  nav_sites:       { pt:"Sites",      en:"Sites",      fr:"Sites",        es:"Sitios",      nl:"Locaties" },
  nav_twin:        { pt:"Gémeo Digital", en:"Digital Twin", fr:"Jumeau Numérique", es:"Gemelo Digital", nl:"Digitale Tweeling" },
  nav_battery:     { pt:"Bateria BMS", en:"Battery BMS", fr:"BMS Batterie", es:"BMS Batería", nl:"Batterij BMS" },
  nav_ev:          { pt:"Carregamento EV", en:"EV Charging", fr:"Charge VE", es:"Carga EV", nl:"EV Laden" },
  nav_grid:        { pt:"Serviços Rede", en:"Grid Services", fr:"Services Réseau", es:"Servicios Red", nl:"Netdiensten" },
  nav_carbon:      { pt:"Carbono",    en:"Carbon",     fr:"Carbone",      es:"Carbono",     nl:"Koolstof" },
  nav_trading:     { pt:"Trading",    en:"Trading",    fr:"Trading",      es:"Trading",     nl:"Trading" },
  nav_autonomous:  { pt:"AI Trading", en:"AI Trading", fr:"IA Trading",   es:"IA Trading",  nl:"AI Trading" },
  nav_forecasting: { pt:"Previsão",   en:"Forecasting",fr:"Prévision",    es:"Previsión",   nl:"Prognose" },
  nav_alerts:      { pt:"Alertas",    en:"Alerts",     fr:"Alertes",      es:"Alertas",     nl:"Meldingen" },
  nav_maintenance: { pt:"Manutenção", en:"Maintenance",fr:"Maintenance",  es:"Mantenimiento",nl:"Onderhoud" },
  nav_reports:     { pt:"Relatórios", en:"Reports",    fr:"Rapports",     es:"Informes",    nl:"Rapporten" },
  nav_investor:    { pt:"Investidor", en:"Investor View", fr:"Vue Investisseur", es:"Vista Inversor", nl:"Investeerdersview" },
  nav_users:       { pt:"Utilizadores", en:"Users",   fr:"Utilisateurs", es:"Usuarios",    nl:"Gebruikers" },
  nav_settings:    { pt:"Definições", en:"Settings",   fr:"Paramètres",   es:"Ajustes",     nl:"Instellingen" },
  nav_whitelabel:  { pt:"White-label",en:"White-label",fr:"Marque Blanche",es:"Marca Blanca",nl:"White-label" },
  nav_audit:       { pt:"Registo de Auditoria", en:"Audit Log", fr:"Journal d'Audit", es:"Registro Auditoría", nl:"Auditlog" },
  nav_apikeys:     { pt:"Chaves API", en:"API Keys",   fr:"Clés API",     es:"Claves API",  nl:"API-sleutels" },
  nav_export:      { pt:"Centro de Exportação", en:"Export Center", fr:"Centre d'Export", es:"Centro de Exportación", nl:"Exportcentrum" },

  // ─── TOPBAR ──────────────────────────────────────────────────────────────────
  topbar_search:   { pt:"Pesquisar",  en:"Search",     fr:"Rechercher",   es:"Buscar",      nl:"Zoeken" },
  topbar_sim_on:   { pt:"Modo Simulação ativado", en:"Simulation mode enabled", fr:"Mode simulation activé", es:"Modo simulación activado", nl:"Simulatiemodus ingeschakeld" },
  topbar_sim_off:  { pt:"Modo Simulação desativado", en:"Simulation mode disabled", fr:"Mode simulation désactivé", es:"Modo simulación desactivado", nl:"Simulatiemodus uitgeschakeld" },
  topbar_live:     { pt:"LIVE",       en:"LIVE",       fr:"EN DIRECT",    es:"EN VIVO",     nl:"LIVE" },

  // ─── COMMON ──────────────────────────────────────────────────────────────────
  save:            { pt:"Guardar",    en:"Save",       fr:"Enregistrer",  es:"Guardar",     nl:"Opslaan" },
  saved:           { pt:"Guardado!",  en:"Saved!",     fr:"Enregistré!",  es:"¡Guardado!",  nl:"Opgeslagen!" },
  cancel:          { pt:"Cancelar",   en:"Cancel",     fr:"Annuler",      es:"Cancelar",    nl:"Annuleren" },
  confirm:         { pt:"Confirmar",  en:"Confirm",    fr:"Confirmer",    es:"Confirmar",   nl:"Bevestigen" },
  delete:          { pt:"Eliminar",   en:"Delete",     fr:"Supprimer",    es:"Eliminar",    nl:"Verwijderen" },
  edit:            { pt:"Editar",     en:"Edit",       fr:"Modifier",     es:"Editar",      nl:"Bewerken" },
  add:             { pt:"Adicionar",  en:"Add",        fr:"Ajouter",      es:"Añadir",      nl:"Toevoegen" },
  export:          { pt:"Exportar",   en:"Export",     fr:"Exporter",     es:"Exportar",    nl:"Exporteren" },
  import:          { pt:"Importar",   en:"Import",     fr:"Importer",     es:"Importar",    nl:"Importeren" },
  refresh:         { pt:"Atualizar",  en:"Refresh",    fr:"Actualiser",   es:"Actualizar",  nl:"Vernieuwen" },
  loading:         { pt:"A carregar...", en:"Loading...", fr:"Chargement...", es:"Cargando...", nl:"Laden..." },
  online:          { pt:"Online",     en:"Online",     fr:"En ligne",     es:"En línea",    nl:"Online" },
  offline:         { pt:"Offline",    en:"Offline",    fr:"Hors ligne",   es:"Sin conexión", nl:"Offline" },
  operational:     { pt:"Operacional",en:"Operational",fr:"Opérationnel", es:"Operacional", nl:"Operationeel" },
  logout:          { pt:"Sair",       en:"Logout",     fr:"Déconnexion",  es:"Cerrar sesión",nl:"Uitloggen" },
  language:        { pt:"Idioma",     en:"Language",   fr:"Langue",       es:"Idioma",      nl:"Taal" },

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  dash_overview:   { pt:"Visão Geral", en:"Overview",  fr:"Vue d'ensemble",es:"Visión General",nl:"Overzicht" },
  dash_production: { pt:"Produção Solar", en:"Solar Production", fr:"Production Solaire", es:"Producción Solar", nl:"Zonnenergie" },
  dash_consumption:{ pt:"Consumo Total", en:"Total Consumption", fr:"Consommation Totale", es:"Consumo Total", nl:"Totaal Verbruik" },
  dash_grid_flow:  { pt:"Fluxo Rede", en:"Grid Flow",  fr:"Flux Réseau",  es:"Flujo Red",   nl:"Netstroom" },
  dash_today_prod: { pt:"Produção Hoje", en:"Today's Production", fr:"Production Aujourd'hui", es:"Producción Hoy", nl:"Productie Vandaag" },
  dash_prod_vs_cons:{ pt:"Produção vs Consumo", en:"Production vs Consumption", fr:"Production vs Consommation", es:"Producción vs Consumo", nl:"Productie vs Verbruik" },
  dash_market_price:{ pt:"Preço de Mercado", en:"Market Price", fr:"Prix du Marché", es:"Precio de Mercado", nl:"Marktprijs" },
  dash_battery:    { pt:"Bateria",    en:"Battery",    fr:"Batterie",     es:"Batería",     nl:"Batterij" },
  dash_battery_global:{ pt:"Estado global", en:"Global state", fr:"État global", es:"Estado global", nl:"Globale status" },
  dash_sites_active:{ pt:"Sites Ativos", en:"Active Sites", fr:"Sites Actifs", es:"Sitios Activos", nl:"Actieve Locaties" },
  dash_realtime:   { pt:"Status em tempo real", en:"Real-time status", fr:"Statut en temps réel", es:"Estado en tiempo real", nl:"Real-time status" },
  dash_soc_24h:    { pt:"Bateria · 24h", en:"Battery · 24h", fr:"Batterie · 24h", es:"Batería · 24h", nl:"Batterij · 24u" },
  dash_soc_pct:    { pt:"Estado de Carga (%)", en:"State of Charge (%)", fr:"État de Charge (%)", es:"Estado de Carga (%)", nl:"Laadtoestand (%)" },
  dash_revenue:    { pt:"Receita",    en:"Revenue",    fr:"Revenus",      es:"Ingresos",    nl:"Omzet" },
  dash_financial:  { pt:"Resumo financeiro", en:"Financial summary", fr:"Résumé financier", es:"Resumen financiero", nl:"Financieel overzicht" },
  dash_today:      { pt:"Hoje",       en:"Today",      fr:"Aujourd'hui",  es:"Hoy",         nl:"Vandaag" },
  dash_week:       { pt:"Esta semana",en:"This week",  fr:"Cette semaine",es:"Esta semana",  nl:"Deze week" },
  dash_month:      { pt:"Este mês",   en:"This month", fr:"Ce mois",      es:"Este mes",     nl:"Deze maand" },
  dash_grid_svc:   { pt:"Grid Services", en:"Grid Services", fr:"Services Réseau", es:"Servicios Red", nl:"Netdiensten" },
  dash_ai_engine:  { pt:"AI Engine · Recomendação", en:"AI Engine · Recommendation", fr:"Moteur IA · Recommandation", es:"Motor IA · Recomendación", nl:"AI Engine · Aanbeveling" },
  dash_confidence: { pt:"Confiança do modelo", en:"Model confidence", fr:"Confiance du modèle", es:"Confianza del modelo", nl:"Modelvertrouwen" },
  dash_threshold:  { pt:"limiar €80/MWh", en:"threshold €80/MWh", fr:"seuil €80/MWh", es:"umbral €80/MWh", nl:"drempel €80/MWh" },
  dash_max_charge: { pt:"carga máx",  en:"max charge", fr:"charge max",   es:"carga máx",   nl:"max. lading" },
  dash_min_charge: { pt:"mínimo",     en:"minimum",    fr:"minimum",      es:"mínimo",      nl:"minimum" },
  dash_dayahead:   { pt:"day-ahead",  en:"day-ahead",  fr:"veille",       es:"día anterior", nl:"dag vooruit" },
  dash_24h:        { pt:"kW · 24h",   en:"kW · 24h",   fr:"kW · 24h",    es:"kW · 24h",    nl:"kW · 24u" },
  dash_vs_prev:    { pt:"vs. hora anterior", en:"vs. previous hour", fr:"vs. heure précédente", es:"vs. hora anterior", nl:"vs. vorig uur" },
  dash_processing: { pt:"A processar...", en:"Processing...", fr:"Traitement...", es:"Procesando...", nl:"Verwerken..." },
  dash_sites_cap:  { pt:"sites · 4.8 MWh cap", en:"sites · 4.8 MWh cap", fr:"sites · cap. 4.8 MWh", es:"sitios · cap. 4.8 MWh", nl:"locaties · 4.8 MWh cap." },
  
  // AI decisions
  ai_charge:       { pt:"Carregar",   en:"Charge",     fr:"Charger",      es:"Cargar",      nl:"Laden" },
  ai_discharge:    { pt:"Descarregar",en:"Discharge",  fr:"Décharger",    es:"Descargar",   nl:"Ontladen" },
  ai_hold:         { pt:"Aguardar",   en:"Hold",       fr:"Attendre",     es:"Mantener",    nl:"Wachten" },
  ai_reason_charge:{ pt:"Preço abaixo do limiar — ótimo para carregar bateria.", en:"Price below threshold — optimal to charge battery.", fr:"Prix sous le seuil — optimal pour charger la batterie.", es:"Precio por debajo del umbral — óptimo para cargar batería.", nl:"Prijs onder drempel — optimaal om batterij te laden." },
  ai_reason_discharge:{ pt:"Preço elevado — venda de energia maximiza receita.", en:"High price — selling energy maximises revenue.", fr:"Prix élevé — vente d'énergie maximise les revenus.", es:"Precio alto — venta de energía maximiza ingresos.", nl:"Hoge prijs — energie verkopen maximaliseert inkomsten." },
  ai_reason_hold:  { pt:"Mercado instável — manter posição atual.", en:"Unstable market — maintain current position.", fr:"Marché instable — maintenir la position actuelle.", es:"Mercado inestable — mantener posición actual.", nl:"Onstabiele markt — huidige positie handhaven." },

  // Battery stats
  bat_cycles:      { pt:"Ciclos",     en:"Cycles",     fr:"Cycles",       es:"Ciclos",      nl:"Cycli" },
  bat_power:       { pt:"Potência",   en:"Power",      fr:"Puissance",    es:"Potencia",    nl:"Vermogen" },
  bat_temp:        { pt:"Temp.",      en:"Temp.",      fr:"Temp.",        es:"Temp.",       nl:"Temp." },
  bat_health:      { pt:"Saúde",      en:"Health",     fr:"Santé",        es:"Salud",       nl:"Gezondheid" },

  // ─── SETTINGS ────────────────────────────────────────────────────────────────
  settings_title:  { pt:"Definições", en:"Settings",   fr:"Paramètres",   es:"Ajustes",     nl:"Instellingen" },
  settings_sub:    { pt:"Perfil, empresa, aparência, integrações e preferências", en:"Profile, company, appearance, integrations and preferences", fr:"Profil, entreprise, apparence, intégrations et préférences", es:"Perfil, empresa, apariencia, integraciones y preferencias", nl:"Profiel, bedrijf, uiterlijk, integraties en voorkeuren" },
  settings_profile:{ pt:"Perfil",     en:"Profile",    fr:"Profil",       es:"Perfil",      nl:"Profiel" },
  settings_company:{ pt:"Empresa",    en:"Company",    fr:"Entreprise",   es:"Empresa",     nl:"Bedrijf" },
  settings_appearance:{ pt:"Aparência",en:"Appearance",fr:"Apparence",    es:"Apariencia",  nl:"Uiterlijk" },
  settings_notifications:{ pt:"Notificações", en:"Notifications", fr:"Notifications", es:"Notificaciones", nl:"Meldingen" },
  settings_integrations:{ pt:"Integrações", en:"Integrations", fr:"Intégrations", es:"Integraciones", nl:"Integraties" },
  settings_security:{ pt:"Segurança", en:"Security",   fr:"Sécurité",     es:"Seguridad",   nl:"Beveiliging" },
  settings_energy: { pt:"Energia",    en:"Energy",     fr:"Énergie",      es:"Energía",     nl:"Energie" },
  settings_trading:{ pt:"Trading",    en:"Trading",    fr:"Trading",      es:"Trading",     nl:"Trading" },
  settings_billing:{ pt:"Faturação",  en:"Billing",    fr:"Facturation",  es:"Facturación", nl:"Facturering" },
  settings_data:   { pt:"Dados & Privacidade", en:"Data & Privacy", fr:"Données & Confidentialité", es:"Datos & Privacidad", nl:"Gegevens & Privacy" },

  // Appearance
  app_theme:       { pt:"Tema",       en:"Theme",      fr:"Thème",        es:"Tema",        nl:"Thema" },
  app_accent:      { pt:"Cor de Destaque", en:"Accent Color", fr:"Couleur d'accentuation", es:"Color de Acento", nl:"Accentkleur" },
  app_density:     { pt:"Densidade de Interface", en:"Interface Density", fr:"Densité d'interface", es:"Densidad de Interfaz", nl:"Interfacedichtheid" },
  app_compact:     { pt:"Compacto",   en:"Compact",    fr:"Compact",      es:"Compacto",    nl:"Compact" },
  app_comfortable: { pt:"Confortável",en:"Comfortable",fr:"Confortable",  es:"Cómodo",      nl:"Comfortabel" },
  app_spacious:    { pt:"Espaçoso",   en:"Spacious",   fr:"Spacieux",     es:"Espacioso",   nl:"Ruim" },
  app_animations:  { pt:"Animações",  en:"Animations", fr:"Animations",   es:"Animaciones", nl:"Animaties" },
  app_animations_desc:{ pt:"Transições e microinterações", en:"Transitions and micro-interactions", fr:"Transitions et micro-interactions", es:"Transiciones y micro-interacciones", nl:"Overgangen en micro-interacties" },
  app_sidebar_collapsed:{ pt:"Sidebar colapsada por padrão", en:"Sidebar collapsed by default", fr:"Barre latérale réduite par défaut", es:"Barra lateral colapsada por defecto", nl:"Zijbalk standaard ingeklapt" },

  // Themes
  theme_dark:      { pt:"Escuro",     en:"Dark",       fr:"Sombre",       es:"Oscuro",      nl:"Donker" },
  theme_light:     { pt:"Claro",      en:"Light",      fr:"Clair",        es:"Claro",       nl:"Licht" },
  theme_midnight:  { pt:"Meia-noite", en:"Midnight",   fr:"Minuit",       es:"Medianoche",  nl:"Middernacht" },
  theme_forest:    { pt:"Floresta",   en:"Forest",     fr:"Forêt",        es:"Bosque",      nl:"Woud" },
  theme_ocean:     { pt:"Oceano",     en:"Ocean",      fr:"Océan",        es:"Océano",      nl:"Oceaan" },

  // ─── PAGE TITLES ─────────────────────────────────────────────────────────────
  page_dashboard:  { pt:"Dashboard",  en:"Dashboard",  fr:"Tableau de bord", es:"Panel",    nl:"Dashboard" },
  page_sites:      { pt:"Sites",      en:"Sites",      fr:"Sites",        es:"Sitios",      nl:"Locaties" },
  page_fleet:      { pt:"Gestão de Frota", en:"Fleet Management", fr:"Gestion de Flotte", es:"Gestión de Flota", nl:"Vlootbeheer" },
  page_trading:    { pt:"Trading",    en:"Trading",    fr:"Trading",      es:"Trading",     nl:"Trading" },
  page_battery:    { pt:"Battery BMS",en:"Battery BMS",fr:"BMS Batterie", es:"BMS Batería", nl:"Batterij BMS" },
  page_ev:         { pt:"Carregamento EV", en:"EV Charging", fr:"Charge VE", es:"Carga EV", nl:"EV Laden" },
  page_grid:       { pt:"Serviços de Rede", en:"Grid Services", fr:"Services Réseau", es:"Servicios de Red", nl:"Netdiensten" },
  page_forecasting:{ pt:"Previsão",   en:"Forecasting",fr:"Prévision",    es:"Previsión",   nl:"Prognose" },
  page_map:        { pt:"Vista de Mapa", en:"Map View",fr:"Vue Carte",    es:"Vista Mapa",  nl:"Kaartweergave" },
  page_alerts:     { pt:"Alertas & Notificações", en:"Alerts & Notifications", fr:"Alertes & Notifications", es:"Alertas y Notificaciones", nl:"Meldingen" },
  page_reports:    { pt:"Relatórios & Análise", en:"Reports & Analytics", fr:"Rapports & Analytique", es:"Informes y Análisis", nl:"Rapporten & Analyses" },
  page_users:      { pt:"Gestão de Utilizadores", en:"User Management", fr:"Gestion des Utilisateurs", es:"Gestión de Usuarios", nl:"Gebruikersbeheer" },
  page_investor:   { pt:"Vista Investidor", en:"Investor View", fr:"Vue Investisseur", es:"Vista Inversor", nl:"Investeerdersview" },
  page_settings:   { pt:"Definições", en:"Settings",   fr:"Paramètres",   es:"Ajustes",     nl:"Instellingen" },
  page_carbon:     { pt:"Carbono",    en:"Carbon Dashboard", fr:"Tableau Carbone", es:"Panel Carbono", nl:"Koolstof Dashboard" },
  page_autonomous: { pt:"Agente de IA Trading", en:"AI Trading Agent", fr:"Agent IA Trading", es:"Agente IA Trading", nl:"AI Trading Agent" },
  page_twin:       { pt:"Gémeo Digital", en:"Digital Twin", fr:"Jumeau Numérique", es:"Gemelo Digital", nl:"Digitale Tweeling" },
  page_maintenance:{ pt:"Manutenção Preditiva", en:"Predictive Maintenance", fr:"Maintenance Prédictive", es:"Mantenimiento Predictivo", nl:"Predictief Onderhoud" },
  page_whitelabel: { pt:"White-label",en:"White-label",fr:"Marque Blanche",es:"Marca Blanca",nl:"White-label" },
  page_audit:      { pt:"Registo de Auditoria", en:"Audit Log", fr:"Journal d'Audit", es:"Registro de Auditoría", nl:"Auditlog" },
  page_apikeys:    { pt:"Chaves API", en:"API Keys",   fr:"Clés API",     es:"Claves API",  nl:"API-sleutels" },
  page_export:     { pt:"Centro de Exportação", en:"Export Center", fr:"Centre d'Exportation", es:"Centro de Exportación", nl:"Exportcentrum" },
}

export default T

// Helper to get translation
export function t(key, lang = "pt") {
  const entry = T[key]
  if (!entry) return key
  return entry[lang] || entry["en"] || key
}
