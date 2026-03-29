# Cold Email Sequence — Restaurants (DE)

Strategie: Personalisierte Beobachtung als Opener. Kein Link in Email 1 — Ziel ist die Antwort (Micro-Commitment + Deliverability Signal). Audit-Link erst in Email 2.

Variablen aus Instantly CSV:
- `{{company_name}}` — Restaurantname
- `{{ig_handle}}` — Instagram Handle
- `{{city}}` — Stadt
- `{{audit_url}}` — Link zum vorausgefüllten Audit (https://flowingpost.com/de/tools/instagram-audit?handle={{ig_handle}}&city={{city}})
- `{{observation}}` — personalisierte Beobachtung aus IG-Daten
- `{{personalized_body}}` — kompletter Email-Body (generiert von write-batch.ts)

---

## Email 1 — Beobachtung + Frage (Tag 0)

**Ziel:** Antwort. KEIN Link.

**Betreff:** (personalisiert von write-batch.ts — enthält konkrete Zahl aus IG/Google-Daten)

**Body:** {{personalized_body}}

(Endet mit einer Frage: "Soll ich Ihnen kurz zeigen...?" / "Posten Sie bewusst wenig oder fehlt die Zeit?")

---

## Email 2 — Audit-Link + konkreter Wert (Tag 3)

**Betreff:** Re: (same thread)

**Body:**

Kurzes Follow-up — im Restaurantalltag geht sowas schnell unter.

Ich hab einen kostenlosen Instagram-Check für Restaurants gebaut. Zeigt in 30 Sekunden wo {{company_name}} im Vergleich zu {{city}} steht — Posting-Frequenz, Engagement, Hashtags, alles auf einen Blick:

{{audit_url}}

Falls etwas Interessantes dabei ist, melde ich mich nochmal mit konkreten Tipps.

Viele Grüße
Tobias Hertfelder
FlowingPost — Social Media für Restaurants

---

## Email 3 — Neuer Angle + Breakup (Tag 7)

**Betreff:** Re: (same thread)

**Body:**

Letzte Nachricht von mir — will nicht nerven.

Kurzer Gedanke: Die meisten Restaurants in {{city}} posten 1-2x pro Woche auf Instagram. Die die regelmässig 4-5x posten haben im Schnitt 3x mehr Profilbesuche — und das sind die Besuche die zu Reservierungen werden.

Falls das Thema irgendwann relevant wird, der Check bleibt online:
{{audit_url}}

Alles Gute mit {{company_name}}.

Tobias
