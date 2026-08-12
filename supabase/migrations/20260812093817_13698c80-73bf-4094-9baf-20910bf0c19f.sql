CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dob date,
  linkedin text,
  email text,
  phone text,
  icp text NOT NULL,
  icp_source text,
  icp_flagged boolean NOT NULL DEFAULT false,
  child_status text,
  relationship_status text,
  role_label text,
  role_level int,
  company_type text,
  company_size text,
  company_size_band int,
  expertise text,
  countries text[] NOT NULL DEFAULT '{}',
  life_context text[] NOT NULL DEFAULT '{}',
  interests text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.respondents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  name text,
  email text,
  phone text,
  birth_year int,
  icp text,
  gate_answer text,
  reroute_answer text,
  founder_tenure text,
  stage_index int,
  stage_label text,
  business_type text,
  open_text text,
  life_context text[] NOT NULL DEFAULT '{}',
  role_label text,
  role_level int,
  company_type text,
  company_size text,
  company_size_band int,
  expertise text,
  countries text[] NOT NULL DEFAULT '{}',
  child_status text,
  interests text[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  last_step text,
  match_count int,
  transcript jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX respondents_visitor_idx ON public.respondents (visitor_id);

GRANT ALL ON public.respondents TO service_role;
ALTER TABLE public.respondents ENABLE ROW LEVEL SECURITY;