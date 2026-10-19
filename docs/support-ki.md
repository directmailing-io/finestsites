# KI-Antwortvorschläge im Support-Chat (seit 19.10.2026)

Im Admin-Support (`/admin/support`) kann Daniel sich pro Gespräch einen Antwortvorschlag von OpenAI erzeugen lassen. Der Vorschlag landet **nur im Eingabefeld**, wird nie automatisch gesendet, und lässt sich beliebig bearbeiten oder verwerfen.

## Bedienung

- **✨ KI-Vorschlag**: liest den Chatverlauf plus Kundenkontext aus der Datenbank und schreibt Daniels nächste Nachricht.
- **Stichpunkte → ✨ Ausformulieren**: Steht schon Text im Feld (z. B. „username geändert, domain braucht www“), gilt er als Vorgabe. Die KI formuliert daraus die Antwort in Daniels Stil. Das ist der günstigste und schnellste Weg bei Fällen, die die KI nicht aus der Datenbank kennen kann.
- **Verwerfen**: leert das Feld. **Senden** schickt den (bearbeiteten) Text wie bisher.
- **✨ KI-Hinweise** (links oben): freier Text, der bei jedem Vorschlag mitgegeben wird und Vorrang vor der Wissensbasis hat. Dort gehören rein: laufende Aktionen mit Code und Enddatum, bekannte Störungen, frisch freigeschaltete Funktionen. Gespeichert in `app_settings` (`support_ai_notes`), ohne Deploy änderbar.
- Unter dem Feld steht nach jedem Vorschlag, was der Aufruf ungefähr gekostet hat.

## Was die KI weiß

- `src/lib/support/ai-knowledge.ts`
  - `KNOWLEDGE_BASE`: alle Fakten zu FinestSites (Tarife, Laufzeit, Kündigung, Vorlagen, Editor, Domain, Partnerprogramm, Einstellungen, Rechtliches, typische Fragen). Bei jeder kundenrelevanten Produktänderung hier nachziehen.
  - `STYLE_GUIDE`: Daniels Schreibstil, aus allen bisherigen Chats abgeleitet (Anrede, Länge, Emojis, typische Formulierungen, was er nicht macht).
  - `EXAMPLES`: neun echte Frage/Antwort-Paare als Vorbild.
- Pro Aufruf dynamisch (`src/lib/support/ai-suggest.ts`): Datum/Uhrzeit, Kundenkontext aus der DB (Name, Benutzername, Abo mit Intervall und Status, Kündigung, Zahlungsprobleme, alle Seiten mit Status und eigener Domain, Partnerdaten), die letzten 30 Nachrichten, die KI-Hinweise, Daniels Stichpunkte.

## Kosten

- Modell `gpt-5.4-mini` (`OPENAI_SUPPORT_MODEL` in der Env überschreibt), `reasoning_effort: low`, `verbosity: low`, max. 900 Ausgabe-Tokens.
- Der statische Teil (Wissensbasis + Stil + Beispiele, rund 7.300 Tokens) steht immer byte-gleich vorne im Prompt. OpenAI cached ihn automatisch (`prompt_cache_key: finestsites-support-v1`). Im Test waren 6.800 bis 7.500 von 7.700 Prompt-Tokens gecacht.
- Listenpreise 19.10.2026: 0,75 $/1M Eingabe, 0,075 $/1M gecacht, 4,50 $/1M Ausgabe → **rund 0,2 US-Cent pro Vorschlag**. 1.000 Vorschläge ≈ 2 $.
- Jeder Vorschlag wird in `support_ai_suggestions` protokolliert (Modell, Tokens, Dauer). Sendet Daniel danach, wird der tatsächlich gesendete Text am Vorschlag gespeichert (`sent_content`). So lässt sich später auswerten, wie oft und wie stark er umschreibt, um Wissensbasis und Stilregeln nachzuschärfen:

```sql
select created_at, left(suggestion, 120), left(sent_content, 120)
from support_ai_suggestions where sent_content is not null order by created_at desc limit 20;
```

## Testen ohne Oberfläche

```bash
# App-Server
cd /var/www/finestsites && node --env-file=.env.production --import tsx scripts/support-ai-test.ts <username|conversationId> ["Stichpunkte"]
```

## Grenzen

- Die KI kennt keine Stripe-Details (Rechnungsbeträge, Zahlungsarten) und keine Fehlerursachen. Dort schreibt sie wie Daniel („Ich schau mir das an und melde mich“) oder setzt höchstens eine Klammer `[PRÜFEN: …]`, die vor dem Senden ersetzt werden muss.
- Antworten auf Bilder/Screenshots: Die KI sieht nur, dass ein Bild geschickt wurde, nicht den Inhalt.
