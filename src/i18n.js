import React, { createContext, useContext, useCallback } from 'react';

export const REGELWERK_DE=[
  {nr:'P',title:'Präambel',color:'#FF9F0A',content:`
    <p><strong>Zweck</strong> – Die IGN (Interessengemeinschaft Ninja-Sport) fördert den Ninja-Sport im deutschsprachigen Raum durch einheitliche Wettkampfregeln, die Fairness, Sicherheit und sportlichen Geist gewährleisten.</p>
    <p><strong>Gültigkeit</strong> – Dieses Regelwerk Version 2026 gilt für alle IGN-Wettkämpfe ab der Saison 2026. Es ersetzt alle früheren Versionen.</p>
    <p><strong>Grundsätze</strong> – Ninja-Sport verbindet Kraft, Geschicklichkeit, Ausdauer und mentale Stärke. Die IGN bekennt sich zu inklusivem Sport für alle Altersgruppen und Leistungsniveaus.</p>
    <p><strong>Änderungen</strong> – Regeländerungen werden durch den IGN-Vorstand beschlossen und mindestens 30 Tage vor Saisonbeginn schriftlich kommuniziert. Dringende Sicherheitsänderungen können sofort in Kraft treten.</p>
    <p><strong>Sprachregelung</strong> – Bei Widersprüchen zwischen Übersetzungen gilt die deutsche Fassung als massgeblich.</p>
  `},
  {nr:'1',title:'Wettkampf-Durchführung',color:'#FF5E3A',content:`
    <p><strong>1.1 Veranstalter</strong> – Jeder Verein oder Organisation kann mit IGN-Zulassung einen Wettkampf ausrichten. Der Veranstalter ist verantwortlich für die sichere Durchführung, die Hindernisse und die Einhaltung des Regelwerks. Die Zulassung muss mindestens 4 Wochen vor dem Wettkampf beantragt werden.</p>
    <p><strong>1.2 Jury</strong> – Jede aktive Station benötigt mindestens eine ausgebildete Jury-Person für Zeitnahme und Checkpoint-Beurteilung. Bei LK1-Wettkämpfen werden zwei Jury-Personen pro Station empfohlen. Jury-Personen müssen neutral sein (kein Verwandtschaftsverhältnis zum startenden Athleten).</p>
    <p><strong>1.3 Wettkampfrichter (WR)</strong> – Mindestens ein ausgebildeter WR pro Wettkampf. Der WR hat abschliessende Entscheidungskompetenz bei Regelunklarheiten und Protesten. WR-Entscheidungen nach Ablauf der Protestfrist sind endgültig und bindend.</p>
    <p><strong>1.4 Protest / Reklamation</strong> – Athleten oder ihre Betreuer können Reklamation einlegen. Frist: 15 Minuten nach Bekanntgabe des betreffenden Ergebnisses. Schriftliche Einreichung wird empfohlen, ist jedoch nicht zwingend erforderlich. Eine Schutzgebühr von CHF/EUR 20 ist zu entrichten; bei berechtigtem Protest wird diese zurückerstattet. Die Jury entscheidet innerhalb von 30 Minuten. Gegen WR-Entscheid ist kein weiterer Einspruch möglich.</p>
    <p><strong>1.5 Ergebnisverwaltung</strong> – Die Wettkampfleitung muss alle Ergebnisse digital oder schriftlich festhalten. Ergebnisse werden nach Wettkampfende öffentlich bekannt gegeben, mindestens für 30 Minuten ausgehängt bzw. digital zugänglich gemacht.</p>
    <p><strong>1.6 Ausrüstung</strong> – Geschlossene Sportschuhe sind Pflicht. Chalk (Magnesia) ist erlaubt. Handschuhe sind erlaubt, sofern keine Haftmittel verwendet werden. Schutzausrüstung (Knieschoner, Handgelenkschoner) ist auf eigenes Risiko erlaubt, sofern kein Vorteil entsteht.</p>
    <p><strong>1.7 Wiegen / Altersnachweis</strong> – Der Veranstalter kann Alterskontrollen verlangen. Bei Kategorienstreitigkeiten gilt der Jahresgeburtstag.</p>
  `},
  {nr:'2',title:'Sicherheit',color:'#FF6B6B',content:`
    <p><strong>2.1 Grundsätze</strong> – Sicherheit hat oberste Priorität. Bei unmittelbarer Gefahr kann jede Jury-Person oder der WR den Wettkampf sofort unterbrechen. Der Veranstalter haftet für die Sicherheit der Anlage.</p>
    <p><strong>2.2 Matten und Landezonen</strong> – Unter und hinter allen Hindernissen mit Sturzrisiko müssen ausreichend dimensionierte Crashmatten (min. 20 cm dick) ausgelegt sein. Die Landezone muss frei von Hindernissen sein. Matten müssen fest liegen und dürfen sich nicht verschieben.</p>
    <p><strong>2.3 Hindernissicherheit</strong> – Alle Hindernisse müssen vor dem Wettkampf auf Stabilität und Sicherheit geprüft werden (Belastungstest). Beschädigte Hindernisse sind sofort zu sperren. Hindernisse dürfen keine scharfen Kanten oder abstehenden Teile aufweisen.</p>
    <p><strong>2.4 Athleten-Pflichten</strong> – Athleten müssen sich vor dem Start über die Hindernisse informieren (Walk-Through erlaubt). Athleten dürfen nicht starten, wenn sie verletzt sind. Athleten sind für ihre eigene Aufwärmung verantwortlich.</p>
    <p><strong>2.5 Jury-Pflichten</strong> – Jury-Personen müssen den Lauf jederzeit unterbrechen können (Notfall-Signal vereinbaren). Jury darf einen Lauf bei akuter Verletzungsgefahr stoppen – die Zeit wird bis zum Stoppzeitpunkt gewertet. Bei Sturz mit Verletzung: Erste Hilfe hat Vorrang, Ergebnis wird gesondert gewertet.</p>
    <p><strong>2.6 Spotter</strong> – Für riskante Hindernisse (grosse Höhe, Rotation) können Spotter eingesetzt werden. Spotter dürfen Athleten nicht aktiv unterstützen (kein physischer Kontakt), nur absichern.</p>
    <p><strong>2.7 Bambinis (5–7 Jahre)</strong> – Bei der Bambini-Kategorie ist ein Elternteil oder Betreuer als Spotter Pflicht. Die Hindernisse müssen altersgerecht und sicher sein.</p>
  `},
  {nr:'3',title:'Wettkampfablauf',color:'#30D158',content:`
    <p><strong>3.1 Startreihenfolge</strong> – Die Startreihenfolge wird vom Veranstalter festgelegt. Empfohlen wird eine Auslosung oder Anmeldungsreihenfolge. In der Finalrunde wird in umgekehrter Qualifikationsreihenfolge gestartet (Letzter zuerst).</p>
    <p><strong>3.2 Aufwärmzeit</strong> – Den Athleten ist ausreichend Zeit für das Aufwärmen zu gewähren. Ein Walk-Through der Hindernisse (ohne Starten) muss vor dem Wettkampf ermöglicht werden. Mindestens 15 Minuten Aufwärmzeit vor dem ersten Start.</p>
    <p><strong>3.3 Startaufruf</strong> – Athleten werden mindestens zweimal ausgerufen. Bei Nichterscheinen innerhalb von 2 Minuten nach drittem Aufruf: Lauf verfallen (DNS). Auf Antrag kann der WR Ausnahmen gewähren (Force Majeure).</p>
    <p><strong>3.4 Versuch / Wiederholungsversuch</strong> – Jeder Athlet hat pro Wettkampfrunde einen Versuch, sofern vom Veranstalter nicht anders festgelegt. Ein Wiederholungsversuch kann gewährt werden bei: technischem Defekt eines Hindernisses, Einwirkung Dritter oder nachgewiesenem Jury-Fehler.</p>
    <p><strong>3.5 Frühstart</strong> – Ein Athlet darf das erste Hindernis erst berühren, nachdem das Startsignal vollständig (GO-Ton) ertönt ist. Frühstart: Lauf ungültig, Neustart möglich. Zweiter Frühstart: Lauf ungültig, kein Neustart. Versuche die mit Frühstart beginnen werden nicht gewertet.</p>
    <p><strong>3.6 Zuschauerpflichten</strong> – Zuschauer dürfen Athleten nicht anfeuern auf eine Weise, die andere Athleten oder die Jury beeinträchtigt. Das Betreten der Aktionsfläche durch Unbefugte ist verboten.</p>
  `},
  {nr:'4',title:'Ausschreibung',color:'#64D2FF',content:`
    <p><strong>4.1 Pflichtangaben</strong> – Jede Wettkampfausschreibung muss enthalten: Datum und Ort, Kategorien, Wettkampfmodus, Hindernisliste, Zeitlimits, Anmeldefrist, Startgebühren, Preisgelder/Sachpreise (falls vorhanden), Kontaktdaten des Veranstalters.</p>
    <p><strong>4.2 Anmeldefrist</strong> – Die Anmeldefrist muss mindestens 7 Tage vor dem Wettkampf enden. Nach Fristende können keine Anmeldungen mehr garantiert werden. Der Veranstalter kann eine Nachmeldeoption mit Aufpreis anbieten.</p>
    <p><strong>4.3 Kategorienänderung</strong> – Athleten können bis 48 Stunden vor Wettkampfbeginn die Kategorie wechseln (einmalig, falls Kapazität vorhanden). Startgeld-Differenzen werden verrechnet.</p>
    <p><strong>4.4 Absage</strong> – Muss der Veranstalter absagen, sind alle Startgebühren innerhalb von 14 Tagen zurückzuerstatten. Bei Absage durch Athleten gelten die Stornobedingungen des Veranstalters (max. 80 % Einbehalt).</p>
    <p><strong>4.5 Datenschutz</strong> – Der Veranstalter ist verpflichtet, Athletendaten DSGVO-konform zu verarbeiten. Ergebnislisten mit Name und Kategorie dürfen öffentlich veröffentlicht werden.</p>
  `},
  {nr:'5',title:'Divisionen & Kategorien',color:'#FF9F0A',content:`
    <p><strong>5.1 Übersicht</strong> – Die IGN kennt 15 Wettkampfkategorien, gegliedert nach Altersgruppe, Geschlecht und Leistungsklasse (LK1/LK2).</p>
    <p><strong>5.2 Bambinis</strong> – Alter: 5–7 Jahre, gemischt (M+W). Keine LK-Einteilung. Angepasste Hindernisse zwingend. Kein Zeitlimit. Betreuer als Spotter Pflicht.</p>
    <p><strong>5.3 Kids</strong> – Alter: 8–11 Jahre. Aufgeteilt in: Kids M LK1, Kids M LK2, Kids W LK1, Kids W LK2. Angepasste Hindernishöhen empfohlen.</p>
    <p><strong>5.4 Teens</strong> – Alter: 12–15 Jahre. Aufgeteilt in: Teens M LK1, Teens M LK2, Teens W LK1, Teens W LK2.</p>
    <p><strong>5.5 Adults</strong> – Alter: 16–39 Jahre. Aufgeteilt in: Adults M LK1, Adults M LK2, Adults W LK1, Adults W LK2. Höchste Wettkampfklasse.</p>
    <p><strong>5.6 Masters</strong> – Alter: 40+ Jahre. Aufgeteilt in: Masters M (40+), Masters W (40+). Hindernisse können angepasst werden.</p>
    <p><strong>5.7 Leistungsklassen</strong> – <strong>LK1</strong>: Erfahrene Athleten, digitale Zeitmessung auf Millisekunden (MM:SS.mmm) verpflichtend, anspruchsvollere Hindernisse. <strong>LK2</strong>: Einsteiger und Fortgeschrittene, Stoppuhr auf Zehntelsekunden ausreichend, zugänglichere Hindernisse.</p>
    <p><strong>5.8 Aufstieg LK2 → LK1</strong> – Nach 3 Podiumsplätzen (Plätze 1–3) in LK2 innerhalb einer Saison ist der Aufstieg in LK1 für die Folgesaison verpflichtend. Freiwilliger Aufstieg ist jederzeit möglich.</p>
    <p><strong>5.9 Altersberechnung</strong> – Massgeblich ist das Alter am Wettkampftag. Athleten an einem Geburtstag starten in der neuen Kategorie. Bei Altersüberschreitung mit Saisonbeginn können Athleten die aktuelle Saison in der bisherigen Kategorie beenden.</p>
  `},
  {nr:'6',title:'Wettkampfmodi',color:'#BF5AF2',content:`
    <p><strong>6.1 Classic</strong> – Athlet durchläuft alle Hindernisse in vorgegebener Reihenfolge. Wertung: primär Anzahl absolvierter Checkpoints (absteigend), sekundär Zeit (aufsteigend). Ein Versuch pro Runde. Bei Fall endet der Lauf am letzten gehaltenen Checkpoint.</p>
    <p><strong>6.2 Segment Race</strong> – Die Strecke ist in Segmente unterteilt (je nach Anlage 2–5 Segmente). Jedes Segment endet an einer Landeplattform. Pro Segment wird die Zeit einzeln gestoppt. Wertung: primär abgeschlossene Segmente, sekundär Gesamtzeit. Fällt ein Athlet innerhalb eines Segments, scheidet er aus diesem Segment aus; absolvierte Segmente bleiben gewertet.</p>
    <p><strong>6.3 Classic + Leben (Lives)</strong> – Wie Classic, aber mit einer festgelegten Anzahl Leben (Standard: 3, vom Veranstalter wählbar: 1–5). Jeder Fall kostet ein Leben; der Lauf beginnt neu am letzten Segment-Start. Sind alle Leben aufgebraucht, endet der Lauf. Gewertet wird der beste erreichte Stand (weitester Checkpoint, kürzeste Zeit).</p>
    <p><strong>6.4 Segment + Leben</strong> – Kombination: Segment Race mit Leben-System. Bei Fall innerhalb eines Segments wird ein Leben abgezogen und das Segment neu gestartet. Alle Leben weg = Segment endet, nächstes Segment entfällt.</p>
    <p><strong>6.5 Finale-Optionen</strong> – Der Veranstalter kann ein separates Finale mit Top-N-Athleten ausschreiben. Im Finale kann ein anderer Modus als in der Qualifikation verwendet werden. Finale-Ergebnisse überschreiben Qualifikations-Ergebnisse für die Endrangliste.</p>
  `},
  {nr:'7',title:'Start- & Landeplattform',color:'#5AC8FA',content:`
    <p><strong>7.1 Startplattform</strong> – Mindestmasse: 80 cm × 80 cm, rutschfeste Oberfläche. Mindesthöhe über Boden: 30 cm (empfohlen: 50–80 cm). Der Athlet muss vollständig auf der Startplattform stehen, bevor das Startsignal ertönt. Kein Momentum vor dem Startsignal erlaubt (kein Anlaufen, kein Vorlehnen).</p>
    <p><strong>7.2 Landeplattform</strong> – Muss das Ende eines Segments klar markieren. Mindestmasse: 100 cm × 100 cm. Stabiles Stehen auf der Plattform beendet das Segment (mind. 1 Sekunde, keine Vorwärtsbewegung). Beim Segment-Start muss der Athlet vollständig auf der Plattform stehen.</p>
    <p><strong>7.3 Bodenkontakt</strong> – Berührt der Athlet zwischen Hindernissen den Boden (ausserhalb definierter Laufbereiche), gilt dies als Fall. Ausnahmen: klar markierte Bodenbereiche zwischen Hindernissen (z.B. Sprungangang). Diese müssen in der Ausschreibung explizit genannt sein.</p>
    <p><strong>7.4 Zieleinlauf</strong> – Das Ziel wird durch eine klar markierte Ziellinie oder -plattform definiert. Die Zeitmessung endet, wenn der Athlet die Ziellinie überquert (Körperschwerpunkt). Bei Segment Race endet das letzte Segment mit stabiler Position auf der Ziel-Landeplattform.</p>
  `},
  {nr:'8',title:'Hindernisse & Checkpoints',color:'#34C759',content:`
    <p><strong>8.1 Hindernisreihenfolge</strong> – Alle Hindernisse müssen in der vorgegebenen Reihenfolge absolviert werden. Ein Hindernis gilt als absolviert, wenn der Athlet es vollständig durchlaufen/überwunden hat ohne Bodenkontakt (ausser erlaubte Bodenbereiche).</p>
    <p><strong>8.2 Überspringen</strong> – Überspringt oder umgeht ein Athlet ein Hindernis, sind alle nachfolgenden Resultate ab diesem Hindernis annulliert. Der weiteste korrekt absolvierte Checkpoint bleibt gewertet.</p>
    <p><strong>8.3 Wiederholung</strong> – Hindernisse dürfen nicht wiederholt werden (kein Zurückgehen). Ausnahme: Der WR kann bei technischem Defekt eines Hindernisses einen Neuversuch anordnen.</p>
    <p><strong>8.4 Festhalten / Zusatz-Kontakt</strong> – Der Athlet darf nur an den vorgesehenen Griffen und Flächen festhalten. Festhalten an Konstruktionen, Seilen oder unvorgesehenen Teilen gilt als Disqualifikation des aktuellen Versuchs ab diesem Punkt.</p>
    <p><strong>8.5 Externe Hilfe</strong> – Jede physische Unterstützung durch Dritte (Anfassen, Schieben, Stabilisieren) führt zur Disqualifikation des gesamten Laufs. Ausnahme: Sicherheits-Spotter in vorher festgelegtem Notfall-Szenario.</p>
    <p><strong>8.6 Hindernisbeschädigung</strong> – Beschädigt ein Athlet absichtlich ein Hindernis oder verändert dessen Position, wird der Lauf disqualifiziert. Bei unbeabsichtigter Beschädigung entscheidet der WR.</p>
    <p><strong>8.7 Wartezeit</strong> – Bleibt ein Athlet länger als 10 Sekunden an einem Hindernis stehen (kein Fortschritt), kann die Jury einen gelben Ton/Signal geben. Bei nochmaligem Stillstand: rotes Signal = Lauf wird beendet (Zeit zum letzten CP gewertet).</p>
    <p><strong>8.8 Chalk / Magnesia</strong> – Die Benutzung von Chalk ist erlaubt. Übermässiger Chalk-Einsatz, der andere Athleten beeinträchtigt, kann gerügt werden. Liquid Chalk und Block Chalk sind beide erlaubt.</p>
    <p><strong>8.9 Checkpointsystem</strong> – Ein Checkpoint (CP) ist eine definierte stabile Halteposition an einem Hindernis. <strong>Definition Stabiles Halten:</strong> Der Athlet hält mind. 1 Sekunde vollständig an der dafür vorgesehenen Position inne, ohne Vor- oder Rückwärtsbewegung. Die Jury bestätigt den CP durch Signal (Ton, Handzeichen oder App-Eingabe). Der zuletzt bestätigte CP gilt als Ausgangspunkt für die Zeitwertung bei Fall.</p>
  `},
  {nr:'9',title:'Zeitmessung',color:'#0A84FF',content:`
    <p><strong>9.1 Allgemein</strong> – Die offizielle Zeit wird von der Jury gemessen. Bei Diskrepanz zwischen digitalem System und Stoppuhr gilt das digitale System (LK1) bzw. die Stoppuhr (LK2) als massgeblich. Die Zeit wird dem Athleten unmittelbar nach dem Lauf mitgeteilt.</p>
    <p><strong>9.2 Startsignal</strong> – Das offizielle Startsignal besteht aus drei kurzen Vorbereitungstönen (Beep–Beep–Beep) in 1-Sekunden-Abständen, gefolgt von einem langen GO-Horn. <strong>Die Zeitmessung beginnt exakt mit dem GO-Horn.</strong> Der Athlet darf das erste Hindernis erst berühren, nachdem der GO-Horn ertönt hat. Ein akustisches System ist bei LK1 Pflicht; bei LK2 genügt auch ein manuelles Signal.</p>
    <p><strong>9.3 LK1 Anforderungen</strong> – Digitale Zeitmessung auf Millisekunden (MM:SS.mmm) ist verpflichtend. Empfohlen: automatisches Timing-System (Lichtschranke oder App-gestützt). Manuelle Zeitmessung mit Millisekunden-Stoppuhr ist als Backup erlaubt.</p>
    <p><strong>9.4 LK2 Anforderungen</strong> – Stoppuhr auf Zehntelsekunden (MM:SS.s) genügt. Digitale Zeitmessung empfohlen. Die Zeit wird auf die nächste Zehntelsekunde gerundet.</p>
    <p><strong>9.5 Checkpoint-Zeitnahme</strong> – Bei LK1 wird die Zeit jedes bestätigten Checkpoints festgehalten (Zwischenzeit). Diese dient als Wertungsgrundlage bei Fall. Die Zwischenzeit läuft ab dem GO-Horn kontinuierlich; Checkpoints addieren sich nicht, sondern bilden Momentaufnahmen der laufenden Zeit.</p>
    <p><strong>9.6 Zeitlimit</strong> – Der Veranstalter kann ein Zeitlimit festlegen. Bei Erreichen des Zeitlimits wird der Lauf automatisch beendet; der zuletzt bestätigte Checkpoint und die Zeit bis zum Limit gelten als offizielles Ergebnis. Das Zeitlimit muss in der Ausschreibung klar kommuniziert werden.</p>
    <p><strong>9.7 Zeitmessung bei Unterbrechung</strong> – Bei einer Unterbrechung durch die Jury (z.B. Sicherheitsvorfall) wird die Zeit angehalten. Bei Wiederaufnahme läuft die Zeit weiter. Kann der Lauf nicht fortgesetzt werden, gilt die Zeit bis zur Unterbrechung am letzten CP als offizielles Ergebnis.</p>
  `},
  {nr:'10',title:'Ergebnisse & Rangliste',color:'#FF9F0A',content:`
    <p><strong>10.1 Wertungsprinzip</strong> – Die Rangliste wird nach folgendem Prinzip erstellt: <strong>Primärkriterium:</strong> Anzahl absolvierter Checkpoints (absteigend – mehr CPs = besser). <strong>Sekundärkriterium:</strong> Offizielle Zeit (aufsteigend – weniger Zeit = besser). Das Checkpointsystem ist für LK1 verpflichtend; für LK2 empfohlen.</p>
    <p><strong>10.2 Gleichstand</strong> – Bei identischer CP-Anzahl und identischer Zeit entscheidet die Anzahl der Versuche (weniger Versuche = besser). Besteht weiterhin Gleichstand, teilen die Athleten den Rang; der nächste Rang entfällt.</p>
    <p><strong>10.3 DNF (Did Not Finish)</strong> – Ein Athlet erhält DNF, wenn er kein einziges Hindernis absolviert hat oder die Ziellinie nicht erreicht hat. DNF-Athleten werden nach abgeschlossenen CPs gewertet und hinter alle Athleten mit Zeitwertung gesetzt.</p>
    <p><strong>10.4 DSQ (Disqualifikation)</strong> – Disqualifizierte Athleten erscheinen nicht in der offiziellen Rangliste. Gründe für DSQ: externe Hilfe, absichtliche Regelverstösse, Ausrüstungsverstoss, Dopingverstoss.</p>
    <p><strong>10.5 DNS (Did Not Start)</strong> – Angemeldete Athleten, die nicht am Start erscheinen, erhalten DNS. DNS zählt für die Kategorienwertung nicht.</p>
    <p><strong>10.6 Veröffentlichung</strong> – Vorläufige Ergebnisse müssen spätestens 30 Minuten nach dem letzten Lauf der Kategorie bekannt gegeben werden. Endgültige Ergebnisse nach Ablauf der Protestfrist. Ergebnisse sind mindestens 7 Tage öffentlich zugänglich zu machen.</p>
    <p><strong>10.7 Serienrangliste</strong> – Richtet ein Verband eine Wettkampfserie aus, werden Punkte nach einem festgelegten Schema vergeben (z.B. 25-18-15-12-10-8-6-4-2-1 für die Plätze 1–10). Streichresultate sind möglich.</p>
  `},
  {nr:'11',title:'Anti-Doping',color:'#FF3B30',content:`
    <p><strong>11.1 Grundsatz</strong> – Die IGN bekennt sich zu einem fairen und dopingfreien Sport. Es gelten die Anti-Doping-Regeln der WADA (World Anti-Doping Agency) in der jeweils gültigen Fassung.</p>
    <p><strong>11.2 Kontrollen</strong> – Der Veranstalter kann Dopingkontrollen durchführen oder durch eine autorisierte Stelle durchführen lassen. Zielkontrollen sind möglich. Verweigerung einer Kontrolle gilt als positiver Befund.</p>
    <p><strong>11.3 Verbotene Substanzen</strong> – Es gilt die aktuelle WADA-Verbotsliste. Betahydroxybutyrat (BHB), Stimulanzien, Wachstumshormone und Blutdoping sind explizit verboten. Therapeutische Ausnahmegenehmigungen (TUE) müssen vor dem Wettkampf beantragt und genehmigt sein.</p>
    <p><strong>11.4 Sanktionen</strong> – Bei positivem Befund: Disqualifikation des Wettkampfergebnisses, Rückforderung von Preisen/Preisgeld. Wiederholungsverstösse führen zu Sperren gemäss WADA-Richtlinien.</p>
  `},
  {nr:'12',title:'Sanktionen',color:'#FF2D78',content:`
    <p><strong>12.1 Verwarnung (Gelbe Karte)</strong> – Für leichte Regelverstösse, unsportliches Verhalten oder wiederholte Frühstarts. Zwei Gelbe Karten im selben Wettkampf = Rote Karte.</p>
    <p><strong>12.2 Disqualifikation (Rote Karte)</strong> – Sofortige DSQ für: absichtliche Behinderung anderer Athleten, grobe Unsportlichkeit, Beleidigung von Jury/WR, externe Hilfe, Ausrüstungsbetrug, wiederholte grobe Regelverstösse.</p>
    <p><strong>12.3 Wettkampfsperre</strong> – Kann vom WR oder IGN-Vorstand ausgesprochen werden. Kurze Sperre (1–3 Wettkämpfe): für DSQ-würdige Verhaltensweisen. Lange Sperre (1–2 Saisons): für schwere Verstösse, Gewalt, Doping. Lebenslange Sperre: für schwerste Verstösse.</p>
    <p><strong>12.4 Berufung</strong> – Gegen Sperren kann innerhalb von 14 Tagen schriftlich Berufung beim IGN-Vorstand eingelegt werden. Der Berufungsausschuss entscheidet innerhalb von 30 Tagen. Entscheid ist endgültig.</p>
    <p><strong>12.5 Registrierung</strong> – Alle Sanktionen werden vom IGN-Vorstand registriert. Gesperrte Athleten dürfen an keinem IGN-Wettkampf teilnehmen – auch nicht als Zuschauer in der Aktionsfläche.</p>
  `},
  {nr:'13',title:'Begriffsdefinitionen',color:'#8E8E93',content:`
    <p><strong>Checkpoint (CP)</strong> – Klar definierte, von der Jury bestätigte Halteposition an einem Hindernis. Bildet Grundlage der Zeitwertung bei Fall.</p>
    <p><strong>DNF</strong> – Did Not Finish. Athlet hat keinen Checkpoint erreicht oder die Ziellinie nicht überquert.</p>
    <p><strong>DNS</strong> – Did Not Start. Angemeldeter Athlet ist nicht am Start erschienen.</p>
    <p><strong>DSQ</strong> – Disqualifikation. Lauf oder Wettkampf wird aus der Wertung genommen.</p>
    <p><strong>Fall</strong> – Unkontrollierter Kontakt mit dem Boden oder einer nicht vorgesehenen Stützfläche. Beendet den Lauf am letzten gehaltenen Checkpoint (ausser im Lives-Modus).</p>
    <p><strong>Frühstart</strong> – Berühren des ersten Hindernisses vor dem GO-Horn. Führt zur Ungültigkeit des Versuchs.</p>
    <p><strong>GO-Horn</strong> – Der lange Abschluss-Ton des Startsignals. Exakter Startpunkt der Zeitmessung.</p>
    <p><strong>IGN</strong> – Interessengemeinschaft Ninja-Sport. Dachverband für Ninja-Sport im deutschsprachigen Raum.</p>
    <p><strong>Jury</strong> – Offizielle Person(en) an einer Station, zuständig für Zeitnahme und Checkpoint-Beurteilung.</p>
    <p><strong>Leben (Life)</strong> – Im Lives-Modus: Ressource, die bei einem Fall verbraucht wird. Ermöglicht Weiterstarten am Segment-Anfang.</p>
    <p><strong>LK1 / LK2</strong> – Leistungsklassen. LK1: erfahrene/fortgeschrittene Athleten, LK2: Einsteiger/Fortgeschrittene.</p>
    <p><strong>Reklamation / Protest</strong> – Formeller Einspruch eines Athleten gegen ein Ergebnis oder eine Entscheidung. Frist: 15 Minuten ab Bekanntgabe.</p>
    <p><strong>Segment</strong> – Im Segment Race: Streckenabschnitt zwischen zwei Landeplattformen. Wird einzeln gewertet.</p>
    <p><strong>Spotter</strong> – Sicherheitsperson an einem Hindernis. Darf nur im Notfall physischen Kontakt aufnehmen.</p>
    <p><strong>Stage</strong> – Eine Jury-Station innerhalb eines Wettkampfs. Mehrere Stages laufen parallel.</p>
    <p><strong>Wettkampfrichter (WR)</strong> – Ausgebildete Aufsichtsperson mit abschliessender Entscheidungskompetenz bei Regelunklarheiten.</p>
    <p><strong>Zeitlimit</strong> – Maximale Laufzeit pro Versuch. Wird vom Veranstalter festgelegt und in der Ausschreibung kommuniziert.</p>
  `},
];

