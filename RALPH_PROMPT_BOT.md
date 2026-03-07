Du verbesserst das Bot-Dashboard UI in scripts/bot-server.ts.

AKTUELLER ZUSTAND:
- Bot-Server laeuft auf localhost:3001, gestartet mit npm run bot-server
- Das Dashboard ist ein eingebettetes HTML-Frontend das direkt aus bot-server.ts als String geliefert wird
- Es zeigt: Globale Stats, Account-Cards mit Status/Logs/Actions, Modal-Formulare
- Das UI ist funktional aber visuell basic - es braucht ein modernes Redesign

DEIN TASK - Mache das Dashboard huebsch und professionell:

1. VISUELLES REDESIGN:
   - Modernes Dark-Theme Dashboard (dunkelgrau/schwarz Hintergrund, wie Vercel oder Linear)
   - Saubere Typografie: Inter oder system-ui Font Stack
   - Konsistente Spacing und Padding
   - Subtile Borders und Shadows statt harter Linien
   - Akzentfarbe: Indigo/Violet passend zum FlowingPost Branding

2. ACCOUNT CARDS VERBESSERN:
   - Status-Dot mit Glow-Effekt (gruen=aktiv, gelb=follow-ups, rot=error, grau=disabled)
   - Warmup-Fortschrittsbalken mit Animation
   - Stats als kleine Badges/Chips statt plain text
   - Log-Output als styled Terminal-Fenster mit Monospace-Font und dunklem Hintergrund
   - Action-Buttons als Icon-Buttons mit Tooltips oder als styled Button-Gruppe
   - Hover-Effekte auf den Cards

3. GLOBALE STATS SEKTION:
   - Stats als grosse Karten oben mit Icon und Trend-Indikator
   - Zahlen prominent, Labels klein darunter
   - Grid-Layout das responsive ist

4. MODAL/FORMULARE:
   - Modernes Modal-Design mit Backdrop-Blur
   - Styled Input-Felder mit Labels und Focus-States
   - Bessere Validierung visuell anzeigen

5. RESPONSIVE:
   - Dashboard muss auf Tablet und grossen Screens gut aussehen
   - Cards in Grid-Layout das sich anpasst
   - Sidebar oder Top-Navigation wenn sinnvoll

6. KLEINE EXTRAS:
   - Auto-Refresh Indikator (zeige wann zuletzt aktualisiert)
   - Smooth Transitions wenn sich Daten aendern
   - Loading-States fuer API-Calls
   - Copy-to-Clipboard Animation fuer Logs

REGELN:
- Aendere NUR scripts/bot-server.ts
- Aendere NICHTS an der Bot-Logik, den API-Endpoints oder der Datenbank
- Nur das HTML/CSS/JS Frontend das als String eingebettet ist
- Behalte ALLE bestehenden Features und Buttons - nichts entfernen
- Teste mit: npx tsx scripts/bot-server.ts (kurz starten, schauen ob es kompiliert, dann Ctrl+C)
- Oder teste mit: npx tsc --noEmit scripts/bot-server.ts

WICHTIG:
- Das gesamte Frontend ist ein eingebetteter HTML-String in bot-server.ts
- Aendere nur den HTML/CSS/JS Teil, nicht die Server-Logik
- Alle API-Endpoints muessen weiterhin funktionieren

Wenn das Dashboard komplett redesigned ist, responsive funktioniert, und npx tsc --noEmit keine Fehler zeigt, output: <promise>BOT UI DONE</promise>
