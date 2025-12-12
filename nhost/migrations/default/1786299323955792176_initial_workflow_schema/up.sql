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
