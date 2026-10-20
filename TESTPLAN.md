# Testplan — Match Engine v0.1

## A. Build en start
1. Compileer `MATCHENG.C` met een DOS-target compiler.
2. Controleer dat er een DOS-compatibele `MATCHENG.EXE` ontstaat.
3. Start de executable in DOSBox.
4. Controleer titel, teams, aftrap, rust, eindsignaal en eindstatistieken.

## B. Consistentie van statistieken
1. Doelpunten in de eindstand moeten overeenkomen met de gemelde doelpunten.
2. Schoten op doel mogen nooit hoger zijn dan het aantal schoten.
3. Het aantal kansen moet minstens zo hoog zijn als het aantal schoten.
4. De balbezitpercentages moeten samen ongeveer 100% zijn; door afronding kan dit 99% of 101% zijn.
5. De scoreregel na een doelpunt moet altijd de thuisploeg links en de uitploeg rechts tonen.

## C. Herhaalbaarheid en variatie
1. Start tweemaal met seed `12345`; bij dezelfde compiler/runtime moet het wedstrijdverloop identiek zijn.
2. Test seeds `1`, `2`, `3`, `100` en `2026`.
3. Controleer dat verschillende seeds verschillende wedstrijdverlopen kunnen geven.

## D. Enginebalans — volgende testfase
Zodra er een batchmodus is, simuleer minimaal 10.000 wedstrijden en meet:
- gemiddelde doelpunten per wedstrijd
- gemiddelde schoten en kansen
- thuisvoordeel
- verschil tussen teams met hoge en lage spelersattributen
- effect van aanvallend spelen, counteren en pressing

## Bekende beperkingen
- Voorbeeldnamen en ratings zijn fictief.
- Tactieken zijn hard gecodeerd en nog niet instelbaar via menu's.
- Nog geen buitenspel, overtredingen, vrije trappen, strafschoppen, wissels, blessures of conditie.
- Geen individuele veldposities of looplijnen in deze versie.
- De engine is nog niet gebalanceerd op basis van grootschalige simulaties.