export const REGELWERK_EN=[
{nr:'P',title:'Preamble',color:'#FF9F0A',content:`
    <p><strong>Purpose</strong> – The IGN (Interessengemeinschaft Ninja-Sport) promotes ninja sport in the German-speaking region through uniform competition rules that ensure fairness, safety, and sporting spirit.</p>
    <p><strong>Validity</strong> – This Rulebook Version 2026 applies to all IGN competitions from the 2026 season onwards. It supersedes all previous versions.</p>
    <p><strong>Principles</strong> – Ninja sport combines strength, skill, endurance, and mental fortitude. The IGN is committed to inclusive sport for all age groups and performance levels.</p>
    <p><strong>Changes</strong> – Rule changes are decided by the IGN Board and communicated in writing at least 30 days before the start of the season. Urgent safety changes may take effect immediately.</p>
    <p><strong>Language Provision</strong> – In case of discrepancies between translations, the German version shall be authoritative.</p>
`},
{nr:'1',title:'Competition Organization',color:'#FF5E3A',content:`
    <p><strong>1.1 Organizers</strong> – Any club or organization may organize a competition with IGN approval. The organizer is responsible for safe conduct, obstacles, and compliance with the rulebook. Approval must be requested at least 4 weeks before the competition.</p>
    <p><strong>1.2 Jury</strong> – Each active station requires at least one trained jury person for timekeeping and checkpoint assessment. At LK1 competitions, two jury persons per station are recommended. Jury persons must be impartial (no family relationship to competing athletes).</p>
    <p><strong>1.3 Competition Referee (WR)</strong> – At least one trained WR per competition. The WR has final decision-making authority on rule clarifications and protests. WR decisions after the protest deadline are final and binding.</p>
    <p><strong>1.4 Protest / Objection</strong> – Athletes or their coaches may lodge an objection. Deadline: 15 minutes after announcement of the relevant result. Written submission is recommended but not mandatory. A filing fee of CHF/EUR 20 must be paid; the fee is refunded if the protest is justified. The jury decides within 30 minutes. No further appeal against WR decisions is possible.</p>
    <p><strong>1.5 Results Management</strong> – Competition management must record all results digitally or in writing. Results are made public after competition ends, displayed for at least 30 minutes or made digitally available.</p>
    <p><strong>1.6 Equipment</strong> – Closed sports shoes are mandatory. Chalk (magnesium) is permitted. Gloves are permitted provided no adhesive substances are used. Protective equipment (knee pads, wrist guards) is permitted at athlete's own risk provided it confers no advantage.</p>
    <p><strong>1.7 Weighing / Age Verification</strong> – The organizer may require age verification. In case of category disputes, the birthdate shall be decisive.</p>
`},
{nr:'2',title:'Safety',color:'#FF6B6B',content:`
    <p><strong>2.1 Principles</strong> – Safety has top priority. In case of immediate danger, any jury person or the WR may immediately interrupt the competition. The organizer is liable for facility safety.</p>
    <p><strong>2.2 Mats and Landing Zones</strong> – Adequate crash mats (minimum 20 cm thick) must be laid under and behind all obstacles with fall risk. The landing zone must be free of obstacles. Mats must lie flat and must not shift.</p>
    <p><strong>2.3 Obstacle Safety</strong> – All obstacles must be checked for stability and safety before the competition (load test). Damaged obstacles must be immediately closed off. Obstacles must have no sharp edges or protruding parts.</p>
    <p><strong>2.4 Athlete Responsibilities</strong> – Athletes must familiarize themselves with obstacles before the start (walk-through permitted). Athletes must not start if injured. Athletes are responsible for their own warm-up.</p>
    <p><strong>2.5 Jury Responsibilities</strong> – Jury persons must be able to interrupt a run at any time (emergency signal agreed upon). The jury may stop a run if acute injury risk exists – the time is scored up to the stop point. In case of a fall with injury: first aid takes priority, result is scored separately.</p>
    <p><strong>2.6 Spotters</strong> – Spotters may be deployed for risky obstacles (high altitude, rotation). Spotters may not actively support athletes (no physical contact), only secure them.</p>
    <p><strong>2.7 Bambinis (5–7 Years)</strong> – In the Bambini category, a parent or coach as spotter is mandatory. Obstacles must be age-appropriate and safe.</p>
`},
{nr:'3',title:'Competition Flow',color:'#30D158',content:`
    <p><strong>3.1 Start Order</strong> – The organizer determines start order. A draw or registration order is recommended. In the final round, athletes start in reverse qualification order (last-placed starts first).</p>
    <p><strong>3.2 Warm-up Time</strong> – Athletes must be given sufficient warm-up time. A walk-through of obstacles (without starting) must be permitted before the competition. Minimum 15 minutes warm-up time before first start.</p>
    <p><strong>3.3 Start Call</strong> – Athletes are called at least twice. If not present within 2 minutes of the third call: run disqualified (DNS). Upon request, the WR may grant exceptions (force majeure).</p>
    <p><strong>3.4 Attempt / Retry</strong> – Each athlete has one attempt per competition round, unless the organizer specifies otherwise. A retry may be granted for: technical defect of an obstacle, third-party interference, or confirmed jury error.</p>
    <p><strong>3.5 False Start</strong> – An athlete may not touch the first obstacle before the start signal is complete (GO-tone). False start: run invalid, restart possible. Second false start: run invalid, no restart. Attempts beginning with a false start are not scored.</p>
    <p><strong>3.6 Spectator Responsibilities</strong> – Spectators may not cheer in a way that disrupts other athletes or the jury. Unauthorized entry into the action area is prohibited.</p>
`},
{nr:'4',title:'Announcements',color:'#64D2FF',content:`
    <p><strong>4.1 Required Information</strong> – Every competition announcement must contain: date and location, categories, competition mode, obstacle list, time limits, registration deadline, entry fees, prize money/prizes (if applicable), organizer contact information.</p>
    <p><strong>4.2 Registration Deadline</strong> – The registration deadline must close at least 7 days before the competition. After the deadline, registrations cannot be guaranteed. The organizer may offer a late registration option with surcharge.</p>
    <p><strong>4.3 Category Change</strong> – Athletes may change category up to 48 hours before competition start (one time only, if capacity available). Entry fee differences are adjusted.</p>
    <p><strong>4.4 Cancellation</strong> – If the organizer must cancel, all entry fees must be refunded within 14 days. For athlete cancellations, the organizer's cancellation terms apply (maximum 80% retention).</p>
    <p><strong>4.5 Data Protection</strong> – The organizer must process athlete data in compliance with GDPR. Results lists with name and category may be published publicly.</p>
`},
{nr:'5',title:'Divisions & Categories',color:'#FF9F0A',content:`
    <p><strong>5.1 Overview</strong> – The IGN recognizes 15 competition categories, divided by age group, gender, and performance level (LK1/LK2).</p>
    <p><strong>5.2 Bambinis</strong> – Age: 5–7 years, mixed (M+W). No LK classification. Adapted obstacles mandatory. No time limit. Coach as spotter mandatory.</p>
    <p><strong>5.3 Kids</strong> – Age: 8–11 years. Divided into: Kids M LK1, Kids M LK2, Kids W LK1, Kids W LK2. Adapted obstacle heights recommended.</p>
    <p><strong>5.4 Teens</strong> – Age: 12–15 years. Divided into: Teens M LK1, Teens M LK2, Teens W LK1, Teens W LK2.</p>
    <p><strong>5.5 Adults</strong> – Age: 16–39 years. Divided into: Adults M LK1, Adults M LK2, Adults W LK1, Adults W LK2. Highest competition class.</p>
    <p><strong>5.6 Masters</strong> – Age: 40+ years. Divided into: Masters M (40+), Masters W (40+). Obstacles may be adapted.</p>
    <p><strong>5.7 Performance Levels</strong> – <strong>LK1</strong>: Experienced athletes, digital timekeeping to milliseconds (MM:SS.mmm) mandatory, more challenging obstacles. <strong>LK2</strong>: Beginners and intermediate athletes, stopwatch to tenths of a second sufficient, more accessible obstacles.</p>
    <p><strong>5.8 Advancement LK2 → LK1</strong> – After 3 podium placements (places 1–3) in LK2 within one season, advancement to LK1 is mandatory for the following season. Voluntary advancement is possible at any time.</p>
    <p><strong>5.9 Age Calculation</strong> – The athlete's age on competition day is decisive. Athletes on a birthday start in the new category. If age is exceeded at season start, athletes may finish the current season in their previous category.</p>
`},
{nr:'6',title:'Competition Modes',color:'#BF5AF2',content:`
    <p><strong>6.1 Classic</strong> – Athlete completes all obstacles in specified order. Scoring: primarily number of completed checkpoints (descending), secondarily time (ascending). One attempt per round. Upon a fall, the run ends at the last held checkpoint.</p>
    <p><strong>6.2 Segment Race</strong> – The course is divided into segments (depending on layout, 2–5 segments). Each segment ends at a landing platform. Time is stopped separately for each segment. Scoring: primarily completed segments, secondarily total time. If an athlete falls within a segment, they are eliminated from that segment; completed segments remain scored.</p>
    <p><strong>6.3 Classic + Lives</strong> – Like Classic, but with a fixed number of lives (standard: 3, organizer selectable: 1–5). Each fall costs one life; the run restarts at the last segment start. When all lives are exhausted, the run ends. The best achieved position (furthest checkpoint, shortest time) is scored.</p>
    <p><strong>6.4 Segment + Lives</strong> – Combination: Segment Race with lives system. Upon a fall within a segment, one life is deducted and the segment is restarted. No lives left = segment ends, next segment waived.</p>
    <p><strong>6.5 Final Options</strong> – The organizer may schedule a separate final with top-N athletes. A different mode may be used in the final than in qualification. Final results override qualification results for the final ranking.</p>
`},
{nr:'7',title:'Start & Landing Platform',color:'#5AC8FA',content:`
    <p><strong>7.1 Start Platform</strong> – Minimum dimensions: 80 cm × 80 cm, non-slip surface. Minimum height above ground: 30 cm (recommended: 50–80 cm). The athlete must stand completely on the start platform before the start signal. No momentum before start signal permitted (no running start, no leaning forward).</p>
    <p><strong>7.2 Landing Platform</strong> – Must clearly mark the end of a segment. Minimum dimensions: 100 cm × 100 cm. Stable stance on the platform ends the segment (at least 1 second, no forward movement). At segment start, the athlete must stand completely on the platform.</p>
    <p><strong>7.3 Ground Contact</strong> – If the athlete touches ground between obstacles (outside defined running areas), this counts as a fall. Exceptions: clearly marked ground areas between obstacles (e.g., jump approach). These must be explicitly named in the announcement.</p>
    <p><strong>7.4 Finish Line</strong> – The finish is defined by a clearly marked finish line or platform. Timekeeping ends when the athlete crosses the finish line (center of mass). In Segment Race, the last segment ends with stable position on the finish landing platform.</p>
`},
{nr:'8',title:'Obstacles & Checkpoints',color:'#34C759',content:`
    <p><strong>8.1 Obstacle Order</strong> – All obstacles must be completed in the specified order. An obstacle is considered completed when the athlete has fully traversed/overcome it without ground contact (except permitted ground areas).</p>
    <p><strong>8.2 Skipping</strong> – If an athlete skips or bypasses an obstacle, all subsequent results from that obstacle are annulled. The furthest correctly completed checkpoint remains scored.</p>
    <p><strong>8.3 Repetition</strong> – Obstacles may not be repeated (no going back). Exception: The WR may order a retry for technical obstacle defect.</p>
    <p><strong>8.4 Holding / Additional Contact</strong> – The athlete may only grip designated handles and surfaces. Gripping constructions, ropes, or unintended parts constitutes disqualification from that point onward.</p>
    <p><strong>8.5 External Help</strong> – Any physical support by third parties (touching, pushing, stabilizing) results in disqualification of the entire run. Exception: safety spotter in pre-arranged emergency scenario.</p>
    <p><strong>8.6 Obstacle Damage</strong> – If an athlete intentionally damages an obstacle or changes its position, the run is disqualified. In case of unintentional damage, the WR decides.</p>
    <p><strong>8.7 Waiting Time</strong> – If an athlete remains stationary at an obstacle longer than 10 seconds (no progress), the jury may give a yellow tone/signal. Upon further stillness: red signal = run is ended (time to last CP scored).</p>
    <p><strong>8.8 Chalk / Magnesium</strong> – Use of chalk is permitted. Excessive chalk use that disrupts other athletes may be cautioned. Liquid chalk and block chalk are both permitted.</p>
    <p><strong>8.9 Checkpoint System</strong> – A checkpoint (CP) is a defined stable holding position on an obstacle. <strong>Definition Stable Hold:</strong> The athlete holds for at least 1 second completely at the designated position, without forward or backward movement. The jury confirms the CP by signal (tone, hand signal, or app entry). The last confirmed CP serves as the starting point for time scoring upon a fall.</p>
`},
{nr:'9',title:'Timekeeping',color:'#0A84FF',content:`
    <p><strong>9.1 General</strong> – Official time is measured by the jury. In case of discrepancy between digital system and stopwatch, the digital system (LK1) or stopwatch (LK2) is authoritative. Time is announced to the athlete immediately after the run.</p>
    <p><strong>9.2 Start Signal</strong> – The official start signal consists of three short preparation tones (beep–beep–beep) at 1-second intervals, followed by a long GO horn. <strong>Timekeeping begins exactly with the GO horn.</strong> The athlete may not touch the first obstacle until after the GO horn sounds. An acoustic system is mandatory for LK1; for LK2 a manual signal suffices.</p>
    <p><strong>9.3 LK1 Requirements</strong> – Digital timekeeping to milliseconds (MM:SS.mmm) is mandatory. Recommended: automatic timing system (light barrier or app-based). Manual timekeeping with millisecond stopwatch is permitted as backup.</p>
    <p><strong>9.4 LK2 Requirements</strong> – Stopwatch to tenths of a second (MM:SS.s) is sufficient. Digital timekeeping recommended. Time is rounded to the nearest tenth of a second.</p>
    <p><strong>9.5 Checkpoint Timekeeping</strong> – For LK1, the time of each confirmed checkpoint is recorded (split time). This serves as the scoring basis upon a fall. Split time runs continuously from the GO horn; checkpoints do not add up but represent snapshots of elapsed time.</p>
    <p><strong>9.6 Time Limit</strong> – The organizer may set a time limit. Upon reaching the time limit, the run ends automatically; the last confirmed checkpoint and time to the limit constitute the official result. The time limit must be clearly communicated in the announcement.</p>
    <p><strong>9.7 Timekeeping Upon Interruption</strong> – If the jury interrupts the run (e.g., safety incident), time is paused. Upon resumption, time resumes. If the run cannot be continued, the time to interruption at the last CP is the official result.</p>
`},
{nr:'10',title:'Results & Rankings',color:'#FF9F0A',content:`
    <p><strong>10.1 Scoring Principle</strong> – The ranking is created using the following principle: <strong>Primary criterion:</strong> Number of completed checkpoints (descending – more CPs = better). <strong>Secondary criterion:</strong> Official time (ascending – less time = better). The checkpoint system is mandatory for LK1; recommended for LK2.</p>
    <p><strong>10.2 Tie</strong> – If CP count and time are identical, number of attempts is decisive (fewer attempts = better). If still tied, athletes share the rank; the next rank is skipped.</p>
    <p><strong>10.3 DNF (Did Not Finish)</strong> – An athlete receives DNF if they have not completed a single obstacle or failed to cross the finish line. DNF athletes are scored by completed CPs and placed after all athletes with time scoring.</p>
    <p><strong>10.4 DSQ (Disqualification)</strong> – Disqualified athletes do not appear in the official ranking. Reasons for DSQ: external help, intentional rule violations, equipment violation, doping violation.</p>
    <p><strong>10.5 DNS (Did Not Start)</strong> – Registered athletes who do not appear at the start receive DNS. DNS does not count toward category scoring.</p>
    <p><strong>10.6 Publication</strong> – Preliminary results must be announced no later than 30 minutes after the last run in the category. Final results after protest deadline. Results must be publicly available for at least 7 days.</p>
    <p><strong>10.7 Series Ranking</strong> – If an association organizes a competition series, points are awarded according to a fixed scheme (e.g., 25-18-15-12-10-8-6-4-2-1 for places 1–10). Score drop rules are possible.</p>
`},
{nr:'11',title:'Anti-Doping',color:'#FF3B30',content:`
    <p><strong>11.1 Principle</strong> – The IGN is committed to fair and doping-free sport. WADA (World Anti-Doping Agency) anti-doping rules in their current version apply.</p>
    <p><strong>11.2 Controls</strong> – The organizer may conduct doping tests or have them conducted by an authorized entity. Targeted testing is possible. Refusal to submit to testing counts as a positive result.</p>
    <p><strong>11.3 Prohibited Substances</strong> – The current WADA prohibited list applies. Betahydroxybutyrate (BHB), stimulants, growth hormones, and blood doping are explicitly prohibited. Therapeutic use exemptions (TUE) must be requested and approved before the competition.</p>
    <p><strong>11.4 Sanctions</strong> – Upon positive result: disqualification of competition result, forfeiture of prizes/prize money. Repeat violations result in bans according to WADA guidelines.</p>
`},
{nr:'12',title:'Sanctions',color:'#FF2D78',content:`
    <p><strong>12.1 Caution (Yellow Card)</strong> – For minor rule violations, unsporting conduct, or repeated false starts. Two yellow cards in the same competition = red card.</p>
    <p><strong>12.2 Disqualification (Red Card)</strong> – Immediate DSQ for: intentional interference with other athletes, gross misconduct, insult of jury/WR, external help, equipment fraud, repeated gross rule violations.</p>
    <p><strong>12.3 Competition Ban</strong> – May be issued by the WR or IGN Board. Short ban (1–3 competitions): for DSQ-worthy conduct. Long ban (1–2 seasons): for serious violations, violence, doping. Lifetime ban: for most serious violations.</p>
    <p><strong>12.4 Appeal</strong> – Bans may be appealed in writing to the IGN Board within 14 days. The appeals committee decides within 30 days. Decision is final.</p>
    <p><strong>12.5 Registration</strong> – All sanctions are registered by the IGN Board. Banned athletes may not participate in any IGN competition – not even as spectators in the action area.</p>
`},
{nr:'13',title:'Definitions',color:'#8E8E93',content:`
    <p><strong>Checkpoint (CP)</strong> – Clearly defined, jury-confirmed holding position on an obstacle. Forms the basis for time scoring upon a fall.</p>
    <p><strong>DNF</strong> – Did Not Finish. Athlete has not reached a checkpoint or failed to cross the finish line.</p>
    <p><strong>DNS</strong> – Did Not Start. Registered athlete did not appear at the start.</p>
    <p><strong>DSQ</strong> – Disqualification. Run or competition is removed from scoring.</p>
    <p><strong>Fall</strong> – Uncontrolled contact with ground or an unintended support surface. Ends the run at the last held checkpoint (except in Lives mode).</p>
    <p><strong>False Start</strong> – Touching the first obstacle before the GO horn. Results in run being invalid.</p>
    <p><strong>GO Horn</strong> – The long concluding tone of the start signal. Exact start point for timekeeping.</p>
    <p><strong>IGN</strong> – Interessengemeinschaft Ninja-Sport. Umbrella organization for ninja sport in the German-speaking region.</p>
    <p><strong>Jury</strong> – Official person(s) at a station responsible for timekeeping and checkpoint assessment.</p>
    <p><strong>Life</strong> – In Lives mode: resource consumed upon a fall. Enables restart at segment start.</p>
    <p><strong>LK1 / LK2</strong> – Performance levels. LK1: experienced/advanced athletes, LK2: beginners/intermediate athletes.</p>
    <p><strong>Objection / Protest</strong> – Formal challenge by an athlete against a result or decision. Deadline: 15 minutes from announcement.</p>
    <p><strong>Segment</strong> – In Segment Race: course section between two landing platforms. Scored separately.</p>
    <p><strong>Spotter</strong> – Safety person at an obstacle. May only make physical contact in an emergency.</p>
    <p><strong>Stage</strong> – A jury station within a competition. Multiple stages run in parallel.</p>
    <p><strong>Competition Referee (WR)</strong> – Trained supervising officer with final decision-making authority on rule clarifications.</p>
    <p><strong>Time Limit</strong> – Maximum run time per attempt. Set by the organizer and communicated in the announcement.</p>
`},
];



