# Retro Football Manager

Een browsergebaseerde retro-voetbalmanager geïnspireerd op de klassieke managementgames uit de jaren 90 en CM 01/02.

## Webapp

De actieve webapp is gebouwd met Next.js, React, TypeScript en Neon PostgreSQL en wordt gedeployed via Vercel.

De interface bevat schermen voor:
- Overzicht en live wedstrijdsimulatie met commentaar, statistieken, doelpuntenmakers, kaarten, blessures en wissels.
- Selectie, opstelling en tactieken.
- Competitie, Europees voetbal en kalender.
- Transfers en spelersprofielen.
- Faciliteiten en loopbaan/career saves.

De actuele webcode staat in `app/`; API-routes staan in `app/api/`. De databasebasis en uitbreidingen staan in `db/schema.sql` en `db/migrations/`.

## Spelersdatabase

De webapp hoort één centrale spelersbron te gebruiken. De actuele implementatie haalt spelers via de gedeelde database/view `all_players`; loopbaangegevens zoals club, fitheid, moraal, contracten en wedstrijdstatistieken horen bij de afzonderlijke career save. De CM 01/02-import schrijft bronprofielen naar `cm0102_player_profiles`.

De database moet zijn ingericht met de schema's en migraties die bij de gedeployde branch horen. Stel `DATABASE_URL` in bij Vercel voordat database-afhankelijke schermen en API-routes worden getest. Voer database-migraties bewust uit op de juiste Neon-database; voer geen schema's uit op een andere applicatiedatabase.

## Ontwikkelen

Vereist: Node.js en npm.

```bash
npm install
npm run dev
```

Controleer voor oplevering:

```bash
npm run lint
npm run build
```

## Legacy DOS-engine

`MATCHENG.C` is een afzonderlijk C/DOS-prototype van de wedstrijdengine. Het is nog geen bewijs dat de webapp dezelfde engine gebruikt. Het testplan hiervoor staat in `TESTPLAN.md`; bouwen en uitvoeren vereist een DOS-target compiler en bijvoorbeeld DOSBox.

## Status en beperkingen

De Vercel-deployment is de actieve webversie; een groene build bewijst alleen dat de code kan bouwen, niet dat de Neon-database gevuld is of dat iedere gameplay-flow end-to-end werkt. Controleer daarom ook de database-migraties, de API-responses en de volledige carrièremove vóór een release.
