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
