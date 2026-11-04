create type public.listing_event_type as enum ('view', 'contact');

alter table public.listings
    add constraint listings_title_not_blank
        check (char_length(btrim(title)) between 1 and 180),
    add constraint listings_species_length
        check (char_length(btrim(species)) between 1 and 100),
    add constraint listings_breed_length
        check (breed is null or char_length(btrim(breed)) <= 100),
    add constraint listings_description_length
        check (description is null or char_length(description) <= 3000),
    add constraint listings_unit_length
        check (char_length(btrim(unit)) between 1 and 30),
    add constraint listings_city_length
        check (char_length(btrim(city)) between 1 and 100),
    add constraint listings_wholesale_not_above_unit
        check (wholesale_price_xof is null or wholesale_price_xof <= unit_price_xof),
    add constraint listings_minimum_within_stock
        check (quantity_available = 0 or minimum_order_quantity <= quantity_available);

create or replace function public.enforce_listing_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_photo_count integer;
begin
    perform 1
    from public.listings l
    where l.id = new.listing_id
    for update;

    select count(*) into existing_photo_count
    from public.listing_photos p
    where p.listing_id = new.listing_id
      and (tg_op = 'INSERT' or p.id is distinct from new.id);

    if existing_photo_count >= 5 then
        raise exception 'An announcement can have at most five photos'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

revoke all on function public.enforce_listing_photo_limit() from public, anon, authenticated;

create trigger listing_photos_enforce_limit
    before insert or update of listing_id on public.listing_photos
    for each row execute function public.enforce_listing_photo_limit();

create table public.listing_events (
    id bigint generated always as identity primary key,
    listing_id uuid references public.listings (id) on delete cascade,
    farmer_id uuid not null references public.farmer_profiles (id) on delete cascade,
    event_type public.listing_event_type not null,
    visitor_key uuid not null,
    event_day date not null default (now() at time zone 'utc')::date,
    created_at timestamptz not null default now()
);

create unique index listing_events_listing_one_per_day_idx
    on public.listing_events (listing_id, event_type, visitor_key, event_day)
    where listing_id is not null;

create unique index listing_events_farmer_contact_one_per_day_idx
    on public.listing_events (farmer_id, event_type, visitor_key, event_day)
    where listing_id is null;

create index listing_events_farmer_day_idx
    on public.listing_events (farmer_id, event_day desc);

alter table public.listing_events enable row level security;

create policy "Farmers can read their own listing events"
    on public.listing_events for select to authenticated
    using (
        farmer_id = (select auth.uid())
        or public.has_any_app_role(array['admin'])
    );

revoke all on table public.listing_events from anon, authenticated;
grant select on table public.listing_events to authenticated;

