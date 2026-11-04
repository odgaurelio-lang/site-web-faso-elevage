(() => {
  const config = window.APP_CONFIG ?? {};
  const configured =
    typeof config.supabaseUrl === "string" &&
    config.supabaseUrl.trim() !== "" &&
    typeof config.supabasePublishableKey === "string" &&
    config.supabasePublishableKey.trim() !== "";
  const pageType = document.body.dataset.page;
  const iconByCategory = {
    volailles: "🐓",
    bovins: "🐄",
    ovins: "🐏",
    caprins: "🐐",
  };
  const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const allowedDocumentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const maximumFileBytes = 5 * 1024 * 1024;
  const maximumSourcePhotoBytes = 20 * 1024 * 1024;
  const maximumPhotoPixels = 40000000;
  const maximumPhotoDimension = 1600;
  const maximumPhotos = 5;
  let supabaseClient;
  let currentUser;
  let listingStats = new Map();
  let currentListings = [];
  let profileItems = [];

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

  function announce(message, kind = "info") {
    const target = document.querySelector("#platform-notice");
    if (!target) {
      return;
    }
    target.textContent = message;
    target.className = `notice platform-banner${kind === "error" ? " notice--error" : ""}${kind === "success" ? " notice--success" : ""}`;
    target.hidden = false;
  }

  function clearAnnouncement() {
    const target = document.querySelector("#platform-notice");
    if (target) {
      target.hidden = true;
      target.textContent = "";
      target.className = "notice platform-banner";
    }
  }

  async function optimizeListingPhoto(file) {
    if (typeof window.createImageBitmap !== "function") {
      if (file.size <= maximumFileBytes) {
        return { file, reduced: false, optimized: false };
      }
      throw new Error("L’optimisation d’image n’est pas disponible dans ce navigateur. Essayez un navigateur plus récent.");
    }
    const bitmap = await window.createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > maximumPhotoPixels) {
        throw new Error("La photo a une résolution trop élevée. Choisissez une image de moins de 40 mégapixels.");
      }
      const scale = Math.min(1, maximumPhotoDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        if (file.size <= maximumFileBytes) {
          return { file, reduced: false, optimized: false };
        }
        throw new Error("La photo ne peut pas être optimisée sur cet appareil.");
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const webp = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
      if (!webp) {
        if (file.size <= maximumFileBytes) {
          return { file, reduced: false, optimized: false };
        }
        throw new Error("La photo n’a pas pu être convertie. Essayez une autre image.");
      }
      const optimized =
        webp.type === "image/webp" && webp.size < file.size
          ? new File([webp], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
              type: "image/webp",
              lastModified: file.lastModified,
            })
          : file;
      if (optimized.size > maximumFileBytes) {
        throw new Error("La photo optimisée dépasse encore la limite de 5 Mo. Choisissez une image moins lourde.");
      }
      return {
        file: optimized,
        reduced: optimized !== file,
        optimized: webp.type === "image/webp",
      };
    } finally {
      bitmap.close();
    }
  }

  function localClientKey() {
    const keyName = "fasoMarketClient.v1";
    let value = window.localStorage.getItem(keyName);
    if (!value) {
      value = window.crypto.randomUUID();
      window.localStorage.setItem(keyName, value);
    }
    return value;
  }

  function formatMoney(value) {
    return `${new Intl.NumberFormat("fr-FR").format(Number(value) || 0)} FCFA`;
  }

  function statusLabel(status) {
    const labels = {
      draft: "Brouillon",
      pending_review: "En modération",
      published: "En ligne",
      paused: "En pause",
      rejected: "À corriger",
      archived: "Archivée",
      pending: "En attente de validation",
      approved: "Profil validé",
      suspended: "Profil suspendu",
    };
    return labels[status] ?? status;
  }

  function makeClient(persistSession = false) {
    if (!window.supabase?.createClient) {
      throw new Error("Le SDK Supabase n’a pas pu être chargé. Vérifiez la connexion puis rechargez.");
    }
    return window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          flowType: "pkce",
          persistSession,
          autoRefreshToken: persistSession,
          detectSessionInUrl: persistSession,
        },
      },
    );
  }

  async function loadPublicListings(client) {
    const { data, error } = await client
      .from("listings")
      .select(
        "id,farmer_id,category_id,title,species,breed,description,age_months,approximate_weight_kg,quantity_available,unit,unit_price_xof,wholesale_price_xof,minimum_order_quantity,city,available_from,status,farmer:farmer_profiles!inner(id,farm_name,whatsapp_phone,city,status,verified_at,bio),category:categories!inner(id,name,slug,is_active),photos:listing_photos(storage_path,display_order)",
      )
      .eq("status", "published")
      .eq("farmer.status", "approved")
      .eq("category.is_active", true)
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    return Promise.all((data ?? []).map((row) => normalizeListing(row, client)));
  }

  async function createSignedPhotoUrl(client, storagePath) {
    const { data, error } = await client.storage
      .from("listing-photos")
      .createSignedUrl(storagePath, 60 * 60);
    if (error) {
      throw error;
    }
    return data.signedUrl;
  }

  async function normalizeListing(row, client) {
    const photos = await Promise.all(
      (row.photos ?? [])
        .slice()
        .sort((left, right) => left.display_order - right.display_order)
        .map((photo) => createSignedPhotoUrl(client, photo.storage_path)),
    );
    const farmer = row.farmer ?? {};
    return {
      id: row.id,
      farmerId: row.farmer_id,
      farmerName: farmer.farm_name || "Éleveur local",
      farmerPhone: farmer.whatsapp_phone || "",
      farmerCity: farmer.city || row.city,
      farmerBio: farmer.bio || "",
      verified: farmer.status === "approved" && Boolean(farmer.verified_at),
      categoryId: row.category?.slug ?? "",
      categoryUuid: row.category_id,
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
      status: row.status,
      photos,
    };
  }

  function createReportDialog() {
    if (document.querySelector("#report-dialog")) {
      return;
    }
    document.body.insertAdjacentHTML(
      "beforeend",
      `<dialog id="report-dialog" class="report-dialog" aria-labelledby="report-dialog-title">
        <form id="report-form" method="post">
          <div class="section-heading">
            <div><p class="eyebrow">Aidez à protéger la marketplace</p><h2 id="report-dialog-title">Signaler une annonce</h2></div>
            <button type="button" class="icon-button" data-close-report aria-label="Fermer">✕</button>
          </div>
          <input type="hidden" name="listingId">
          <div id="report-notice" class="notice" role="status" aria-live="polite" hidden></div>
          <div class="field">
            <label for="report-reason">Motif du signalement</label>
            <select id="report-reason" name="reason" required>
              <option value="">Choisir un motif</option>
              <option value="Prix ou stock trompeur">Prix ou stock trompeur</option>
              <option value="Annonce suspecte ou frauduleuse">Annonce suspecte ou frauduleuse</option>
              <option value="Contenu inapproprié">Contenu inapproprié</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div class="field">
            <label for="report-details">Détails (facultatif)</label>
            <textarea id="report-details" name="details" maxlength="2000" rows="3"></textarea>
          </div>
          <p class="muted text-small">Le signalement est envoyé à la modération. N’incluez pas d’informations personnelles.</p>
          <button class="button button--red" type="submit">Envoyer le signalement</button>
        </form>
      </dialog>`,
    );
    const dialog = document.querySelector("#report-dialog");
    dialog.querySelector("[data-close-report]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.querySelector("#report-form").addEventListener("submit", submitReport);
  }

  async function submitReport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const notice = document.querySelector("#report-notice");
    notice.hidden = true;
    if (!configured || !supabaseClient) {
      notice.textContent = "Les signalements seront actifs quand la base Supabase sera configurée.";
      notice.className = "notice notice--error";
      notice.hidden = false;
      return;
    }
    try {
      const { error } = await supabaseClient.rpc("submit_listing_report", {
        target_listing_id: String(data.get("listingId")),
        submitted_reason: String(data.get("reason")),
        submitted_details: String(data.get("details") ?? ""),
        submitted_client_key: localClientKey(),
      });
      if (error) {
        throw error;
      }
      form.reset();
      notice.textContent = "Merci. Le signalement a été transmis à l’équipe de modération.";
      notice.className = "notice notice--success";
      notice.hidden = false;
    } catch (error) {
      notice.textContent = `Le signalement n’a pas pu être transmis : ${error.message || "erreur réseau"}.`;
      notice.className = "notice notice--error";
      notice.hidden = false;
    }
  }

  function openReport(listingId) {
    const dialog = document.querySelector("#report-dialog");
    if (!dialog) {
      return;
    }
    dialog.querySelector('[name="listingId"]').value = listingId;
    dialog.querySelector("#report-notice").hidden = true;
    dialog.showModal();
  }

  function renderMarketplace(products) {
    const form = document.querySelector("#marketplace-filters");
    const target = document.querySelector("#market-results");
    const count = document.querySelector("#market-results-count");
    if (!form || !target || !count) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    for (const [name, value] of params) {
      const control = form.elements.namedItem(name);
      if (!control) {
        continue;
      }
      if (control.type === "checkbox") {
        control.checked = value === "on" || value === "true";
      } else {
        control.value = value;
      }
    }

    function update() {
      const data = new FormData(form);
      const query = String(data.get("q") || "").trim().toLocaleLowerCase("fr");
      const category = String(data.get("category") || "");
      const city = String(data.get("city") || "");
      const saleType = String(data.get("saleType") || "");
      const verifiedOnly = data.has("verified");
      const sort = String(data.get("sort") || "recent");
      let results = products.filter((product) => {
        const searchable =
          `${product.title} ${product.species} ${product.breed ?? ""} ${product.city} ${product.farmerName}`.toLocaleLowerCase("fr");
        return (
          (!query || searchable.includes(query)) &&
          (!category || product.categoryId === category) &&
          (!city || product.city === city) &&
          (!verifiedOnly || product.verified) &&
          (saleType !== "wholesale" || product.wholesalePrice !== null) &&
          (saleType !== "retail" || product.quantity > 0)
        );
      });
      if (sort === "price-asc") {
        results.sort((left, right) => left.unitPrice - right.unitPrice);
      } else if (sort === "price-desc") {
        results.sort((left, right) => right.unitPrice - left.unitPrice);
      } else if (sort === "quantity") {
        results.sort((left, right) => right.quantity - left.quantity);
      }

      count.textContent = `${results.length} offre${results.length > 1 ? "s" : ""}`;
      if (!results.length) {
        target.innerHTML = '<p class="empty-state">Aucune offre ne correspond à ces critères.</p>';
        return;
      }
      target.innerHTML = results
        .map((product) => {
          const icon = iconByCategory[product.categoryId] ?? "🐓";
          const lightMode = document.body.classList.contains("is-light-mode");
          const image = product.photos[0] && !lightMode
            ? `<div class="product-image"><img src="${escapeHtml(product.photos[0])}" alt="${escapeHtml(`Photo de ${product.title}`)}" loading="lazy" fetchpriority="low" decoding="async"></div>`
            : `<div class="product-image product-image--placeholder" role="img" aria-label="${lightMode ? "Photo masquée en mode léger" : "Photo non fournie"}"><span aria-hidden="true">${icon}</span><span class="image-note">${lightMode ? "Photo masquée · mode léger" : "Photo à confirmer"}</span></div>`;
          return `<article class="surface product-card">
            ${image}
            <div class="product-info">
              <div>${product.verified ? '<span class="badge">✓ Fermier vérifié</span>' : '<span class="badge badge--gold">Profil à vérifier</span>'}</div>
              <p class="eyebrow" style="margin-top:.65rem">${escapeHtml(product.categoryName)} · ${escapeHtml(product.breed || product.species)}</p>
              <h3><a href="produit.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.title)}</a></h3>
              <div class="product-facts"><span>📍 ${escapeHtml(product.city)}</span><span>${product.quantity > 0 ? `${escapeHtml(product.quantity)} ${escapeHtml(product.unit)} disponibles` : "Indisponible"}</span><span>Minimum : ${escapeHtml(product.minimumQuantity)}</span></div>
              <p class="product-price">${formatMoney(product.unitPrice)} <span class="muted text-small">/ ${escapeHtml(product.unit)}</span></p>
              ${product.wholesalePrice ? `<p class="text-small">Gros indicatif : <strong>${formatMoney(product.wholesalePrice)}</strong></p>` : '<p class="muted text-small">Vente au détail · devis possible</p>'}
              <p class="text-small">Élevage : <a href="fermier.html?id=${encodeURIComponent(product.farmerId)}">${escapeHtml(product.farmerName)}</a></p>
              <div class="product-actions">
                <a class="button button--outline button--full" href="produit.html?id=${encodeURIComponent(product.id)}">Voir l’offre</a>
                <button class="button button--full" type="button" data-add-product="${escapeHtml(product.id)}" ${product.quantity <= 0 || window.FasoMarket?.isOfflineCatalog() ? "disabled" : ""}>${window.FasoMarket?.isOfflineCatalog() ? "Vérification en ligne requise" : product.wholesalePrice ? "Demander un devis" : "Ajouter au panier"}</button>
                <button class="report-trigger" type="button" data-report-listing="${escapeHtml(product.id)}">Signaler</button>
              </div>
            </div>
          </article>`;
        })
        .join("");
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", () => window.setTimeout(update, 0));
    update();
  }

  async function initializeMarketplace() {
    createReportDialog();
    document.body.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-report-listing]");
      if (trigger) {
        openReport(trigger.dataset.reportListing);
      }
    });
    try {
      if (configured) {
        if (window.FasoMarket) {
          await window.FasoMarket.ready;
        }
        if (window.FasoMarket?.isOfflineCatalog()) {
          renderMarketplace(window.FasoMarket.products());
          announce("Catalogue hors connexion : stocks potentiellement périmés. Reconnectez-vous avant de contacter un fermier.", "info");
          return;
        }
        supabaseClient = makeClient(false);
        const products = await loadPublicListings(supabaseClient);
        renderMarketplace(products);
      } else if (window.FasoMarket) {
        await window.FasoMarket.ready;
        const products = window.FasoMarket.products();
        renderMarketplace(products);
        announce("Mode démonstration : les offres sont fictives, aucune ferme n’est vérifiée et les demandes ne seront pas envoyées sans numéro configuré.");
      } else {
        throw new Error("Les offres ne sont pas disponibles.");
      }
    } catch (error) {
      announce(`La marketplace n’a pas pu charger les offres : ${error.message || "erreur réseau"}.`, "error");
      document.querySelector("#market-results").innerHTML =
        '<p class="empty-state">Réessayez plus tard ou revenez au catalogue.</p>';
    }
  }

  function setPhotoPreview(photos) {
    const target = document.querySelector("#listing-existing-photos");
    if (!target) {
      return;
    }
    target.innerHTML = photos
      .map(
        (photo) => `<div class="platform-photo">
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt || "Photo de l’annonce")}" loading="lazy">
          <button type="button" data-remove-photo="${escapeHtml(photo.id)}" aria-label="Retirer cette photo">×</button>
        </div>`,
      )
      .join("");
  }

  function resetListingForm() {
    const form = document.querySelector("#listing-form");
    if (!form) {
      return;
    }
    form.reset();
    form.elements.namedItem("listingId").value = "";
    form.elements.namedItem("minimumQuantity").value = "1";
    document.querySelector("#listing-form-title").textContent = "Ajouter une annonce";
    document.querySelector("#listing-cancel-edit").hidden = true;
    setPhotoPreview([]);
  }

  function editListing(listing) {
    const form = document.querySelector("#listing-form");
    form.elements.namedItem("listingId").value = listing.id;
    form.elements.namedItem("title").value = listing.title;
    form.elements.namedItem("categoryId").value = listing.category_id;
    form.elements.namedItem("species").value = listing.species;
    form.elements.namedItem("breed").value = listing.breed ?? "";
    form.elements.namedItem("city").value = listing.city;
    form.elements.namedItem("ageMonths").value = listing.age_months ?? "";
    form.elements.namedItem("weightKg").value = listing.approximate_weight_kg ?? "";
    form.elements.namedItem("quantity").value = listing.quantity_available;
    form.elements.namedItem("unit").value = listing.unit;
    form.elements.namedItem("unitPrice").value = listing.unit_price_xof;
    form.elements.namedItem("wholesalePrice").value = listing.wholesale_price_xof ?? "";
    form.elements.namedItem("minimumQuantity").value = listing.minimum_order_quantity;
    form.elements.namedItem("availableFrom").value = listing.available_from ?? "";
    form.elements.namedItem("description").value = listing.description ?? "";
    document.querySelector("#listing-form-title").textContent = "Modifier l’annonce";
    document.querySelector("#listing-cancel-edit").hidden = false;
    const photos = (listing.photos ?? [])
      .slice()
      .sort((left, right) => left.display_order - right.display_order)
      .map((photo) => ({
        id: photo.id,
        storagePath: photo.storage_path,
        url: photo.url,
        alt: listing.title,
      }));
    setPhotoPreview(photos);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderFarmerListings() {
    const target = document.querySelector("#farmer-listings");
    if (!target) {
      return;
    }
    if (!currentListings.length) {
      target.innerHTML = '<p class="empty-state">Vous n’avez pas encore d’annonce. Ajoutez un stock pour commencer.</p>';
      return;
    }
    target.innerHTML = currentListings
      .map((listing) => {
        const firstPhoto = (listing.photos ?? [])
          .slice()
          .sort((left, right) => left.display_order - right.display_order)[0];
        const photoUrl = firstPhoto?.url ?? "";
        const stat = listingStats.get(listing.id) ?? { views: 0, whatsapp_contacts: 0 };
        const image = photoUrl
          ? `<img src="${escapeHtml(photoUrl)}" alt="" loading="lazy">`
          : escapeHtml(iconByCategory[listing.category?.slug] ?? "🐓");
        const pauseAction = listing.status === "published" ? "paused" : "pending_review";
        const pauseLabel = listing.status === "published" ? "Mettre en pause" : "Renvoyer en modération";
        return `<article class="platform-listing">
          <div class="platform-listing-image">${image}</div>
          <div class="platform-listing-main">
            <h3>${escapeHtml(listing.title)}</h3>
            <p class="platform-listing-meta">${escapeHtml(listing.species)} · ${escapeHtml(listing.breed || "Race non précisée")} · ${escapeHtml(listing.city)}</p>
            <p class="platform-listing-meta">${formatMoney(listing.unit_price_xof)} / ${escapeHtml(listing.unit)} · ${escapeHtml(listing.quantity_available)} en stock · ${escapeHtml(statusLabel(listing.status))}</p>
            <p class="platform-listing-meta">${escapeHtml(stat.views)} vues · ${escapeHtml(stat.whatsapp_contacts)} clics WhatsApp</p>
            ${listing.status === "rejected" && listing.moderation_note ? `<p class="platform-listing-meta" style="color:var(--color-red-dark)">Motif : ${escapeHtml(listing.moderation_note)}</p>` : ""}
          </div>
          <div class="platform-listing-actions">
            <button class="button button--outline" type="button" data-edit-listing="${escapeHtml(listing.id)}">Modifier</button>
            ${["published", "paused"].includes(listing.status) ? `<button class="button button--outline" type="button" data-pause-listing="${escapeHtml(listing.id)}" data-next-status="${pauseAction}">${pauseLabel}</button>` : ""}
            ${["draft", "pending_review", "paused", "rejected"].includes(listing.status) ? `<button class="button button--outline" type="button" data-delete-listing="${escapeHtml(listing.id)}">Supprimer</button>` : ""}
            ${listing.status === "published" ? `<a class="button button--outline" href="produit.html?id=${encodeURIComponent(listing.id)}">Voir</a>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  async function loadFarmerListings() {
    const { data, error } = await supabaseClient
      .from("listings")
      .select(
        "id,farmer_id,category_id,title,species,breed,description,age_months,approximate_weight_kg,quantity_available,unit,unit_price_xof,wholesale_price_xof,minimum_order_quantity,city,available_from,status,moderation_note,category:categories(id,name,slug),photos:listing_photos(id,storage_path,display_order)",
      )
      .eq("farmer_id", currentUser.id)
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    currentListings = await Promise.all(
      (data ?? []).map(async (listing) => ({
        ...listing,
        photos: await Promise.all(
          (listing.photos ?? []).map(async (photo) => ({
            ...photo,
            url: await createSignedPhotoUrl(supabaseClient, photo.storage_path),
          })),
        ),
      })),
    );

    const [{ data: stats, error: statsError }, { data: profileContacts, error: contactsError }] =
      await Promise.all([
        supabaseClient.rpc("get_my_listing_stats"),
        supabaseClient.rpc("get_my_farmer_profile_contact_count"),
      ]);
    if (statsError) {
      throw statsError;
    }
    if (contactsError) {
      throw contactsError;
    }
    listingStats = new Map((stats ?? []).map((row) => [row.listing_id, row]));
    const totalViews = (stats ?? []).reduce((sum, row) => sum + Number(row.views || 0), 0);
    const totalContacts =
      (stats ?? []).reduce((sum, row) => sum + Number(row.whatsapp_contacts || 0), 0) +
      Number(profileContacts || 0);
    document.querySelector("#stat-listings").textContent = String(
      currentListings.filter((listing) => listing.status === "published").length,
    );
    document.querySelector("#stat-views").textContent = String(totalViews);
    document.querySelector("#stat-contacts").textContent = String(totalContacts);
    document.querySelector("#stat-pending").textContent = String(
      currentListings.filter((listing) => listing.status === "pending_review").length,
    );
    renderFarmerListings();
  }

  async function loadCategories() {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("id,name")
      .eq("is_active", true)
      .order("name");
    if (error) {
      throw error;
    }
    const select = document.querySelector("#listing-category");
    select.innerHTML = '<option value="">Choisir une espèce</option>';
    for (const category of data ?? []) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.append(option);
    }
  }

  async function loadNotifications(target = "#farmer-notifications") {
    const container = document.querySelector(target);
    if (!container) {
      return;
    }
    const { data, error } = await supabaseClient
      .from("farmer_notifications")
      .select("id,notification_type,subject,message,created_at,read_at")
      .eq("farmer_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      throw error;
    }
    if (!data?.length) {
      container.innerHTML = '<p class="muted text-small">Aucune notification pour le moment.</p>';
      return;
    }
    container.innerHTML = data
      .map(
        (notification) => `<article class="platform-notification">
          <strong>${escapeHtml(notification.subject)}</strong>
          <p>${escapeHtml(notification.message)}</p>
          <p>${new Date(notification.created_at).toLocaleString("fr-FR")}</p>
          ${notification.read_at ? "" : `<button class="button button--outline" type="button" data-read-notification="${escapeHtml(notification.id)}">Marquer comme lu</button>`}
        </article>`,
      )
      .join("");
  }

  async function uploadFarmerDocument(event) {
    event.preventDefault();
    const file = event.currentTarget.elements.namedItem("document").files[0];
    if (!file) {
      announce("Choisissez un justificatif avant de l’envoyer.", "error");
      return;
    }
    if (!allowedDocumentTypes.has(file.type) || file.size > maximumFileBytes) {
      announce("Format invalide. Choisissez un PDF, JPEG ou PNG de 5 Mo maximum.", "error");
      return;
    }
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const path = `${currentUser.id}/${window.crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabaseClient.storage
        .from("farmer-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        throw uploadError;
      }
      const { error: recordError } = await supabaseClient
        .from("farmer_documents")
        .insert({ farmer_id: currentUser.id, storage_path: path });
      if (recordError) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("farmer-documents")
          .remove([path]);
        if (cleanupError) {
          throw new Error(`${recordError.message}; nettoyage du fichier échoué : ${cleanupError.message}`);
        }
        throw recordError;
      }
      event.currentTarget.reset();
      announce("Justificatif transmis dans l’espace privé de validation.", "success");
    } catch (error) {
      announce(`Le justificatif n’a pas pu être transmis : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function saveListing(event) {
    event.preventDefault();
    clearAnnouncement();
    const form = event.currentTarget;
    if (!form.reportValidity()) {
      return;
    }
    const data = new FormData(form);
    const listingId = String(data.get("listingId") || "");
    const submitterAction = event.submitter?.value === "draft" ? "draft" : "review";
    let photos = [...form.elements.namedItem("photos").files];
    const existingPhotoCount =
      currentListings.find((listing) => listing.id === listingId)?.photos?.length ?? 0;
    if (existingPhotoCount + photos.length > maximumPhotos) {
      announce(`Une annonce peut contenir au maximum ${maximumPhotos} photos.`, "error");
      return;
    }
    for (const photo of photos) {
      if (!allowedPhotoTypes.has(photo.type) || photo.size > maximumSourcePhotoBytes) {
        announce("Chaque photo doit être au format JPEG, PNG ou WebP et faire 20 Mo maximum avant optimisation.", "error");
        return;
      }
    }

    const unitPrice = Number(data.get("unitPrice"));
    const wholesalePrice = String(data.get("wholesalePrice") || "").trim();
    const quantity = Number(data.get("quantity"));
    const minimumQuantity = Number(data.get("minimumQuantity"));
    if (wholesalePrice && Number(wholesalePrice) > unitPrice) {
      announce("Le prix de gros ne peut pas dépasser le prix unitaire indiqué.", "error");
      return;
    }
    if (quantity > 0 && minimumQuantity > quantity) {
      announce("La quantité minimale ne peut pas dépasser le stock disponible.", "error");
      return;
    }

    const listing = {
      farmer_id: currentUser.id,
      category_id: String(data.get("categoryId")),
      title: String(data.get("title")).trim(),
      species: String(data.get("species")).trim(),
      breed: String(data.get("breed") || "").trim() || null,
      description: String(data.get("description") || "").trim() || null,
      age_months: data.get("ageMonths") === "" ? null : Number(data.get("ageMonths")),
      approximate_weight_kg: data.get("weightKg") === "" ? null : Number(data.get("weightKg")),
      quantity_available: quantity,
      unit: String(data.get("unit") || "tête"),
      unit_price_xof: unitPrice,
      wholesale_price_xof: wholesalePrice ? Number(wholesalePrice) : null,
      minimum_order_quantity: minimumQuantity,
      city: String(data.get("city")).trim(),
      available_from: String(data.get("availableFrom") || "") || null,
      status: submitterAction === "draft" ? "draft" : "pending_review",
    };

    try {
      const optimizedPhotos = await Promise.all(photos.map(optimizeListingPhoto));
      const reducedPhotoCount = optimizedPhotos.filter((photo) => photo.reduced).length;
      const unchangedPhotoCount = optimizedPhotos.filter((photo) => !photo.optimized).length;
      photos = optimizedPhotos.map((photo) => photo.file);
      let savedId = listingId;
      if (listingId) {
        const { error } = await supabaseClient
          .from("listings")
          .update(listing)
          .eq("id", listingId)
          .eq("farmer_id", currentUser.id);
        if (error) {
          throw error;
        }
      } else {
        const { data: inserted, error } = await supabaseClient
          .from("listings")
          .insert(listing)
          .select("id")
          .single();
        if (error) {
          throw error;
        }
        savedId = inserted.id;
      }

      for (const photo of photos) {
        const extension = photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : "webp";
        const path = `${currentUser.id}/${savedId}/${window.crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabaseClient.storage
          .from("listing-photos")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (uploadError) {
          throw uploadError;
        }
        const { error: recordError } = await supabaseClient
          .from("listing_photos")
          .insert({ listing_id: savedId, storage_path: path });
        if (recordError) {
          const { error: cleanupError } = await supabaseClient.storage
            .from("listing-photos")
            .remove([path]);
          if (cleanupError) {
            throw new Error(`${recordError.message}; nettoyage de la photo échoué : ${cleanupError.message}`);
          }
          throw recordError;
        }
      }
      resetListingForm();
      announce(
        submitterAction === "draft"
          ? `Annonce enregistrée en brouillon. Elle n’est pas publique.${reducedPhotoCount ? ` ${reducedPhotoCount} photo(s) redimensionnée(s) et compressée(s).` : ""}${unchangedPhotoCount ? ` ${unchangedPhotoCount} photo(s) conservée(s) dans leur format d’origine.` : ""}`
          : `Annonce envoyée en modération. Elle sera visible après validation.${reducedPhotoCount ? ` ${reducedPhotoCount} photo(s) redimensionnée(s) et compressée(s).` : ""}${unchangedPhotoCount ? ` ${unchangedPhotoCount} photo(s) conservée(s) dans leur format d’origine.` : ""}`,
        "success",
      );
      await loadFarmerListings();
    } catch (error) {
      announce(`L’annonce n’a pas pu être enregistrée : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function removeListingPhoto(photoId) {
    const listing = currentListings.find((item) =>
      item.photos?.some((photo) => photo.id === photoId),
    );
    const photo = listing?.photos.find((item) => item.id === photoId);
    if (!photo || !listing) {
      return;
    }
    try {
      const { error: storageError } = await supabaseClient.storage
        .from("listing-photos")
        .remove([photo.storage_path]);
      if (storageError) {
        throw storageError;
      }
      const { error } = await supabaseClient
        .from("listing_photos")
        .delete()
        .eq("id", photo.id)
        .eq("listing_id", listing.id);
      if (error) {
        throw error;
      }
      await loadFarmerListings();
      const updatedListing = currentListings.find((item) => item.id === listing.id);
      if (updatedListing) {
        editListing(updatedListing);
      }
      announce("Photo retirée de l’annonce.", "success");
    } catch (error) {
      announce(`La photo n’a pas pu être supprimée : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function pauseListing(listingId, nextStatus) {
    const action = nextStatus === "paused" ? "mettre en pause" : "renvoyer en modération";
    if (!window.confirm(`Voulez-vous ${action} cette annonce ?`)) {
      return;
    }
    try {
      const { error } = await supabaseClient
        .from("listings")
        .update({ status: nextStatus })
        .eq("id", listingId)
        .eq("farmer_id", currentUser.id);
      if (error) {
        throw error;
      }
      await loadFarmerListings();
      announce(
        nextStatus === "paused"
          ? "Annonce mise en pause."
          : "Annonce renvoyée en modération ; elle ne sera pas visible avant validation.",
        "success",
      );
    } catch (error) {
      announce(`Le statut n’a pas pu être modifié : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function deleteListing(listingId) {
    const listing = currentListings.find((item) => item.id === listingId);
    if (!listing) {
      return;
    }
    if (!window.confirm(`Supprimer « ${listing.title} » ? Cette action est définitive.`)) {
      return;
    }
    try {
      const paths = (listing.photos ?? []).map((photo) => photo.storage_path);
      if (paths.length) {
        const { error: storageError } = await supabaseClient.storage
          .from("listing-photos")
          .remove(paths);
        if (storageError) {
          throw storageError;
        }
      }
      const { error } = await supabaseClient
        .from("listings")
        .delete()
        .eq("id", listingId)
        .eq("farmer_id", currentUser.id);
      if (error) {
        throw error;
      }
      await loadFarmerListings();
      announce("Annonce supprimée.", "success");
    } catch (error) {
      announce(`L’annonce n’a pas pu être supprimée : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function markNotificationRead(notificationId) {
    try {
      const { error } = await supabaseClient
        .from("farmer_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("farmer_id", currentUser.id);
      if (error) {
        throw error;
      }
      await loadNotifications();
      announce("Notification marquée comme lue.", "success");
    } catch (error) {
      announce(`La notification n’a pas pu être mise à jour : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function initializeDashboard() {
    const signInPanel = document.querySelector("#farmer-auth-required");
    const pendingPanel = document.querySelector("#farmer-pending-panel");
    const dashboard = document.querySelector("#farmer-dashboard");
    if (!configured) {
      signInPanel.hidden = false;
      announce("La connexion à l’espace fermier nécessite une configuration Supabase. Les formulaires ne transmettent aucune donnée en mode démo.", "error");
      return;
    }

    try {
      supabaseClient = makeClient(true);
      const { data, error } = await supabaseClient.auth.getUser();
      if (error) {
        throw error;
      }
      currentUser = data.user;
      if (!currentUser) {
        signInPanel.hidden = false;
        return;
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("full_name,role")
        .eq("id", currentUser.id)
        .single();
      if (profileError) {
        throw profileError;
      }
      if (profile.role !== "farmer") {
        signInPanel.hidden = false;
        announce("Cet espace est réservé aux comptes fermiers. Les accès administrateur/modérateur sont séparés.", "error");
        return;
      }

      const { data: farmer, error: farmerError } = await supabaseClient
        .from("farmer_profiles")
        .select("id,farm_name,city,status,verified_at")
        .eq("id", currentUser.id)
        .single();
      if (farmerError) {
        throw farmerError;
      }
      if (farmer.status !== "approved") {
        pendingPanel.hidden = false;
        document.querySelector("#farmer-pending-title").textContent =
          farmer.status === "rejected"
            ? "Votre demande n’a pas été validée"
            : farmer.status === "suspended"
              ? "Votre espace est suspendu"
              : "Votre profil est en cours de vérification";
        document.querySelector("#farmer-pending-message").textContent =
          farmer.status === "pending"
            ? `Bonjour ${profile.full_name}. L’équipe vérifiera les informations de ${farmer.farm_name}. Vous recevrez une notification dans votre espace lorsque le statut changera.`
            : "Les annonces et la publication restent désactivées. Consultez vos notifications ou contactez l’équipe de la plateforme.";
        document.querySelector("#farmer-document-form").addEventListener("submit", uploadFarmerDocument);
        await loadNotifications("#farmer-notifications-pending");
        return;
      }

      dashboard.hidden = false;
      document.querySelector("#dashboard-welcome").textContent = `Bonjour, ${profile.full_name}`;
      document.querySelector("#farmer-location").textContent = `${farmer.farm_name} · ${farmer.city}`;
      document.querySelector("#farmer-verified-badge").hidden = !farmer.verified_at;
      const profileLink = document.querySelector("#farmer-public-profile");
      profileLink.href = `fermier.html?id=${encodeURIComponent(currentUser.id)}`;
      profileLink.hidden = false;
      document.querySelector("#farmer-public-profile-link").textContent = "Votre profil public regroupe vos annonces publiées, avis et contact WhatsApp.";
      document.querySelector("#listing-form").addEventListener("submit", saveListing);
      document.querySelector("#listing-cancel-edit").addEventListener("click", resetListingForm);
      document.querySelector("#farmer-listings").addEventListener("click", (event) => {
        const editButton = event.target.closest("[data-edit-listing]");
        const pauseButton = event.target.closest("[data-pause-listing]");
        const deleteButton = event.target.closest("[data-delete-listing]");
        const photoButton = event.target.closest("[data-remove-photo]");
        if (editButton) {
          const listing = currentListings.find((item) => item.id === editButton.dataset.editListing);
          if (listing) {
            editListing(listing);
          }
        } else if (pauseButton) {
          pauseListing(pauseButton.dataset.pauseListing, pauseButton.dataset.nextStatus);
        } else if (deleteButton) {
          deleteListing(deleteButton.dataset.deleteListing);
        } else if (photoButton) {
          removeListingPhoto(photoButton.dataset.removePhoto);
        }
      });
      document.querySelector("#farmer-listings").addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target.closest("[data-edit-listing]")) {
          event.target.click();
        }
      });
      document.querySelector("#farmer-notifications").addEventListener("click", (event) => {
        const button = event.target.closest("[data-read-notification]");
        if (button) {
          markNotificationRead(button.dataset.readNotification);
        }
      });
      await loadCategories();
      await loadFarmerListings();
      await loadNotifications();
      window.addEventListener("focus", () => {
        loadNotifications().catch((error) =>
          announce(`Les notifications n’ont pas pu être actualisées : ${error.message || "erreur réseau"}.`, "error"),
        );
      });
    } catch (error) {
      announce(`L’espace fermier n’a pas pu être chargé : ${error.message || "erreur réseau"}.`, "error");
      signInPanel.hidden = false;
    }
  }

  async function loadFarmerProfile() {
    const target = document.querySelector("#public-farmer-profile");
    if (!target) {
      return;
    }
    const farmerId = new URLSearchParams(window.location.search).get("id");
    if (!configured) {
      const demoProducts = window.FasoMarket?.products() ?? [];
      const items = demoProducts.filter((product) => product.farmerId === farmerId);
      if (items.length) {
        target.innerHTML = `<section class="surface farmer-profile-header">
          <div class="farmer-profile-heading">
            <span class="farmer-profile-avatar" aria-hidden="true">FD</span>
            <div><span class="badge badge--gold">Profil de démonstration</span><h2>${escapeHtml(items[0].farmerName)}</h2><p>📍 ${escapeHtml(items[0].farmerCity)}</p></div>
          </div>
          <p class="notice">Ce profil et ses offres sont fictifs. Aucun fermier n’est vérifié et aucun contact réel n’est configuré.</p>
        </section><section><div class="section-heading"><h2>Stocks de démonstration</h2></div><div class="catalog-products">${items.map((product) => `<article class="surface product-card"><div class="product-info"><h3>${escapeHtml(product.title)}</h3><p>${formatMoney(product.unitPrice)} / ${escapeHtml(product.unit)}</p><a class="button button--outline" href="produit.html?id=${encodeURIComponent(product.id)}">Voir l’offre</a></div></article>`).join("")}</div></section>`;
      } else {
        target.innerHTML = '<p class="empty-state">Le profil public n’est pas disponible en mode démonstration.</p>';
      }
      return;
    }
    if (!farmerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(farmerId)) {
      target.innerHTML = '<p class="empty-state">Le lien vers ce profil est incomplet ou invalide.</p>';
      return;
    }

    try {
      supabaseClient = makeClient(false);
      const [{ data: farmer, error: farmerError }, { data: listings, error: listingsError }, { data: reviews, error: reviewsError }] =
        await Promise.all([
          supabaseClient
            .from("farmer_profiles")
            .select("id,farm_name,city,commune,bio,whatsapp_phone,status,verified_at")
            .eq("id", farmerId)
            .eq("status", "approved")
            .maybeSingle(),
          supabaseClient
            .from("listings")
            .select("id,farmer_id,category_id,title,species,breed,description,age_months,approximate_weight_kg,quantity_available,unit,unit_price_xof,wholesale_price_xof,minimum_order_quantity,city,available_from,farmer:farmer_profiles!inner(id,farm_name,whatsapp_phone,city,status,verified_at),category:categories!inner(id,name,slug,is_active),photos:listing_photos(storage_path,display_order)")
            .eq("farmer_id", farmerId)
            .eq("status", "published")
            .eq("farmer.status", "approved")
            .eq("category.is_active", true)
            .order("created_at", { ascending: false }),
          supabaseClient
            .from("reviews")
            .select("reviewer_name,rating,body,created_at")
            .eq("farmer_id", farmerId)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
      if (farmerError) {
        throw farmerError;
      }
      if (listingsError) {
        throw listingsError;
      }
      if (reviewsError) {
        throw reviewsError;
      }
      if (!farmer) {
        target.innerHTML = '<p class="empty-state">Ce profil n’est pas public ou n’existe plus.</p>';
        return;
      }

      profileItems = await Promise.all(
        (listings ?? []).map((listing) => normalizeListing(listing, supabaseClient)),
      );
      const reviewRows = reviews ?? [];
      const average = reviewRows.length
        ? (reviewRows.reduce((sum, review) => sum + Number(review.rating), 0) / reviewRows.length).toFixed(1)
        : "—";
      const phone = farmer.whatsapp_phone.replace(/\D/g, "");
      const validPhone = /^226\d{8}$/.test(phone) || /^\d{8}$/.test(phone) || /^0\d{8}$/.test(phone);
      target.innerHTML = `<section class="surface farmer-profile-header">
        <div class="farmer-profile-heading">
          <span class="farmer-profile-avatar" aria-hidden="true">${escapeHtml(farmer.farm_name.slice(0, 2).toLocaleUpperCase("fr"))}</span>
          <div>${farmer.verified_at ? '<span class="badge">✓ Fermier vérifié</span>' : '<span class="badge badge--gold">Profil validé</span>'}
            <h2>${escapeHtml(farmer.farm_name)}</h2>
            <p>📍 ${escapeHtml([farmer.commune, farmer.city].filter(Boolean).join(", "))}</p>
            <p>${escapeHtml(profileItems.length)} annonce${profileItems.length > 1 ? "s" : ""} publiée${profileItems.length > 1 ? "s" : ""} · ${escapeHtml(average)} ★ (${reviewRows.length} avis)</p>
          </div>
        </div>
        ${validPhone ? `<a class="button" data-farmer-contact href="https://wa.me/${phone.startsWith("226") ? phone : `226${phone.replace(/^0/, "")}`}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Contacter sur WhatsApp</a>` : '<span class="muted text-small">Contact indisponible</span>'}
        <p>${escapeHtml(farmer.bio || "Présentation de la ferme non renseignée.")}</p>
      </section>
      <section>
        <div class="section-heading"><div><p class="eyebrow">Stocks publiés</p><h2>Annonces de la ferme</h2></div></div>
        <div id="farmer-public-listings" class="catalog-products"></div>
      </section>
      <section class="platform-grid" style="margin-top:1rem">
        <div class="surface platform-card">
          <div class="section-heading"><div><p class="eyebrow">Avis modérés</p><h2>Retours des acheteurs</h2></div></div>
          <div class="review-list" id="farmer-review-list"></div>
        </div>
        <form id="farmer-review-form" class="review-form" method="post">
          <h2>Partager un avis</h2>
          <p class="muted text-small">Votre avis sera modéré avant publication. Il n’est pas présenté comme un achat vérifié.</p>
          <div id="review-notice" class="notice" role="status" aria-live="polite" hidden></div>
          <fieldset class="field" style="border:0;padding:0;margin:0">
            <legend>Votre note</legend>
            <div class="rating-input">
              ${[5, 4, 3, 2, 1].map((rating) => `<label><input type="radio" name="rating" value="${rating}" ${rating === 5 ? "checked" : ""} required>${rating} ★</label>`).join("")}
            </div>
          </fieldset>
          <div class="field"><label for="review-name">Votre nom ou prénom</label><input id="review-name" name="name" maxlength="120" required></div>
          <div class="field"><label for="review-body">Votre avis</label><textarea id="review-body" name="body" minlength="10" maxlength="2000" rows="4" required></textarea></div>
          <button class="button" type="submit">Envoyer pour modération</button>
        </form>
      </section>`;

      const listingTarget = document.querySelector("#farmer-public-listings");
      if (profileItems.length) {
        listingTarget.innerHTML = profileItems.map((product) => {
          const image = product.photos[0]
            ? `<div class="product-image"><img src="${escapeHtml(product.photos[0])}" alt="${escapeHtml(`Photo de ${product.title}`)}" loading="lazy"></div>`
            : `<div class="product-image product-image--placeholder" role="img" aria-label="Photo non fournie"><span>${escapeHtml(iconByCategory[product.categoryId] ?? "🐓")}</span><span class="image-note">Photo à confirmer</span></div>`;
          return `<article class="surface product-card">${image}<div class="product-info"><h3><a href="produit.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.title)}</a></h3><div class="product-facts"><span>${escapeHtml(product.city)}</span><span>${product.quantity > 0 ? `${escapeHtml(product.quantity)} ${escapeHtml(product.unit)} disponibles` : "Indisponible"}</span><span>Minimum ${escapeHtml(product.minimumQuantity)}</span></div><p class="product-price">${formatMoney(product.unitPrice)} / ${escapeHtml(product.unit)}</p>${product.wholesalePrice ? `<p class="text-small">Gros : ${formatMoney(product.wholesalePrice)}</p>` : ""}<a class="button button--outline button--full" href="produit.html?id=${encodeURIComponent(product.id)}">Voir l’offre</a></div></article>`;
        }).join("");
      } else {
        listingTarget.innerHTML = '<p class="empty-state">Aucun stock n’est actuellement publié.</p>';
      }
      const reviewTarget = document.querySelector("#farmer-review-list");
      reviewTarget.innerHTML = reviewRows.length
        ? reviewRows.map((review) => `<article class="surface"><div class="review-stars" aria-label="${escapeHtml(review.rating)} étoiles sur 5">${"★".repeat(Number(review.rating))}</div><strong>${escapeHtml(review.reviewer_name || "Acheteur")}</strong><p>${escapeHtml(review.body || "")}</p></article>`).join("")
        : '<p class="muted">Aucun avis publié pour le moment.</p>';
      document.querySelector("#farmer-review-form").addEventListener("submit", submitReview);
      target.querySelector("[data-farmer-contact]")?.addEventListener("click", () => {
        window.FasoMarket?.recordFarmerContact(farmerId).catch((error) =>
          announce(`Le clic WhatsApp n’a pas pu être comptabilisé : ${error.message || "erreur réseau"}.`, "error"),
        );
      });

      if (window.FasoMarket) {
        for (const listing of profileItems) {
          window.FasoMarket.recordListingEvent(listing.id, "view").catch((error) =>
            announce(`La vue de l’annonce n’a pas pu être comptabilisée : ${error.message || "erreur réseau"}.`, "error"),
          );
        }
      }
    } catch (error) {
      target.innerHTML = '<p class="empty-state">Le profil n’a pas pu être chargé. Réessayez plus tard.</p>';
      announce(`Erreur de chargement du profil : ${error.message || "erreur réseau"}.`, "error");
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const notice = document.querySelector("#review-notice");
    notice.hidden = true;
    const farmerId = new URLSearchParams(window.location.search).get("id");
    const data = new FormData(form);
    if (!configured || !supabaseClient) {
      notice.textContent = "Les avis seront actifs après la configuration de la plateforme.";
      notice.className = "notice notice--error";
      notice.hidden = false;
      return;
    }
    try {
      const { error } = await supabaseClient.rpc("submit_farmer_review", {
        target_farmer_id: farmerId,
        submitted_rating: Number(data.get("rating")),
        submitted_name: String(data.get("name")).trim(),
        submitted_body: String(data.get("body")).trim(),
        submitted_client_key: localClientKey(),
      });
      if (error) {
        throw error;
      }
      form.reset();
      notice.textContent = "Votre avis a été envoyé à la modération. Il ne sera public qu’après validation.";
      notice.className = "notice notice--success";
      notice.hidden = false;
    } catch (error) {
      notice.textContent = `L’avis n’a pas pu être envoyé : ${error.message || "erreur réseau"}.`;
      notice.className = "notice notice--error";
      notice.hidden = false;
    }
  }

  async function initialize() {
    if (pageType === "marketplace") {
      await initializeMarketplace();
    } else if (pageType === "farmer-dashboard") {
      await initializeDashboard();
    } else if (pageType === "farmer-profile") {
      if (window.FasoMarket) {
        await window.FasoMarket.ready;
      }
      await loadFarmerProfile();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initialize().catch((error) => announce(`Erreur inattendue : ${error.message || "erreur réseau"}.`, "error"));
  }, { once: true });
})();
