(() => {
  const config = window.APP_CONFIG ?? {};
  const configured =
    typeof config.supabaseUrl === "string" &&
    config.supabaseUrl.trim() !== "" &&
    typeof config.supabasePublishableKey === "string" &&
    config.supabasePublishableKey.trim() !== "";
  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
  const state = {
    user: null,
    factorId: null,
    enrollmentPending: false,
    deleteFarmer: null,
    farmers: [],
    listings: [],
    reviews: [],
    reports: [],
    categories: [],
    users: [],
    settings: new Map(),
    exportData: new Map(),
  };

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

  function reportError(message, error) {
    const notice = document.querySelector("#admin-notice");
    notice.textContent = `${message} ${error?.message || "Erreur réseau."}`;
    notice.className = "notice notice--error admin-notice";
    notice.hidden = false;
  }

  function reportSuccess(message) {
    const notice = document.querySelector("#admin-notice");
    notice.textContent = message;
    notice.className = "notice admin-notice notice--success";
    notice.hidden = false;
  }

  function setMfaMessage(message, isError = false) {
    const notice = document.querySelector("#admin-notice");
    notice.textContent = message;
    notice.className = `notice admin-notice${isError ? " notice--error" : ""}`;
    notice.hidden = false;
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }
    return new Date(value).toLocaleString("fr-FR");
  }

  function statusLabel(value) {
    const labels = {
      pending: "En attente",
      approved: "Validé",
      rejected: "Refusé",
      suspended: "Suspendu",
      draft: "Brouillon",
      pending_review: "À modérer",
      published: "Publié",
      paused: "En pause",
      archived: "Archivé",
      hidden: "Masqué",
      open: "Ouvert",
      in_review: "En cours",
      resolved: "Résolu",
      dismissed: "Classé",
      farmer: "Fermier",
      moderator: "Modérateur",
      admin: "Administrateur",
    };
    return labels[value] ?? value ?? "—";
  }

  function statusBadge(value) {
    const alert = ["pending", "pending_review", "open", "in_review"].includes(value);
    const danger = ["rejected", "suspended", "hidden"].includes(value);
    return `<span class="badge${alert ? " badge--gold" : danger ? " badge--red" : ""}">${escapeHtml(statusLabel(value))}</span>`;
  }

  async function fetchAll(buildQuery) {
    const rows = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await buildQuery(offset, offset + pageSize - 1);
      if (error) {
        throw error;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) {
        return rows;
      }
    }
  }

  function setTab(tabName) {
    for (const button of document.querySelectorAll("[data-admin-tab]")) {
      if (button.dataset.adminTab === tabName) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
    for (const panel of document.querySelectorAll("[data-admin-panel]")) {
      panel.hidden = panel.dataset.adminPanel !== tabName;
    }
    loadPanel(tabName).catch((error) =>
      reportError(`La section « ${statusLabel(tabName)} » n’a pas pu être chargée.`, error),
    );
  }

  async function loadDashboard() {
    const { data, error } = await client.rpc("admin_dashboard_stats");
    if (error) {
      throw error;
    }
    const stats = data?.[0] ?? {};
    document.querySelector("#metric-visitors").textContent = String(stats.estimated_visitors ?? 0);
    document.querySelector("#metric-whatsapp").textContent = String(stats.whatsapp_contacts ?? 0);
    document.querySelector("#metric-listings").textContent = String(stats.active_listings ?? 0);
    document.querySelector("#metric-farmers").textContent = String(stats.pending_farmers ?? 0);
  }

  function farmerActions(farmer) {
    const approveButton = farmer.status !== "approved"
      ? `<button class="button" type="button" data-farmer-status="${escapeHtml(farmer.id)}" data-status="approved">Valider</button>`
      : "";
    const rejectButton = farmer.status !== "rejected"
      ? `<button class="button button--outline" type="button" data-farmer-status="${escapeHtml(farmer.id)}" data-status="rejected">Refuser</button>`
      : "";
    const suspendButton = farmer.status !== "suspended"
      ? `<button class="button button--outline" type="button" data-farmer-status="${escapeHtml(farmer.id)}" data-status="suspended">Suspendre</button>`
      : "";
    const verifyLabel = farmer.verified_at ? "Retirer le badge" : "Badge vérifié";
    const verifyValue = farmer.verified_at ? "false" : "true";
    return `<div class="admin-table-actions">
      ${approveButton}${rejectButton}${suspendButton}
      <button class="button button--outline" type="button" data-farmer-verified="${escapeHtml(farmer.id)}" data-verified="${verifyValue}" ${farmer.status !== "approved" ? "disabled" : ""}>${verifyLabel}</button>
      <button class="button button--red" type="button" data-delete-farmer="${escapeHtml(farmer.id)}">Supprimer</button>
    </div>`;
  }

  async function loadFarmers() {
    state.farmers = await fetchAll((from, to) =>
      client
        .from("farmer_profiles")
        .select("id,farm_name,whatsapp_phone,city,commune,status,verified_at,created_at,profiles!farmer_profiles_id_fkey(full_name,phone),documents:farmer_documents(id,storage_path,created_at)")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    state.exportData.set("farmers", state.farmers.map((farmer) => ({
      id: farmer.id,
      full_name: farmer.profiles?.full_name,
      farm_name: farmer.farm_name,
      whatsapp_phone: farmer.whatsapp_phone,
      city: farmer.city,
      commune: farmer.commune,
      status: farmer.status,
      verified: Boolean(farmer.verified_at),
      created_at: farmer.created_at,
    })));
    renderFarmers();
  }

  function renderFarmers() {
    const search = document.querySelector("#farmer-search").value.trim().toLocaleLowerCase("fr");
    const rows = state.farmers.filter((farmer) =>
      `${farmer.profiles?.full_name ?? ""} ${farmer.farm_name} ${farmer.city} ${farmer.whatsapp_phone}`
        .toLocaleLowerCase("fr")
        .includes(search),
    );
    document.querySelector("#admin-farmers").innerHTML = rows.length
      ? rows.map((farmer) => `<tr>
          <td><strong>${escapeHtml(farmer.profiles?.full_name || "Compte fermier")}</strong><br>${escapeHtml(farmer.farm_name)}<br><span class="text-small muted">${escapeHtml(farmer.id)}</span></td>
          <td><a href="https://wa.me/${escapeHtml(farmer.whatsapp_phone.replace(/\D/g, ""))}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${escapeHtml(farmer.whatsapp_phone)}</a><br>${escapeHtml([farmer.commune, farmer.city].filter(Boolean).join(", "))}</td>
          <td>${statusBadge(farmer.status)}<br><span class="text-small muted">${formatDate(farmer.created_at)}</span></td>
          <td>${farmer.verified_at ? '<span class="badge">✓ Vérifié</span>' : '<span class="muted">Non vérifié</span>'}${farmer.documents?.length ? `<br><button class="button button--outline" type="button" data-farmer-documents="${escapeHtml(farmer.id)}">Justificatifs (${farmer.documents.length})</button><div id="farmer-documents-${escapeHtml(farmer.id)}"></div>` : '<br><span class="muted text-small">Aucun document</span>'}</td>
          <td>${farmerActions(farmer)}</td>
        </tr>`).join("")
      : '<tr><td colspan="5">Aucun fermier ne correspond à la recherche.</td></tr>';
  }

  async function updateFarmerStatus(farmerId, status) {
    const farmer = state.farmers.find((item) => item.id === farmerId);
    if (!farmer) {
      return;
    }
    const confirmText = status === "suspended"
      ? `Suspendre ${farmer.farm_name} ? Ses annonces publiées seront mises en pause.`
      : status === "rejected"
        ? `Refuser la demande de ${farmer.farm_name} ?`
        : `Valider le profil de ${farmer.farm_name} ?`;
    if (!window.confirm(confirmText)) {
      return;
    }
    const { error } = await client
      .from("farmer_profiles")
      .update({
        status,
        verified_at: status === "approved" ? farmer.verified_at : null,
      })
      .eq("id", farmerId);
    if (error) {
      throw error;
    }
    await loadFarmers();
    await loadDashboard();
    reportSuccess(`Statut de « ${farmer.farm_name} » mis à jour.`);
  }

  async function toggleFarmerVerification(farmerId, verified) {
    const farmer = state.farmers.find((item) => item.id === farmerId);
    if (!farmer || farmer.status !== "approved") {
      return;
    }
    const { error } = await client
      .from("farmer_profiles")
      .update({ verified_at: verified ? new Date().toISOString() : null })
      .eq("id", farmerId);
    if (error) {
      throw error;
    }
    await loadFarmers();
    reportSuccess(verified ? "Badge de fermier vérifié attribué." : "Badge de vérification retiré.");
  }

  async function showFarmerDocuments(farmerId) {
    const farmer = state.farmers.find((item) => item.id === farmerId);
    if (!farmer?.documents?.length) {
      return;
    }
    const target = document.querySelector(`#farmer-documents-${CSS.escape(farmerId)}`);
    target.textContent = "Préparation des liens privés…";
    const links = await Promise.all(farmer.documents.map(async (documentRow) => {
      const { data, error } = await client.storage
        .from("farmer-documents")
        .createSignedUrl(documentRow.storage_path, 60);
      if (error) {
        throw error;
      }
      return { url: data.signedUrl, date: documentRow.created_at };
    }));
    target.replaceChildren();
    for (const [index, documentLink] of links.entries()) {
      const link = document.createElement("a");
      link.href = documentLink.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";
      link.textContent = `Ouvrir le justificatif ${index + 1} · ${formatDate(documentLink.date)} (60 s)`;
      target.append(link);
      if (index < links.length - 1) {
        target.append(document.createElement("br"));
      }
    }
  }

  function openFarmerDeletion(farmerId) {
    const farmer = state.farmers.find((item) => item.id === farmerId);
    if (!farmer) {
      return;
    }
    state.deleteFarmer = farmer;
    document.querySelector("#farmer-delete-description").textContent =
      `Vous allez supprimer définitivement « ${farmer.farm_name} » et son compte associé. Les annonces, avis, photos et justificatifs seront également supprimés.`;
    document.querySelector("#farmer-delete-confirm").value = "";
    document.querySelector("#farmer-delete-dialog").showModal();
  }

  async function deleteFarmer(event) {
    event.preventDefault();
    const farmer = state.deleteFarmer;
    const confirmation = document.querySelector("#farmer-delete-confirm").value;
    if (!farmer || confirmation !== farmer.farm_name) {
      reportError("Le nom de la ferme ne correspond pas.", new Error("Aucune donnée n’a été supprimée."));
      return;
    }
    try {
      const { data, error } = await client.functions.invoke("admin-delete-farmer", {
        body: { farmer_id: farmer.id },
      });
      if (error) {
        throw error;
      }
      document.querySelector("#farmer-delete-dialog").close();
      state.deleteFarmer = null;
      await Promise.all([loadFarmers(), loadDashboard()]);
      reportSuccess(data?.message || "Le compte fermier et ses données ont été supprimés.");
    } catch (error) {
      reportError("La suppression n’a pas été effectuée.", error);
    }
  }

  async function loadListings() {
    state.listings = await fetchAll((from, to) =>
      client
        .from("listings")
        .select("id,farmer_id,title,species,breed,city,unit,quantity_available,unit_price_xof,status,moderation_note,created_at,farmer:farmer_profiles!listings_farmer_id_fkey(farm_name,profiles!farmer_profiles_id_fkey(full_name)),photos:listing_photos(id,storage_path,display_order)")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    state.exportData.set("listings", state.listings.map((listing) => ({
      id: listing.id,
      farmer_id: listing.farmer_id,
      farm_name: listing.farmer?.farm_name,
      title: listing.title,
      species: listing.species,
      breed: listing.breed,
      city: listing.city,
      quantity_available: listing.quantity_available,
      unit_price_xof: listing.unit_price_xof,
      status: listing.status,
      moderation_note: listing.moderation_note,
      created_at: listing.created_at,
    })));
    renderListings();
  }

  function renderListings() {
    const search = document.querySelector("#listing-search").value.trim().toLocaleLowerCase("fr");
    const rows = state.listings.filter((listing) =>
      `${listing.title} ${listing.species} ${listing.breed ?? ""} ${listing.city} ${listing.farmer?.farm_name ?? ""}`
        .toLocaleLowerCase("fr")
        .includes(search),
    );
    document.querySelector("#admin-listings").innerHTML = rows.length
      ? rows.map((listing) => {
          const actions = [];
          if (listing.status !== "published") {
            actions.push(`<button class="button" type="button" data-listing-status="${escapeHtml(listing.id)}" data-status="published">Publier</button>`);
          }
          if (listing.status !== "rejected") {
            actions.push(`<button class="button button--outline" type="button" data-listing-status="${escapeHtml(listing.id)}" data-status="rejected">Refuser</button>`);
          }
          if (listing.status !== "paused") {
            actions.push(`<button class="button button--outline" type="button" data-listing-status="${escapeHtml(listing.id)}" data-status="paused">Masquer / pause</button>`);
          }
          actions.push(`<button class="button button--red" type="button" data-delete-listing="${escapeHtml(listing.id)}">Supprimer</button>`);
          return `<tr>
            <td><strong>${escapeHtml(listing.title)}</strong><br>${escapeHtml(listing.species)} · ${escapeHtml(listing.breed || "Race non précisée")} · ${escapeHtml(listing.city)}<br><span class="text-small muted">${escapeHtml(listing.id)}</span></td>
            <td>${escapeHtml(listing.farmer?.farm_name || "Compte supprimé")}<br><span class="text-small muted">${escapeHtml(listing.farmer?.profiles?.full_name || "")}</span></td>
            <td>${new Intl.NumberFormat("fr-FR").format(listing.unit_price_xof)} FCFA / ${escapeHtml(listing.unit)}<br>${escapeHtml(listing.quantity_available)} en stock</td>
            <td>${statusBadge(listing.status)}</td>
            <td><label class="sr-only" for="listing-note-${escapeHtml(listing.id)}">Note de modération</label><textarea id="listing-note-${escapeHtml(listing.id)}" maxlength="1000" rows="2">${escapeHtml(listing.moderation_note || "")}</textarea><button class="button button--outline" type="button" data-save-listing-note="${escapeHtml(listing.id)}">Enregistrer</button></td>
            <td><div class="admin-table-actions">${actions.join("")}</div></td>
          </tr>`;
        }).join("")
      : '<tr><td colspan="6">Aucune annonce ne correspond à la recherche.</td></tr>';
  }

  async function moderateListing(listingId, status) {
    const listing = state.listings.find((item) => item.id === listingId);
    if (!listing) {
      return;
    }
    if (status === "published" && !window.confirm(`Publier « ${listing.title} » ?`)) {
      return;
    }
    const { error } = await client
      .from("listings")
      .update({ status })
      .eq("id", listingId);
    if (error) {
      throw error;
    }
    await Promise.all([loadListings(), loadDashboard()]);
    reportSuccess(`Annonce « ${listing.title} » : ${statusLabel(status).toLocaleLowerCase("fr")}.`);
  }

  async function saveListingNote(listingId) {
    const note = document.querySelector(`#listing-note-${CSS.escape(listingId)}`).value.trim();
    const { error } = await client
      .from("listings")
      .update({ moderation_note: note || null })
      .eq("id", listingId);
    if (error) {
      throw error;
    }
    await loadListings();
    reportSuccess("Note de modération enregistrée.");
  }

  async function deleteListing(listingId) {
    const listing = state.listings.find((item) => item.id === listingId);
    if (!listing || !window.confirm(`Supprimer définitivement l’annonce « ${listing.title} » ?`)) {
      return;
    }
    const paths = (listing.photos ?? []).map((photo) => photo.storage_path);
    if (paths.length) {
      const { error: storageError } = await client.storage.from("listing-photos").remove(paths);
      if (storageError) {
        throw storageError;
      }
    }
    const { error } = await client.from("listings").delete().eq("id", listingId);
    if (error) {
      throw error;
    }
    await Promise.all([loadListings(), loadDashboard()]);
    reportSuccess(`Annonce « ${listing.title} » supprimée.`);
  }

  async function loadReviews() {
    state.reviews = await fetchAll((from, to) =>
      client
        .from("reviews")
        .select("id,farmer_id,listing_id,reviewer_name,rating,body,status,created_at,farmer:farmer_profiles!reviews_farmer_id_fkey(farm_name)")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    state.exportData.set("reviews", state.reviews.map((review) => ({
      id: review.id,
      farmer_id: review.farmer_id,
      farm_name: review.farmer?.farm_name,
      reviewer_name: review.reviewer_name,
      rating: review.rating,
      body: review.body,
      status: review.status,
      created_at: review.created_at,
    })));
    renderReviews();
  }

  function renderReviews() {
    const search = document.querySelector("#review-search").value.trim().toLocaleLowerCase("fr");
    const rows = state.reviews.filter((review) =>
      `${review.reviewer_name ?? ""} ${review.body ?? ""} ${review.farmer?.farm_name ?? ""}`
        .toLocaleLowerCase("fr")
        .includes(search),
    );
    document.querySelector("#admin-reviews").innerHTML = rows.length
      ? rows.map((review) => `<article class="admin-record">
          <div class="section-heading"><div><h3>${escapeHtml(review.farmer?.farm_name || "Ferme")}</h3><p>${escapeHtml(review.reviewer_name || "Acheteur")} · ${escapeHtml(review.rating)} / 5 · ${formatDate(review.created_at)}</p></div>${statusBadge(review.status)}</div>
          <p>${escapeHtml(review.body || "")}</p>
          <div class="admin-actions">
            <label class="field"><span>Décision</span><select data-review-status="${escapeHtml(review.id)}"><option value="pending" ${review.status === "pending" ? "selected" : ""}>En attente</option><option value="published" ${review.status === "published" ? "selected" : ""}>Publier</option><option value="hidden" ${review.status === "hidden" ? "selected" : ""}>Masquer</option><option value="rejected" ${review.status === "rejected" ? "selected" : ""}>Refuser</option></select></label>
            <button class="button button--outline" type="button" data-save-review="${escapeHtml(review.id)}">Enregistrer</button>
            <button class="button button--red" type="button" data-delete-review="${escapeHtml(review.id)}">Supprimer</button>
          </div>
        </article>`).join("")
      : '<p class="empty-state">Aucun avis ne correspond à la recherche.</p>';
  }

  async function moderateReview(reviewId, status) {
    const { error } = await client.from("reviews").update({ status }).eq("id", reviewId);
    if (error) {
      throw error;
    }
    await loadReviews();
    reportSuccess(`Avis : ${statusLabel(status).toLocaleLowerCase("fr")}.`);
  }

  async function deleteReview(reviewId) {
    if (!window.confirm("Supprimer définitivement cet avis ?")) {
      return;
    }
    const { error } = await client.from("reviews").delete().eq("id", reviewId);
    if (error) {
      throw error;
    }
    await loadReviews();
    reportSuccess("Avis supprimé.");
  }

  async function loadReports() {
    state.reports = await fetchAll((from, to) =>
      client
        .from("reports")
        .select("id,target_type,listing_id,review_id,reason,details,status,resolution_note,created_at,listing:listings(title),review:reviews(reviewer_name,body)")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    state.exportData.set("reports", state.reports.map((report) => ({
      id: report.id,
      target_type: report.target_type,
      listing_id: report.listing_id,
      review_id: report.review_id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolution_note: report.resolution_note,
      created_at: report.created_at,
    })));
    renderReports();
  }

  function renderReports() {
    document.querySelector("#admin-reports").innerHTML = state.reports.length
      ? state.reports.map((report) => {
          const targetLabel = report.target_type === "listing"
            ? `Annonce : ${report.listing?.title || "Annonce supprimée"}`
            : `Avis : ${report.review?.reviewer_name || "Avis supprimé"} — ${report.review?.body || ""}`;
          return `<article class="admin-record">
            <div class="section-heading"><div><h3>${escapeHtml(targetLabel)}</h3><p>${formatDate(report.created_at)}</p></div>${statusBadge(report.status)}</div>
            <p><strong>Motif :</strong> ${escapeHtml(report.reason)}</p>
            <p>${escapeHtml(report.details || "Aucun détail fourni.")}</p>
            <div class="admin-actions">
              <label class="field"><span>Décision</span><select data-report-status="${escapeHtml(report.id)}"><option value="open" ${report.status === "open" ? "selected" : ""}>Ouvert</option><option value="in_review" ${report.status === "in_review" ? "selected" : ""}>En cours</option><option value="resolved" ${report.status === "resolved" ? "selected" : ""}>Résolu</option><option value="dismissed" ${report.status === "dismissed" ? "selected" : ""}>Classer sans suite</option></select></label>
              <label class="field"><span>Note de résolution</span><input data-report-note="${escapeHtml(report.id)}" maxlength="1000" value="${escapeHtml(report.resolution_note || "")}"></label>
              <button class="button button--outline" type="button" data-save-report="${escapeHtml(report.id)}">Enregistrer</button>
            </div>
          </article>`;
        }).join("")
      : '<p class="empty-state">Aucun signalement enregistré.</p>';
  }

  async function moderateReport(reportId) {
    const status = document.querySelector(`[data-report-status="${CSS.escape(reportId)}"]`).value;
    const note = document.querySelector(`[data-report-note="${CSS.escape(reportId)}"]`).value.trim();
    const { error } = await client
      .from("reports")
      .update({
        status,
        resolution_note: note || null,
        resolved_by: ["resolved", "dismissed"].includes(status) ? state.user.id : null,
        resolved_at: ["resolved", "dismissed"].includes(status) ? new Date().toISOString() : null,
      })
      .eq("id", reportId);
    if (error) {
      throw error;
    }
    await loadReports();
    reportSuccess(`Signalement : ${statusLabel(status).toLocaleLowerCase("fr")}.`);
  }

  async function loadCategories() {
    state.categories = await fetchAll((from, to) =>
      client
        .from("categories")
        .select("id,name,slug,description,is_active,created_at")
        .order("name")
        .range(from, to),
    );
    state.exportData.set("categories", state.categories);
    renderCategories();
  }

  function resetCategoryForm() {
    const form = document.querySelector("#category-form");
    form.reset();
    form.elements.namedItem("id").value = "";
    form.elements.namedItem("is_active").checked = true;
    document.querySelector("#category-form-title").textContent = "Ajouter une catégorie";
    document.querySelector("#category-cancel").hidden = true;
  }

  function renderCategories() {
    const target = document.querySelector("#admin-categories");
    target.innerHTML = state.categories.length
      ? state.categories.map((category) => `<article class="admin-record">
          <div class="section-heading"><div><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.slug)} · ${escapeHtml(category.description || "Sans description")}</p></div>${category.is_active ? '<span class="badge">Visible</span>' : '<span class="badge badge--gold">Masquée</span>'}</div>
          <div class="admin-actions">
            <button class="button button--outline" type="button" data-edit-category="${escapeHtml(category.id)}">Modifier</button>
            <button class="button button--outline" type="button" data-toggle-category="${escapeHtml(category.id)}" data-active="${String(category.is_active)}">${category.is_active ? "Masquer" : "Réactiver"}</button>
            <button class="button button--red" type="button" data-delete-category="${escapeHtml(category.id)}">Supprimer</button>
          </div>
        </article>`).join("")
      : '<p class="empty-state">Aucune catégorie.</p>';
  }

  async function saveCategory(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const id = String(data.get("id") || "");
    const category = {
      name: String(data.get("name")).trim(),
      slug: String(data.get("slug")).trim().toLowerCase(),
      description: String(data.get("description") || "").trim() || null,
      is_active: data.has("is_active"),
    };
    const query = id
      ? client.from("categories").update(category).eq("id", id)
      : client.from("categories").insert(category);
    const { error } = await query;
    if (error) {
      throw error;
    }
    resetCategoryForm();
    await loadCategories();
    reportSuccess("Catégorie enregistrée.");
  }

  async function toggleCategory(categoryId, active) {
    const { error } = await client
      .from("categories")
      .update({ is_active: !active })
      .eq("id", categoryId);
    if (error) {
      throw error;
    }
    await loadCategories();
    reportSuccess(active ? "Catégorie masquée." : "Catégorie réactivée.");
  }

  async function deleteCategory(categoryId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category || !window.confirm(`Supprimer la catégorie « ${category.name} » ? La base refusera la suppression si des annonces l’utilisent.`)) {
      return;
    }
    const { error } = await client.from("categories").delete().eq("id", categoryId);
    if (error) {
      throw error;
    }
    await loadCategories();
    reportSuccess("Catégorie supprimée.");
  }

  function getSettingValue(key, fallback) {
    return state.settings.get(key) ?? fallback;
  }

  async function loadSettings() {
    const keys = ["site_content", "public_whatsapp", "contact", "social_links", "supported_languages"];
    const { data, error } = await client
      .from("site_settings")
      .select("key,value,updated_at,updated_by")
      .in("key", keys);
    if (error) {
      throw error;
    }
    state.settings = new Map((data ?? []).map((setting) => [setting.key, setting.value]));
    state.exportData.set("settings", (data ?? []).map((setting) => ({
      key: setting.key,
      value: JSON.stringify(setting.value),
      updated_at: setting.updated_at,
    })));
    const form = document.querySelector("#settings-form");
    const content = getSettingValue("site_content", {});
    const contact = getSettingValue("contact", {});
    const socials = getSettingValue("social_links", {});
    const whatsapp = getSettingValue("public_whatsapp", {});
    const languages = getSettingValue("supported_languages", ["fr"]);
    for (const key of ["brand_name", "home_slogan", "home_intro", "banner_image_url"]) {
      form.elements.namedItem(key).value = content[key] ?? "";
    }
    form.elements.namedItem("brand_name_is_provisional").checked =
      content.brand_name_is_provisional !== false;
    for (const key of ["email", "phone", "address"]) {
      form.elements.namedItem(key).value = contact[key] ?? "";
    }
    form.elements.namedItem("whatsapp").value = whatsapp.number ?? "";
    for (const key of ["facebook", "instagram", "tiktok"]) {
      form.elements.namedItem(key).value = socials[key] ?? "";
    }
    for (const checkbox of form.querySelectorAll('[name="languages"]')) {
      checkbox.checked = languages.includes(checkbox.value);
    }
  }

  function requireHttpsUrl(value, label) {
    if (!value) {
      return;
    }
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      throw new Error(`${label} doit utiliser une URL HTTPS.`);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const content = {
      ...getSettingValue("site_content", {}),
      brand_name: String(data.get("brand_name")).trim(),
      brand_name_is_provisional: data.has("brand_name_is_provisional"),
      home_slogan: String(data.get("home_slogan")).trim(),
      home_intro: String(data.get("home_intro")).trim(),
      banner_image_url: String(data.get("banner_image_url") || "").trim(),
    };
    const contact = {
      address: String(data.get("address") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
    };
    const socials = Object.fromEntries(
      ["facebook", "instagram", "tiktok"].map((key) => [key, String(data.get(key) || "").trim()]),
    );
    for (const key of Object.keys(socials)) {
      requireHttpsUrl(socials[key], key);
    }
    requireHttpsUrl(content.banner_image_url, "L’image de bannière");
    let whatsappNumber = String(data.get("whatsapp") || "").replace(/\D/g, "");
    if (whatsappNumber.startsWith("0") && whatsappNumber.length === 9) {
      whatsappNumber = `226${whatsappNumber.slice(1)}`;
    } else if (whatsappNumber.length === 8) {
      whatsappNumber = `226${whatsappNumber}`;
    }
    if (whatsappNumber && !/^226\d{8}$/.test(whatsappNumber)) {
      throw new Error("Le numéro WhatsApp doit contenir un numéro burkinabè valide.");
    }
    const languages = [...new Set(data.getAll("languages").map(String))];
    if (!languages.includes("fr")) {
      throw new Error("Le français doit rester sélectionné.");
    }
    const settings = [
      { key: "site_content", value: content },
      { key: "public_whatsapp", value: { number: whatsappNumber } },
      { key: "contact", value: contact },
      { key: "social_links", value: socials },
      { key: "supported_languages", value: languages },
    ].map((setting) => ({ ...setting, updated_by: state.user.id }));
    const { error } = await client.from("site_settings").upsert(settings, { onConflict: "key" });
    if (error) {
      throw error;
    }
    await loadSettings();
    reportSuccess("Paramètres enregistrés. Les modifications publiques seront appliquées lors du prochain chargement du site.");
  }

  async function loadUsers() {
    state.users = await fetchAll((from, to) =>
      client
        .from("profiles")
        .select("id,full_name,phone,role,created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    state.exportData.set("users", state.users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
    })));
    renderUsers();
  }

  function renderUsers() {
    const search = document.querySelector("#user-search").value.trim().toLocaleLowerCase("fr");
    const rows = state.users.filter((user) =>
      `${user.full_name} ${user.id} ${user.role}`.toLocaleLowerCase("fr").includes(search),
    );
    document.querySelector("#admin-users").innerHTML = rows.length
      ? rows.map((user) => `<tr>
          <td><strong>${escapeHtml(user.full_name)}</strong><br>${escapeHtml(user.phone || "Téléphone non renseigné")}</td>
          <td><code>${escapeHtml(user.id)}</code></td>
          <td>${statusBadge(user.role)}</td>
          <td><label class="sr-only" for="user-role-${escapeHtml(user.id)}">Nouveau rôle de ${escapeHtml(user.full_name)}</label>
            <select id="user-role-${escapeHtml(user.id)}" data-user-role="${escapeHtml(user.id)}" ${user.id === state.user.id ? "disabled" : ""}>
              <option value="farmer" ${user.role === "farmer" ? "selected" : ""}>Fermier</option>
              <option value="moderator" ${user.role === "moderator" ? "selected" : ""}>Modérateur</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrateur</option>
            </select>
            <button class="button button--outline" type="button" data-save-role="${escapeHtml(user.id)}" ${user.id === state.user.id ? "disabled" : ""}>Enregistrer</button>
          </td>
        </tr>`).join("")
      : '<tr><td colspan="4">Aucun compte ne correspond à la recherche.</td></tr>';
  }

  async function saveRole(userId) {
    const select = document.querySelector(`[data-user-role="${CSS.escape(userId)}"]`);
    const selectedUser = state.users.find((user) => user.id === userId);
    if (!selectedUser || selectedUser.role === select.value) {
      return;
    }
    const role = select.value;
    if (!window.confirm(`Attribuer le rôle « ${statusLabel(role)} » à ${selectedUser.full_name} ? La rétrogradation d’un fermier suspend aussi son profil et ses annonces publiques.`)) {
      await loadUsers();
      return;
    }
    const { error } = await client.rpc("admin_change_user_role", {
      target_user_id: userId,
      new_role: role,
    });
    if (error) {
      throw error;
    }
    await Promise.all([loadUsers(), loadFarmers(), loadDashboard()]);
    reportSuccess(`Rôle de ${selectedUser.full_name} modifié.`);
  }

  async function loadActivity() {
    const rows = await fetchAll((from, to) =>
      client
        .from("activity_logs")
        .select("id,actor_id,action,target_type,target_id,details,created_at,actor:profiles!activity_logs_actor_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    state.exportData.set("activity", rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_name: row.actor?.full_name,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      details: JSON.stringify(row.details),
      created_at: row.created_at,
    })));
    document.querySelector("#admin-activity").innerHTML = rows.length
      ? rows.map((row) => `<article class="admin-record">
          <div class="section-heading"><div><h3>${escapeHtml(row.action)}</h3><p>${escapeHtml(row.actor?.full_name || "Compte supprimé")} · ${escapeHtml(row.target_type)} · ${escapeHtml(row.target_id)}</p></div><span class="muted text-small">${formatDate(row.created_at)}</span></div>
          <pre>${escapeHtml(JSON.stringify(row.details, null, 2))}</pre>
        </article>`).join("")
      : '<p class="empty-state">Le journal ne contient aucune action.</p>';
  }

  async function loadPanel(name) {
    if (name === "overview") {
      await loadDashboard();
    } else if (name === "farmers") {
      await loadFarmers();
    } else if (name === "listings") {
      await loadListings();
    } else if (name === "reviews") {
      await loadReviews();
    } else if (name === "reports") {
      await loadReports();
    } else if (name === "categories") {
      await loadCategories();
    } else if (name === "settings") {
      await loadSettings();
    } else if (name === "admins") {
      await loadUsers();
    } else if (name === "activity") {
      await loadActivity();
    }
  }

  function csvCell(value) {
    let text = String(value ?? "").replace(/[\r\n]+/g, " ");
    if (/^[\s]*[=+\-@]/.test(text)) {
      text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv(name) {
    const rows = state.exportData.get(name) ?? [];
    if (!rows.length) {
      reportSuccess("Aucune donnée à exporter dans cette section.");
      return;
    }
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const csv = [
      columns.map(csvCell).join(";"),
      ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(";")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `faso-elevage-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    reportSuccess("Export CSV téléchargé.");
  }

  function bindEvents() {
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => setTab(button.dataset.adminTab));
    });
    document.querySelectorAll("[data-refresh]").forEach((button) => {
      button.addEventListener("click", () => loadPanel("overview").catch((error) => reportError("Actualisation impossible.", error)));
    });
    document.querySelectorAll("[data-export]").forEach((button) => {
      button.addEventListener("click", () => exportCsv(button.dataset.export));
    });
    document.querySelector("#farmer-search").addEventListener("input", renderFarmers);
    document.querySelector("#listing-search").addEventListener("input", renderListings);
    document.querySelector("#review-search").addEventListener("input", renderReviews);
    document.querySelector("#user-search").addEventListener("input", renderUsers);
    document.querySelector("#category-form").addEventListener("submit", (event) => {
      saveCategory(event).catch((error) => reportError("La catégorie n’a pas été enregistrée.", error));
    });
    document.querySelector("#category-cancel").addEventListener("click", resetCategoryForm);
    document.querySelector("#settings-form").addEventListener("submit", (event) => {
      saveSettings(event).catch((error) => reportError("Les paramètres n’ont pas été enregistrés.", error));
    });
    document.querySelector("#farmer-delete-form").addEventListener("submit", (event) => {
      deleteFarmer(event).catch((error) => reportError("La suppression n’a pas été effectuée.", error));
    });
    document.querySelector("[data-close-delete]").addEventListener("click", () => {
      document.querySelector("#farmer-delete-dialog").close();
      state.deleteFarmer = null;
    });
    document.querySelector("#farmer-delete-dialog").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        event.currentTarget.close();
        state.deleteFarmer = null;
      }
    });
    document.querySelector("#admin-sign-out").addEventListener("click", async () => {
      const { error } = await client.auth.signOut();
      if (error) {
        reportError("La déconnexion n’a pas abouti.", error);
        return;
      }
      window.location.assign("authentification.html");
    });
    document.querySelector("#admin-farmers").addEventListener("click", (event) => {
      const status = event.target.closest("[data-farmer-status]");
      const verified = event.target.closest("[data-farmer-verified]");
      const documents = event.target.closest("[data-farmer-documents]");
      const deletion = event.target.closest("[data-delete-farmer]");
      if (status) {
        updateFarmerStatus(status.dataset.farmerStatus, status.dataset.status)
          .catch((error) => reportError("Le statut du fermier n’a pas été modifié.", error));
      } else if (verified) {
        toggleFarmerVerification(verified.dataset.farmerVerified, verified.dataset.verified === "true")
          .catch((error) => reportError("Le badge n’a pas été modifié.", error));
      } else if (documents) {
        showFarmerDocuments(documents.dataset.farmerDocuments)
          .catch((error) => reportError("Les justificatifs privés n’ont pas pu être ouverts.", error));
      } else if (deletion) {
        openFarmerDeletion(deletion.dataset.deleteFarmer);
      }
    });
    document.querySelector("#admin-listings").addEventListener("click", (event) => {
      const status = event.target.closest("[data-listing-status]");
      const deletion = event.target.closest("[data-delete-listing]");
      const saveNote = event.target.closest("[data-save-listing-note]");
      if (status) {
        moderateListing(status.dataset.listingStatus, status.dataset.status)
          .catch((error) => reportError("Le statut de l’annonce n’a pas été modifié.", error));
      } else if (deletion) {
        deleteListing(deletion.dataset.deleteListing)
          .catch((error) => reportError("L’annonce n’a pas été supprimée.", error));
      } else if (saveNote) {
        saveListingNote(saveNote.dataset.saveListingNote)
          .catch((error) => reportError("La note n’a pas été enregistrée.", error));
      }
    });
    document.querySelector("#admin-reviews").addEventListener("click", (event) => {
      const save = event.target.closest("[data-save-review]");
      const deletion = event.target.closest("[data-delete-review]");
      if (save) {
        const status = document.querySelector(`[data-review-status="${CSS.escape(save.dataset.saveReview)}"]`).value;
        moderateReview(save.dataset.saveReview, status)
          .catch((error) => reportError("L’avis n’a pas été modéré.", error));
      } else if (deletion) {
        deleteReview(deletion.dataset.deleteReview)
          .catch((error) => reportError("L’avis n’a pas été supprimé.", error));
      }
    });
    document.querySelector("#admin-reports").addEventListener("click", (event) => {
      const save = event.target.closest("[data-save-report]");
      if (save) {
        moderateReport(save.dataset.saveReport)
          .catch((error) => reportError("Le signalement n’a pas été traité.", error));
      }
    });
    document.querySelector("#admin-categories").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-category]");
      const toggle = event.target.closest("[data-toggle-category]");
      const deletion = event.target.closest("[data-delete-category]");
      if (edit) {
        const category = state.categories.find((item) => item.id === edit.dataset.editCategory);
        if (!category) {
          return;
        }
        const form = document.querySelector("#category-form");
        form.elements.namedItem("id").value = category.id;
        form.elements.namedItem("name").value = category.name;
        form.elements.namedItem("slug").value = category.slug;
        form.elements.namedItem("description").value = category.description ?? "";
        form.elements.namedItem("is_active").checked = category.is_active;
        document.querySelector("#category-form-title").textContent = "Modifier une catégorie";
        document.querySelector("#category-cancel").hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (toggle) {
        toggleCategory(toggle.dataset.toggleCategory, toggle.dataset.active === "true")
          .catch((error) => reportError("La visibilité de la catégorie n’a pas changé.", error));
      } else if (deletion) {
        deleteCategory(deletion.dataset.deleteCategory)
          .catch((error) => reportError("La catégorie n’a pas été supprimée.", error));
      }
    });
    document.querySelector("#admin-users").addEventListener("click", (event) => {
      const save = event.target.closest("[data-save-role]");
      if (save) {
        saveRole(save.dataset.saveRole)
          .catch((error) => reportError("Le rôle n’a pas été modifié.", error));
      }
    });
  }

  function renderEnrollment(data) {
    const qrCode = data?.totp?.qr_code;
    const secret = data?.totp?.secret;
    if (!qrCode || !secret || !data.id) {
      throw new Error("Supabase n’a pas fourni les informations de configuration TOTP attendues.");
    }
    state.factorId = data.id;
    state.enrollmentPending = true;
    document.querySelector("#admin-mfa-title").textContent = "Configurez votre double authentification";
    document.querySelector("#admin-mfa-setup").hidden = false;
    const image = document.querySelector("#admin-mfa-qr");
    image.src = qrCode.startsWith("data:image/")
      ? qrCode
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
    document.querySelector("#admin-mfa-secret").value = secret;
    document.querySelector("#admin-mfa-submit").textContent = "Activer la double authentification";
  }

  async function prepareMfa() {
    const { data: assurance, error: assuranceError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      throw assuranceError;
    }
    if (assurance.currentLevel === "aal2") {
      await enterAdminConsole();
      return;
    }

    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    if (factorsError) {
      throw factorsError;
    }
    const verifiedFactor = (factors.totp ?? []).find((factor) => factor.status === "verified");
    if (verifiedFactor) {
      state.factorId = verifiedFactor.id;
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      if (challengeError) {
        throw challengeError;
      }
      state.challengeId = challenge.id;
      document.querySelector("#admin-mfa-title").textContent = "Vérifiez votre identité";
      document.querySelector("#admin-mfa-submit").textContent = "Vérifier le code";
    } else {
      const pendingFactors = (factors.all ?? []).filter((factor) => factor.status === "unverified");
      for (const factor of pendingFactors) {
        const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
        if (error) {
          throw error;
        }
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Administration Faso Élevage",
      });
      if (error) {
        throw error;
      }
      renderEnrollment(data);
    }
    document.querySelector("#admin-mfa").hidden = false;
  }

  async function verifyMfa(event) {
    event.preventDefault();
    const code = document.querySelector("#admin-mfa-code").value.trim();
    if (!/^\d{6}$/.test(code) || !state.factorId) {
      setMfaMessage("Saisissez le code à six chiffres de votre application.", true);
      return;
    }
    try {
      const { data: challenge, error: challengeError } = state.challengeId
        ? { data: { id: state.challengeId }, error: null }
        : await client.auth.mfa.challenge({ factorId: state.factorId });
      if (challengeError) {
        throw challengeError;
      }
      const { error } = await client.auth.mfa.verify({
        factorId: state.factorId,
        challengeId: challenge.id,
        code,
      });
      if (error) {
        throw error;
      }
      const { data: assurance, error: assuranceError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) {
        throw assuranceError;
      }
      if (assurance.currentLevel !== "aal2") {
        throw new Error("La session n’a pas atteint le niveau AAL2. Vérifiez le code puis réessayez.");
      }
      document.querySelector("#admin-mfa").hidden = true;
      await enterAdminConsole();
    } catch (error) {
      state.challengeId = null;
      setMfaMessage(`La vérification MFA a échoué : ${error.message || "code invalide"}.`, true);
    }
  }

  async function enterAdminConsole() {
    document.querySelector("#admin-console").hidden = false;
    document.querySelector("#admin-account-label").textContent =
      `Connecté : ${state.user.email || state.user.id}`;
    bindEvents();
    setTab("overview");
  }

  async function initialize() {
    if (!configured || !client) {
      document.querySelector("#admin-sign-in").hidden = false;
      reportError("L’accès admin nécessite une configuration Supabase. Aucun formulaire de gestion ne peut être utilisé en mode démonstration.", new Error("URL/clé publishable manquante ou SDK indisponible."));
      return;
    }
    const { data, error } = await client.auth.getUser();
    if (error) {
      throw error;
    }
    state.user = data.user;
    if (!state.user) {
      document.querySelector("#admin-sign-in").hidden = false;
      return;
    }
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", state.user.id)
      .single();
    if (profileError) {
      throw profileError;
    }
    if (profile.role !== "admin") {
      document.querySelector("#admin-denied").hidden = false;
      return;
    }
    document.querySelector("#admin-mfa-form").addEventListener("submit", verifyMfa);
    await prepareMfa();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initialize().catch((error) => {
      reportError("L’espace administration n’a pas pu être initialisé.", error);
      document.querySelector("#admin-sign-in").hidden = false;
    });
  }, { once: true });
})();
