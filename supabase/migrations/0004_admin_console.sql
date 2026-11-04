create or replace function public.has_any_app_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role::text = any(required_roles)
          and (
              p.role <> 'admin'
              or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          )
    );
$$;

revoke all on function public.has_any_app_role(text[]) from public;
grant execute on function public.has_any_app_role(text[]) to anon, authenticated;

grant update (status, verified_at) on public.farmer_profiles to authenticated;

create or replace function public.guard_public_listing_and_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_table_name = 'listings' and new.status = 'published'
       and not exists (
           select 1
           from public.farmer_profiles fp
           join public.categories c on c.id = new.category_id
           where fp.id = new.farmer_id
             and fp.status = 'approved'
             and c.is_active
       ) then
        raise exception 'Only approved farmers can publish listings in active categories'
            using errcode = '23514';
    end if;

    if tg_table_name = 'reviews' and new.status = 'published'
       and not exists (
           select 1 from public.farmer_profiles fp
           where fp.id = new.farmer_id and fp.status = 'approved'
       ) then
        raise exception 'Reviews can only be published for approved farmers'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function public.guard_public_listing_and_review() from public, anon, authenticated;

create trigger listings_require_public_eligibility
    before insert or update of status, farmer_id, category_id on public.listings
    for each row when (new.status = 'published')
    execute function public.guard_public_listing_and_review();

create trigger reviews_require_approved_farmer
    before insert or update of status, farmer_id on public.reviews
    for each row when (new.status = 'published')
    execute function public.guard_public_listing_and_review();

create or replace function public.pause_farmer_content_when_suspended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status <> 'approved' then
        update public.listings
        set status = 'paused'
        where farmer_id = new.id
          and status = 'published';
        update public.reviews
        set status = 'hidden'
        where farmer_id = new.id
          and status = 'published';
    end if;
    return new;
end;
$$;

revoke all on function public.pause_farmer_content_when_suspended() from public, anon, authenticated;

create trigger farmer_profiles_hide_public_content
    after update of status on public.farmer_profiles
    for each row
    when (old.status is distinct from new.status and new.status <> 'approved')
    execute function public.pause_farmer_content_when_suspended();

