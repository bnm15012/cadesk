
CREATE TYPE public.app_role AS ENUM ('super_admin', 'ca_admin', 'manager', 'staff', 'client');
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended');
CREATE TYPE public.doc_status AS ENUM ('pending', 'uploaded', 'under_review', 'approved', 'rejected', 'reupload_required');
CREATE TYPE public.request_status AS ENUM ('open', 'completed', 'archived');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'expired', 'cancelled');

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status public.tenant_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_firm_member(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('ca_admin','manager','staff'))
$$;

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  UNIQUE (role_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_roles TO authenticated;
GRANT ALL ON public.user_custom_roles TO service_role;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'ca_admin')
  OR EXISTS (
    SELECT 1 FROM public.user_custom_roles ucr
    JOIN public.role_permissions rp ON rp.role_id = ucr.role_id
    WHERE ucr.user_id = _user_id AND rp.permission = _permission
  )
$$;

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pan TEXT,
  gstin TEXT,
  mobile TEXT,
  email TEXT,
  portal_user_id UUID,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX idx_clients_portal_user ON public.clients(portal_user_id);

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clients WHERE portal_user_id = _user_id LIMIT 1
$$;

CREATE TABLE public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_assignments TO authenticated;
GRANT ALL ON public.client_assignments TO service_role;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assignments_user ON public.client_assignments(user_id);
CREATE INDEX idx_assignments_client ON public.client_assignments(client_id);

CREATE OR REPLACE FUNCTION public.is_assigned_to_client(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'ca_admin')
  OR EXISTS (SELECT 1 FROM public.client_assignments WHERE user_id = _user_id AND client_id = _client_id)
$$;

CREATE TABLE public.financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_years TO authenticated;
GRANT ALL ON public.financial_years TO service_role;
ALTER TABLE public.financial_years ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_templates_tenant ON public.document_templates(tenant_id);

CREATE TABLE public.template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_items TO authenticated;
GRANT ALL ON public.template_items TO service_role;
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_template_items_template ON public.template_items(template_id);

CREATE TABLE public.document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financial_year_id UUID NOT NULL REFERENCES public.financial_years(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status public.request_status NOT NULL DEFAULT 'open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requests TO authenticated;
GRANT ALL ON public.document_requests TO service_role;
ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_requests_tenant ON public.document_requests(tenant_id);
CREATE INDEX idx_requests_client ON public.document_requests(client_id);
CREATE INDEX idx_requests_fy ON public.document_requests(financial_year_id);

CREATE OR REPLACE FUNCTION public.can_access_request(_user_id UUID, _request_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_requests dr
    WHERE dr.id = _request_id
      AND (
        (public.is_firm_member(_user_id) AND dr.tenant_id = public.get_user_tenant(_user_id) AND public.is_assigned_to_client(_user_id, dr.client_id))
        OR dr.client_id = public.get_user_client_id(_user_id)
      )
  )
$$;

CREATE TABLE public.request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.document_requests(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT true,
  status public.doc_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_items TO authenticated;
GRANT ALL ON public.request_items TO service_role;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_request_items_request ON public.request_items(request_id);
CREATE INDEX idx_request_items_status ON public.request_items(status);

CREATE TABLE public.document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.document_files TO authenticated;
GRANT ALL ON public.document_files TO service_role;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_files_item ON public.document_files(request_item_id);
CREATE INDEX idx_files_tenant ON public.document_files(tenant_id);

CREATE TABLE public.document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id UUID NOT NULL REFERENCES public.request_items(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.document_comments TO authenticated;
GRANT ALL ON public.document_comments TO service_role;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_item ON public.document_comments(request_item_id);

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_logs_tenant ON public.activity_logs(tenant_id, created_at DESC);

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  max_clients INTEGER NOT NULL DEFAULT 25,
  max_staff INTEGER NOT NULL DEFAULT 3,
  storage_gb INTEGER NOT NULL DEFAULT 5,
  max_templates INTEGER NOT NULL DEFAULT 10,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trial',
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  razorpay_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_subs_tenant ON public.subscriptions(tenant_id);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  percent_off INTEGER NOT NULL CHECK (percent_off > 0 AND percent_off <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "CA admin can update own tenant" ON public.tenants FOR UPDATE TO authenticated
  USING ((id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'ca_admin')) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK ((id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'ca_admin')) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Members can view tenant profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Members can view tenant roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Firm members can view roles" ON public.roles FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.roles FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'settings.edit'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY "Firm members view role permissions" ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid())));
CREATE POLICY "Admins manage role permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'settings.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'settings.edit')));

CREATE POLICY "Firm members view custom role assignments" ON public.user_custom_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.is_firm_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.get_user_tenant(auth.uid()))));
CREATE POLICY "Admins manage custom role assignments" ON public.user_custom_roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'users.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'users.edit')));

CREATE POLICY "Firm members view assigned clients" ON public.clients FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid()) AND public.is_assigned_to_client(auth.uid(), id))
    OR portal_user_id = auth.uid()
  );
