(() => {
  const defaultLocale = "fr";
  const locales = Object.freeze({
    fr: Object.freeze({
      label: "Français",
      ready: true,
      install: "Installer l’application",
      lightMode: "Mode léger",
      standardMode: "Mode standard",
      language: "Langue",
    }),
    mos: Object.freeze({ label: "Mooré", ready: false }),
    dyu: Object.freeze({ label: "Dioula", ready: false }),
    ff: Object.freeze({ label: "Fulfuldé", ready: false }),
  });

  function translate(key, locale = defaultLocale) {
    return locales[locale]?.[key] ?? locales[defaultLocale][key] ?? key;
  }

  window.FasoMarketI18n = Object.freeze({
    defaultLocale,
    locales,
    translate,
  });
})();
