(() => {
  const base = document.body.dataset.siteBase ?? "";
  const path = (value) => `${base}${value}`;
  const currentPage = document.body.dataset.page ?? "";
  const optionsAvailable = !["farmer-dashboard", "admin"].includes(currentPage);
  const translate = (key) => window.FasoMarketI18n?.translate(key) ?? key;
  const localeOptions = Object.entries(window.FasoMarketI18n?.locales ?? {})
    .map(([code, locale]) =>
      `<option value="${code}"${locale.ready ? "" : " disabled"}>${locale.label}${locale.ready ? "" : " · traduction à venir"}</option>`,
    )
    .join("");
  const modeStorageKey = "fasoMarketDisplayMode.v1";
  let savedMode = "";
  try {
    savedMode = window.localStorage.getItem(modeStorageKey) ?? "";
  } catch (error) {
    console.warn("La préférence d’affichage ne peut pas être lue :", error);
  }
  const lightMode = savedMode
    ? savedMode === "light"
    : Boolean(navigator.connection?.saveData);
  document.body.classList.toggle("is-light-mode", lightMode);

  const header = document.querySelector("#site-header");
  if (header) {
    header.innerHTML = `
      <div id="site-announcement" class="announcement">Fiers de nos élevages · Consommons local au Burkina Faso</div>
      <header class="site-header">
        <div class="container header-main">
          <a class="brand" href="${path("index.html")}" aria-label="Faso Élevage, accueil">
            <img class="brand-mark" src="${path("icons/mark.svg")}" alt="">
            <span class="brand-name"><span>Faso</span> <span class="brand-name-accent">Élevage</span> <span class="muted text-small">(provisoire)</span></span>
          </a>
          <div class="header-actions">
            ${["farmer-dashboard", "admin"].includes(currentPage) ? "" : `<button class="icon-button" type="button" data-open-cart aria-label="Ouvrir le panier">
              <span class="cart-label">Panier</span> <span class="cart-count" data-cart-count>0</span>
            </button>`}
            <button class="icon-button menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="primary-nav" aria-label="Ouvrir le menu">☰</button>
          </div>
        </div>
        <div class="header-bottom">
          <nav id="primary-nav" class="site-nav container" aria-label="Navigation principale">
            <a href="${path("index.html")}" ${currentPage === "home" ? 'aria-current="page"' : ""}>Accueil</a>
            <a href="${path("pages/catalogue.html")}" ${currentPage === "catalogue" ? 'aria-current="page"' : ""}>Catalogue</a>
            <a href="${path("pages/marketplace.html")}" ${currentPage === "marketplace" ? 'aria-current="page"' : ""}>Marketplace fermiers</a>
            <a href="${path("pages/informations/a-propos.html")}">Notre démarche</a>
            <a href="${path("pages/informations/conseils.html")}">Conseils d’achat</a>
            <a href="${path("pages/authentification.html")}">Espace fermier</a>
          </nav>
          ${optionsAvailable ? `<div class="site-options container">
            <button class="icon-button" type="button" data-light-mode-toggle aria-pressed="${lightMode}">${translate(lightMode ? "standardMode" : "lightMode")}</button>
            <button class="icon-button" type="button" data-install-pwa>${translate("install")}</button>
            <label class="sr-only" for="site-language">${translate("language")}</label>
            <select id="site-language" class="site-language" aria-label="${translate("language")}">
              ${localeOptions}
            </select>
            <span class="site-options-status" data-pwa-status role="status" aria-live="polite" hidden></span>
          </div>` : ""}
        </div>
      </header>`;
  }

  const footer = document.querySelector("#site-footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <a class="brand" href="${path("index.html")}">
              <img class="brand-mark" src="${path("icons/mark.svg")}" alt="">
              <span class="brand-name"><span>Faso</span> <span class="brand-name-accent">Élevage</span></span>
            </a>
            <p id="footer-slogan" class="footer-muted" style="margin-top: 1rem">Du terroir burkinabè à votre table.<br>Ensemble, consommons local.</p>
            <span class="badge badge--gold">★ Made in Burkina</span>
          </div>
          <div>
            <strong>Explorer</strong>
            <nav class="footer-links" aria-label="Explorer le site" style="margin-top: .75rem">
              <a href="${path("pages/catalogue.html")}">Nos élevages</a>
              <a href="${path("pages/informations/a-propos.html")}">À propos</a>
              <a href="${path("pages/informations/conseils.html")}">Conseils d’achat</a>
              <a href="${path("pages/authentification.html")}">Espace fermier</a>
            </nav>
          </div>
          <div>
            <strong>Informations</strong>
            <nav class="footer-links" aria-label="Informations" style="margin-top: .75rem">
              <a href="${path("pages/informations/contact.html")}">Contact</a>
              <a href="${path("pages/informations/faq.html")}">Questions fréquentes</a>
              <a href="${path("pages/informations/conditions.html")}">Conditions d’utilisation</a>
              <a href="${path("pages/informations/confidentialite.html")}">Confidentialité</a>
            </nav>
          </div>
          <div>
            <strong>Nous joindre</strong>
            <nav class="footer-links" aria-label="Contacts" style="margin-top: .75rem">
              <a id="footer-support-whatsapp" hidden target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">WhatsApp assistance</a>
              <a id="footer-support-email" hidden></a>
              <a id="footer-support-phone" hidden></a>
              <span id="footer-support-address" class="footer-muted"></span>
            </nav>
            <nav id="footer-social-links" class="footer-links" aria-label="Réseaux sociaux" style="margin-top: .75rem" hidden></nav>
          </div>
        </div>
        <div class="container footer-muted" style="margin-top: 2rem">
          © <span data-current-year></span> <span id="footer-brand-copy">Faso Élevage · Nom provisoire</span> · Les commandes sont convenues directement avec les fermiers.
        </div>
      </footer>`;
    footer.querySelector("[data-current-year]").textContent = String(new Date().getFullYear());
  }

  if (!["farmer-dashboard", "admin"].includes(currentPage) && !document.querySelector("#cart-dialog")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<dialog id="cart-dialog" class="cart-dialog" aria-labelledby="cart-title">
        <div class="cart-dialog-inner">
          <div class="cart-header">
            <div>
              <p class="eyebrow">Contact direct avec le fermier</p>
              <h2 id="cart-title">Votre panier</h2>
            </div>
            <button class="icon-button" type="button" data-close-cart aria-label="Fermer le panier">✕</button>
          </div>
          <p id="cart-farmer" class="muted text-small"></p>
          <div id="cart-notice" class="notice" role="status" aria-live="polite" hidden></div>
          <div id="cart-items" class="cart-items"></div>
          <p id="cart-empty" class="empty-state">Votre panier est vide. Choisissez une offre pour commencer.</p>
          <div id="cart-checkout" hidden>
            <div class="cart-total"><span>Total indicatif</span><span id="cart-total-value">0 FCFA</span></div>
            <p class="muted text-small">Le total est indicatif : le stock, le prix final, le retrait et la livraison seront confirmés directement avec le fermier sur WhatsApp.</p>
            <form id="checkout-form" class="cart-form" method="post">
              <div class="cart-form-grid">
                <div class="field">
                  <label for="buyer-name">Votre nom</label>
                  <input id="buyer-name" name="name" autocomplete="name" maxlength="120" required>
                </div>
                <div class="field">
                  <label for="buyer-phone">Votre téléphone</label>
                  <input id="buyer-phone" name="phone" type="tel" autocomplete="tel" maxlength="32" required>
                </div>
                <div class="field">
                  <label for="buyer-city">Votre ville</label>
                  <input id="buyer-city" name="city" autocomplete="address-level2" maxlength="100" required>
                </div>
              </div>
              <button id="checkout-button" class="button button--full" type="submit">Continuer sur WhatsApp</button>
            </form>
          </div>
        </div>
      </dialog>`,
    );
  }

  const menuToggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("#primary-nav");
  menuToggle?.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    menuToggle.setAttribute("aria-label", expanded ? "Ouvrir le menu" : "Fermer le menu");
    nav.classList.toggle("is-open", !expanded);
  });

  const lightModeToggle = document.querySelector("[data-light-mode-toggle]");
  lightModeToggle?.addEventListener("click", () => {
    const enabled = document.body.classList.toggle("is-light-mode");
    lightModeToggle.setAttribute("aria-pressed", String(enabled));
    lightModeToggle.textContent = translate(enabled ? "standardMode" : "lightMode");
    try {
      window.localStorage.setItem(modeStorageKey, enabled ? "light" : "standard");
    } catch (error) {
      console.warn("La préférence d’affichage ne peut pas être mémorisée :", error);
    }
    document.dispatchEvent(
      new CustomEvent("fasomarket:display-mode-change", { detail: { lightMode: enabled } }),
    );
  });

  const installButton = document.querySelector("[data-install-pwa]");
  const pwaStatus = document.querySelector("[data-pwa-status]");
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) {
      installButton.hidden = false;
    }
  });
  installButton?.addEventListener("click", async () => {
    if (!installPrompt) {
      if (pwaStatus) {
        pwaStatus.textContent = "Utilisez le menu de votre navigateur pour ajouter ce site à l’écran d’accueil.";
        pwaStatus.hidden = false;
      }
      return;
    }
    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
      if (pwaStatus) {
        pwaStatus.textContent = choice.outcome === "accepted"
          ? "Application ajoutée à l’écran d’accueil."
          : "Installation non confirmée.";
        pwaStatus.hidden = false;
      }
    } catch (error) {
      console.error("L’installation de la PWA a échoué :", error);
      if (pwaStatus) {
        pwaStatus.textContent = "L’installation n’a pas abouti. Utilisez le menu de votre navigateur et réessayez.";
        pwaStatus.hidden = false;
      }
    }
  });
  window.addEventListener("appinstalled", () => {
    if (installButton) {
      installButton.hidden = true;
    }
    installPrompt = null;
  });

  if ("serviceWorker" in navigator) {
    const appBase = new URL(base || "./", window.location.href);
    navigator.serviceWorker
      .register(new URL("sw.js", appBase), { scope: appBase.pathname })
      .catch((error) => {
        console.error("Le mode hors connexion n’a pas pu être activé :", error);
        if (pwaStatus) {
          pwaStatus.textContent = "Le mode hors connexion n’a pas pu être activé sur cet hébergement.";
          pwaStatus.hidden = false;
        }
      });
  } else if (pwaStatus) {
    pwaStatus.textContent = "Le mode hors connexion nécessite un navigateur récent et un site en HTTPS.";
    pwaStatus.hidden = false;
  }

  window.FasoMarketShell = Object.freeze({
    applyPublicSettings(settings) {
      if (!settings || typeof settings !== "object") {
        return;
      }
      const content = settings.site_content ?? {};
      const brandName = typeof content.brand_name === "string" ? content.brand_name.trim() : "";
      if (brandName) {
        document.querySelectorAll(".brand-name").forEach((element) => {
          element.textContent = brandName;
        });
        const provisionalMark = document.querySelector(".brand-name .muted");
        if (provisionalMark) {
          provisionalMark.remove();
        }
        const footerBrand = document.querySelector("#footer-brand-copy");
        if (footerBrand) {
          footerBrand.textContent = content.brand_name_is_provisional === false
            ? brandName
            : `${brandName} · Nom provisoire`;
        }
      }
      const slogan = typeof content.home_slogan === "string" ? content.home_slogan.trim() : "";
      const intro = typeof content.home_intro === "string" ? content.home_intro.trim() : "";
      const heroTitle = document.querySelector("[data-home-slogan]");
      const heroIntro = document.querySelector("[data-home-intro]");
      if (heroTitle && slogan) {
        heroTitle.textContent = slogan;
        document.title = `${brandName || "Faso Élevage"} — ${slogan}`;
      }
      if (heroIntro && intro) {
        heroIntro.textContent = intro;
      }
      const footerSlogan = document.querySelector("#footer-slogan");
      if (footerSlogan && slogan) {
        footerSlogan.textContent = slogan;
      }
      const announcement = document.querySelector("#site-announcement");
      if (announcement && slogan) {
        announcement.textContent = slogan;
      }
      const bannerUrl = typeof content.banner_image_url === "string" ? content.banner_image_url.trim() : "";
      if (bannerUrl) {
        try {
          const parsedBanner = new URL(bannerUrl);
          if (parsedBanner.protocol === "https:") {
            document.querySelector(".hero-home")?.style.setProperty(
              "background-image",
              `linear-gradient(90deg, rgb(252 250 246 / 92%), rgb(252 250 246 / 56%)), url("${parsedBanner.href.replace(/[")\\\n\r]/g, encodeURIComponent)}")`,
            );
          }
        } catch {
          // Invalid administrator-supplied image URLs are ignored.
        }
      }

      const contact = settings.contact ?? {};
      const whatsappNumber = String(settings.public_whatsapp?.number ?? "").replace(/\D/g, "");
      const whatsappLink = document.querySelector("#footer-support-whatsapp");
      if (whatsappLink && /^226\d{8}$/.test(whatsappNumber)) {
        whatsappLink.href = `https://wa.me/${whatsappNumber}`;
        whatsappLink.hidden = false;
      }
      const emailLink = document.querySelector("#footer-support-email");
      if (emailLink && typeof contact.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
        emailLink.href = `mailto:${contact.email}`;
        emailLink.textContent = contact.email;
        emailLink.hidden = false;
      }
      const phoneLink = document.querySelector("#footer-support-phone");
      const phoneNumber = typeof contact.phone === "string" ? contact.phone.trim() : "";
      if (phoneLink && /^[+\d][\d\s()-]{6,30}$/.test(phoneNumber)) {
        phoneLink.href = `tel:${phoneNumber.replace(/[^\d+]/g, "")}`;
        phoneLink.textContent = phoneNumber;
        phoneLink.hidden = false;
      }
      const address = document.querySelector("#footer-support-address");
      if (address && typeof contact.address === "string") {
        address.textContent = contact.address;
      }
      const socialTarget = document.querySelector("#footer-social-links");
      const socialLinks = settings.social_links ?? {};
      if (socialTarget) {
        socialTarget.replaceChildren();
        for (const [platform, url] of Object.entries(socialLinks)) {
          if (typeof url !== "string" || !url.trim()) {
            continue;
          }
          try {
            if (new URL(url).protocol !== "https:") {
              continue;
            }
          } catch {
            continue;
          }
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.referrerPolicy = "no-referrer";
          link.textContent = platform;
          socialTarget.append(link);
        }
        socialTarget.hidden = socialTarget.childElementCount === 0;
      }
    },
  });
})();