create or replace function public.record_listing_event(
    target_listing_id uuid,
    target_event_type public.listing_event_type,
    target_visitor_key uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_farmer_id uuid;
    inserted_count integer;
begin
    if target_listing_id is null or target_visitor_key is null
       or target_event_type not in ('view', 'contact') then
        raise exception 'Invalid listing event';
    end if;

    select l.farmer_id
    into target_farmer_id
    from public.listings l
    join public.farmer_profiles fp on fp.id = l.farmer_id
    join public.categories c on c.id = l.category_id
    where l.id = target_listing_id
      and l.status = 'published'
      and fp.status = 'approved'
      and c.is_active;

    if target_farmer_id is null then
        return false;
    end if;

    insert into public.listing_events (
        listing_id, farmer_id, event_type, visitor_key
    )
    values (
        target_listing_id, target_farmer_id, target_event_type, target_visitor_key
    )
    on conflict (listing_id, event_type, visitor_key, event_day)
    where listing_id is not null do nothing;

    get diagnostics inserted_count = row_count;
    return inserted_count = 1;
end;
$$;

revoke all on function public.record_listing_event(uuid, public.listing_event_type, uuid) from public;
grant execute on function public.record_listing_event(uuid, public.listing_event_type, uuid) to anon, authenticated;

create or replace function public.record_farmer_contact_event(
    target_farmer_id uuid,
    target_visitor_key uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    inserted_count integer;
begin
    if target_farmer_id is null or target_visitor_key is null then
        raise exception 'Invalid farmer contact event';
    end if;

    if not exists (
        select 1 from public.farmer_profiles fp
        where fp.id = target_farmer_id and fp.status = 'approved'
    ) then
        return false;
    end if;

    insert into public.listing_events (
        listing_id, farmer_id, event_type, visitor_key
    )
    values (
        null, target_farmer_id, 'contact', target_visitor_key
    )
    on conflict (farmer_id, event_type, visitor_key, event_day)
    where listing_id is null do nothing;

    get diagnostics inserted_count = row_count;
    return inserted_count = 1;
end;
$$;

revoke all on function public.record_farmer_contact_event(uuid, uuid) from public;
grant execute on function public.record_farmer_contact_event(uuid, uuid) to anon, authenticated;

create or replace function public.get_my_listing_stats()
returns table (
    listing_id uuid,
    views bigint,
    whatsapp_contacts bigint,
    last_event_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select l.id,
           count(e.id) filter (where e.event_type = 'view'),
           count(e.id) filter (where e.event_type = 'contact'),
           max(e.created_at)
    from public.listings l
    left join public.listing_events e on e.listing_id = l.id
    where l.farmer_id = (select auth.uid())
    group by l.id;
$$;

revoke all on function public.get_my_listing_stats() from public, anon;
grant execute on function public.get_my_listing_stats() to authenticated;

create or replace function public.get_my_farmer_profile_contact_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
    select count(*)
    from public.listing_events e
    where e.farmer_id = (select auth.uid())
      and e.listing_id is null
      and e.event_type = 'contact';
$$;

revoke all on function public.get_my_farmer_profile_contact_count() from public, anon;
grant execute on function public.get_my_farmer_profile_contact_count() to authenticated;

alter table public.reviews
    add column client_key uuid;

alter table public.reports
    add column client_key uuid;

create index reviews_client_farmer_created_idx
    on public.reviews (farmer_id, client_key, created_at desc)
    where client_key is not null;

create index reports_client_target_created_idx
    on public.reports (client_key, listing_id, created_at desc)
    where client_key is not null;

create unique index reviews_one_per_client_farmer_idx
    on public.reviews (farmer_id, client_key)
    where client_key is not null;

alter table public.reports
    add column client_day date generated always as ((created_at at time zone 'utc')::date) stored;

create unique index reports_one_per_client_listing_day_idx
    on public.reports (listing_id, client_key, client_day)
    where client_key is not null and listing_id is not null;

create or replace function public.submit_farmer_review(
    target_farmer_id uuid,
    submitted_rating smallint,
    submitted_name text,
    submitted_body text,
    submitted_client_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    review_id uuid;
begin
    if target_farmer_id is null
       or submitted_client_key is null
       or submitted_rating not between 1 and 5
       or char_length(btrim(coalesce(submitted_name, ''))) not between 1 and 120
       or char_length(btrim(coalesce(submitted_body, ''))) not between 10 and 2000 then
        raise exception 'Veuillez fournir une note et un avis valides';
    end if;

    if not exists (
        select 1 from public.farmer_profiles fp
        where fp.id = target_farmer_id and fp.status = 'approved'
    ) then
        raise exception 'Ce profil fermier n’accepte pas les avis';
    end if;

    begin
        insert into public.reviews (
            farmer_id, reviewer_name, rating, body, status, client_key
        )
        values (
            target_farmer_id,
            btrim(submitted_name),
            submitted_rating,
            btrim(submitted_body),
            'pending',
            submitted_client_key
        )
        returning id into review_id;
    exception when unique_violation then
        raise exception 'Un avis a déjà été envoyé depuis cet appareil pour ce fermier';
    end;

    return review_id;
end;
$$;

revoke all on function public.submit_farmer_review(uuid, smallint, text, text, uuid) from public;
grant execute on function public.submit_farmer_review(uuid, smallint, text, text, uuid) to anon, authenticated;

create or replace function public.submit_listing_report(
    target_listing_id uuid,
    submitted_reason text,
    submitted_details text,
    submitted_client_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    report_id uuid;
begin
    if target_listing_id is null
       or submitted_client_key is null
       or char_length(btrim(coalesce(submitted_reason, ''))) not between 3 and 200
       or char_length(btrim(coalesce(submitted_details, ''))) > 2000 then
        raise exception 'Veuillez fournir un signalement valide';
    end if;

    if not exists (
        select 1 from public.listings l
        where l.id = target_listing_id and l.status = 'published'
    ) then
        raise exception 'Cette annonce n’est pas signalable';
    end if;

    begin
        insert into public.reports (
            target_type, listing_id, reason, details, status, client_key
        )
        values (
            'listing',
            target_listing_id,
            btrim(submitted_reason),
            nullif(btrim(coalesce(submitted_details, '')), ''),
            'open',
            submitted_client_key
        )
        returning id into report_id;
    exception when unique_violation then
        raise exception 'Un signalement a déjà été reçu depuis cet appareil pour cette annonce aujourd’hui';
    end;

    return report_id;
end;
$$;

revoke all on function public.submit_listing_report(uuid, text, text, uuid) from public;
grant execute on function public.submit_listing_report(uuid, text, text, uuid) to anon, authenticated;

revoke insert on table public.reviews, public.reports from anon, authenticated;

create table public.farmer_notifications (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references public.farmer_profiles (id) on delete cascade,
    notification_type text not null,
    subject text not null,
    message text not null,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    constraint farmer_notifications_type check (
        notification_type in ('farmer_approved', 'farmer_rejected', 'listing_rejected')
    )
);

create index farmer_notifications_farmer_created_idx
    on public.farmer_notifications (farmer_id, created_at desc);

alter table public.farmer_notifications enable row level security;

create policy "Farmers can read their own notifications"
    on public.farmer_notifications for select to authenticated
    using (
        farmer_id = (select auth.uid())
        or public.has_any_app_role(array['admin'])
    );

create policy "Farmers can mark their own notifications read"
    on public.farmer_notifications for update to authenticated
    using (farmer_id = (select auth.uid()))
    with check (farmer_id = (select auth.uid()));

revoke all on table public.farmer_notifications from anon, authenticated;
grant select on table public.farmer_notifications to authenticated;
grant update (read_at) on table public.farmer_notifications to authenticated;

create or replace function public.enqueue_farmer_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status is distinct from old.status then
        if new.status = 'approved' then
            insert into public.farmer_notifications (
                farmer_id, notification_type, subject, message
            )
            values (
                new.id,
                'farmer_approved',
                'Votre profil fermier est validé',
                'Votre profil est validé. Vous pouvez maintenant gérer vos annonces dans votre espace fermier.'
            );
        elsif new.status = 'rejected' then
            insert into public.farmer_notifications (
                farmer_id, notification_type, subject, message
            )
            values (
                new.id,
                'farmer_rejected',
                'Votre profil fermier nécessite une correction',
                'Votre demande n’a pas été validée. Connectez-vous ou contactez l’équipe pour connaître la suite.'
            );
        end if;
    end if;
    return new;
end;
$$;

create trigger farmer_profiles_enqueue_notification
    after update on public.farmer_profiles
    for each row execute function public.enqueue_farmer_status_notification();

create or replace function public.enqueue_listing_rejection_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status = 'rejected' and old.status is distinct from new.status then
        insert into public.farmer_notifications (
            farmer_id, notification_type, subject, message
        )
        values (
            new.farmer_id,
            'listing_rejected',
            'Une annonce nécessite une correction',
            'Une de vos annonces a été refusée. Ouvrez votre espace fermier pour consulter le motif et la corriger.'
        );
    end if;
    return new;
end;
$$;

create trigger listings_enqueue_rejection_notification
    after update on public.listings
    for each row execute function public.enqueue_listing_rejection_notification();

create policy "Farmers can delete their own non-published listings"
    on public.listings for delete to authenticated
    using (
        farmer_id = (select auth.uid())
        and public.is_approved_farmer()
        and status in ('draft', 'pending_review', 'paused', 'rejected')
    );

create policy "Farmers can delete photos from their own listings"
    on public.listing_photos for delete to authenticated
    using (
        exists (
            select 1 from public.listings l
            where l.id = listing_photos.listing_id
              and l.farmer_id = (select auth.uid())
              and public.is_approved_farmer()
        )
    );

create policy "Farmers can delete their own listing photo storage"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = (select auth.uid())::text
        and exists (
            select 1 from public.listings l
            where l.id::text = (storage.foldername(name))[2]
              and l.farmer_id = (select auth.uid())
              and public.is_approved_farmer()
        )
    );
