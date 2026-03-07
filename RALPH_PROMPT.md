Du baust eine Kompetitor-Vergleichs-Landingpage fuer FlowingPost.

PROJEKT: Next.js 16 App mit next-intl, Tailwind CSS, App Router unter src/app/[locale]/
ICP: Restaurants, Cafes, Bars in DACH die Social Media selbst machen.
FlowingPost-Preise: Starter 39 EUR, Growth 79 EUR, Pro 149 EUR pro Monat.
Plattformen: Instagram, TikTok, Facebook, LinkedIn, X, Threads, Pinterest, Bluesky, Reddit - 9 insgesamt.

TASK - Baue eine komplette /vergleich Seite:

1. SEITE ERSTELLEN:
   - Erstelle src/app/[locale]/vergleich/page.tsx
   - Registriere Translations in messages/de.json und messages/en.json unter neuem Key "vergleich"
   - Verlinke die Seite im Footer der Landing Page

2. INHALT - Vergleiche FlowingPost mit diesen Tools:
   - Later - 25 USD/Monat, 1 Social Set, geplante Posts
   - Hootsuite - 99 USD/Monat, 10 Accounts, Analytics
   - Buffer - 6 USD/Monat pro Kanal, einfaches Scheduling
   - Planoly - 16 USD/Monat, visueller Planner, Instagram-fokussiert
   Recherchiere aktuelle Preise falls dir neuere bekannt sind.

3. FEATURES DER SEITE:
   - Hero mit starker Headline: Warum FlowingPost statt Hootsuite oder Later
   - Interaktive Vergleichstabelle mit Feature-Matrix: KI-Captions, Plattform-Anzahl, Preis, Auto-Scheduler, Sprachen, Telegram Bot
   - Einzelne Sektionen: FlowingPost vs Later, FlowingPost vs Hootsuite, FlowingPost vs Buffer, FlowingPost vs Planoly
   - Pricing-Vergleich visualisiert als Karten
   - Starker CTA am Ende: Jetzt zu FlowingPost wechseln
   - FAQ Sektion mit Fragen wie: Kann ich von Later zu FlowingPost wechseln?

4. DESIGN:
   - Nutze den gleichen Stil wie die Landing Page: gleiche Farben, gleiche Fonts, clean und modern
   - Responsive - mobile first
   - Animationen: fade-in on scroll, hover effects auf Karten
   - FlowingPost-Spalte in der Tabelle hervorgehoben mit Akzentfarbe

5. SEO:
   - Gute Meta-Tags: title, description
   - Strukturierte Ueberschriften H1, H2, H3
   - Interne Links zur Hauptseite und Pricing

6. QUALITAET:
   - Fuehre am Ende npm run build aus
   - Fixe alle Build-Fehler
   - de.json und en.json muessen identische Key-Struktur haben
   - TypeScript strict - keine any types
   - Alle Texte in beiden Sprachen DE und EN

REGELN:
- Erstelle NUR die neue Vergleichsseite + Translations + Footer-Link
- Aendere NICHT die bestehende Landing Page Logik, nur den Footer-Link hinzufuegen
- Fasse KEINE API-Routes, Tool-Page, Auth oder Backend an
- Committe NICHT automatisch
- Schreibe sauberen, idiomatischen Next.js Code

Wenn npm run build FEHLERFREI durchlaeuft UND die Seite komplett ist mit allen 4 Kompetitoren, Vergleichstabelle, Einzelvergleiche, FAQ, SEO und beide Sprachen, output am Ende: <promise>COMPARE PAGE DONE</promise>
