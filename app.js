/**
 * app.js — Cotizador Eje Cafetero · VERSIÓN 2
 *
 * Se monta dentro de:  <div id="eje-cafetero-cotizador-v2"></div>
 * (más los scripts de config.js, data.js y este archivo).
 *
 * Mismo motor de negocio que la v1 (tarifas, reglas de niño/infante,
 * descriptivo por salida, envío de prereserva a Supabase) — lo que cambia
 * es la interacción: carrusel de fechas en vez de <select>, y un layout de
 * resultado en dos columnas con el precio "sticky" al lado del descriptivo.
 */

(function () {
  "use strict";

  const MOUNT_ID = "eje-cafetero-cotizador-v2";
  const LIMITS = { adults: { min: 1, max: 9 }, kids: { min: 0, max: 8 }, infants: { min: 0, max: 4 } };
  const CATEGORY_BY_COUNT = { 1: "sencilla", 2: "doble", 3: "triple", 4: "cuadruple", 5: "quintuple" };
  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

  const money = (n) =>
    n == null ? "N/A" : n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  const state = {
    tiers: {},
    departures: [],
    selectedDeparture: null,
    adults: 2,
    kids: 0,
    infants: 0,
    lastQuote: null,
    supabase: null,
  };

  function minPriceForTier(tier) {
    if (!tier) return null;
    const candidates = [tier.doble, tier.triple, tier.cuadruple, tier.quintuple].filter((v) => v != null);
    return candidates.length ? Math.min(...candidates) : tier.sencilla;
  }

  function formatBadge(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return { month: MESES[m - 1], day: String(d).padStart(2, "0") };
  }

  // ---------------------------------------------------------------------
  // Markup
  // ---------------------------------------------------------------------
  function buildMarkup() {
    return `
      <div class="cw2-head">
        <p class="cw2-eyebrow">Cotizador</p>
        <h2 class="cw2-title">Arma tu viaje al Eje Cafetero</h2>
      </div>

      <div class="cw2-section">
        <span class="cw2-section__label">1. Elige tu fecha de salida</span>
        <div class="cw2-date-carousel" id="cw2-date-carousel" role="radiogroup" aria-label="Fecha de salida"></div>
        <p class="cw2-departure-nota" id="cw2-departure-nota"></p>
      </div>

      <div class="cw2-section">
        <span class="cw2-section__label">2. Pasajeros</span>
        <div class="cw2-pax-row">
          ${paxItem("adults", "Adultos", "")}
          ${paxItem("kids", "Niños", "3 a 10 años")}
          ${paxItem("infants", "Infantes", "0 a 2 años")}
        </div>
        <p class="cw2-hint">La tarifa de niño o infante solo aplica si viajan acompañados de mínimo dos adultos en la misma habitación.</p>
      </div>

      <button type="button" class="cw2-cta" id="cw2-submit" disabled>Cotizar</button>

      <!-- Solo aparece DESPUÉS de cotizar -->
      <div class="cw2-result" id="cw2-result" hidden>
        <div class="cw2-details" id="cw2-details"></div>
        <div class="cw2-price" id="cw2-price"></div>
      </div>

      <div class="cw2-panel" id="cw2-contact-panel" hidden>
        <h3>Tus datos de contacto</h3>
        <p class="cw2-panel__subtitle">Con esto generamos tu prereserva; el equipo confirma disponibilidad y te escribe con los medios de pago.</p>
        <form id="cw2-contact-form" novalidate>
          <div class="cw2-field">
            <label for="cw2-full_name">Nombre completo *</label>
            <input type="text" id="cw2-full_name" required autocomplete="name" />
          </div>
          <div class="cw2-field">
            <label for="cw2-document_id">Documento de identidad *</label>
            <input type="text" id="cw2-document_id" required />
          </div>
          <div class="cw2-field-row">
            <div class="cw2-field">
              <label for="cw2-email">Correo electrónico *</label>
              <input type="email" id="cw2-email" required autocomplete="email" />
            </div>
            <div class="cw2-field">
              <label for="cw2-phone">Celular / WhatsApp *</label>
              <input type="tel" id="cw2-phone" required autocomplete="tel" />
            </div>
          </div>
          <div class="cw2-field">
            <label for="cw2-emergency_contact">Contacto de emergencia (nombre y teléfono) *</label>
            <input type="text" id="cw2-emergency_contact" required />
          </div>
          <div class="cw2-field">
            <label for="cw2-special_requests">Solicitudes especiales (dieta, movilidad, medicamentos…)</label>
            <textarea id="cw2-special_requests" rows="2"></textarea>
          </div>
          <label class="cw2-checkbox-line">
            <input type="checkbox" id="cw2-accept_policy" required />
            Acepto las políticas de reservas, pagos y cancelaciones.
          </label>
          <div class="cw2-panel__actions">
            <button type="button" class="cw2-cta cw2-cta--ghost" id="cw2-back">Volver</button>
            <button type="submit" class="cw2-cta" id="cw2-submit-contact">Enviar prereserva</button>
          </div>
          <p class="cw2-form-error" id="cw2-form-error" role="alert"></p>
        </form>
      </div>

      <div class="cw2-panel cw2-panel--done" id="cw2-done-panel" hidden>
        <div class="cw2-done-ring"></div>
        <h3>¡Tu prereserva fue generada!</h3>
        <p>Te enviamos un correo con el resumen. En cuanto confirmemos disponibilidad con el operador, te llegará otro correo con los medios de pago.</p>
        <span class="cw2-done-ref">N.º <strong id="cw2-done-ref-code">—</strong></span>
        <div style="margin-top:20px">
          <button type="button" class="cw2-cta cw2-cta--ghost" id="cw2-new-quote">Hacer otra cotización</button>
        </div>
      </div>
    `;
  }

  function paxItem(key, label, caption) {
    return `
      <div>
        <span class="cw2-pax-item__label">${label}</span>
        <span class="cw2-pax-item__caption">${caption || "&nbsp;"}</span>
        <div class="cw2-counter">
          <button type="button" class="cw2-counter__btn" data-target="${key}" data-delta="-1" aria-label="Menos ${label.toLowerCase()}">−</button>
          <span class="cw2-counter__value" id="cw2-${key}-value">${state[key]}</span>
          <button type="button" class="cw2-counter__btn" data-target="${key}" data-delta="1" aria-label="Más ${label.toLowerCase()}">+</button>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------
  // Datos: Supabase si está configurado, si no, data.js local
  // ---------------------------------------------------------------------
  async function loadData() {
    const cfg = window.APP_CONFIG || {};
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
      try {
        state.supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        const { data: tiersRows, error: tiersErr } = await state.supabase.from("pricing_tiers").select("*");
        if (tiersErr) throw tiersErr;
        const { data: depRows, error: depErr } = await state.supabase
          .from("departures").select("*").eq("active", true).order("salida", { ascending: true });
        if (depErr) throw depErr;
        state.tiers = Object.fromEntries(tiersRows.map((t) => [t.id, t]));
        state.departures = depRows;
        return;
      } catch (err) {
        console.warn("No se pudo cargar Supabase, usando datos locales de respaldo.", err);
      }
    }
    state.tiers = window.PRICING_TIERS;
    state.departures = window.DEPARTURES.slice().sort((a, b) => a.salida.localeCompare(b.salida));
  }

  function renderDateCarousel(root) {
    const carousel = root.querySelector("#cw2-date-carousel");
    carousel.innerHTML = state.departures.map((dep, i) => {
      const tier = state.tiers[dep.tier];
      const badge = formatBadge(dep.salida);
      return `
        <label class="cw2-date-card">
          <input type="radio" name="cw2-departure" value="${dep.id}" />
          <span class="cw2-date-card__badge">
            <span class="cw2-date-card__month">${badge.month}</span>
            <span class="cw2-date-card__day">${badge.day}</span>
          </span>
          <span class="cw2-date-card__label">${dep.etiqueta}</span>
          <span class="cw2-date-card__price">${money(minPriceForTier(tier))}<span>desde · ${tier ? tier.noches : "?"} noches</span></span>
        </label>`;
    }).join("");
  }

  // ---------------------------------------------------------------------
  // Cálculo de tarifa (idéntico a la v1 — mismas reglas del PDF)
  // ---------------------------------------------------------------------
  function calculateQuote(tier, adults, kids, infants) {
    if (!tier) return null;
    const kidsCountAsKids = adults >= 2 ? kids : 0;
    const kidsCountAsAdults = adults >= 2 ? 0 : kids;

    let payingCount = Math.max(1, Math.min(5, adults + kids));
    const category = CATEGORY_BY_COUNT[payingCount];
    let adultUnit = tier[category];

    let overrideNote = "";
    if (adults === 1 && kids === 0 && infants > 0) {
      adultUnit = tier.sencilla;
      overrideNote = "acomodación sencilla (1 adulto + infante)";
    }

    if (adultUnit == null) {
      return { error: `No hay tarifa "${category}" disponible para esta salida. Escríbenos por WhatsApp para armar la acomodación.` };
    }

    const kidUnit = tier.nino;
    const infantUnit = tier.infante;
    const total =
      adults * adultUnit +
      kidsCountAsKids * kidUnit +
      kidsCountAsAdults * adultUnit +
      infants * infantUnit;

    const lines = [];
    lines.push(`${adults} adulto${adults !== 1 ? "s" : ""} × ${money(adultUnit)}${overrideNote ? " · " + overrideNote : " · " + category}`);
    if (kidsCountAsKids > 0) lines.push(`${kidsCountAsKids} niño${kidsCountAsKids !== 1 ? "s" : ""} × ${money(kidUnit)}`);
    if (kidsCountAsAdults > 0) lines.push(`${kidsCountAsAdults} niño${kidsCountAsAdults !== 1 ? "s" : ""} × ${money(adultUnit)} (tarifa de adulto)`);
    if (infants > 0) lines.push(`${infants} infante${infants !== 1 ? "s" : ""} × ${money(infantUnit)}`);

    return { total, category, adultUnit, kidUnit, infantUnit, breakdownLines: lines };
  }

  // ---------------------------------------------------------------------
  // Descriptivo (solo se pinta después de cotizar)
  // ---------------------------------------------------------------------
  function renderDetails(tier, departure) {
    const itineraryKey = tier.itinerario_key || "regular";
    const itinerary = (window.ITINERARIES && window.ITINERARIES[itineraryKey]) || [];
    const noIncluye = window.NO_INCLUYE || [];
    const incluye = tier.incluye || [];

    return `
      <h3 class="cw2-details__heading">${departure.etiqueta}</h3>
      <p class="cw2-details__meta">${tier.lodging || ""}${tier.meals_note ? " · " + tier.meals_note : ""}</p>

      <div class="cw2-details__block">
        <p class="cw2-details__subheading">Este plan incluye</p>
        <ul class="cw2-check-grid">${incluye.map((item) => `<li>${item}</li>`).join("")}</ul>
        ${tier.special_note ? `<p class="cw2-note-banner">${tier.special_note}</p>` : ""}
      </div>

      ${itinerary.length ? `
      <div class="cw2-details__block">
        <p class="cw2-details__subheading">Itinerario</p>
        <ol class="cw2-timeline">
          ${itinerary.map((paso, i) => `
            <li>
              <span class="cw2-timeline__num">${i + 1}</span>
              <span class="cw2-timeline__body">
                <span class="cw2-timeline__dia">${paso.dia}</span>
                <span class="cw2-timeline__titulo">${paso.titulo}</span>
                <span class="cw2-timeline__detalle">${paso.detalle}</span>
              </span>
            </li>`).join("")}
        </ol>
      </div>` : ""}

      <div class="cw2-details__block">
        <p class="cw2-details__subheading">No incluye</p>
        <ul class="cw2-check-grid cw2-check-grid--no">${noIncluye.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // Interacción
  // ---------------------------------------------------------------------
  function wireForm(root) {
    const submitBtn = root.querySelector("#cw2-submit");
    const notaEl = root.querySelector("#cw2-departure-nota");

    root.querySelector("#cw2-date-carousel").addEventListener("change", (e) => {
      if (e.target.name !== "cw2-departure") return;
      state.selectedDeparture = state.departures.find((d) => d.id === e.target.value) || null;
      // La nota especial (toque de queda, cena especial, etc.) solo se muestra
      // dentro del descriptivo, después de cotizar — no antes.
      notaEl.textContent = "";
      submitBtn.disabled = !state.selectedDeparture;
      hideResult(root);
    });

    root.querySelectorAll(".cw2-counter__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        const delta = parseInt(btn.dataset.delta, 10);
        const limits = LIMITS[target];
        state[target] = Math.min(limits.max, Math.max(limits.min, state[target] + delta));
        root.querySelector(`#cw2-${target}-value`).textContent = state[target];
        hideResult(root);
      });
    });

    submitBtn.addEventListener("click", () => showResult(root));
  }

  function hideResult(root) {
    root.querySelector("#cw2-result").hidden = true;
    root.querySelector("#cw2-contact-panel").hidden = true;
    state.lastQuote = null;
  }

  function showResult(root) {
    const resultEl = root.querySelector("#cw2-result");
    const priceEl = root.querySelector("#cw2-price");
    const detailsEl = root.querySelector("#cw2-details");

    if (!state.selectedDeparture) return;

    const tier = state.tiers[state.selectedDeparture.tier];
    const quote = calculateQuote(tier, state.adults, state.kids, state.infants);

    resultEl.hidden = false;

    if (!quote || quote.error) {
      priceEl.innerHTML = `<p class="cw2-price__error">${quote?.error || "No fue posible calcular el valor."}</p>`;
      detailsEl.innerHTML = "";
      state.lastQuote = null;
    } else {
      priceEl.innerHTML = `
        <p class="cw2-price__label">Valor total</p>
        <span class="cw2-price__amount">${money(quote.total)}</span>
        <p class="cw2-price__breakdown">${quote.breakdownLines.join("<br>")}</p>
        <button type="button" class="cw2-cta" id="cw2-continue">Continuar con la reserva</button>
      `;
      detailsEl.innerHTML = renderDetails(tier, state.selectedDeparture);
      state.lastQuote = quote;
      root.querySelector("#cw2-continue").addEventListener("click", () => {
        root.querySelector("#cw2-contact-panel").hidden = false;
        root.querySelector("#cw2-contact-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function wireNavigation(root) {
    root.querySelector("#cw2-back").addEventListener("click", () => {
      root.querySelector("#cw2-contact-panel").hidden = true;
    });
    root.querySelector("#cw2-new-quote").addEventListener("click", () => {
      root.querySelector("#cw2-done-panel").hidden = true;
      root.querySelector("#cw2-result").hidden = true;
      root.querySelector("#cw2-contact-form").reset();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function generateLocalRefCode() {
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `EC-${date}-${rand}`;
  }

  function wireContactForm(root) {
    root.querySelector("#cw2-contact-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const errorEl = root.querySelector("#cw2-form-error");
      errorEl.textContent = "";

      if (!state.lastQuote || !state.selectedDeparture) {
        errorEl.textContent = "Selecciona una fecha y la cantidad de pasajeros antes de continuar.";
        return;
      }

      const val = (id) => root.querySelector(id).value.trim();
      const payload = {
        destination_slug: "eje-cafetero",
        departure_id: state.selectedDeparture.id,
        departure_label: state.selectedDeparture.etiqueta,
        tier_id: state.selectedDeparture.tier,
        adults: state.adults,
        kids: state.kids,
        infants: state.infants,
        total_price: state.lastQuote.total,
        price_breakdown: state.lastQuote.breakdownLines.join(" | "),
        full_name: val("#cw2-full_name"),
        document_id: val("#cw2-document_id"),
        email: val("#cw2-email"),
        phone: val("#cw2-phone"),
        emergency_contact: val("#cw2-emergency_contact"),
        special_requests: val("#cw2-special_requests"),
        status: "pendiente",
      };

      if (!payload.full_name || !payload.document_id || !payload.email || !payload.phone || !payload.emergency_contact) {
        errorEl.textContent = "Por favor completa todos los campos obligatorios (*).";
        return;
      }
      if (!root.querySelector("#cw2-accept_policy").checked) {
        errorEl.textContent = "Debes aceptar las políticas de reservas para continuar.";
        return;
      }

      const submitBtn = root.querySelector("#cw2-submit-contact");
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";

      let refCode = generateLocalRefCode();
      try {
        if (state.supabase) {
          const { data, error } = await state.supabase.from("prereservations").insert(payload).select().single();
          if (error) throw error;
          refCode = data.id;
        } else {
          console.info("[DEMO] Prereserva (sin Supabase configurado):", payload);
        }

        const webhookUrl = window.APP_CONFIG?.N8N_PRERESERVA_WEBHOOK_URL;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, ref_code: refCode }),
          }).catch((e) => console.warn("No se pudo notificar a n8n directamente:", e));
        }

        root.querySelector("#cw2-done-ref-code").textContent = refCode;
        root.querySelector("#cw2-result").hidden = true;
        root.querySelector("#cw2-contact-panel").hidden = true;
        root.querySelector("#cw2-done-panel").hidden = false;
        root.querySelector("#cw2-done-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (err) {
        console.error(err);
        errorEl.textContent = "No pudimos enviar tu prereserva. Intenta de nuevo o escríbenos por WhatsApp.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar prereserva";
      }
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  async function init() {
    const root = document.getElementById(MOUNT_ID);
    if (!root) {
      console.warn(`app.js (v2): no se encontró #${MOUNT_ID} en la página.`);
      return;
    }
    root.classList.add("cw2");
    root.innerHTML = buildMarkup();

    await loadData();
    renderDateCarousel(root);
    wireForm(root);
    wireNavigation(root);
    wireContactForm(root);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
