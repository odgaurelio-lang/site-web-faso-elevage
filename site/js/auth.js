(() => {
  const status = document.querySelector("#auth-status");
  const accountPanel = document.querySelector("#account-panel");
  const authForms = document.querySelector("#auth-forms");
  const viewControls = [...document.querySelectorAll("[data-auth-view]")];
  const viewTabs = [...document.querySelectorAll(".auth-switcher [data-auth-view]")];
  const views = [...document.querySelectorAll("[data-auth-panel]")];
  const config = window.APP_CONFIG;
  let isPasswordReset = new URLSearchParams(window.location.search).has("password-reset");
  let configurationIssue = false;

  function showMessage(message, kind = "info") {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
  }

  function clearMessage() {
    status.textContent = "";
    status.hidden = true;
    delete status.dataset.kind;
  }

  function setView(viewName) {
    if (!configurationIssue) {
      clearMessage();
    }
    for (const panel of views) {
      panel.hidden = panel.dataset.authPanel !== viewName;
    }
    for (const button of viewTabs) {
      const selected = button.dataset.authView === viewName;
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  for (const button of viewControls) {
    button.addEventListener("click", () => setView(button.dataset.authView));
  }

  if (isPasswordReset) {
    setView("new-password");
  }

  function disableAuthForms() {
    for (const fieldset of document.querySelectorAll("form[data-auth-action] fieldset")) {
      fieldset.disabled = true;
    }
  }

  function describeError(error) {
    if (error?.message) {
      return error.message;
    }
    return "Une erreur inattendue est survenue. Réessayez.";
  }

  if (
    !config ||
    typeof config.supabaseUrl !== "string" ||
    typeof config.supabasePublishableKey !== "string" ||
    !config.supabaseUrl.trim() ||
    !config.supabasePublishableKey.trim()
  ) {
    disableAuthForms();
    configurationIssue = true;
    showMessage(
      "Ajoutez l’URL Supabase et la clé publishable dans site/js/supabase-config.js pour activer l’authentification.",
      "error",
    );
    return;
  }

  if (!window.supabase?.createClient) {
    disableAuthForms();
    configurationIssue = true;
    showMessage(
      "La bibliothèque Supabase n’a pas pu être chargée. Vérifiez votre connexion puis rechargez la page.",
      "error",
    );
    return;
  }

  let client;
  try {
    client = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
      {
        auth: {
          flowType: "pkce",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    );
  } catch (error) {
    disableAuthForms();
    configurationIssue = true;
    showMessage(`Configuration Supabase invalide : ${describeError(error)}`, "error");
    return;
  }

  for (const fieldset of document.querySelectorAll("form[data-auth-action] fieldset")) {
    fieldset.disabled = false;
  }

  function validatePassword(password) {
    return password.length >= 12;
  }

  async function loadAccount() {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError) {
      throw userError;
    }
    if (!user) {
      accountPanel.hidden = true;
      authForms.hidden = false;
      document.querySelector("#farmer-dashboard-link").hidden = true;
      document.querySelector("#admin-dashboard-link").hidden = true;
      return;
    }

    accountPanel.hidden = false;
    authForms.hidden = true;
    const farmerDashboardLink = document.querySelector("#farmer-dashboard-link");
    const adminDashboardLink = document.querySelector("#admin-dashboard-link");
    farmerDashboardLink.hidden = true;
    adminDashboardLink.hidden = true;
    document.querySelector("#account-name").textContent = user.email ?? "Compte connecté";
    document.querySelector("#account-role").textContent = "Chargement…";
    document.querySelector("#account-farm").textContent = "";
    document.querySelector("#account-state").textContent = "Chargement du profil…";

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    let farmerStatus = null;
    if (profile.role === "farmer") {
      const { data: farmer, error: farmerError } = await client
        .from("farmer_profiles")
        .select("farm_name, status")
        .eq("id", user.id)
        .maybeSingle();

      if (farmerError) {
        throw farmerError;
      }
      farmerStatus = farmer?.status ?? "profil incomplet";
      document.querySelector("#account-farm").textContent =
        farmer?.farm_name ?? "Ferme non configurée";
    } else {
      document.querySelector("#account-farm").textContent = "";
    }

    document.querySelector("#account-name").textContent = profile.full_name;
    document.querySelector("#account-role").textContent =
      profile.role === "admin"
        ? "Administrateur"
        : profile.role === "moderator"
          ? "Modérateur"
          : "Fermier";
    farmerDashboardLink.hidden = profile.role !== "farmer";
    adminDashboardLink.hidden = profile.role !== "admin";
    document.querySelector("#account-state").textContent =
      farmerStatus === "approved"
        ? "Profil validé"
        : farmerStatus
          ? `Compte ${farmerStatus} — les annonces restent indisponibles jusqu’à validation.`
          : "Compte connecté.";

  }

  document.querySelector("#sign-in-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const { error } = await client.auth.signInWithPassword({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
      });
      if (error) {
        throw error;
      }
      await loadAccount();
      form.reset();
      showMessage("Connexion réussie.", "success");
    } catch (error) {
      showMessage(describeError(error), "error");
    }
  });

  document.querySelector("#sign-up-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    const passwordConfirmation = String(data.get("password_confirmation"));

    if (!validatePassword(password)) {
      showMessage("Choisissez un mot de passe d’au moins 12 caractères.", "error");
      return;
    }
    if (password !== passwordConfirmation) {
      showMessage("Les deux mots de passe ne correspondent pas.", "error");
      return;
    }

    const metadata = {
      account_type: "farmer",
      full_name: String(data.get("full_name")).trim(),
      phone: String(data.get("phone")).trim(),
      farm_name: String(data.get("farm_name")).trim(),
      whatsapp_phone: String(data.get("whatsapp_phone")).trim(),
      city: String(data.get("city")).trim(),
      commune: String(data.get("commune")).trim(),
      bio: String(data.get("bio")).trim(),
    };

    try {
      const { data: result, error } = await client.auth.signUp({
        email: String(data.get("email")).trim(),
        password,
        options: { data: metadata },
      });
      if (error) {
        throw error;
      }
      form.reset();
      if (result.session) {
        await loadAccount();
      }
      showMessage(
        "Inscription reçue. Confirmez votre adresse e-mail si demandé ; votre profil fermier restera en attente de validation.",
        "success",
      );
    } catch (error) {
      showMessage(describeError(error), "error");
    }
  });

  document.querySelector("#reset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    const form = event.currentTarget;
    const data = new FormData(form);
    const redirectTo = new URL(window.location.pathname, window.location.origin);
    redirectTo.searchParams.set("password-reset", "1");

    try {
      const { error } = await client.auth.resetPasswordForEmail(
        String(data.get("email")).trim(),
        { redirectTo: redirectTo.toString() },
      );
      if (error) {
        throw error;
      }
      form.reset();
      showMessage(
        "Si cette adresse possède un compte, un e-mail de réinitialisation lui sera envoyé.",
        "success",
      );
    } catch (error) {
      showMessage(describeError(error), "error");
    }
  });

  document.querySelector("#new-password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));

    if (!validatePassword(password)) {
      showMessage("Choisissez un mot de passe d’au moins 12 caractères.", "error");
      return;
    }
    if (password !== String(data.get("password_confirmation"))) {
      showMessage("Les deux mots de passe ne correspondent pas.", "error");
      return;
    }

    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        throw error;
      }
      form.reset();
      isPasswordReset = false;
      window.history.replaceState({}, "", window.location.pathname);
      showMessage("Votre mot de passe a été modifié.", "success");
      await loadAccount();
    } catch (error) {
      showMessage(describeError(error), "error");
    }
  });

  document.querySelector("#sign-out-button").addEventListener("click", async () => {
    clearMessage();
    try {
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
      await loadAccount();
      showMessage("Vous êtes déconnecté.", "success");
    } catch (error) {
      showMessage(describeError(error), "error");
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    if (isPasswordReset) {
      accountPanel.hidden = true;
      authForms.hidden = false;
      return;
    }
    if (session) {
      window.setTimeout(
        () => loadAccount().catch((error) => showMessage(describeError(error), "error")),
        0,
      );
    } else {
      accountPanel.hidden = true;
      authForms.hidden = false;
      document.querySelector("#farmer-dashboard-link").hidden = true;
      document.querySelector("#admin-dashboard-link").hidden = true;
    }
  });

  if (!isPasswordReset) {
    loadAccount().catch((error) => showMessage(describeError(error), "error"));
  }

})();
