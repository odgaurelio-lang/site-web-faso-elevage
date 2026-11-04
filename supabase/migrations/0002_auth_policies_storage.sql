-- Public farmer registrations start pending; privileged roles are assigned only
-- through a trusted administrative process.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    full_name_value text := nullif(btrim(metadata ->> 'full_name'), '');
    farm_name_value text := nullif(btrim(metadata ->> 'farm_name'), '');
    whatsapp_value text := nullif(btrim(metadata ->> 'whatsapp_phone'), '');
    city_value text := nullif(btrim(metadata ->> 'city'), '');
begin
    if metadata ->> 'account_type' is not null
       and metadata ->> 'account_type' <> 'farmer' then
        raise exception 'Only farmer registration is enabled';
    end if;

    full_name_value := coalesce(
        full_name_value,
        nullif(left(split_part(coalesce(new.email, ''), '@', 1), 120), ''),
        'Compte'
    );

    insert into public.profiles (id, full_name, phone)
    values (
        new.id,
        full_name_value,
        nullif(btrim(metadata ->> 'phone'), '')
    );

    if metadata ->> 'account_type' = 'farmer' then
        if char_length(full_name_value) > 120
           or farm_name_value is null or char_length(farm_name_value) > 160
           or whatsapp_value is null or char_length(whatsapp_value) not between 8 and 32
           or city_value is null or char_length(city_value) > 100 then
            raise exception 'Required farmer registration fields are invalid';
        end if;

        insert into public.farmer_profiles (
            id, farm_name, whatsapp_phone, city, commune, bio
        )
        values (
            new.id,
            farm_name_value,
            whatsapp_value,
            city_value,
            nullif(btrim(metadata ->> 'commune'), ''),
            nullif(btrim(metadata ->> 'bio'), '')
        );
    end if;

    return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

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
    );
$$;

create or replace function public.is_approved_farmer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.farmer_profiles fp
        where fp.id = (select auth.uid())
          and fp.status = 'approved'
    );
$$;

revoke all on function public.has_any_app_role(text[]) from public;
revoke all on function public.is_approved_farmer() from public;
grant execute on function public.has_any_app_role(text[]) to anon, authenticated;
grant execute on function public.is_approved_farmer() to anon, authenticated;

create or replace function public.guard_privileged_profile_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.role is distinct from old.role
       and current_user not in ('postgres', 'service_role')
       and not public.has_any_app_role(array['admin']) then
        raise exception 'Only an administrator can change account roles'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

create trigger profiles_guard_role
    before update on public.profiles
    for each row execute function public.guard_privileged_profile_changes();

create or replace function public.guard_farmer_review_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if (new.status is distinct from old.status
        or new.verified_at is distinct from old.verified_at)
       and current_user not in ('postgres', 'service_role')
       and not public.has_any_app_role(array['admin']) then
        raise exception 'Only an administrator can change farmer approval'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

create trigger farmer_profiles_guard_review
    before update on public.farmer_profiles
    for each row execute function public.guard_farmer_review_changes();

create or replace function public.guard_listing_moderation_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id is distinct from old.id
       and current_user not in ('postgres', 'service_role') then
        raise exception 'Listing identifiers cannot be changed'
            using errcode = '42501';
    end if;

    if current_user not in ('postgres', 'service_role')
       and not public.has_any_app_role(array['admin', 'moderator'])
       and (
           new.moderation_note is distinct from old.moderation_note
           or (
               new.status is distinct from old.status
               and new.status not in ('draft', 'pending_review', 'paused')
           )
       ) then
        raise exception 'Farmers may only pause or resubmit their own listings'
            using errcode = '42501';
    end if;

    if current_user not in ('postgres', 'service_role')
       and public.has_any_app_role(array['moderator'])
       and not public.has_any_app_role(array['admin'])
       and (
           new.farmer_id is distinct from old.farmer_id
           or new.category_id is distinct from old.category_id
           or new.title is distinct from old.title
           or new.species is distinct from old.species
           or new.breed is distinct from old.breed
           or new.description is distinct from old.description
           or new.age_months is distinct from old.age_months
           or new.approximate_weight_kg is distinct from old.approximate_weight_kg
           or new.quantity_available is distinct from old.quantity_available
           or new.unit is distinct from old.unit
           or new.unit_price_xof is distinct from old.unit_price_xof
           or new.wholesale_price_xof is distinct from old.wholesale_price_xof
           or new.minimum_order_quantity is distinct from old.minimum_order_quantity
           or new.city is distinct from old.city
           or new.available_from is distinct from old.available_from
           or new.created_at is distinct from old.created_at
       ) then
        raise exception 'Moderators can only change listing moderation fields'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

