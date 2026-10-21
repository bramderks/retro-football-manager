-- Expand the supported tactical position vocabulary and normalize legacy abbreviations.
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_position_check;
ALTER TABLE players ADD CONSTRAINT players_position_check CHECK (position = ANY (ARRAY[
  'GK','LB','CV','RB','VM','CM','LM','RM','AM','AML','AMR','LA','RA','SP',
  'CB','DM','LWB','RWB','LW','RW','ST'
]::text[]));
UPDATE players SET position = CASE
  WHEN position='CB' THEN 'CV'
  WHEN position='DM' THEN 'VM'
  WHEN position='ST' THEN 'SP'
  WHEN position='LWB' THEN 'LB'
  WHEN position='RWB' THEN 'RB'
  WHEN position='LW' AND substring(md5(id),1,1) IN ('0','1','2','3','4','5','6','7') THEN 'LA'
  WHEN position='LW' THEN 'AML'
  WHEN position='RW' AND substring(md5(id),1,1) IN ('0','1','2','3','4','5','6','7') THEN 'RA'
  WHEN position='RW' THEN 'AMR'
  WHEN position='CM' AND substring(md5(id),1,1) IN ('0','1','2','3') THEN 'LM'
  WHEN position='CM' AND substring(md5(id),1,1) IN ('4','5','6','7') THEN 'RM'
  WHEN position='CM' AND substring(md5(id),1,1) IN ('8','9','a','b') THEN 'VM'
  WHEN position='AM' AND substring(md5(id),1,1) IN ('0','1','2','3') THEN 'AML'
  WHEN position='AM' AND substring(md5(id),1,1) IN ('4','5','6','7') THEN 'AMR'
  ELSE position
END
WHERE is_active=TRUE AND position IN ('CB','DM','ST','LWB','RWB','LW','RW','CM','AM');
