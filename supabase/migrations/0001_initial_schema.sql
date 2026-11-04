-- Schéma de base. La migration 0002 ajoute les politiques RLS et le stockage
-- avant tout accès applicatif ; les tests de rôles restent requis.

create extension if not exists pgcrypto;

create type public.app_role as enum ('farmer', 'moderator', 'admin');
create type public.farmer_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.listing_status as enum ('draft', 'pending_review', 'published', 'paused', 'rejected', 'archived');
create type public.review_status as enum ('pending', 'published', 'hidden', 'rejected');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.report_target as enum ('listing', 'review');

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    role public.app_role not null default 'farmer',
    full_name text not null,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_full_name_length check (char_length(full_name) between 1 and 120),
    constraint profiles_phone_length check (phone is null or char_length(phone) <= 32)
);

create table public.farmer_profiles (
    id uuid primary key references public.profiles (id) on delete cascade,
    farm_name text not null,
    whatsapp_phone text not null,
    city text not null,
    commune text,
    bio text,
    status public.farmer_status not null default 'pending',
    verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint farmer_farm_name_length check (char_length(farm_name) between 1 and 160),
    constraint farmer_phone_length check (char_length(whatsapp_phone) between 8 and 32),
    constraint farmer_city_length check (char_length(city) between 1 and 100)
);

create table public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    constraint categories_name_length check (char_length(name) between 1 and 100)
);

create table public.listings (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references public.farmer_profiles (id) on delete restrict,
    category_id uuid not null references public.categories (id) on delete restrict,
    title text not null,
    species text not null,
    breed text,
    description text,
    age_months integer,
    approximate_weight_kg numeric(7, 2),
    quantity_available integer not null,
    unit text not null default 'tête',
    unit_price_xof integer not null,
    wholesale_price_xof integer,
    minimum_order_quantity integer not null default 1,
    city text not null,
    available_from date,
    status public.listing_status not null default 'draft',
    moderation_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint listings_title_length check (char_length(title) between 1 and 180),
    constraint listings_age_nonnegative check (age_months is null or age_months >= 0),
    constraint listings_weight_positive check (approximate_weight_kg is null or approximate_weight_kg > 0),
    constraint listings_quantity_nonnegative check (quantity_available >= 0),
    constraint listings_price_positive check (unit_price_xof > 0),
    constraint listings_wholesale_price_positive check (wholesale_price_xof is null or wholesale_price_xof > 0),
    constraint listings_minimum_order_positive check (minimum_order_quantity > 0)
);

create table public.listing_photos (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings (id) on delete cascade,
    storage_path text not null unique,
    display_order smallint not null default 0,
    created_at timestamptz not null default now(),
    constraint listing_photos_order_nonnegative check (display_order >= 0)
);

create table public.reviews (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references public.farmer_profiles (id) on delete cascade,
    listing_id uuid references public.listings (id) on delete set null,
    reviewer_name text,
    rating smallint not null,
    body text,
    status public.review_status not null default 'pending',
    created_at timestamptz not null default now(),
    constraint reviews_rating_range check (rating between 1 and 5),
    constraint reviews_name_length check (reviewer_name is null or char_length(reviewer_name) <= 120),
    constraint reviews_body_length check (body is null or char_length(body) <= 3000)
);

create table public.reports (
    id uuid primary key default gen_random_uuid(),
    target_type public.report_target not null,
    listing_id uuid references public.listings (id) on delete cascade,
    review_id uuid references public.reviews (id) on delete cascade,
    reason text not null,
    details text,
    status public.report_status not null default 'open',
    resolved_by uuid references public.profiles (id) on delete set null,
    resolution_note text,
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    constraint reports_target_matches check (
        (target_type = 'listing' and listing_id is not null and review_id is null)
        or (target_type = 'review' and review_id is not null and listing_id is null)
    ),
    constraint reports_reason_length check (char_length(reason) between 1 and 200)
);

-- Une ligne mesure une ouverture du contact WhatsApp, pas une vente confirmée.
-- Les coordonnées et le contenu du message ne sont pas enregistrés.
create table public.whatsapp_contact_events (
    id uuid primary key default gen_random_uuid(),
    farmer_id uuid not null references public.farmer_profiles (id) on delete cascade,
    listing_id uuid references public.listings (id) on delete set null,
    item_count smallint not null default 1,
    created_at timestamptz not null default now(),
    constraint whatsapp_events_item_count_positive check (item_count > 0)
);

create table public.site_settings (
    key text primary key,
    value jsonb not null,
    updated_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint site_settings_key_length check (char_length(key) between 1 and 100)
);

create table public.activity_logs (
    id bigint generated always as identity primary key,
    actor_id uuid references public.profiles (id) on delete set null,
    action text not null,
    target_type text not null,
    target_id text,
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint activity_logs_action_length check (char_length(action) between 1 and 120),
    constraint activity_logs_target_type_length check (char_length(target_type) between 1 and 80)
);

create index farmer_profiles_status_idx on public.farmer_profiles (status);
create index listings_public_search_idx on public.listings (category_id, city, unit_price_xof)
    where status = 'published';
create index listings_farmer_status_idx on public.listings (farmer_id, status);
create index listing_photos_listing_order_idx on public.listing_photos (listing_id, display_order);
create index reviews_farmer_status_idx on public.reviews (farmer_id, status);
create index reports_status_created_idx on public.reports (status, created_at);
create index whatsapp_events_farmer_created_idx on public.whatsapp_contact_events (farmer_id, created_at);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

alter table public.profiles enable row level security;
alter table public.farmer_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.whatsapp_contact_events enable row level security;
alter table public.site_settings enable row level security;
alter table public.activity_logs enable row level security;
