-- Backfill the profiles table from existing users.
-- The application also runs the equivalent migration during startup.
INSERT INTO profiles (
    id,
    user_id,
    full_name,
    display_name,
    phone_number,
    avatar_url,
    bio,
    metadata,
    created_at,
    updated_at,
    tenant_id
)
SELECT
    UUID(),
    users.id,
    COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', users.first_name, users.last_name)), ''),
        NULLIF(TRIM(users.display_name), ''),
        NULLIF(TRIM(users.username), ''),
        users.email
    ),
    users.display_name,
    users.phone_number,
    '',
    '',
    JSON_OBJECT(),
    NOW(),
    NOW(),
    users.tenant_id
FROM users
LEFT JOIN profiles ON profiles.user_id = users.id AND profiles.deleted_at IS NULL
WHERE profiles.id IS NULL;
