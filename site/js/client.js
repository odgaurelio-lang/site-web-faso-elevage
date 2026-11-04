(() => {
  const config = window.APP_CONFIG ?? {};
  const hasSupabaseConfig =
    typeof config.supabaseUrl === "string" &&
    config.supabaseUrl.trim() !== "" &&
    typeof config.supabasePublishableKey === "string" &&
    config.supabasePublishableKey.trim() !== "";
  const demoMode = !hasSupabaseConfig;
  const cartKey = "fasoMarketCart.v1";
  const catalogCacheKey = "fasoMarketCatalog.v2";
  const catalogCacheLimit = 150;
  const catalogCacheLifetimeMs = 30 * 24 * 60 * 60 * 1000;
  const cityCoordinates = {
    Ouagadougou: [12.3714, -1.5197],
    "Bobo-Dioulasso": [11.1771, -4.2979],
    Koudougou: [12.2529, -2.3627],
    Ouahigouya: [13.5828, -2.4216],
    Banfora: [10.6333, -4.7667],
  };
  const animalIcons = {
    volailles: "🐓",
    bovins: "🐄",
    ovins: "🐏",
    caprins: "🐐",
  };
  const cities = [
    "Ouagadougou",
    "Bobo-Dioulasso",
    "Koudougou",
    "Ouahigouya",
    "Banfora",
  ];
  const demoProducts = [
    {
      id: "demo-poulets-koudougou",
      farmerId: "demo-ferme-sahel",
      farmerName: "Ferme Sahel Vert · Démo",
      farmerPhone: "",
      farmerCity: "Koudougou",
      verified: false,
      categoryId: "volailles",
      categoryName: "Volailles",
      title: "Poulets locaux élevés au village",
      species: "Volaille",
      breed: "Poulet local",
      description:
        "Exemple fictif d’une offre locale. La disponibilité, le prix et les modalités sont à confirmer auprès d’un fermier réel.",
      ageMonths: 5,
      weightKg: 1.8,
      quantity: 25,
      unit: "tête",
      unitPrice: 4500,
      wholesalePrice: null,
      minimumQuantity: 1,
      city: "Koudougou",
      availableFrom: null,
      photos: [],
    },
    {
      id: "demo-pintades-rupture",
      farmerId: "demo-ferme-nord",
      farmerName: "Élevage du Nord · Démo",
      farmerPhone: "",
      farmerCity: "Ouahigouya",
      verified: false,
      categoryId: "volailles",
      categoryName: "Volailles",
      title: "Pintades locales (stock épuisé)",
      species: "Volaille",
      breed: "Pintade locale",
      description: "Exemple fictif d’une offre actuellement marquée indisponible.",
      ageMonths: 6,
      weightKg: 1.5,
      quantity: 0,
      unit: "tête",
      unitPrice: 7000,
      wholesalePrice: null,
      minimumQuantity: 1,
      city: "Ouahigouya",
      availableFrom: null,
      photos: [],
    },
    {
      id: "demo-pintades-koudougou",
      farmerId: "demo-ferme-sahel",
      farmerName: "Ferme Sahel Vert · Démo",
      farmerPhone: "",
      farmerCity: "Koudougou",
      verified: false,
      categoryId: "volailles",
      categoryName: "Volailles",
      title: "Pintades locales",
      species: "Volaille",
      breed: "Pintade locale",
      description:
        "Exemple de démonstration : les caractéristiques sont illustratives, pas une offre commerciale.",
      ageMonths: 6,
      weightKg: 1.5,
      quantity: 16,
      unit: "tête",
      unitPrice: 6500,
      wholesalePrice: null,
      minimumQuantity: 1,
      city: "Koudougou",
      availableFrom: null,
      photos: [],
    },
    {
      id: "demo-bali-ouaga",
      farmerId: "demo-ferme-sahel",
      farmerName: "Ferme Sahel Vert · Démo",
      farmerPhone: "",
      farmerCity: "Ouagadougou",
      verified: false,
      categoryId: "ovins",
      categoryName: "Ovins",
      title: "Moutons Bali-Bali pour la saison",
      species: "Ovin",
      breed: "Bali-Bali",
      description:
        "Exemple fictif d’annonce. Demandez toujours confirmation du poids, du stock et du prix.",
      ageMonths: 18,
      weightKg: 38,
      quantity: 8,
      unit: "tête",
      unitPrice: 85000,
      wholesalePrice: 80000,
      minimumQuantity: 1,
      city: "Ouagadougou",
      availableFrom: null,
      photos: [],
    },
    {
      id: "demo-chevres-banfora",
      farmerId: "demo-ferme-banfora",
      farmerName: "Élevage Cascades · Démo",
      farmerPhone: "",
      farmerCity: "Banfora",
      verified: false,
      categoryId: "caprins",
      categoryName: "Caprins",
      title: "Chèvres locales de Banfora",
      species: "Caprin",
      breed: "Chèvre locale",
      description:
        "Exemple de démonstration. La ferme et le stock ne sont pas encore vérifiés.",
      ageMonths: 12,
      weightKg: 14,
      quantity: 12,
      unit: "tête",
      unitPrice: 32000,
      wholesalePrice: null,
      minimumQuantity: 1,
      city: "Banfora",
      availableFrom: null,
      photos: [],
    },
    {
      id: "demo-zebu-bobo",
      farmerId: "demo-ferme-bobo",
      farmerName: "Ferme Bobo Démo",
      farmerPhone: "",
      farmerCity: "Bobo-Dioulasso",
      verified: false,
      categoryId: "bovins",
      categoryName: "Bovins",
      title: "Zébus d’élevage à Bobo-Dioulasso",
      species: "Bovin",
      breed: "Zébu",
      description:
        "Annonce fictive de démonstration. Confirmez personnellement toute offre réelle.",
      ageMonths: 36,
      weightKg: 280,
      quantity: 4,
      unit: "tête",
      unitPrice: 275000,
      wholesalePrice: 260000,
      minimumQuantity: 1,
      city: "Bobo-Dioulasso",
      availableFrom: null,
      photos: [],
    },
    {
      id: "demo-poulets-ouahigouya",
      farmerId: "demo-ferme-nord",
      farmerName: "Élevage du Nord · Démo",
      farmerPhone: "",
      farmerCity: "Ouahigouya",
      verified: false,
      categoryId: "volailles",
      categoryName: "Volailles",
      title: "Poulets du Nord, élevage familial",
      species: "Volaille",
      breed: "Poulet local",
      description: "Exemple fictif destiné à présenter les filtres du catalogue.",
      ageMonths: 4,
      weightKg: 1.6,
      quantity: 18,
      unit: "tête",
      unitPrice: 5000,
      wholesalePrice: null,
      minimumQuantity: 1,
      city: "Ouahigouya",
      availableFrom: null,
      photos: [],
    },
  ];
  const demoReviews = [
    {
      name: "Avis de démonstration",
      rating: 5,
      body: "Cet emplacement présentera les avis publiés quand la plateforme sera configurée.",
    },
    {
      name: "Avis de démonstration",
      rating: 4,
      body: "Les commandes se discutent directement avec les fermiers sur WhatsApp.",
    },
    {
      name: "Avis de démonstration",
      rating: 5,
      body: "Vérifiez toujours le stock, le prix et les modalités avant tout accord.",
    },
  ];

  const state = {
    client: null,
    products: [],
    reviews: [],
    publicSettings: {},
    cart: { farmerId: null, items: [] },
    cartStorageAvailable: true,
    demoMode,
    offlineCatalog: false,
    catalogCachedAt: null,
    catalogLoadError: "",
    nearbyCoordinates: null,
    renderedProductViewId: null,
  };
  let supabaseSdkPromise = null;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function money(value) {
    return `${new Intl.NumberFormat("fr-FR").format(Number(value) || 0)} FCFA`;
  }

  function saveCatalogCache(products) {
    const snapshot = {
      savedAt: new Date().toISOString(),
      products: products
        .slice(0, catalogCacheLimit)
        .map((product) => ({ ...product, photos: [] })),
    };
    try {
      window.localStorage.setItem(catalogCacheKey, JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Le catalogue ne peut pas être enregistré pour une consultation hors connexion :", error);
      showNotice(
        "Le navigateur n’a pas pu mémoriser les offres pour une prochaine consultation hors connexion.",
        "info",
      );
    }
  }

  function readCatalogCache() {
    try {
      const cached = JSON.parse(window.localStorage.getItem(catalogCacheKey) ?? "null");
      const cachedAt = Date.parse(cached?.savedAt);
      if (
        !cached ||
        !Array.isArray(cached.products) ||
        !Number.isFinite(cachedAt) ||
        Date.now() - cachedAt > catalogCacheLifetimeMs
      ) {
        return null;
      }
      return { products: cached.products, savedAt: cached.savedAt };
    } catch (error) {
      console.warn("Le catalogue hors connexion n’a pas pu être lu :", error);
      return null;
    }
  }

  function formatQuantity(quantity, unit) {
    const suffix = Number(quantity) > 1 && !String(unit).endsWith("s") ? "s" : "";
    return `${quantity} ${unit}${suffix}`;
  }

  function showNotice(message, kind = "info", target = "#page-notice") {
    const notice = document.querySelector(target);
    if (!notice) {
      return;
    }
    notice.textContent = message;
    notice.className = `notice${kind === "error" ? " notice--error" : ""}${kind === "success" ? " notice--success" : ""}`;
    notice.hidden = false;
  }

  function clearNotice(target = "#page-notice") {
    const notice = document.querySelector(target);
    if (notice) {
      notice.hidden = true;
      notice.textContent = "";
      notice.className = "notice";
    }
  }

  function loadCart() {
    try {
      const stored = window.localStorage.getItem(cartKey);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        Array.isArray(parsed.items) &&
        (parsed.farmerId === null || typeof parsed.farmerId === "string") &&
        parsed.items.every(
          (item) =>
            item &&
            typeof item.id === "string" &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0,
        )
      ) {
        state.cart = parsed;
      } else {
        window.localStorage.removeItem(cartKey);
        showNotice("Un ancien panier incomplet a été écarté ; vous pouvez en créer un nouveau.", "info", "#cart-notice");
      }
    } catch (error) {
      state.cartStorageAvailable = false;
      showNotice(
        `Le panier ne peut pas être mémorisé sur cet appareil (${error.message}). Il restera disponible pendant cette visite.`,
        "error",
        "#cart-notice",
      );
    }
  }

  function saveCart() {
    if (!state.cartStorageAvailable) {
      return;
    }
    try {
      if (state.cart.items.length) {
        window.localStorage.setItem(cartKey, JSON.stringify(state.cart));
      } else {
        window.localStorage.removeItem(cartKey);
      }
    } catch (error) {
      state.cartStorageAvailable = false;
      showNotice(
        `Le panier ne peut pas être mémorisé (${error.message}). Il restera disponible pendant cette visite.`,
        "error",
        "#cart-notice",
      );
    }
  }

  async function normalizeListing(row, client) {
    const photos = await Promise.all(
      (row.photos ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map(async (photo) => {
          const { data, error } = await client.storage
            .from("listing-photos")
            .createSignedUrl(photo.storage_path, 60 * 60);
          if (error) {
            throw error;
          }
          return data.signedUrl;
        }),
    );

    return {
      id: row.id,
      farmerId: row.farmer_id,
      farmerName: row.farmer?.farm_name ?? "Éleveur local",
      farmerPhone: row.farmer?.whatsapp_phone ?? "",
      farmerCity: row.farmer?.city ?? row.city,
      verified: row.farmer?.status === "approved" && Boolean(row.farmer?.verified_at),
      categoryId: row.category?.slug ?? "",
      categoryName: row.category?.name ?? row.species,
      title: row.title,
      species: row.species,
      breed: row.breed,
      description: row.description ?? "",
      ageMonths: row.age_months,
      weightKg: row.approximate_weight_kg,
      quantity: row.quantity_available,
      unit: row.unit || "tête",
      unitPrice: row.unit_price_xof,
      wholesalePrice: row.wholesale_price_xof,
      minimumQuantity: row.minimum_order_quantity || 1,
      city: row.city,
      availableFrom: row.available_from,
      photos,
    };
  }

  async function loadProducts() {
    if (demoMode) {
      return demoProducts;
    }
    try {
      if (!window.supabase?.createClient) {
        await loadSupabaseSdk();
      }
      if (!window.supabase?.createClient) {
        throw new Error("Le SDK Supabase ne s’est pas chargé. Vérifiez la connexion puis rechargez.");
      }

      state.client = window.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await state.client
        .from("listings")
        .select(
          "id,farmer_id,category_id,title,species,breed,description,age_months,approximate_weight_kg,quantity_available,unit,unit_price_xof,wholesale_price_xof,minimum_order_quantity,city,available_from,farmer:farmer_profiles!inner(id,farm_name,whatsapp_phone,city,status,verified_at),category:categories!inner(id,name,slug,is_active),photos:listing_photos(storage_path,display_order)",
        )
        .eq("status", "published")
        .eq("farmer.status", "approved")
        .eq("category.is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      const products = await Promise.all(
        (data ?? []).map((row) => normalizeListing(row, state.client)),
      );
      saveCatalogCache(products);
      return products;
    } catch (error) {
      if (
        navigator.onLine !== false &&
        !(error instanceof TypeError) &&
        !/fetch|network|sdk supabase/i.test(String(error?.message ?? ""))
      ) {
        throw error;
      }
      const cached = readCatalogCache();
      if (!cached) {
        throw error;
      }
      state.offlineCatalog = true;
      state.catalogCachedAt = cached.savedAt;
      state.catalogLoadError = String(error?.message ?? "connexion indisponible");
      state.client = null;
      return cached.products;
    }
  }

  function loadSupabaseSdk() {
    if (window.supabase?.createClient) {
      return Promise.resolve();
    }
    if (supabaseSdkPromise) {
      return supabaseSdkPromise;
    }
    supabaseSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const finish = (error) => {
        window.clearTimeout(timeout);
        if (error) {
          script.remove();
          supabaseSdkPromise = null;
          reject(error);
          return;
        }
        resolve();
      };
      const timeout = window.setTimeout(
        () => finish(new Error("Le chargement du SDK Supabase a dépassé 8 secondes.")),
        8000,
      );
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () =>
        finish(
          window.supabase?.createClient
            ? null
            : new Error("Le SDK Supabase ne contient pas le client attendu."),
        );
      script.onerror = () => finish(new Error("Le SDK Supabase ne s’est pas chargé. Vérifiez la connexion."));
      document.head.append(script);
    });
    return supabaseSdkPromise;
  }

  async function loadReviews() {
    if (demoMode) {
      return demoReviews;
    }
    const { data, error } = await state.client
      .from("reviews")
      .select("reviewer_name,rating,body")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      throw error;
    }
    return (data ?? []).map((review) => ({
      name: review.reviewer_name || "Client",
      rating: review.rating,
      body: review.body || "",
    }));
  }

  async function loadPublicSettings() {
    if (demoMode || !state.client) {
      return;
    }
    const { data, error } = await state.client
      .from("site_settings")
      .select("key,value")
      .in("key", ["site_content", "public_whatsapp", "contact", "social_links", "supported_languages"]);
    if (error) {
      throw error;
    }
    state.publicSettings = Object.fromEntries((data ?? []).map((setting) => [setting.key, setting.value]));
    window.FasoMarketShell?.applyPublicSettings(state.publicSettings);
  }

  function iconFor(product) {
    return animalIcons[product.categoryId] ?? "🐓";
  }

  function productImage(product, className = "") {
    const photo = product.photos?.[0];
    if (photo) {
      if (document.body.classList.contains("is-light-mode")) {
        return `<div class="product-image product-image--placeholder ${className}" role="img" aria-label="${escapeHtml(`Photo masquée en mode léger pour ${product.title}`)}">
          <span aria-hidden="true">${iconFor(product)}</span>
          <span class="image-note">Photo masquée · mode léger</span>
        </div>`;
      }
      return `<div class="product-image ${className}">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(`Photo de ${product.title}`)}" loading="${className.includes("product-detail-image") ? "eager" : "lazy"}" fetchpriority="${className.includes("product-detail-image") ? "high" : "low"}" decoding="async">
        <span class="image-note">Photo publiée par le fermier</span>
      </div>`;
    }
    return `<div class="product-image product-image--placeholder ${className}" role="img" aria-label="${escapeHtml(`Illustration de démonstration pour ${product.title}`)}">
      <span aria-hidden="true">${iconFor(product)}</span>
      <span class="image-note">Illustration · photo à confirmer</span>
    </div>`;
  }

  function availability(product) {
    if (Number(product.quantity) <= 0) {
      return "Indisponible";
    }
    return `${product.quantity} ${product.unit}${product.quantity > 1 ? "s" : ""} disponibles`;
  }

  function distanceToCity(city, origin) {
    const destination = cityCoordinates[city];
    if (!destination) {
      return null;
    }
    const radians = (degrees) => (degrees * Math.PI) / 180;
    const [latitude, longitude] = origin;
    const [targetLatitude, targetLongitude] = destination;
    const latitudeDelta = radians(targetLatitude - latitude);
    const longitudeDelta = radians(targetLongitude - longitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(radians(latitude)) *
        Math.cos(radians(targetLatitude)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
  }

  function verificationBadge(product) {
    return product.verified
      ? '<span class="badge">✓ Fermier vérifié</span>'
      : '<span class="badge badge--gold">Profil à vérifier</span>';
  }

  function productCard(product) {
    const base = document.body.dataset.siteBase ?? "";
    const detailUrl = `${base}pages/produit.html?id=${encodeURIComponent(product.id)}`;
    const farmerUrl = `${base}pages/fermier.html?id=${encodeURIComponent(product.farmerId)}`;
    return `<article class="surface product-card">
      <a class="product-image-link" href="${detailUrl}" aria-label="${escapeHtml(`Voir ${product.title}`)}">
        ${productImage(product)}
      </a>
      <div class="product-info">
        ${verificationBadge(product)}
        <p class="eyebrow" style="margin-top:.65rem">${escapeHtml(product.categoryName)} · ${escapeHtml(product.breed || product.species)}</p>
        <h3><a href="${detailUrl}">${escapeHtml(product.title)}</a></h3>
        <div class="product-facts">
          <span>📍 ${escapeHtml(product.city)}</span>
          ${product.distanceKm === null || product.distanceKm === undefined ? "" : `<span>≈ ${escapeHtml(product.distanceKm)} km de votre position</span>`}
          <span>${escapeHtml(availability(product))}</span>
          ${product.ageMonths === null || product.ageMonths === undefined ? "" : `<span>${escapeHtml(product.ageMonths)} mois</span>`}
          ${product.weightKg === null || product.weightKg === undefined ? "" : `<span>≈ ${escapeHtml(product.weightKg)} kg</span>`}
        </div>
        <p class="product-price">${money(product.unitPrice)} <span class="muted text-small">/ ${escapeHtml(product.unit)}</span></p>
        <p class="text-small">Élevage : <a href="${farmerUrl}">${escapeHtml(product.farmerName)}</a></p>
        <div class="product-actions">
          <a class="button button--outline button--full" href="${detailUrl}">Voir l’offre</a>
          <button class="button button--full" type="button" data-add-product="${escapeHtml(product.id)}" ${product.quantity <= 0 || state.offlineCatalog ? "disabled" : ""}>${state.offlineCatalog ? "Vérification en ligne requise" : product.quantity <= 0 ? "Indisponible" : "Ajouter au panier"}</button>
        </div>
      </div>
    </article>`;
  }

  function renderHome() {
    const categoriesTarget = document.querySelector("#home-categories");
    if (categoriesTarget) {
      const categories = [
        ["volailles", "🐓", "Volailles"],
        ["bovins", "🐄", "Bovins"],
        ["ovins", "🐏", "Ovins"],
        ["caprins", "🐐", "Caprins"],
      ];
      categoriesTarget.innerHTML = categories
        .map(
          ([slug, icon, name]) =>
            `<a class="category-tile" href="pages/catalogue.html?categorie=${slug}">
              <span class="category-icon" aria-hidden="true">${icon}</span>
              <strong>${name}</strong>
              <span class="muted text-small">Découvrir les offres →</span>
            </a>`,
        )
        .join("");
    }
    const featured = document.querySelector("#featured-products");
    if (featured) {
      featured.innerHTML = state.products.slice(0, 3).map(productCard).join("");
    }
    const reviews = document.querySelector("#home-reviews");
    if (reviews) {
      if (!state.reviews.length) {
        reviews.innerHTML = '<p class="empty-state">Les avis publiés apparaîtront ici.</p>';
        return;
      }
      reviews.innerHTML = state.reviews
        .map(
          (review) => `<article class="surface review-card">
            <div class="review-stars" aria-label="${escapeHtml(review.rating)} étoiles sur 5">${"★".repeat(Math.max(0, Math.min(5, Number(review.rating))))}</div>
            <blockquote>« ${escapeHtml(review.body)} »</blockquote>
            <cite>${escapeHtml(review.name)}${demoMode ? " · Démo" : ""}</cite>
          </article>`,
        )
        .join("");
    }
  }

  function renderCatalogue() {
    const form = document.querySelector("#catalogue-filters");
    const search = document.querySelector("#catalogue-search");
    const productsTarget = document.querySelector("#catalogue-products");
    const count = document.querySelector("#catalogue-count");
    const alertPanel = document.querySelector("#stock-alert-panel");
    const alertForm = document.querySelector("#stock-alert-form");
    const alertStatus = document.querySelector("#stock-alert-status");
    const nearbyButton = document.querySelector("#nearby-toggle");
    const nearbyStatus = document.querySelector("#nearby-status");
    if (!form || !productsTarget) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const categorySelect = form.elements.namedItem("category");
    if (params.has("categorie")) {
      categorySelect.value = params.get("categorie");
    }

    function update() {
      const formData = new FormData(form);
      const query = String(search.value || "").trim().toLocaleLowerCase("fr");
      const category = String(formData.get("category") || "");
      const city = String(formData.get("city") || "");
      const minValue = String(formData.get("minPrice") || "").trim();
      const maxValue = String(formData.get("maxPrice") || "").trim();
      const minPrice = minValue ? Number(minValue) : 0;
      const maxPrice = maxValue ? Number(maxValue) : Number.MAX_SAFE_INTEGER;
      const availableOnly = formData.has("available");
      const sort = String(formData.get("sort") || "recent");

      let products = state.products.filter((product) => {
        const searchable =
          `${product.title} ${product.species} ${product.breed ?? ""} ${product.city} ${product.farmerName}`.toLocaleLowerCase("fr");
        return (
          (!query || searchable.includes(query)) &&
          (!category || product.categoryId === category) &&
          (!city || product.city === city) &&
          product.unitPrice >= minPrice &&
          product.unitPrice <= maxPrice &&
          (!availableOnly || product.quantity > 0)
        );
      });
      if (sort === "price-asc") {
        products.sort((a, b) => a.unitPrice - b.unitPrice);
      } else if (sort === "price-desc") {
        products.sort((a, b) => b.unitPrice - a.unitPrice);
      } else if (sort === "name") {
        products.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      }
      if (state.nearbyCoordinates) {
        products = products
          .map((product) => ({
            ...product,
            distanceKm: distanceToCity(product.city, state.nearbyCoordinates),
          }))
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      }

      count.textContent = `${products.length} offre${products.length > 1 ? "s" : ""}`;
      productsTarget.innerHTML = products.length
        ? products.map(productCard).join("")
        : '<p class="empty-state">Aucune offre ne correspond à ces filtres. Essayez une autre ville ou réinitialisez la recherche.</p>';
      if (alertPanel) {
        alertPanel.hidden = products.length > 0;
      }
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    search.addEventListener("input", update);
    form.addEventListener("reset", () => {
      search.value = "";
      window.setTimeout(update, 0);
    });
    nearbyButton?.addEventListener("click", () => {
      if (state.nearbyCoordinates) {
        state.nearbyCoordinates = null;
        nearbyButton.textContent = "Trouver près de moi";
        nearbyStatus.hidden = true;
        update();
        return;
      }
      if (!navigator.geolocation) {
        nearbyStatus.textContent = "La géolocalisation n’est pas disponible sur cet appareil.";
        nearbyStatus.hidden = false;
        return;
      }
      nearbyButton.disabled = true;
      nearbyStatus.textContent = "Recherche de votre position…";
      nearbyStatus.hidden = false;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          state.nearbyCoordinates = [coords.latitude, coords.longitude];
          nearbyButton.disabled = false;
          nearbyButton.textContent = "Désactiver le tri de proximité";
          nearbyStatus.textContent = "Distances approximatives calculées à partir de la ville de l’élevage. Votre position n’est pas enregistrée ni transmise.";
          update();
        },
        (error) => {
          nearbyButton.disabled = false;
          nearbyStatus.textContent =
            error.code === error.PERMISSION_DENIED
              ? "Autorisez la position dans votre navigateur pour trier les offres par proximité."
              : "Votre position n’a pas pu être obtenue. Réessayez lorsque la connexion est disponible.";
        },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
      );
    });
    alertForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const number = normalizeWhatsAppNumber(
        state.publicSettings.public_whatsapp?.number ?? config.demoWhatsAppNumber,
      );
      if (!number) {
        alertStatus.textContent = "Le numéro WhatsApp d’assistance n’est pas encore configuré. Aucune donnée n’a été envoyée.";
        alertStatus.hidden = false;
        return;
      }
      const formData = new FormData(form);
      const buyerPhone = String(new FormData(alertForm).get("phone") ?? "").trim();
      if (buyerPhone && !normalizeWhatsAppNumber(buyerPhone)) {
        alertStatus.textContent = "Vérifiez le numéro de téléphone ou laissez ce champ vide.";
        alertStatus.hidden = false;
        return;
      }
      const cityValue = String(formData.get("city") ?? "");
      const categoryValue = String(formData.get("category") ?? "");
      const message = [
        "Bonjour, je souhaite demander une alerte manuelle si un stock correspondant à cette recherche devient disponible.",
        `Recherche : ${search.value.trim() || "toutes les offres"}`,
        `Espèce : ${categoryValue || "toutes"}`,
        `Ville : ${cityValue || "toutes"}`,
        buyerPhone ? `Mon WhatsApp : ${normalizeWhatsAppNumber(buyerPhone)}` : "",
        "Je comprends que cette demande est transmise par WhatsApp et qu’aucune alerte automatique n’est encore active.",
      ]
        .filter(Boolean)
        .join("\n");
      const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
      const whatsappWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      if (!whatsappWindow) {
        alertStatus.replaceChildren();
        const link = document.createElement("a");
        link.href = whatsappUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ouvrir WhatsApp pour envoyer la demande";
        alertStatus.append(link);
      } else {
        alertStatus.textContent = "WhatsApp s’est ouvert. Vérifiez le message et envoyez-le pour transmettre votre demande.";
      }
      alertStatus.hidden = false;
    });
    update();
  }

  function renderProductPage() {
    const target = document.querySelector("#product-detail");
    if (!target) {
      return;
    }
    const id = new URLSearchParams(window.location.search).get("id");
    const product = state.products.find((item) => item.id === id);
    if (!product) {
      target.innerHTML = `<div class="empty-state">
        <h1>Cette offre n’est pas disponible</h1>
        <p>Elle a peut-être été retirée, épuisée ou son lien est incomplet.</p>
        <a class="button" href="catalogue.html">Retour au catalogue</a>
      </div>`;
      return;
    }
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(product.id)}`;

    document.title = `${product.title} — Faso Élevage`;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = `${product.title} à ${product.city}. Contactez le fermier pour confirmer le stock, le prix et les modalités.`.slice(0, 160);
    }

    const lightModeEnabled = document.body.classList.contains("is-light-mode");
    const gallery = product.photos.length && !lightModeEnabled
      ? `<div class="product-gallery">
          <div class="product-image" id="main-product-image">
            <img src="${escapeHtml(product.photos[0])}" alt="${escapeHtml(`Photo de ${product.title}`)}" fetchpriority="high" decoding="async">
            <span class="image-note">Photo publiée par le fermier</span>
          </div>
          ${product.photos.length > 1
            ? `<div class="product-thumbnails" aria-label="Galerie photos">${product.photos.map((photo, index) => `<button type="button" data-photo-index="${index}" aria-label="${escapeHtml(`Afficher la photo ${index + 1}`)}"><img src="${escapeHtml(photo)}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>`
            : ""}
        </div>`
      : `<div class="product-gallery">${productImage(product, "product-detail-image")}</div>`;

    target.innerHTML = `${gallery}
      <section class="surface product-detail-card" aria-labelledby="product-title">
        <div>${verificationBadge(product)} ${demoMode ? '<span class="badge badge--red">Annonce fictive</span>' : ""}</div>
        <p class="eyebrow" style="margin-top: .8rem">${escapeHtml(product.categoryName)} · ${escapeHtml(product.species)}</p>
        <h1 id="product-title">${escapeHtml(product.title)}</h1>
        <p class="muted">📍 ${escapeHtml(product.city)} · ${product.availableFrom ? `Disponible à partir du ${escapeHtml(product.availableFrom)}` : "Date à confirmer avec le fermier"}</p>
        <p class="product-price" style="font-size:1.55rem">${money(product.unitPrice)} <span class="muted text-small">/ ${escapeHtml(product.unit)}</span></p>
        ${product.wholesalePrice ? `<p class="text-small">Prix de gros indicatif : <strong>${money(product.wholesalePrice)}</strong></p>` : ""}
        <dl class="detail-list">
          <div><dt>Race</dt><dd>${escapeHtml(product.breed || "Non précisée")}</dd></div>
          <div><dt>Âge estimé</dt><dd>${product.ageMonths === null || product.ageMonths === undefined ? "Non précisé" : `${escapeHtml(product.ageMonths)} mois`}</dd></div>
          <div><dt>Poids approximatif</dt><dd>${product.weightKg === null || product.weightKg === undefined ? "Non précisé" : `≈ ${escapeHtml(product.weightKg)} kg`}</dd></div>
          <div><dt>Stock indiqué</dt><dd>${escapeHtml(availability(product))}</dd></div>
          <div><dt>Commande minimale</dt><dd>${escapeHtml(product.minimumQuantity)} ${escapeHtml(product.unit)}</dd></div>
          <div><dt>Localisation</dt><dd>${escapeHtml(product.city)}</dd></div>
        </dl>
        <h2>Description</h2>
        <p>${escapeHtml(product.description || "Contactez le fermier pour en savoir plus.")}</p>
        <div class="farmer-card">
          <span class="farmer-avatar" aria-hidden="true">${escapeHtml(product.farmerName.slice(0, 2).toLocaleUpperCase("fr"))}</span>
          <p><strong><a href="fermier.html?id=${encodeURIComponent(product.farmerId)}">${escapeHtml(product.farmerName)}</a></strong><br>
            <span class="muted">${product.verified ? "✓ Fermier vérifié" : "Vérification en attente ou profil de démonstration"}</span><br>
            <span class="muted">📍 ${escapeHtml(product.farmerCity)}</span>
          </p>
        </div>
        <label class="field" for="product-quantity">
          <span>Quantité souhaitée (${escapeHtml(product.unit)})</span>
          <input id="product-quantity" type="number" min="${escapeHtml(product.minimumQuantity)}" max="${escapeHtml(product.quantity)}" value="${escapeHtml(product.minimumQuantity)}" step="1" ${product.quantity <= 0 ? "disabled" : ""}>
        </label>
        <p id="product-order-notice" class="notice" role="status" aria-live="polite" hidden></p>
          <button class="button button--full" type="button" data-add-product="${escapeHtml(product.id)}" style="margin-top:1rem" ${product.quantity <= 0 || state.offlineCatalog ? "disabled" : ""}>${state.offlineCatalog ? "Vérification en ligne requise" : product.quantity <= 0 ? "Stock indisponible" : "Commander sur WhatsApp"}</button>
        <p class="muted text-small" style="margin: .7rem 0 0; text-align:center">L’ajout prépare votre panier ; le message WhatsApp n’est envoyé qu’après votre validation.</p>
      </section>`;

    target.querySelectorAll("[data-photo-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const photo = product.photos[Number(button.dataset.photoIndex)];
        const image = target.querySelector("#main-product-image img");
        if (image && photo) {
          image.src = photo;
          image.alt = `Photo ${Number(button.dataset.photoIndex) + 1} de ${product.title}`;
        }
      });
    });

    if (!demoMode && state.client && state.renderedProductViewId !== product.id) {
      state.renderedProductViewId = product.id;
      recordListingEvent(product.id, "view").catch((error) =>
        showNotice(
          `La consultation de l’offre n’a pas pu être comptabilisée : ${error.message || "erreur réseau"}.`,
          "error",
        ),
      );
    }
  }

  function renderCart() {
    const count = state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(count);
    });
    const itemsTarget = document.querySelector("#cart-items");
    const empty = document.querySelector("#cart-empty");
    const checkout = document.querySelector("#cart-checkout");
    const farmerLine = document.querySelector("#cart-farmer");
    if (!itemsTarget || !empty || !checkout) {
      return;
    }

    state.cart.items = state.cart.items.filter((item) =>
      state.products.some((product) => product.id === item.id),
    );
    if (!state.cart.items.length) {
      state.cart.farmerId = null;
    }
    const items = state.cart.items
      .map((item) => ({
        ...item,
        product: state.products.find((product) => product.id === item.id),
      }))
      .filter((item) => item.product);

    empty.hidden = items.length > 0;
    checkout.hidden = items.length === 0;
    farmerLine.textContent = items.length
      ? `Même fermier : ${items[0].product.farmerName} · ${items[0].product.city}`
      : "";
    itemsTarget.innerHTML = items
      .map(
        ({ product, quantity }) => `<article class="cart-item">
          <div>
            <h3>${escapeHtml(product.title)}</h3>
            <p>${money(product.unitPrice)} / ${escapeHtml(product.unit)} · ${escapeHtml(availability(product))}</p>
          </div>
          <div class="cart-item-actions">
            <label class="sr-only" for="cart-quantity-${escapeHtml(product.id)}">Quantité de ${escapeHtml(product.title)}</label>
            <input id="cart-quantity-${escapeHtml(product.id)}" class="cart-quantity" type="number" min="${escapeHtml(product.minimumQuantity)}" max="${escapeHtml(product.quantity)}" step="1" value="${escapeHtml(quantity)}" data-cart-quantity="${escapeHtml(product.id)}">
            <button class="remove-item" type="button" data-remove-product="${escapeHtml(product.id)}" aria-label="${escapeHtml(`Retirer ${product.title} du panier`)}">Retirer</button>
          </div>
        </article>`,
      )
      .join("");
    const total = items.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);
    document.querySelector("#cart-total-value").textContent = money(total);

    if (demoMode && items.length) {
      showNotice(
        "Mode démonstration : offres fictives, fermier non vérifié et numéro WhatsApp non configuré. Aucune commande réelle ne peut être envoyée.",
        "info",
        "#cart-notice",
      );
    } else {
      clearNotice("#cart-notice");
    }
    saveCart();
  }

  function addProduct(productId) {
    if (state.offlineCatalog) {
      showNotice(
        "Le stock affiché vient d’une copie hors connexion et peut être périmé. Reconnectez-vous pour vérifier l’offre avant de commander.",
        "error",
        "#cart-notice",
      );
      return;
    }
    const product = state.products.find((item) => item.id === productId);
    if (!product || product.quantity <= 0) {
      showNotice("Cette offre n’est plus disponible.", "error", "#cart-notice");
      return;
    }
    const quantityInput = document.querySelector("#product-quantity");
    const requested = quantityInput ? Number(quantityInput.value) : product.minimumQuantity;
    if (
      !Number.isInteger(requested) ||
      requested < product.minimumQuantity ||
      requested > product.quantity
    ) {
      showNotice(
        `Choisissez une quantité entière entre ${product.minimumQuantity} et ${product.quantity}.`,
        "error",
        "#product-order-notice",
      );
      return;
    }
    if (
      state.cart.items.length &&
      state.cart.farmerId &&
      state.cart.farmerId !== product.farmerId
    ) {
      showNotice(
        "Le panier regroupe un seul fermier. Finalisez ou videz le panier avant de choisir une offre d’un autre fermier.",
        "error",
        "#cart-notice",
      );
      document.querySelector("#cart-dialog").showModal();
      return;
    }

    const item = state.cart.items.find((entry) => entry.id === product.id);
    const nextQuantity = (item?.quantity ?? 0) + requested;
    if (nextQuantity > product.quantity) {
      showNotice(
        `Le stock affiché est de ${product.quantity} ${product.unit} au maximum.`,
        "error",
        "#product-order-notice",
      );
      return;
    }
    state.cart.farmerId = product.farmerId;
    if (item) {
      item.quantity = nextQuantity;
    } else {
      state.cart.items.push({ id: product.id, quantity: requested });
    }
    clearNotice("#product-order-notice");
    renderCart();
    document.querySelector("#cart-dialog").showModal();
  }

  function normalizeWhatsAppNumber(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (/^226\d{8}$/.test(digits)) {
      return digits;
    }
    if (/^\d{8}$/.test(digits)) {
      return `226${digits}`;
    }
    if (/^0\d{8}$/.test(digits)) {
      return `226${digits.slice(1)}`;
    }
    return "";
  }

  function buildWhatsAppMessage(items, buyer) {
    const lines = items.map(({ product, quantity }) => {
      const total = product.unitPrice * quantity;
      return `- ${product.title} — ${formatQuantity(quantity, product.unit)} × ${money(product.unitPrice)} = ${money(total)}`;
    });
    const total = items.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);
    return [
      "Bonjour, je souhaite vérifier la disponibilité et commander :",
      ...lines,
      `Total indicatif : ${money(total)}`,
      "",
      `Nom : ${buyer.name}`,
      `Téléphone : ${buyer.phone}`,
      `Ville : ${buyer.city}`,
      "",
      "Merci de confirmer le stock, le prix final et les modalités de retrait/livraison.",
    ].join("\n");
  }

  function checkout(event) {
    event.preventDefault();
    clearNotice("#cart-notice");
    if (state.offlineCatalog || !navigator.onLine) {
      showNotice("Reconnectez-vous pour vérifier le stock et préparer une demande WhatsApp.", "error", "#cart-notice");
      return;
    }
    const form = event.currentTarget;
    if (!form.reportValidity()) {
      return;
    }
    const items = state.cart.items
      .map((item) => ({
        ...item,
        product: state.products.find((product) => product.id === item.id),
      }))
      .filter((item) => item.product);
    if (!items.length) {
      showNotice("Ajoutez au moins une offre avant de continuer.", "error", "#cart-notice");
      return;
    }

    const seller = items[0].product;
    if (items.some((item) => item.product.farmerId !== seller.farmerId)) {
      showNotice("Pour protéger les acheteurs, un message ne peut concerner qu’un seul fermier.", "error", "#cart-notice");
      return;
    }
    const phone = normalizeWhatsAppNumber(
      demoMode ? config.demoWhatsAppNumber : seller.farmerPhone,
    );
    if (!phone) {
      showNotice(
        demoMode
          ? "Démonstration seulement : renseignez un numéro WhatsApp de test dans site/js/supabase-config.js. Aucun faux numéro n’est utilisé."
          : "Le fermier n’a pas de numéro WhatsApp valide. Contactez l’assistance du site.",
        "error",
        "#cart-notice",
      );
      return;
    }

    const data = new FormData(form);
    const message = buildWhatsAppMessage(items, {
      name: String(data.get("name")).trim(),
      phone: String(data.get("phone")).trim(),
      city: String(data.get("city")).trim(),
    });
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    const whatsappWindow = window.open(url, "_blank");
    if (whatsappWindow) {
      whatsappWindow.opener = null;
    }
    if (!demoMode && state.client?.rpc) {
      Promise.all(items.map(({ product }) => recordListingEvent(product.id, "contact"))).catch((error) =>
        showNotice(
          `La demande WhatsApp est ouverte, mais le clic n’a pas pu être comptabilisé : ${error.message || "erreur réseau"}.`,
          "error",
          "#cart-notice",
        ),
      );
    }
    if (!whatsappWindow) {
      showNotice(
        "Le navigateur a bloqué l’ouverture de WhatsApp. Autorisez les fenêtres contextuelles puis réessayez.",
        "error",
        "#cart-notice",
      );
      return;
    }
    showNotice(
      "WhatsApp s’est ouvert avec votre demande préremplie. La commande ne sera effective qu’après accord direct avec le fermier.",
      "success",
      "#cart-notice",
    );
  }

  function wireCart() {
    const dialog = document.querySelector("#cart-dialog");
    document.querySelectorAll("[data-open-cart]").forEach((button) => {
      button.addEventListener("click", () => dialog.showModal());
    });
    dialog.querySelector("[data-close-cart]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    document.querySelector("#checkout-form").addEventListener("submit", checkout);
    document.body.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add-product]");
      if (addButton) {
        addProduct(addButton.dataset.addProduct);
      }
      const removeButton = event.target.closest("[data-remove-product]");
      if (removeButton) {
        state.cart.items = state.cart.items.filter(
          (item) => item.id !== removeButton.dataset.removeProduct,
        );
        renderCart();
      }
    });
    dialog.addEventListener("change", (event) => {
      const input = event.target.closest("[data-cart-quantity]");
      if (!input) {
        return;
      }
      const product = state.products.find((item) => item.id === input.dataset.cartQuantity);
      const quantity = Number(input.value);
      if (
        !product ||
        !Number.isInteger(quantity) ||
        quantity < product.minimumQuantity ||
        quantity > product.quantity
      ) {
        showNotice("Quantité incorrecte ou supérieure au stock affiché.", "error", "#cart-notice");
        renderCart();
        return;
      }
      const item = state.cart.items.find((entry) => entry.id === product.id);
      if (item) {
        item.quantity = quantity;
        renderCart();
      }
    });
  }

  async function initialize() {
    loadCart();
    wireCart();
    if (demoMode) {
      showNotice(
        "Mode démonstration : les annonces et avis visibles sont fictifs. Aucun fermier n’est vérifié et aucun numéro WhatsApp n’est configuré.",
        "info",
      );
    }
    try {
      state.products = await loadProducts();
      if (!state.offlineCatalog) {
        try {
          await loadPublicSettings();
        } catch (error) {
          showNotice(
            `Les offres sont disponibles, mais les paramètres publics ne peuvent pas être chargés : ${error.message || "erreur réseau"}.`,
            "error",
          );
        }
        try {
          state.reviews = await loadReviews();
        } catch (error) {
          state.reviews = [];
          showNotice(
            `Les offres sont disponibles, mais les avis ne peuvent pas être chargés : ${error.message || "erreur réseau"}.`,
            "error",
          );
        }
      }
      renderCart();
      renderHome();
      renderCatalogue();
      renderProductPage();
      if (state.offlineCatalog) {
        const cachedDate = new Intl.DateTimeFormat("fr-BF", { dateStyle: "medium" }).format(
          new Date(state.catalogCachedAt),
        );
        showNotice(
          `Catalogue de secours : ${state.products.length} offre(s) mémorisée(s) le ${cachedDate}. La connexion au catalogue a échoué (${state.catalogLoadError}). Les stocks et prix peuvent être périmés ; les commandes sont désactivées.`,
          "info",
        );
      }
    } catch (error) {
      const message = `Les offres n’ont pas pu être chargées : ${error.message || "erreur réseau"}. Réessayez plus tard.`;
      showNotice(message, "error");
      for (const target of [
        "#featured-products",
        "#catalogue-products",
        "#home-reviews",
        "#product-detail",
      ]) {
        const node = document.querySelector(target);
        if (node) {
          node.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
        }
      }
    }
  }

  function getVisitorKey() {
    let visitorKey = window.localStorage.getItem("fasoMarketVisitor.v1");
    if (!visitorKey) {
      visitorKey = window.crypto.randomUUID();
      window.localStorage.setItem("fasoMarketVisitor.v1", visitorKey);
    }
    return visitorKey;
  }

  async function recordListingEvent(listingId, eventType) {
    if (demoMode || state.offlineCatalog || !state.client) {
      return;
    }
    const { error } = await state.client.rpc("record_listing_event", {
      target_listing_id: listingId,
      target_event_type: eventType,
      target_visitor_key: getVisitorKey(),
    });
    if (error) {
      throw error;
    }
  }

  async function recordFarmerContact(farmerId) {
    if (demoMode || state.offlineCatalog || !state.client) {
      return;
    }
    const { error } = await state.client.rpc("record_farmer_contact_event", {
      target_farmer_id: farmerId,
      target_visitor_key: getVisitorKey(),
    });
    if (error) {
      throw error;
    }
  }

  window.FasoMarket = Object.freeze({
    money,
    demoMode,
    ready,
    products: () => [...state.products],
    isOfflineCatalog: () => state.offlineCatalog,
    buildWhatsAppMessage,
    recordListingEvent,
    recordFarmerContact,
    openCart: () => document.querySelector("#cart-dialog").showModal(),
  });

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      initialize()
        .then(resolveReady)
        .catch((error) => {
          resolveReady();
          showNotice(`Le site client n’a pas pu démarrer : ${error.message || "erreur réseau"}.`, "error");
        });
    },
    { once: true },
  );

  document.addEventListener("fasomarket:display-mode-change", () => {
    renderHome();
    document.querySelector("#catalogue-filters")?.dispatchEvent(new Event("input", { bubbles: true }));
    renderProductPage();
  });
})();