CREATE POLICY "Permitted members add clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'clients.add'));
CREATE POLICY "Permitted members edit clients" ON public.clients FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'clients.edit'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'clients.edit'));
CREATE POLICY "Permitted members delete clients" ON public.clients FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'clients.delete'));

CREATE POLICY "Firm members view assignments" ON public.client_assignments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid()));
CREATE POLICY "Permitted members manage assignments" ON public.client_assignments FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'clients.assign'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'clients.assign'));

CREATE POLICY "Tenant members view financial years" ON public.financial_years FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));
CREATE POLICY "Permitted members manage financial years" ON public.financial_years FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'settings.edit'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'settings.edit'));

CREATE POLICY "Firm members view templates" ON public.document_templates FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid()));
CREATE POLICY "Permitted members manage templates" ON public.document_templates FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'templates.manage'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'templates.manage'));

CREATE POLICY "Firm members view template items" ON public.template_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.document_templates t WHERE t.id = template_id AND t.tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid())));
CREATE POLICY "Permitted members manage template items" ON public.template_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.document_templates t WHERE t.id = template_id AND t.tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'templates.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.document_templates t WHERE t.id = template_id AND t.tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'templates.manage')));

CREATE POLICY "Members view accessible requests" ON public.document_requests FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid()) AND public.is_assigned_to_client(auth.uid(), client_id))
    OR client_id = public.get_user_client_id(auth.uid())
  );
CREATE POLICY "Permitted members create requests" ON public.document_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.request'));
CREATE POLICY "Permitted members update requests" ON public.document_requests FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.review'))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.review'));
CREATE POLICY "Permitted members delete requests" ON public.document_requests FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.delete'));

CREATE POLICY "Members view accessible request items" ON public.request_items FOR SELECT TO authenticated
  USING (public.can_access_request(auth.uid(), request_id));
CREATE POLICY "Permitted members create request items" ON public.request_items FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.request'))
    OR (public.can_access_request(auth.uid(), request_id) AND public.get_user_client_id(auth.uid()) IS NOT NULL)
  );
CREATE POLICY "Accessible members update request items" ON public.request_items FOR UPDATE TO authenticated
  USING (public.can_access_request(auth.uid(), request_id))
  WITH CHECK (public.can_access_request(auth.uid(), request_id));
CREATE POLICY "Permitted members delete request items" ON public.request_items FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.delete'));

CREATE POLICY "Members view accessible files" ON public.document_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.request_items ri WHERE ri.id = request_item_id AND public.can_access_request(auth.uid(), ri.request_id)));
CREATE POLICY "Accessible members upload files" ON public.document_files FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.request_items ri WHERE ri.id = request_item_id AND public.can_access_request(auth.uid(), ri.request_id)));
CREATE POLICY "Permitted members delete files" ON public.document_files FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_permission(auth.uid(), 'documents.delete'));

CREATE POLICY "Members view accessible comments" ON public.document_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.request_items ri WHERE ri.id = request_item_id AND public.can_access_request(auth.uid(), ri.request_id)));
CREATE POLICY "Accessible members add comments" ON public.document_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.request_items ri WHERE ri.id = request_item_id AND public.can_access_request(auth.uid(), ri.request_id)));