create trigger listings_guard_moderation
    before update on public.listings
    for each row execute function public.guard_listing_moderation_changes();

create or replace function public.guard_review_moderation_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id is distinct from old.id
       and current_user not in ('postgres', 'service_role') then
        raise exception 'Review identifiers cannot be changed'
            using errcode = '42501';
    end if;

    if current_user not in ('postgres', 'service_role')
       and public.has_any_app_role(array['moderator'])
       and not public.has_any_app_role(array['admin'])
       and (
           new.farmer_id is distinct from old.farmer_id
           or new.listing_id is distinct from old.listing_id
           or new.reviewer_name is distinct from old.reviewer_name
           or new.rating is distinct from old.rating
           or new.body is distinct from old.body
           or new.created_at is distinct from old.created_at
       ) then
        raise exception 'Moderators can only change review moderation status'
            using errcode = '42501';
    end if;

    if new.status is distinct from old.status
       and current_user not in ('postgres', 'service_role')
       and not public.has_any_app_role(array['admin', 'moderator']) then
        raise exception 'Only a moderator can change review moderation'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

create or replace function public.guard_report_resolution_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id is distinct from old.id
       and current_user not in ('postgres', 'service_role') then
        raise exception 'Report identifiers cannot be changed'
            using errcode = '42501';
    end if;

    if current_user not in ('postgres', 'service_role')
       and public.has_any_app_role(array['moderator'])
       and not public.has_any_app_role(array['admin'])
       and (
           new.target_type is distinct from old.target_type
           or new.listing_id is distinct from old.listing_id
           or new.review_id is distinct from old.review_id
           or new.reason is distinct from old.reason
           or new.details is distinct from old.details
           or new.created_at is distinct from old.created_at
       ) then
        raise exception 'Moderators cannot change report contents'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

create trigger reports_guard_resolution
    before update on public.reports
    for each row execute function public.guard_report_resolution_changes();

create trigger reviews_guard_moderation
    before update on public.reviews
    for each row execute function public.guard_review_moderation_changes();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger farmer_profiles_set_updated_at
    before update on public.farmer_profiles
    for each row execute function public.set_updated_at();

create trigger listings_set_updated_at
    before update on public.listings
    for each row execute function public.set_updated_at();

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
    on public.categories for select to anon, authenticated
    using (is_active);

create policy "Admins can manage categories"
    on public.categories for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Users can read their own profile"
    on public.profiles for select to authenticated
    using (id = (select auth.uid()) or public.has_any_app_role(array['admin']));

create policy "Users can update their own profile"
    on public.profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (
        id = (select auth.uid())
        and role = 'farmer'
    );

create policy "Admins can manage profiles"
    on public.profiles for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Public can read approved farmer profiles"
    on public.farmer_profiles for select to anon, authenticated
    using (status = 'approved');

create policy "Farmers can read their own profile"
    on public.farmer_profiles for select to authenticated
    using (id = (select auth.uid()));

create policy "Admins can manage farmer profiles"
    on public.farmer_profiles for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Farmers can update their own contact details"
    on public.farmer_profiles for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

