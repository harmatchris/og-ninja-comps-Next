# Warteschlange

## Erledigt

1. ✅ **Stage-ID überlappt Stage-Header** — Commit `924e100`. Badge zeigt jetzt ersten Buchstaben des Stage-Namens statt Stage-ID.

2. ✅ **Live Runner Row erscheint nicht im Ranking** — Commit `6402c56`. `catsWithData` enthält jetzt Kategorien mit aktiven Läufen, nicht nur abgeschlossenen.

3. ✅ **Stats Ninja Animation auf Zuschauer-Tab** — Commit `6402c56`. `activeStageNums` erkennt Stages mit `activeRuns` unabhängig von lokalem Besitz.

4. ✅ **Direkt-Start ignoriert Stage-Category-Filter** — Commits `6402c56` + `e14f538`.
   - JuryApp-Athletenliste: Belt-and-suspenders-Filter auf `pipelineStageCfg.categories`.
   - StageRecoveryBanner.onJoin: Pipeline-Stages (String-ID) setzen jetzt `stageId` statt `stNum`, damit JuryApp in Pipeline-Modus startet und die Legacy-Kategorie-Picker-Seite nicht mehr erscheint. Visuell verifiziert auf Vercel: "Stage JV67OY übernehmen" → direkt Main Stage A mit Rafael 14 (Adults), kein 15-Kategorien-Picker mehr.

## Offen

(keine)
