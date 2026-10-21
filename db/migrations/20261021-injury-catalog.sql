CREATE TABLE IF NOT EXISTS injury_catalog (
  id TEXT PRIMARY KEY,
  injury_name TEXT NOT NULL UNIQUE,
  base_days INTEGER NOT NULL CHECK (base_days > 0),
  severity TEXT NOT NULL CHECK (severity IN ('Licht','Matig','Ernstig','Zwaar','Zeer zwaar')),
  recovery_days INTEGER NOT NULL CHECK (recovery_days > 0)
);
WITH base(idx, name, base_days) AS (
  VALUES
  (0,'Hamstringverrekking',7),(1,'Hamstringscheur',28),(2,'Kuitverrekking',6),(3,'Kuitscheur',24),(4,'Enkelverstuiking',10),
  (5,'Enkelbandletsel',35),(6,'Kniebandverrekking',14),(7,'Voorste kruisbandletsel',210),(8,'Achterste kruisbandletsel',150),(9,'Binnenbandletsel knie',45),
  (10,'Meniscusletsel',60),(11,'Kneuzing knie',5),(12,'Kneuzing bovenbeen',4),(13,'Kneuzing kuit',4),(14,'Kneuzing enkel',5),
  (15,'Liesblessure',14),(16,'Adductorenverrekking',12),(17,'Adductorenruptuur',42),(18,'Heupflexorblessure',14),(19,'Heupkneuzing',7),
  (20,'Achillespeesontsteking',28),(21,'Achillespeesruptuur',180),(22,'Voetkneuzing',5),(23,'Middenvoetsbeentjeletsel',42),(24,'Stressfractuur voet',70),
  (25,'Scheenbeenklachten',14),(26,'Stressfractuur scheenbeen',90),(27,'Kuitkramp',1),(28,'Spiervermoeidheid',2),(29,'Rugspierblessure',10),
  (30,'Onderrugblessure',14),(31,'Ribkneuzing',10),(32,'Gebroken rib',42),(33,'Schouderkneuzing',7),(34,'Schouderluxatie',56),
  (35,'Sleutelbeenbreuk',70),(36,'Polsverstuiking',10),(37,'Gebroken pols',56),(38,'Vingerblessure',7),(39,'Handkneuzing',4),
  (40,'Hoofdblessure',7),(41,'Hersenschudding',14),(42,'Neusbloeding',1),(43,'Gezichtsfractuur',35),(44,'Oogkasletsel',42),
  (45,'Tandletsel',10),(46,'Buikspierblessure',14),(47,'Buikkneuzing',5),(48,'Bekkenkneuzing',7),(49,'Peesontsteking',21)
), severity(idx, label, multiplier, prefix) AS (
  VALUES
  (0,'Licht',0.45,'Lichte '),(1,'Matig',0.8,'Matige '),(2,'Ernstig',1.35,'Ernstige '),(3,'Zwaar',2.0,'Zware '),(4,'Zeer zwaar',3.2,'Zeer zware ')
)
INSERT INTO injury_catalog(id, injury_name, base_days, severity, recovery_days)
SELECT 'inj-'||lpad((base.idx*5+severity.idx+1)::text,3,'0'),
       severity.prefix||base.name, base.base_days, severity.label,
       GREATEST(1,ROUND(base.base_days*severity.multiplier)::integer)
FROM base CROSS JOIN severity
ON CONFLICT (id) DO NOTHING;
