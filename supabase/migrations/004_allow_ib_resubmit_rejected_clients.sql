-- Allow IBs to update rejected accounts (for resubmit flow)
DROP POLICY "ca_ib_update" ON public.client_accounts;
CREATE POLICY "ca_ib_update" ON public.client_accounts
  FOR UPDATE
  USING (
    get_user_role() = 'master_ib'
    AND master_ib_id = get_user_master_ib_id()
    AND status IN ('pending', 'rejected')
  );
