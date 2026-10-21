CREATE TABLE IF NOT EXISTS career_applications (
 id TEXT PRIMARY KEY,
 save_id TEXT NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
 target_club_id TEXT NOT NULL REFERENCES teams(id),
 target_role TEXT NOT NULL CHECK (target_role IN ('manager','sporting_director','chairperson')),
 applied_on DATE NOT NULL,
 response_on DATE NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
 note TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_career_applications_save ON career_applications(save_id,status);