-- A signed-in user can save a custom field, and can store a lot rent accepted from a quoted document.
-- Other park columns stay read-only for the browser role. The pipeline uses the service role and bypasses this.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated')
     and exists (select 1 from pg_namespace where nspname = 'auth') then
    drop policy if exists "team can update custom fields" on parks;
    create policy "team can update custom fields" on parks
      for update to authenticated
      using (true)
      with check (true);
    revoke update on parks from authenticated;
    grant update (custom_fields) on parks to authenticated;

    drop policy if exists "team can enter figures" on park_operating;
    create policy "team can enter figures" on park_operating
      for insert to authenticated
      with check (entered_by = auth.uid() and source in ('manual', 'document'));
  end if;
end $$;
