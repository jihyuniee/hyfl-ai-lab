CREATE SCHEMA IF NOT EXISTS hyfl_community;
REVOKE ALL ON SCHEMA hyfl_community FROM PUBLIC;

CREATE TABLE IF NOT EXISTS hyfl_community.likes (
  project_id text NOT NULL,
  author_id text COLLATE "C" NOT NULL CHECK (author_id ~ '^[0-9a-f]{64}$'),
  profile jsonb CHECK (profile IS NULL OR jsonb_typeof(profile) = 'object'),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (project_id, author_id)
);

CREATE TABLE IF NOT EXISTS hyfl_community.comments (
  project_id text NOT NULL,
  comment_id text COLLATE "C" NOT NULL CHECK (comment_id ~ '^[0-9]{11}-[0-9a-f]{64}$'),
  author_id text NOT NULL CHECK (author_id ~ '^[0-9a-f]{64}$'),
  text text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 300),
  profile jsonb CHECK (profile IS NULL OR jsonb_typeof(profile) = 'object'),
  author_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  PRIMARY KEY (project_id, comment_id)
);

CREATE TABLE IF NOT EXISTS hyfl_community.moderation (
  project_id text NOT NULL,
  comment_id text COLLATE "C" NOT NULL,
  moderator_id text NOT NULL,
  hidden_at timestamptz NOT NULL,
  PRIMARY KEY (project_id, comment_id),
  FOREIGN KEY (project_id, comment_id) REFERENCES hyfl_community.comments (project_id, comment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hyfl_community.migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL
);

REVOKE ALL ON ALL TABLES IN SCHEMA hyfl_community FROM PUBLIC;
