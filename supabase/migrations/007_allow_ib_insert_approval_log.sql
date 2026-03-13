-- Fix: allow master_ib to insert into approval_log (for 'submitted' action)
CREATE POLICY "al_ib_insert" ON public.approval_log
  FOR INSERT
  WITH CHECK (
    get_user_role() = 'master_ib'
    AND is_own_client(client_account_id)
    AND performed_by = auth.uid()
  );