create or replace function public.admin_dashboard_stats()
returns table (
    estimated_visitors bigint,
    whatsapp_contacts bigint,
    active_listings bigint,
    pending_farmers bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.has_any_app_role(array['admin']) then
        raise exception 'Administrator access requires a verified MFA session'
            using errcode = '42501';
    end if;

    return query
    select
        (
            select count(distinct e.visitor_key)
            from public.listing_events e
            where e.event_type = 'view'
              and e.event_day >= (now() at time zone 'utc')::date - 29
        )::bigint,
        (
            select count(*)
            from public.listing_events e
            where e.event_type = 'contact'
              and e.event_day >= (now() at time zone 'utc')::date - 29
        ) + (
            select count(*)
            from public.whatsapp_contact_events e
            where e.created_at >= now() - interval '30 days'
        )::bigint,
        (
            select count(*)
            from public.listings l
            where l.status = 'published'
        )::bigint,
        (
            select count(*)
            from public.farmer_profiles fp
            where fp.status = 'pending'
        )::bigint;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_change_user_role(
    target_user_id uuid,
    new_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    admin_count bigint;
    old_role public.app_role;
begin
    if not public.has_any_app_role(array['admin']) then
        raise exception 'Administrator access requires a verified MFA session'
            using errcode = '42501';
    end if;
    if target_user_id is null or new_role is null then
        raise exception 'A valid account and role are required';
    end if;
    if target_user_id = (select auth.uid()) then
        raise exception 'You cannot change your own administrator role';
    end if;

    perform pg_advisory_xact_lock(917305, 1);

    select p.role into old_role
    from public.profiles p
    where p.id = target_user_id
    for update;
    if not found then
        raise exception 'Account not found';
    end if;

    if old_role = 'admin' and new_role <> 'admin' then
        select count(*) into admin_count
        from public.profiles p
        where p.role = 'admin';
        if admin_count <= 1 then
            raise exception 'The last administrator cannot be demoted';
        end if;
    end if;

    update public.profiles
    set role = new_role
    where id = target_user_id;

    if new_role <> 'farmer' then
        update public.farmer_profiles
        set status = 'suspended', verified_at = null
        where id = target_user_id;
        update public.listings
        set status = 'paused'
        where farmer_id = target_user_id
          and status = 'published';
    elsif old_role <> 'farmer' then
        update public.farmer_profiles
        set status = 'pending', verified_at = null
        where id = target_user_id;
        update public.listings
        set status = 'paused'
        where farmer_id = target_user_id
          and status = 'published';
    end if;
end;
$$;

revoke all on function public.admin_change_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_change_user_role(uuid, public.app_role) to authenticated;

create or replace function public.audit_admin_console_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    before_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
    after_row jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
    target_row jsonb;
    target_key text;
    details_value jsonb;
begin
    if auth.uid() is null then
        if tg_op = 'DELETE' then
            return old;
        end if;
        return new;
    end if;

    target_row := case when tg_op = 'DELETE' then before_row else after_row end;
    target_key := coalesce(target_row ->> 'id', target_row ->> 'key');

    case tg_table_name
        when 'profiles' then
            details_value := jsonb_build_object(
                'before_role', before_row -> 'role',
                'after_role', after_row -> 'role'
            );
        when 'farmer_profiles' then
            details_value := jsonb_build_object(
                'farm_name', coalesce(after_row -> 'farm_name', before_row -> 'farm_name'),
                'before_status', before_row -> 'status',
                'after_status', after_row -> 'status',
                'before_verified', before_row -> 'verified_at',
                'after_verified', after_row -> 'verified_at'
            );
        when 'listings' then
            details_value := jsonb_build_object(
                'farmer_id', coalesce(after_row -> 'farmer_id', before_row -> 'farmer_id'),
                'title', coalesce(after_row -> 'title', before_row -> 'title'),
                'before_status', before_row -> 'status',
                'after_status', after_row -> 'status'
            );
        when 'reviews' then
            details_value := jsonb_build_object(
                'farmer_id', coalesce(after_row -> 'farmer_id', before_row -> 'farmer_id'),
                'before_status', before_row -> 'status',
                'after_status', after_row -> 'status'
            );
        when 'reports' then
            details_value := jsonb_build_object(
                'target_type', coalesce(after_row -> 'target_type', before_row -> 'target_type'),
                'before_status', before_row -> 'status',
                'after_status', after_row -> 'status'
            );
        when 'categories' then
            details_value := jsonb_build_object(
                'slug', coalesce(after_row -> 'slug', before_row -> 'slug'),
                'before_name', before_row -> 'name',
                'after_name', after_row -> 'name',
                'before_active', before_row -> 'is_active',
                'after_active', after_row -> 'is_active'
            );
        when 'site_settings' then
            details_value := jsonb_build_object(
                'key', coalesce(after_row -> 'key', before_row -> 'key')
            );
        else
            details_value := '{}'::jsonb;
    end case;

    insert into public.activity_logs (
        actor_id, action, target_type, target_id, details
    )
    values (
        auth.uid(),
        lower(tg_table_name || '.' || tg_op),
        tg_table_name,
        target_key,
        jsonb_strip_nulls(details_value)
    );

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

revoke all on function public.audit_admin_console_change() from public, anon, authenticated;
revoke insert on public.activity_logs from anon, authenticated;

create trigger profiles_admin_audit
    after update of role on public.profiles
    for each row when (old.role is distinct from new.role)
    execute function public.audit_admin_console_change();

create trigger farmer_profiles_admin_audit
    after insert or update of status, verified_at or delete on public.farmer_profiles
    for each row execute function public.audit_admin_console_change();

create trigger listings_admin_audit
    after insert or update of status or delete on public.listings
    for each row execute function public.audit_admin_console_change();

create trigger reviews_admin_audit
    after update of status or delete on public.reviews
    for each row execute function public.audit_admin_console_change();

create trigger reports_admin_audit
    after update of status or delete on public.reports
    for each row execute function public.audit_admin_console_change();

create trigger categories_admin_audit
    after insert or update or delete on public.categories
    for each row execute function public.audit_admin_console_change();

create trigger site_settings_admin_audit
    after insert or update or delete on public.site_settings
    for each row execute function public.audit_admin_console_change();