create policy "Public can read published listings"
    on public.listings for select to anon, authenticated
    using (
        status = 'published'
        and exists (
            select 1
            from public.farmer_profiles fp
            where fp.id = listings.farmer_id
              and fp.status = 'approved'
        )
        and exists (
            select 1
            from public.categories c
            where c.id = listings.category_id
              and c.is_active
        )
    );

create policy "Farmers can read their own listings"
    on public.listings for select to authenticated
    using (
        farmer_id = (select auth.uid())
        or public.has_any_app_role(array['admin', 'moderator'])
    );

create policy "Approved farmers can create listings"
    on public.listings for insert to authenticated
    with check (
        farmer_id = (select auth.uid())
        and public.is_approved_farmer()
        and status in ('draft', 'pending_review')
        and exists (
            select 1
            from public.categories c
            where c.id = listings.category_id
              and c.is_active
        )
    );

create policy "Farmers can update their own listings"
    on public.listings for update to authenticated
    using (farmer_id = (select auth.uid()) and public.is_approved_farmer())
    with check (
        farmer_id = (select auth.uid())
        and public.is_approved_farmer()
        and status in ('draft', 'pending_review', 'paused')
        and exists (
            select 1
            from public.categories c
            where c.id = listings.category_id
              and c.is_active
        )
    );

create policy "Moderators can update listing moderation"
    on public.listings for update to authenticated
    using (public.has_any_app_role(array['moderator']))
    with check (public.has_any_app_role(array['moderator']));

create policy "Admins can manage listings"
    on public.listings for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Public can read photos for visible listings"
    on public.listing_photos for select to anon, authenticated
    using (
        exists (
            select 1
            from public.listings l
            join public.farmer_profiles fp on fp.id = l.farmer_id
            where l.id = listing_photos.listing_id
              and l.status = 'published'
              and fp.status = 'approved'
        )
        or exists (
            select 1
            from public.listings l
            where l.id = listing_photos.listing_id
              and l.farmer_id = (select auth.uid())
        )
        or public.has_any_app_role(array['admin', 'moderator'])
    );

create policy "Approved farmers can manage photos for their listings"
    on public.listing_photos for all to authenticated
    using (
        exists (
            select 1
            from public.listings l
            where l.id = listing_photos.listing_id
              and l.farmer_id = (select auth.uid())
              and public.is_approved_farmer()
        )
    )
    with check (
        exists (
            select 1
            from public.listings l
            where l.id = listing_photos.listing_id
              and l.farmer_id = (select auth.uid())
              and public.is_approved_farmer()
        )
    );

create policy "Admins can manage all listing photos"
    on public.listing_photos for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Public can read published reviews"
    on public.reviews for select to anon, authenticated
    using (status = 'published');

create policy "Farmers and moderators can read reviews"
    on public.reviews for select to authenticated
    using (
        farmer_id = (select auth.uid())
        or public.has_any_app_role(array['admin', 'moderator'])
    );

create policy "Moderators can manage reviews"
    on public.reviews for update to authenticated
    using (public.has_any_app_role(array['admin', 'moderator']))
    with check (public.has_any_app_role(array['admin', 'moderator']));

create policy "Admins can manage reviews"
    on public.reviews for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Moderators can review reports"
    on public.reports for select to authenticated
    using (public.has_any_app_role(array['admin', 'moderator']));

create policy "Moderators can resolve reports"
    on public.reports for update to authenticated
    using (public.has_any_app_role(array['admin', 'moderator']))
    with check (public.has_any_app_role(array['admin', 'moderator']));

create policy "Admins can manage reports"
    on public.reports for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Farmers can read their own contact events"
    on public.whatsapp_contact_events for select to authenticated
    using (
        farmer_id = (select auth.uid())
        or public.has_any_app_role(array['admin'])
    );

create policy "Public can read approved public settings"
    on public.site_settings for select to anon, authenticated
    using (key in ('public_whatsapp', 'site_content', 'social_links', 'supported_languages', 'contact'));

