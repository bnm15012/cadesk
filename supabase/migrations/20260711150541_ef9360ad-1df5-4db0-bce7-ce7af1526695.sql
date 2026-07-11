
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) END
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN NULL
  ELSE (SELECT tenant_id FROM public.profiles WHERE id = _user_id) END
$$;

CREATE OR REPLACE FUNCTION public.is_firm_member(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ca_admin','manager','staff')) END
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE public.has_role(_user_id, 'ca_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_custom_roles ucr
      JOIN public.role_permissions rp ON rp.role_id = ucr.role_id
      WHERE ucr.user_id = _user_id AND rp.permission = _permission
    ) END
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN NULL
  ELSE (SELECT id FROM public.clients WHERE portal_user_id = _user_id LIMIT 1) END
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_client(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE public.has_role(_user_id, 'ca_admin')
    OR EXISTS (SELECT 1 FROM public.client_assignments WHERE user_id = _user_id AND client_id = _client_id) END
$$;

CREATE OR REPLACE FUNCTION public.can_access_request(_user_id UUID, _request_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN false
  ELSE EXISTS (
    SELECT 1 FROM public.document_requests dr
    WHERE dr.id = _request_id
      AND (
        (public.is_firm_member(_user_id) AND dr.tenant_id = public.get_user_tenant(_user_id) AND public.is_assigned_to_client(_user_id, dr.client_id))
        OR dr.client_id = public.get_user_client_id(_user_id)
      )
  ) END
$$;