export const T={
  de:{lang:'EN',app:'OG Ninja Comp',competitions:'Wettkämpfe',newComp:'Neuer Wettkampf',rulebook:'Regelwerk',join:'Beitreten',compCode:'Wettkampf-Code',enterCode:'Code eingeben…',joinComp:'Beitreten',noComps:'Noch keine Wettkämpfe. Tippe + um zu starten.',compName:'Wettkampf-Name',compDate:'Datum',compLocation:'Ort',mode:'Modus',numStations:'Stages',next:'Weiter',finish:'Speichern',obstacles:'Hindernisse',obsName:'Hindernisname',athletes:'Athleten',addAth:'Athlet hinzufügen',athName:'Name',station:'Stage',openDisplay:'Anzeige öffnen',stationSetup:'Stage-Setup',startCountdown:'Countdown starten',upNext:'Als Nächstes',nextAthlete:'Nächster Athlet',checkpoint:'Checkpoint',fall:'Fall melden',fallTitle:'Fall gemeldet',lastCP:'Letzter Checkpoint',officialTime:'Offizielle Zeit',confirm:'Bestätigen',cancel:'Abbrechen',retry:'Nochmal',runComplete:'Lauf abgeschlossen',official:'Offizielle Zeit',allCPs:'Checkpoints',nextAth:'Nächster Athlet',tabJury:'Jury',tabResults:'Rangliste',tabRules:'Regelwerk',live:'Live',dnf:'DNF',noRuns:'Noch keine Läufe',export:'Exportieren',category:'Kategorie',lives:'Leben',copyUrl:'URL kopieren',copied:'Kopiert!',allDone:'Alle Läufe absolviert!',sortHint:'⠿ ziehen zum sortieren',laufzeit:'Laufzeit'},
  en:{lang:'DE',app:'OG Ninja Comp',competitions:'Competitions',newComp:'New Competition',rulebook:'Rulebook',join:'Join',compCode:'Competition Code',enterCode:'Enter code…',joinComp:'Join',noComps:'No competitions yet. Tap + to start.',compName:'Competition name',compDate:'Date',compLocation:'Venue',mode:'Mode',numStations:'Stages',next:'Next',finish:'Save',obstacles:'Obstacles',obsName:'Obstacle name',athletes:'Athletes',addAth:'Add athlete',athName:'Name',station:'Stage',openDisplay:'Open display',stationSetup:'Stage Setup',startCountdown:'Start countdown',upNext:'Up next',nextAthlete:'Next athlete',checkpoint:'Checkpoint',fall:'Report fall',fallTitle:'Fall reported',lastCP:'Last checkpoint',officialTime:'Official time',confirm:'Confirm',cancel:'Cancel',retry:'Retry',runComplete:'Run complete',official:'Official time',allCPs:'Checkpoints',nextAth:'Next athlete',tabJury:'Jury',tabResults:'Results',tabRules:'Rulebook',live:'Live',dnf:'DNF',noRuns:'No runs yet',export:'Export',category:'Category',lives:'Lives',copyUrl:'Copy URL',copied:'Copied!',allDone:'All runs completed!',sortHint:'⠿ drag to reorder',laufzeit:'Run time'},
};

export const LangCtx = createContext('de');

export const useLang = () => {
  const lang = useContext(LangCtx);
  const t = useCallback(k => T[lang]?.[k] ?? T.de[k] ?? k, [lang]);
  const catName = useCallback(cat => cat?.name?.[lang] || cat?.name?.de || '', [lang]);
  return { lang, t, catName };
};