create policy "Admins can manage site settings"
    on public.site_settings for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

create policy "Admins can read activity logs"
    on public.activity_logs for select to authenticated
    using (public.has_any_app_role(array['admin']));

create policy "Admins can append activity logs"
    on public.activity_logs for insert to authenticated
    with check (public.has_any_app_role(array['admin']));

create table public.farmer_documents (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references public.farmer_profiles (id) on delete cascade,
    storage_path text not null unique,
    created_at timestamptz not null default now(),
    constraint farmer_documents_path_owner check (
        storage_path like farmer_id::text || '/%'
    )
);

create index farmer_documents_farmer_idx on public.farmer_documents (farmer_id);
alter table public.farmer_documents enable row level security;

create policy "Farmers can read their own verification documents"
    on public.farmer_documents for select to authenticated
    using (farmer_id = (select auth.uid()));

create policy "Farmers can register their own verification documents"
    on public.farmer_documents for insert to authenticated
    with check (farmer_id = (select auth.uid()));

create policy "Admins can manage verification documents"
    on public.farmer_documents for all to authenticated
    using (public.has_any_app_role(array['admin']))
    with check (public.has_any_app_role(array['admin']));

insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
)
values
    ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
    ('farmer-documents', 'farmer-documents', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Public can read listing photos"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'listing-photos');

create policy "Approved farmers can upload listing photos to their own listings"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and exists (
            select 1
            from public.listings l
            where l.id::text = (storage.foldername(name))[2]
              and l.farmer_id = (select auth.uid())
              and public.is_approved_farmer()
        )
    );

create policy "Farmers can update their own listing photos"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and exists (
            select 1
            from public.listings l
            where l.id::text = (storage.foldername(name))[2]
              and l.farmer_id = (select auth.uid())
              and public.is_approved_farmer()
        )
    );

create policy "Farmers can delete their own listing photos"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "Admins can manage listing photos storage"
    on storage.objects for all to authenticated
    using (
        bucket_id = 'listing-photos'
        and public.has_any_app_role(array['admin'])
    )
    with check (
        bucket_id = 'listing-photos'
        and public.has_any_app_role(array['admin'])
    );

create policy "Farmers can upload their own verification documents"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'farmer-documents'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "Farmers and admins can read verification documents"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'farmer-documents'
        and (
            (storage.foldername(name))[1] = (select auth.uid())::text
            or public.has_any_app_role(array['admin'])
        )
    );

create policy "Farmers can delete their own verification documents"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'farmer-documents'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "Admins can manage verification document storage"
    on storage.objects for all to authenticated
    using (
        bucket_id = 'farmer-documents'
        and public.has_any_app_role(array['admin'])
    )
    with check (
        bucket_id = 'farmer-documents'
        and public.has_any_app_role(array['admin'])
    );

revoke all on table public.profiles, public.farmer_profiles, public.categories,
    public.listings, public.listing_photos, public.reviews, public.reports,
    public.whatsapp_contact_events, public.site_settings, public.activity_logs,
    public.farmer_documents from anon, authenticated;

grant select on table public.categories, public.farmer_profiles, public.listings,
    public.listing_photos, public.reviews, public.site_settings to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;
grant select, update on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;
grant select, update on table public.farmer_profiles to authenticated;
grant update (farm_name, whatsapp_phone, city, commune, bio) on table public.farmer_profiles to authenticated;
grant insert, update, delete on table public.listings to authenticated;
grant insert, update, delete on table public.listing_photos to authenticated;
grant select, update, delete on table public.reviews to authenticated;
grant select, update, delete on table public.reports to authenticated;
grant select on table public.whatsapp_contact_events to authenticated;
grant insert, update, delete on table public.site_settings to authenticated;
grant select, insert on table public.activity_logs to authenticated;
grant select, insert, delete on table public.farmer_documents to authenticated;
grant usage, select on sequence public.activity_logs_id_seq to authenticated;
