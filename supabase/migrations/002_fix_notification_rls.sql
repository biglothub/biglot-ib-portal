-- Fix #6: Add admin policy for notifications table
-- Previously only had "notif_own" (user_id = auth.uid()), blocking admin from inserting
-- notifications for other users when using authenticated client.

CREATE POLICY "notif_admin_all" ON public.notifications
  FOR ALL USING (get_user_role() = 'admin');
