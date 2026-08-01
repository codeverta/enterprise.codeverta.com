# Core extraction boundary

## Retained

Authentication, tenancy, users, notification delivery, order primitives, subscriptions, promo codes, payment gateway integration, wallets/finance, audit logging, settings, files, email, rate limiting, and operational infrastructure.

## Not registered

LMS, courses, modules, lessons, quizzes, certificates, learning schedules, parent/student workflows, readiness assessments, course purchases, community, chat, and RAG routes are not registered. Their models are not part of the core `AutoMigrate` list.

## Module rule

An ERP module owns its router, controller/service layer, models, migrations, and permissions. Shared capabilities are consumed through core services or stable core API contracts. Commercial module records link to `orders` with `reference_type` and `reference_id`; core does not import module models.

## Migration note

Do not point this application at the LMS production database. Provision a separate database and tenant configuration for ERP.
