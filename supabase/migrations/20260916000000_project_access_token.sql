-- Per-project access token: an unguessable capability granting full admin
-- rights to exactly one project, via /project/[accessToken] - the same
-- "unguessable URL is the credential, no login" pattern already used for
-- the participant interview link, just with admin-level permissions scoped
-- to one project instead of participant-level access to one interview.
--
-- Revocation works by regenerating this value: every project-management
-- Server Action re-checks the caller's token against this column on every
-- call (see lib/project-access.ts), not just once at the page level, so an
-- old token simply stops matching the moment a new one is written - no
-- separate revocation list needed.
--
-- gen_random_bytes comes from pgcrypto, already enabled in this database
-- (gen_random_uuid(), used as the default for every table's id column,
-- depends on the same extension).
alter table projects add column access_token text;

update projects
set access_token = encode(gen_random_bytes(32), 'hex')
where access_token is null;

alter table projects alter column access_token set not null;
alter table projects add constraint projects_access_token_key unique (access_token);
alter table projects alter column access_token set default encode(gen_random_bytes(32), 'hex');

create index if not exists projects_access_token_idx on projects (access_token);
