-- Allow all authenticated users to view activity logs for occurrences module
CREATE POLICY "All authenticated users can view occurrence activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (module = 'occurrences');