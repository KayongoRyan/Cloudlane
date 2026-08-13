DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cloudlane') THEN
    CREATE ROLE cloudlane WITH LOGIN PASSWORD 'RyANkAy#34';
  ELSE
    ALTER ROLE cloudlane WITH PASSWORD 'RyANkAy#34';
  END IF;
END
$$;
