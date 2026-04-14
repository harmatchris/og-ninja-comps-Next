# Warteschlange

## Offen

1. **Stage-ID überlappt Stage-Header** (z.B. "JV670Y" direkt links vor "Main Stage A" in Next Up).
   Quelle: Stage-ID aus URL `?stageId=JV670Y&comp=9PGICI` wird im Header gerendert und überlagert den Namen.
   Visuell bestätigt auf Vercel, Comp 9PGICI ("I Jo"), Next up tab.

2. **Live Runner Row erscheint nicht im Ranking.** Live-Tab auf Ranking zeigt keine grüne Live-Zeile für aktiven Läufer. Ursache: Kategorie-Chips werden nur aus abgeschlossenen Runs generiert — wenn in der aktiven Kategorie noch kein Run gebuzzert wurde, existiert der Chip nicht, also kein Render-Ort für die Live-Row. Fix: Chip auch für aktive Läufer erzeugen.

3. **Stats Ninja Animation nicht verifizierbar von Zuschauer-Tab.** Stats zeigt "Noch keine aktiven Stages" + "Handy ausgefallen?" Recovery-Banner auf nicht-ownender Tab. Stats sollte den aktiven Stage live anzeigen ohne "Übernehmen"-Klick zu erfordern.

4. **Direkt-Start ignoriert Stage-Category-Filter.** Stage "Adults LK1" → "Stages — Direkt starten" lässt Athleten aus *allen* Kategorien auswählen (Sabine 97 aus Bambinis 5-7 landete in Adults LK1 Stage). Filter greift nur in Pipeline/Next Up, nicht in Direct-Start.
