update storage.buckets
set public = false
where id = 'listing-photos';

drop policy if exists "Public can read listing photos" on storage.objects;

create policy "Users can read accessible listing photos"
    on storage.objects for select to anon, authenticated
    using (
        bucket_id = 'listing-photos'
        and exists (
            select 1
            from public.listing_photos lp
            where lp.storage_path = storage.objects.name
        )
    );

drop policy if exists "Public can read photos for visible listings"
    on public.listing_photos;

create policy "Public can read photos for visible listings"
    on public.listing_photos for select to anon, authenticated
    using (
        exists (
            select 1
            from public.listings l
            join public.farmer_profiles fp on fp.id = l.farmer_id
            join public.categories c on c.id = l.category_id
            where l.id = listing_photos.listing_id
              and l.status = 'published'
              and fp.status = 'approved'
              and c.is_active
        )
        or exists (
            select 1
            from public.listings l
            where l.id = listing_photos.listing_id
              and l.farmer_id = (select auth.uid())
        )
        or public.has_any_app_role(array['admin', 'moderator'])
    );
