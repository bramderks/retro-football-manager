# Retro Football Manager

Een retro-voetbalmanager geïnspireerd op de klassieke managementgames uit de jaren 90.

## Huidige status

**Desktop prototype v0.2**
- Eerste Windows-desktopinterface in Python/Tkinter met muisknoppen
- Live scorebord, wedstrijdminuut en doorlopend tekstcommentaar
- Start, pauze, verder, nieuwe wedstrijd en tempo-instelling
- Schoten, schoten op doel, kansen en corners
- Klassieke donkere blauw/groene interface als eerste stijlbasis

Dit is een vroege UI-prototype. De huidige desktopversie gebruikt nog een eenvoudige, eigen Python-simulatie; de bestaande C-engine in `MATCHENG.C` is nog niet geïntegreerd in de GUI. De navigatieknoppen voor selectie, tactiek, competitie en transfers zijn voorlopig placeholders. Voortgang wordt nog niet opgeslagen en de wedstrijdregels zijn nog niet gekalibreerd.

## Bestanden

- `retro_manager.py` — Windows-desktopinterfaceprototype (Python 3 + Tkinter)
- `MATCHENG.C` — oorspronkelijke C/DOS-wedstrijdengine
- `TESTPLAN.md` — handmatig testplan voor de oorspronkelijke engine

## Desktopprototype starten op Windows

1. Installeer Python 3 als dat nog niet op de pc staat. Kies tijdens de installatie indien beschikbaar voor **Add Python to PATH**.
2. Download `retro_manager.py` uit deze repository naar een map op je pc.
3. Open Opdrachtprompt in die map.
4. Start het programma met:

```bat
py retro_manager.py
```

Als `py` niet wordt herkend, probeer:

```bat
python retro_manager.py
```

Tkinter is meestal inbegrepen bij de standaard Windows-installatie van Python. Er zijn geen extra Python-pakketten nodig.

## DOS-prototype

De C-versie kan afzonderlijk worden gebouwd met Open Watcom dat voor DOS is ingesteld. De exacte compileropties en bibliotheekinstellingen hangen af van de installatie. Start de resulterende DOS-executable vanuit DOSBox; Windows 64-bit voert een 16-bits DOS-programma niet rechtstreeks uit.

## Volgende ontwikkelstappen

1. Test de desktopinterface op Windows.
2. Verfijn het commentaar en de wedstrijdsimulatie.
3. Integreer de C-engine via een duidelijke interface of migreer de wedstrijdregels gecontroleerd.
4. Bouw echte selectie-, tactiek-, competitie- en transferonderdelen.
5. Voeg opslag van spelstanden en een speelbare seizoenstructuur toe.
