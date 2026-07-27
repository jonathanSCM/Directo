CREATE TYPE property_report_reason AS ENUM ('fake', 'misleading', 'already_sold', 'inappropriate', 'spam', 'other');
CREATE TYPE property_report_status AS ENUM ('pending', 'reviewed', 'dismissed');

CREATE TABLE IF NOT EXISTS property_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       property_report_reason NOT NULL,
    message      TEXT,
    status       property_report_status NOT NULL DEFAULT 'pending',
    reviewed_by  UUID,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_reports_property ON property_reports(property_id);
CREATE INDEX IF NOT EXISTS idx_property_reports_status ON property_reports(status);
CREATE INDEX IF NOT EXISTS idx_property_reports_reporter ON property_reports(reporter_id);
