-- Development/demo data only. Do not run this file against production.
-- Optional listings are created only after registering a test account with
-- demo-fermier@example.test in a non-production Supabase project.

insert into public.categories (name, slug, description)
values
    ('Volailles', 'volailles', 'Poulets locaux, pintades et autres volailles du Faso.'),
    ('Bovins', 'bovins', 'Bovins d’élevage et animaux disponibles.'),
    ('Ovins', 'ovins', 'Moutons et autres ovins élevés localement.'),
    ('Caprins', 'caprins', 'Chèvres et autres caprins disponibles.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true;

insert into public.site_settings (key, value)
values
    ('site_content', jsonb_build_object(
        'brand_name', 'Faso Élevage',
        'brand_name_is_provisional', true,
        'home_slogan', 'Du terroir burkinabè à votre table',
        'home_intro', 'Découvrez les élevages près de chez vous et échangez directement avec les fermiers pour confirmer le stock, le prix et les modalités.'
    )),
    ('supported_languages', jsonb_build_array('fr'))
on conflict (key) do nothing;

do $$
declare
    demo_farmer_id uuid;
begin
    select u.id into demo_farmer_id
    from auth.users u
    where lower(u.email) = 'demo-fermier@example.test'
    limit 1;

    if demo_farmer_id is null then
        raise notice 'Demo listings skipped: create demo-fermier@example.test in a non-production project first.';
        return;
    end if;

    update public.farmer_profiles
    set status = 'approved',
        verified_at = coalesce(verified_at, now())
    where id = demo_farmer_id;

    insert into public.listings (
        farmer_id, category_id, title, species, breed, description,
        age_months, approximate_weight_kg, quantity_available, unit,
        unit_price_xof, minimum_order_quantity, city, status
    )
    select demo_farmer_id, c.id, sample.title, sample.species, sample.breed,
        sample.description, sample.age_months, sample.weight_kg, sample.quantity,
        'tête', sample.price_xof, 1, sample.city, 'published'::public.listing_status
    from (
        values
            ('Poulets locaux élevés au village', 'Volaille', 'Poulet local',
                'Poulets élevés en plein air, disponibilité à confirmer directement auprès de la ferme.',
                5, 1.80::numeric, 25, 4500, 'Koudougou', 'volailles'),
            ('Moutons Bali-Bali pour la saison', 'Ovin', 'Bali-Bali',
                'Lot de moutons suivis à la ferme. Contact direct pour confirmer le poids et le stock.',
                18, 38.00::numeric, 8, 85000, 'Ouagadougou', 'ovins'),
            ('Chèvres locales de Banfora', 'Caprin', 'Chèvre locale',
                'Chèvres disponibles sur demande. Retrait à organiser avec le fermier.',
                12, 14.00::numeric, 12, 32000, 'Banfora', 'caprins'),
            ('Bœufs zébus de Koudougou', 'Bovin', 'Zébu',
                'Bovins d’élevage, vente au détail ou discussion pour un lot.',
                36, 280.00::numeric, 4, 275000, 'Koudougou', 'bovins')
    ) as sample(title, species, breed, description, age_months, weight_kg,
                quantity, price_xof, city, category_slug)
    join public.categories c on c.slug = sample.category_slug
    where not exists (
        select 1
        from public.listings existing
        where existing.farmer_id = demo_farmer_id
          and existing.title = sample.title
    );
end;
$$;