CREATE POLICY "Firm members view activity logs" ON public.activity_logs FOR SELECT TO authenticated
  USING ((tenant_id = public.get_user_tenant(auth.uid()) AND public.is_firm_member(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Tenant members write activity logs" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Public can view active plans" ON public.plans FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated view plans" ON public.plans FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant members view own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "CA admin views own payments" ON public.payments FOR SELECT TO authenticated
  USING ((tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'ca_admin')) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated view active coupons" ON public.coupons FOR SELECT TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.document_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_request_items_updated BEFORE UPDATE ON public.request_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id UUID;
  v_role public.app_role;
  v_client_id UUID;
BEGIN
  IF NEW.raw_user_meta_data ? 'tenant_id' THEN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
    v_role := COALESCE((NEW.raw_user_meta_data->>'app_role')::public.app_role, 'staff');

    INSERT INTO public.profiles (id, tenant_id, full_name, email, phone)
    VALUES (NEW.id, v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''), NEW.raw_user_meta_data->>'phone');

    INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, v_tenant_id, v_role);

    IF v_role = 'client' AND NEW.raw_user_meta_data ? 'client_id' THEN
      v_client_id := (NEW.raw_user_meta_data->>'client_id')::uuid;
      UPDATE public.clients SET portal_user_id = NEW.id WHERE id = v_client_id AND tenant_id = v_tenant_id;
    END IF;
  ELSE
    INSERT INTO public.tenants (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'firm_name', 'My Firm'))
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.profiles (id, tenant_id, full_name, email, phone)
    VALUES (NEW.id, v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''), NEW.raw_user_meta_data->>'phone');

    INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, v_tenant_id, 'ca_admin');

    INSERT INTO public.subscriptions (tenant_id, status, current_period_start, current_period_end)
    VALUES (v_tenant_id, 'trial', now(), now() + interval '14 days');
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Tenant members upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text);
CREATE POLICY "Tenant members read own folder" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text);
CREATE POLICY "Permitted members delete files in own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_user_tenant(auth.uid())::text AND public.has_permission(auth.uid(), 'documents.delete'));

-- ===== Security hardening =====
CREATE OR REPLACE FUNCTION public.guard_clients()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      NEW.portal_user_id := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Client records cannot be moved to another firm';
  END IF;
  IF current_user IN ('authenticated', 'anon') AND NEW.portal_user_id IS DISTINCT FROM OLD.portal_user_id THEN
    RAISE EXCEPTION 'Portal access link can only be set by the system';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_clients_guard BEFORE INSERT OR UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.guard_clients();

CREATE OR REPLACE FUNCTION public.guard_tenant_boundary()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Records cannot be moved to another firm';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_boundary();
CREATE TRIGGER trg_requests_tenant_guard BEFORE UPDATE ON public.document_requests FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_boundary();
CREATE TRIGGER trg_request_items_tenant_guard BEFORE UPDATE ON public.request_items FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_boundary();

CREATE OR REPLACE FUNCTION public.guard_request_client()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Requests cannot be reassigned to another client';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_requests_client_guard BEFORE UPDATE ON public.document_requests FOR EACH ROW EXECUTE FUNCTION public.guard_request_client();

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tenant(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_firm_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_firm_member(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_user_client_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_client_id(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_client(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_access_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_request(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.plans (name, description, price_monthly, price_yearly, max_clients, max_staff, storage_gb, max_templates, features, sort_order) VALUES
('Starter', 'For solo practitioners getting started', 49900, 499000, 25, 3, 5, 10, '{"client_portal": true, "document_requests": true}'::jsonb, 1),
('Professional', 'For growing CA firms', 99900, 999000, 100, 10, 25, 50, '{"client_portal": true, "document_requests": true, "custom_roles": true, "activity_logs": true}'::jsonb, 2),
('Enterprise', 'For large practices with many clients', 199900, 1999000, 500, 50, 100, 200, '{"client_portal": true, "document_requests": true, "custom_roles": true, "activity_logs": true, "priority_support": true}'::jsonb, 3)
ON CONFLICT (name) DO NOTHING;
