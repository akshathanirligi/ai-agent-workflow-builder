CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUM TYPES
-- =========================================================

CREATE TYPE public.org_member_role AS ENUM (
  'owner',
  'editor',
  'viewer'
);

CREATE TYPE public.workflow_run_status AS ENUM (
  'pending',
  'running',
  'paused',
  'completed',
  'failed'
);

CREATE TYPE public.step_run_status AS ENUM (
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'skipped'
);

CREATE TYPE public.trigger_type AS ENUM (
  'manual',
  'webhook',
  'scheduled',
  'database_event'
);

CREATE TYPE public.workflow_step_type AS ENUM (
  'llm_call',
  'http_request',
  'db_write',
  'notify',
  'conditional_branch',
  'approval_gate'
);

-- =========================================================
-- ORGANIZATIONS
-- =========================================================

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quota_calls_used integer NOT NULL DEFAULT 0,
  quota_calls_allowed integer NOT NULL DEFAULT 100,
  quota_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- ORGANIZATION MEMBERS
-- =========================================================

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user_id
  ON public.org_members(user_id);

CREATE INDEX idx_org_members_org_id
  ON public.org_members(org_id);

-- =========================================================
-- WORKFLOWS
-- =========================================================

CREATE TABLE public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_org_id
  ON public.workflows(org_id);

-- =========================================================
-- WORKFLOW STEPS
-- =========================================================

CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  position integer NOT NULL,
  name text NOT NULL,
  type public.workflow_step_type NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(workflow_id, position)
);

CREATE INDEX idx_workflow_steps_workflow_id
  ON public.workflow_steps(workflow_id);

-- =========================================================
-- WORKFLOW TRIGGERS
-- =========================================================

CREATE TABLE public.workflow_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  type public.trigger_type NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_triggers_workflow_id
  ON public.workflow_triggers(workflow_id);

-- =========================================================
-- WORKFLOW RUNS
-- =========================================================

CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type public.trigger_type NOT NULL DEFAULT 'manual',
  status public.workflow_run_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_runs_workflow_id
  ON public.workflow_runs(workflow_id);

CREATE INDEX idx_workflow_runs_status
  ON public.workflow_runs(status);

-- =========================================================
-- STEP RUNS
-- =========================================================

CREATE TABLE public.step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id uuid NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,

  status public.step_run_status NOT NULL DEFAULT 'pending',

  input jsonb,
  output jsonb,
  error text,

  attempt_count integer NOT NULL DEFAULT 0,

  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_step_runs_workflow_run_id
  ON public.step_runs(workflow_run_id);

CREATE INDEX idx_step_runs_workflow_step_id
  ON public.step_runs(workflow_step_id);

-- =========================================================
-- DB WRITE OUTPUTS
-- Used by the db_write workflow step.
-- =========================================================

CREATE TABLE public.workflow_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_run_id uuid REFERENCES public.step_runs(id) ON DELETE SET NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_outputs_run_id
  ON public.workflow_outputs(workflow_run_id);

-- =========================================================
-- NOTIFICATION OUTBOX
-- Used by notify/Event Trigger.
-- =========================================================

CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'webhook',
  recipient text,
  subject text,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_outbox_org_id
  ON public.notification_outbox(org_id);

-- =========================================================
-- USAGE AGGREGATION VIEW
-- Required by assignment.
-- =========================================================

CREATE OR REPLACE VIEW public.organization_usage_monthly AS
SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  o.quota_calls_allowed,
  o.quota_calls_used,
  o.quota_period_start,
  COUNT(wr.id) FILTER (
    WHERE wr.created_at >= date_trunc('month', now())
  ) AS runs_this_month,
  COUNT(wr.id) FILTER (
    WHERE wr.status = 'completed'
      AND wr.created_at >= date_trunc('month', now())
  ) AS completed_runs_this_month,
  COUNT(wr.id) FILTER (
    WHERE wr.status = 'failed'
      AND wr.created_at >= date_trunc('month', now())
  ) AS failed_runs_this_month
FROM public.organizations o
LEFT JOIN public.workflows w
  ON w.org_id = o.id
LEFT JOIN public.workflow_runs wr
  ON wr.workflow_id = w.id
GROUP BY
  o.id,
  o.name,
  o.quota_calls_allowed,
  o.quota_calls_used,
  o.quota_period_start;

-- =========================================================
-- HELPFUL CONSTRAINTS
-- =========================================================

ALTER TABLE public.workflow_steps
ADD CONSTRAINT workflow_steps_position_positive
CHECK (position >= 0);

ALTER TABLE public.step_runs
ADD CONSTRAINT step_runs_attempt_count_positive
CHECK (attempt_count >= 0);

ALTER TABLE public.organizations
ADD CONSTRAINT organizations_quota_valid
CHECK (
  quota_calls_used >= 0
  AND quota_calls_allowed > 0
  AND quota_calls_used <= quota_calls_allowed
);
