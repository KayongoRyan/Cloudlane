-- Set password via psql variable or replace CHANGE_ME before running (do not commit real passwords).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cloudlane') THEN
    CREATE ROLE cloudlane WITH LOGIN PASSWORD 'CHANGE_ME';
  ELSE
    ALTER ROLE cloudlane WITH PASSWORD 'CHANGE_ME';
  END IF;
END
$$;
