# Retro Football Manager

Een echte DOS-voetbalmanager in C, bedoeld om via DOSBox te draaien. De eerste mijlpaal is een klassieke tekstuele wedstrijdsimulatie.

## Huidige status

**v0.1 — eerste prototype**
- C-broncode voor een DOS-compiler
- 90 minuten tekstcommentaar
- Voorbeeldteams Ajax en NEC met fictieve spelers
- Eenvoudige kansberekening voor aanvallen, schoten en reddingen
- Ruststand en eindstatistieken
- Herhaalbare simulatie met een opgegeven random seed

Dit is nog geen complete of gekalibreerde engine. De huidige regels zijn een eerste basis die we met tests gaan verbeteren.

## Bestanden

- `MATCHENG.C` — wedstrijdsimulatie
- `TESTPLAN.md` — handmatig testplan en volgende controles

## Compileren voor DOS

Gebruik een compiler die DOS-uitvoer kan maken, bijvoorbeeld Turbo C/Borland C of Open Watcom.

Voor een passende Open Watcom-installatie is een opdracht in deze stijl gebruikelijk:

```text
wcl -bt=dos -ml MATCHENG.C
```

Compileropties kunnen per versie verschillen. De uiteindelijke `MATCHENG.EXE` moet een DOS-programma zijn, niet een Windows-consoleprogramma.

## Starten

```text
MATCHENG.EXE
```

Herhaalbare test:

```text
MATCHENG.EXE 12345
```

Start de executable vanuit DOSBox in de map waar het bestand staat.
