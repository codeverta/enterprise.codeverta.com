-- Allow one subscription/pricing plan to include multiple course bundles.
-- Keep subscription_plans.bundle_id as legacy/primary bundle compatibility.

CREATE TABLE IF NOT EXISTS subscription_plan_bundles (
    id CHAR(36) NOT NULL,
    plan_id CHAR(36) NOT NULL,
    bundle_id CHAR(36) NOT NULL,
    created_at DATETIME(3) NULL,
    updated_at DATETIME(3) NULL,
    deleted_at DATETIME(3) NULL,
    tenant_id CHAR(36) NULL,
    PRIMARY KEY (id),
    UNIQUE INDEX idx_subscription_plan_bundle (plan_id, bundle_id),
    INDEX idx_subscription_plan_bundles_plan_id (plan_id),
    INDEX idx_subscription_plan_bundles_bundle_id (bundle_id),
    INDEX idx_subscription_plan_bundles_deleted_at (deleted_at),
    INDEX idx_subscription_plan_bundles_tenant_id (tenant_id),
    CONSTRAINT fk_subscription_plan_bundles_plan
        FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_subscription_plan_bundles_bundle
        FOREIGN KEY (bundle_id) REFERENCES course_bundles(id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill existing single-bundle plan links into the new join table.
INSERT INTO subscription_plan_bundles (id, plan_id, bundle_id, created_at, updated_at, tenant_id)
SELECT UUID(), id, bundle_id, NOW(3), NOW(3), tenant_id
FROM subscription_plans
WHERE bundle_id IS NOT NULL
  AND bundle_id <> '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (
      SELECT 1
      FROM subscription_plan_bundles spb
      WHERE spb.plan_id = subscription_plans.id
        AND spb.bundle_id = subscription_plans.bundle_id
  );
