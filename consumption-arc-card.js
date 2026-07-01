/**
 * Consumption Arc Card
 * -----------------
 * Zeigt zwei umschaltbare Ansichten (Tabs) für den Hausverbrauch (oder einen
 * beliebigen anderen Energie-Verbrauchsbereich):
 *
 *  - "energy"  (Tageswerte): Halbkreis-Bogen von Min- bis Max-Verbrauch (kWh)
 *               eines Tages (feste Tages-Sensoren), Marker = verbrauchte kWh
 *               im gewählten Zeitraum (produced_entity). Im Bogen-Zentrum:
 *               Verbraucht (groß). Darüber: Zeitraum-Auswahl
 *               Tag/Woche/Monat/Jahr/Gesamt - die Werte für Verbraucht,
 *               Energiefluss und Kacheln werden je gewähltem Zeitraum per
 *               Home-Assistant-Langzeitstatistik (WebSocket
 *               recorder/statistics_during_period, types: ["change"])
 *               ermittelt - das ist dieselbe Methode wie die offizielle
 *               Statistic Card / das Energy-Dashboard nutzen und behandelt
 *               Sensor-Resets/-Korrekturen automatisch korrekt. Bei Zeitraum
 *               "Gesamt" wird der Bogen komplett gefüllt angezeigt (kein
 *               Min/Max-Vergleich möglich). Voraussetzung: die jeweilige
 *               Entity benötigt state_class total/total_increasing
 *               (Langzeitstatistik aktiv).
 *               Darunter: Energiefluss (zeigt, woher der verbrauchte Strom
 *               kam - PV-Eigenverbrauch/Batterie/Netz, kWh) und bis zu 4
 *               Verbraucher-Kacheln (kWh), beide ebenfalls zeitraumabhängig.
 *
 *  - "live"    (Leistung): Halbkreis-Bogen von 0 bis Max-Leistung (W) des
 *               Tages, Marker = aktuelle Gesamtleistung (power_entity).
 *               Im Bogen-Zentrum: aktuelle Verbrauchsleistung (groß).
 *               Darunter: Energiefluss (PV/Batterie/Netz, W) und bis zu
 *               4 Verbraucher-Kacheln (W).
 *
 * Installation:
 * 1. Datei nach /config/www/consumption-arc-card.js kopieren
 * 2. In Einstellungen -> Dashboards -> Ressourcen hinzufügen:
 *      URL: /local/consumption-arc-card.js
 *      Typ: JavaScript-Modul
 * 3. Karte hinzufügen, Typ: custom:consumption-arc-card
 *
 * Beispiel-Konfiguration:
 * type: custom:consumption-arc-card
 * title: Hausverbrauch
 * default_tab: energy                 # "energy" oder "live"
 *
 * # Tageswerte (Energie, kWh)
 * produced_entity: sensor.hausverbrauch_energie_gesamt_taglich
 * energy_min: 5.0                                              # feste Zahl (kWh), ODER:
 * energy_min_entity: sensor.hausverbrauch_energie_min_heute    # Sensor hat Vorrang
 * energy_max: 35.0                                             # feste Zahl (kWh), ODER:
 * energy_max_entity: sensor.hausverbrauch_energie_max_heute    # Sensor hat Vorrang
 * energy_color_stops:
 *   - { value: 0, color: "#2e7d32" }
 *   - { value: 15, color: "#1565c0" }
 *   - { value: 25, color: "#c62828" }
 * decimals_day: 2      # Nachkommastellen je Zeitraum (0-6), gilt für ALLE
 * decimals_week: 1     # Zahlen im Tageswerte-Tab: Verbraucht, Energiefluss
 * decimals_month: 0    # und Kacheln (inkl. kWh/Modul). Default: 2.
 * decimals_year: 0
 * decimals_total: 0
 * # Energiefluss Tageswerte: mind. 2 von 3 angeben, der dritte wird aus produced_entity berechnet
 * # Zeigt, woher der verbrauchte Strom kam:
 * energy_flow_house_entity: sensor.pv_eigenverbrauch_heute_kwh
 * energy_flow_house_invert: false
 * energy_flow_battery_entity: sensor.batterie_entladen_heute_kwh
 * energy_flow_battery_invert: false
 * energy_flow_grid_entity: sensor.netzbezug_heute_kwh
 * energy_flow_grid_invert: false
 * energy_tiles:
 *   - { name: "Küche", entity: "sensor.kueche_kwh_heute" }
 *   - { name: "Heizung", entity: "sensor.heizung_kwh_heute" }
 *   - { name: "Sonstiges", entity: "sensor.sonstiges_kwh_heute" }
 *   # keine module_count/module_peak_wp bei Verbrauchs-Kacheln (ergibt
 *   # bei Verbrauchern keinen Sinn) - nur Name + Wert.
 *
 * # Live (Leistung, W)
 * power_entity: sensor.hausverbrauch_leistung_gesamt
 * power_max: 8000                                # feste Zahl (W), ODER:
 * power_max_entity: input_number.hausverbrauch_peak_allzeit   # Sensor hat Vorrang
 * # Min ist immer 0, kein eigenes Feld nötig.
 * # Energiefluss Live: mind. 2 von 3 angeben, der dritte wird aus power_entity berechnet
 * flow_house_entity: sensor.pv_eigenverbrauch_aktuell
 * flow_house_invert: false
 * flow_battery_entity: sensor.batterie_leistung   # + lädt, - entlädt
 * flow_battery_invert: false
 * flow_grid_entity: sensor.netz_leistung          # + Einspeisung, - Bezug
 * flow_grid_invert: false
 * power_color_stops:
 *   - { value: 0, color: "#1565c0" }
 *   - { value: 3000, color: "#f9a825" }
 *   - { value: 6000, color: "#c62828" }
 * power_tiles:
 *   - { name: "Küche", entity: "sensor.kueche_leistung" }
 *   - { name: "Heizung", entity: "sensor.heizung_leistung" }
 *   - { name: "Sonstiges", entity: "sensor.sonstiges_leistung" }
 *   # keine module_count/module_peak_wp bei Verbrauchs-Kacheln (weder bei
 *   # power_tiles noch bei energy_tiles) - nur Name + Wert.
 */

const MAX_TILES = 4;
const MAX_PERIOD_RETRIES = 5;

class ConsumptionArcCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._activeTab = null;
    this._energyPeriod = "day";
    this._periodValues = null; // zuletzt geladene { produced, flows, tiles } für _energyPeriod
    this._periodLoading = false;
    this._periodLoadingFor = null; // welcher Zeitraum gerade lädt (verhindert doppelte Requests für denselben Zeitraum)
    this._periodRetryCount = 0; // Anzahl aufeinanderfolgender Ladeversuche ohne Erfolg
    this._periodRequestId = 0; // Generation-Counter gegen veraltete/überlappende Requests
    this._statsCache = {};
    this.attachShadow({ mode: "open" });
  }

  // ---- Home Assistant Lifecycle -------------------------------------------------

  setConfig(config) {
    if (!config.produced_entity) {
      throw new Error("Bitte 'produced_entity' angeben (kWh, bisher erzeugt heute)");
    }

    const tiles = Array.isArray(config.power_tiles)
      ? config.power_tiles.slice(0, MAX_TILES)
      : [];
    const energyTiles = Array.isArray(config.energy_tiles)
      ? config.energy_tiles.slice(0, MAX_TILES)
      : [];

    this._config = {
      title: "Hausverbrauch",
      default_tab: "energy",
      energy_min: null,
      energy_min_entity: null,
      energy_max: null,
      energy_max_entity: null,
      produced_entity: null,
      energy_color_stops: [],
      energy_flow_house_entity: null,
      energy_flow_house_invert: false,
      energy_flow_battery_entity: null,
      energy_flow_battery_invert: false,
      energy_flow_grid_entity: null,
      energy_flow_grid_invert: false,
      energy_tiles: [],
      decimals_day: 2,
      decimals_week: 2,
      decimals_month: 2,
      decimals_year: 2,
      decimals_total: 2,
      power_entity: null,
      power_max: null,
      power_max_entity: null,
      power_color_stops: [],
      power_tiles: [],
      flow_house_entity: null,
      flow_house_invert: false,
      flow_battery_entity: null,
      flow_battery_invert: false,
      flow_grid_entity: null,
      flow_grid_invert: false,
      unit: "kWh",
      ...config,
      power_tiles: tiles,
      energy_tiles: energyTiles,
    };

    if (!this._activeTab) {
      this._activeTab = this._config.default_tab === "live" ? "live" : "energy";
    }

    this._initialRenderDone = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  static getConfigElement() {
    return document.createElement("consumption-arc-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:consumption-arc-card",
      title: "Hausverbrauch",
      default_tab: "energy",
      energy_min_entity: "sensor.hausverbrauch_energie_min_heute",
      energy_max_entity: "sensor.hausverbrauch_energie_max_heute",
      produced_entity: "sensor.hausverbrauch_energie_gesamt_taglich",
      power_entity: "sensor.hausverbrauch_leistung_gesamt",
      power_max: null,
      power_max_entity: "",
      power_tiles: [],
    };
  }

  // ---- Helpers --------------------------------------------------------------

  _getState(entityId) {
    if (!this._hass || !entityId) return null;
    return this._hass.states[entityId] || null;
  }

  _getNumericState(entityId) {
    const ent = this._getState(entityId);
    if (!ent) return null;
    const val = parseFloat(ent.state);
    return Number.isNaN(val) ? null : val;
  }

  /**
   * Berechnet min/max/current/fraction für einen generischen Min/Max-Bogen.
   */
  _getMinMaxFraction(minEntity, maxEntity, currentValue) {
    const min = this._getNumericState(minEntity);
    const max = this._getNumericState(maxEntity);

    if (min === null || max === null) return null;

    let fraction = 0;
    if (currentValue !== null && max > min) {
      fraction = (currentValue - min) / (max - min);
      fraction = Math.max(0, Math.min(1, fraction));
    } else if (currentValue !== null && max === min) {
      fraction = 0.5;
    }

    return { min, max, current: currentValue, fraction };
  }

  /**
   * Ermittelt die passende Farbe für einen Wert anhand einer Liste von
   * Farbschwellen [{ value, color }, ...]. Die Farbe des höchsten Stops,
   * dessen value <= Wert ist, wird verwendet. Stops müssen nicht sortiert
   * übergeben werden.
   */
  _colorForValue(value, stops, fallbackColor) {
    if (!Array.isArray(stops) || stops.length === 0 || value === null) {
      return fallbackColor;
    }
    const sorted = [...stops]
      .filter((s) => s && s.value !== undefined && s.value !== null && s.color)
      .map((s) => ({ value: parseFloat(s.value), color: s.color }))
      .filter((s) => !Number.isNaN(s.value))
      .sort((a, b) => a.value - b.value);

    if (sorted.length === 0) return fallbackColor;

    let matched = null;
    for (const stop of sorted) {
      if (value >= stop.value) {
        matched = stop.color;
      } else {
        break;
      }
    }
    return matched || fallbackColor;
  }

  _fmt(val, decimals) {
    const d = decimals === undefined || decimals === null ? 2 : decimals;
    return val === null || val === undefined
      ? "–"
      : val.toFixed(d).replace(".", ",");
  }

  /** Liefert die konfigurierte Dezimalstellen-Anzahl für einen Zeitraum (Default: 2). */
  _decimalsForPeriod(period) {
    const cfg = this._config;
    const map = {
      day: cfg.decimals_day,
      week: cfg.decimals_week,
      month: cfg.decimals_month,
      year: cfg.decimals_year,
      total: cfg.decimals_total,
    };
    const raw = map[period];
    if (raw === null || raw === undefined || raw === "") return 2;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? 2 : Math.max(0, Math.min(6, parsed));
  }

  /**
   * Start-Zeitpunkt der aktuellen Periode (lokale Zeit), passend zur
   * Zeitraum-Auswahl im Tageswerte-Tab. "total" hat keinen Start (komplette
   * Historie). Wochenstart ist Montag (DE-Konvention).
   */
  _getPeriodStart(period, now) {
    const d = new Date(now || Date.now());
    if (period === "day") {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === "week") {
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === "month") {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === "year") {
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return null; // "total"
  }

  /**
   * Fragt die Veränderung ("change") einer Entity per WebSocket-Statistik-API
   * für den Zeitraum [startMs, jetzt] ab und summiert die Bucket-Werte auf.
   * "change" wird von Home Assistant selbst berechnet (gleiche Methode wie
   * die offizielle Statistic Card / das Energy-Dashboard) und behandelt z.B.
   * Sensor-Resets/-Korrekturen korrekt - im Gegensatz zur naiven Differenz
   * aus zwei "sum"-Werten, die nach einem Reset oder einer nachträglichen
   * Sensor-Korrektur fälschlich stark negative Werte liefern kann.
   * Ergebnis (eine einzige Zahl: Summe aller Changes im Zeitraum) wird pro
   * Entity+Zeitraum gecacht (siehe _invalidateStatsCache).
   */
  async _fetchStatistics(entityId, startMs) {
    if (!this._hass || !entityId) return null;

    this._statsCache = this._statsCache || {};
    const cacheKey = `${entityId}:${startMs || "all"}`;
    if (this._statsCache[cacheKey] !== undefined) {
      return this._statsCache[cacheKey];
    }

    try {
      const startIso = startMs
        ? new Date(startMs).toISOString()
        : "2000-01-01T00:00:00.000Z"; // praktisch "Anfang aller Zeiten"
      const result = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: startIso,
        end_time: new Date().toISOString(),
        statistic_ids: [entityId],
        period: "hour",
        types: ["change"],
      });
      const points = (result && result[entityId]) || [];
      // Summe aller "change"-Werte über den abgefragten Zeitraum ergibt die
      // Gesamtveränderung. null-Werte (z.B. bei Lücken) werden ignoriert.
      const total = points.reduce((acc, p) => {
        return p && p.change !== null && p.change !== undefined
          ? acc + p.change
          : acc;
      }, 0);
      this._statsCache[cacheKey] = total;
      return total;
    } catch (err) {
      console.error("Consumption Arc Card: Statistik-Abfrage fehlgeschlagen für", entityId, err);
      return null;
    }
  }

  /** Setzt den Statistik-Cache zurück (bei explizitem Zeitraum-Wechsel). */
  _invalidateStatsCache() {
    this._statsCache = {};
  }

  /**
   * Lädt alle für den Tageswerte-Tab benötigten Werte (Verbraucht, Energiefluss,
   * Kacheln) für den aktuell gewählten Zeitraum (_energyPeriod) asynchron und
   * stößt danach ein erneutes Rendern an. Wird bei Zeitraum-Wechsel sowie
   * beim ersten Aufruf des Energy-Tabs ausgelöst. Ergebnis wird in
   * _periodValues zwischengespeichert, sodass _renderEnergyTab() synchron
   * darauf zugreifen kann, ohne selbst auf Promises zu warten.
   *
   * Da mehrere Aufrufe überlappend laufen können (z.B. schnelles mehrfaches
   * Klicken auf verschiedene Zeitraum-Buttons, während der vorherige Request
   * noch unterwegs ist), bekommt jeder Aufruf eine eindeutige Generation-ID
   * (_periodRequestId). Ein Request übernimmt sein Ergebnis nur, wenn er zum
   * Zeitpunkt des Abschlusses noch der NEUESTE gestartete Request ist - sonst
   * wird das veraltete Ergebnis verworfen, ohne den Zustand zu verändern.
   * Das verhindert, dass ein langsamerer alter Request das Ergebnis eines
   * neueren Requests überschreibt.
   */
  async _loadPeriodValues() {
    const cfg = this._config;
    const period = this._energyPeriod;

    this._periodRequestId++;
    const myRequestId = this._periodRequestId;

    this._periodLoading = true;
    this._periodLoadingFor = period;
    this._render();

    let produced = null;
    let flows = null;
    let tileValues = [];
    let succeeded = false;

    try {
      produced = await this._getPeriodValue(cfg.produced_entity, period, cfg.unit);

      const house = cfg.energy_flow_house_entity
        ? await this._getPeriodValue(cfg.energy_flow_house_entity, period, cfg.unit)
        : null;
      const battery = cfg.energy_flow_battery_entity
        ? await this._getPeriodValue(cfg.energy_flow_battery_entity, period, cfg.unit)
        : null;
      const grid = cfg.energy_flow_grid_entity
        ? await this._getPeriodValue(cfg.energy_flow_grid_entity, period, cfg.unit)
        : null;

      // Invertierung erst NACH der Periodenwert-Berechnung anwenden (Differenzen
      // bleiben bei Invertierung einfach im Vorzeichen gedreht).
      const houseSigned = house !== null && cfg.energy_flow_house_invert ? -house : house;
      const batterySigned = battery !== null && cfg.energy_flow_battery_invert ? -battery : battery;
      const gridSigned = grid !== null && cfg.energy_flow_grid_invert ? -grid : grid;

      const knownCount = [houseSigned, batterySigned, gridSigned].filter((v) => v !== null).length;
      if (knownCount >= 2) {
        let h = houseSigned, b = batterySigned, g = gridSigned;
        const pv = produced;
        if (h === null && pv !== null) h = pv - (b || 0) - (g || 0);
        else if (b === null && pv !== null) b = pv - (h || 0) - (g || 0);
        else if (g === null && pv !== null) g = pv - (h || 0) - (b || 0);
        flows = { house: h, battery: b, grid: g };
      }

      const tileConfigs = (cfg.energy_tiles || []).filter((t) => t && t.entity).slice(0, MAX_TILES);
      for (const t of tileConfigs) {
        const val = await this._getPeriodValue(t.entity, period, "kWh");
        tileValues.push({ ...t, periodValue: val });
      }

      succeeded = true;
    } catch (err) {
      console.error("Consumption Arc Card: Laden der Zeitraum-Werte fehlgeschlagen", err);
    }

    // Veralteten Request verwerfen: falls inzwischen ein neuerer Aufruf
    // gestartet wurde (z.B. durch einen weiteren Klick während dieser
    // Request noch lief), darf dieses Ergebnis NICHT mehr übernommen werden.
    if (myRequestId !== this._periodRequestId) {
      return;
    }

    if (succeeded) {
      this._periodValues = { period, produced, flows, tiles: tileValues };
      // Zähler nur zurücksetzen, wenn tatsächlich ein Wert da ist. Bleibt
      // produced null (z.B. weil hass/Statistik-API noch nicht bereit war,
      // aber ohne dass eine Exception geworfen wurde), zählt das ebenfalls
      // als Fehlversuch, damit MAX_PERIOD_RETRIES auch diesen Fall begrenzt.
      this._periodRetryCount = produced !== null ? 0 : this._periodRetryCount + 1;
    } else {
      this._periodRetryCount++;
      // _periodValues bewusst NICHT überschreiben, sonst bleibt die Karte
      // dauerhaft leer, da _renderEnergyTab() es als "fertig geladen" sehen
      // würde. Der nächste _render()-Aufruf löst dadurch (begrenzt durch
      // MAX_PERIOD_RETRIES) einen erneuten Ladeversuch aus.
    }

    this._periodLoading = false;
    this._periodLoadingFor = null;
    this._render();
  }

  /**
   * Liefert die Veränderung einer Entity im gewählten Zeitraum, normalisiert
   * auf targetUnit. Bei "total" wird einfach der aktuelle Live-Wert genutzt
   * (Gesamtmenge seit je). Sonst wird die "change"-Statistik von Periodenbeginn
   * bis jetzt abgefragt (siehe _fetchStatistics) - HA berechnet das selbst
   * und behandelt dabei Sensor-Resets/-Korrekturen korrekt.
   */
  async _getPeriodValue(entityId, period, targetUnit) {
    if (!entityId) return null;
    const sourceUnit =
      this._getState(entityId)?.attributes?.unit_of_measurement || targetUnit;

    if (period === "total") {
      const current = this._getNumericState(entityId);
      if (current === null) return null;
      return this._normalizeToUnit(current, sourceUnit, targetUnit);
    }

    const periodStart = this._getPeriodStart(period);
    const change = await this._fetchStatistics(
      entityId,
      periodStart ? periodStart.getTime() : null
    );
    if (change === null) return null;
    return this._normalizeToUnit(change, sourceUnit, targetUnit);
  }

  /** Leistung immer in W anzeigen, unabhängig von Quelleinheit (W/kW). */
  _fmtPower(val, unit) {
    if (val === null || val === undefined) return "–";
    const u = (unit || "W").toLowerCase();
    const watts = u === "kw" ? val * 1000 : val;
    return Math.round(watts).toLocaleString("de-DE") + " W";
  }

  /** Normalisiert einen Wert von dessen Einheit auf die Zieleinheit (W/kW). */
  _normalizeToUnit(val, fromUnit, toUnit) {
    if (val === null || val === undefined) return null;
    const f = (fromUnit || "W").toLowerCase();
    const t = (toUnit || "W").toLowerCase();
    if (f === t) return val;
    if (f === "kw" && t === "w") return val * 1000;
    if (f === "w" && t === "kw") return val / 1000;
    if (f === "wh" && t === "kwh") return val / 1000;
    if (f === "kwh" && t === "wh") return val * 1000;
    return val;
  }

  /**
   * Liest einen Flow-Sensor (Haus/Batterie/Netz), normalisiert auf die
   * angegebene Zieleinheit (z.B. "W" für Live, "kWh" für Tageswerte) und
   * wendet ggf. Invertierung an. Gibt null zurück, falls keine Entity
   * konfiguriert oder kein Wert verfügbar ist.
   */
  _readFlowEntity(entityId, invert, targetUnit) {
    if (!entityId) return null;
    const raw = this._getNumericState(entityId);
    if (raw === null) return null;
    const unit =
      this._getState(entityId)?.attributes?.unit_of_measurement || targetUnit;
    let val = this._normalizeToUnit(raw, unit, targetUnit);
    if (invert) val = -val;
    return val;
  }

  /**
   * Ermittelt die drei Energiefluss-Werte (Haus, Batterie, Netz), wahlweise
   * als Leistung (W) oder als Energie (kWh) - gesteuert über keyPrefix
   * ("flow_" für Live/W, "energy_flow_" für Tageswerte/kWh) und unit.
   * Konvention: Haus = Verbrauch (positiv). Batterie: positiv = lädt,
   * negativ = entlädt. Netz: positiv = Einspeisung, negativ = Bezug.
   * Mindestens zwei der drei müssen als Entity konfiguriert sein; der
   * dritte wird aus der PV-Gesamtmenge minus den beiden anderen berechnet.
   * Gibt null zurück, wenn weniger als zwei Werte ermittelbar sind.
   */
  _getEnergyFlows(currentPv, keyPrefix, unit) {
    const cfg = this._config;
    let house = this._readFlowEntity(
      cfg[`${keyPrefix}house_entity`],
      cfg[`${keyPrefix}house_invert`],
      unit
    );
    let battery = this._readFlowEntity(
      cfg[`${keyPrefix}battery_entity`],
      cfg[`${keyPrefix}battery_invert`],
      unit
    );
    let grid = this._readFlowEntity(
      cfg[`${keyPrefix}grid_entity`],
      cfg[`${keyPrefix}grid_invert`],
      unit
    );

    const knownCount = [house, battery, grid].filter((v) => v !== null).length;
    if (knownCount < 2) return null;

    const pv = currentPv !== null ? currentPv : null;

    if (house === null && pv !== null) {
      house = pv - (battery || 0) - (grid || 0);
    } else if (battery === null && pv !== null) {
      battery = pv - (house || 0) - (grid || 0);
    } else if (grid === null && pv !== null) {
      grid = pv - (house || 0) - (battery || 0);
    }

    return { house, battery, grid };
  }

  // ---- Bogen-Geometrie (gemeinsam für beide Tabs) ----------------------------

  _arcGeometry() {
    const cx = 150;
    const cy = 140;
    const r = 110;
    const angleForFraction = (f) => Math.PI - f * Math.PI; // 180° -> 0°
    const pointOnArc = (f) => {
      const a = angleForFraction(f);
      return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
    };
    const describeArcPath = (fromF, toF) => {
      const p1 = pointOnArc(fromF);
      const p2 = pointOnArc(toF);
      return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    };
    return { cx, cy, r, pointOnArc, describeArcPath };
  }

  // ---- Rendering --------------------------------------------------------------

  _render() {
    if (!this._config || !this.shadowRoot) return;

    if (!this._initialRenderDone) {
      this.shadowRoot.innerHTML = this._styles();
      const card = document.createElement("ha-card");
      card.className = "pv-card";
      const container = document.createElement("div");
      container.className = "card-content";
      card.appendChild(container);
      this.shadowRoot.appendChild(card);
      this._initialRenderDone = true;
      this._tabsClickHandlerAttached = false;
    }

    const container = this.shadowRoot.querySelector(".card-content");
    const cfg = this._config;

    container.innerHTML = `
      <div class="header-row">
        <div class="title">${cfg.title}</div>
        <div class="tabs">
          <button class="tab-btn ${this._activeTab === "energy" ? "active" : ""}" data-tab="energy">Tageswerte</button>
          <button class="tab-btn ${this._activeTab === "live" ? "active" : ""}" data-tab="live">Live</button>
        </div>
      </div>
      <div class="tab-content">
        ${this._activeTab === "live" ? this._renderLiveTab() : this._renderEnergyTab()}
      </div>
    `;

    // Event Delegation auf dem Container (statt auf den einzelnen Buttons):
    // Der Container selbst wird bei jedem _render() nur per innerHTML neu
    // befüllt, nicht neu erzeugt. Ein einziger, dauerhaft registrierter
    // Listener auf dem Container vermeidet doppelte/verlorene Listener bei
    // häufigen hass-Updates (die _render() z.B. alle paar Sekunden auslösen).
    if (!this._tabsClickHandlerAttached) {
      container.addEventListener("click", (ev) => {
        const tabBtn = ev.target.closest(".tab-btn");
        if (tabBtn) {
          const tab = tabBtn.dataset.tab;
          if (tab && tab !== this._activeTab) {
            this._activeTab = tab;
            this._render();
          }
          return;
        }

        const periodBtn = ev.target.closest(".period-btn");
        if (periodBtn) {
          const period = periodBtn.dataset.period;
          if (period && period !== this._energyPeriod) {
            this._energyPeriod = period;
            this._invalidateStatsCache();
            this._periodValues = null;
            this._periodRetryCount = 0;
            this._render();
          }
          return;
        }
      });
      this._tabsClickHandlerAttached = true;
    }
  }

  // ---- Tab: Tageswerte (Energie) ----------------------------------------------

  _renderEnergyTab() {
    const cfg = this._config;
    const { cx, cy, pointOnArc, describeArcPath } = this._arcGeometry();

    // Periodenwerte nachladen, falls noch nicht für den aktuellen Zeitraum
    // vorhanden (z.B. erster Render des Tabs, oder nach Zeitraum-Wechsel) -
    // oder falls der letzte Ladeversuch keinen "produced"-Wert lieferte
    // (z.B. weil hass/WebSocket beim allerersten Render der Karte noch nicht
    // bereit war). Ohne diese zweite Bedingung würde ein einmal fehlgeschlagener
    // Ladeversuch die Karte dauerhaft leer lassen, da der Zeitraum ja
    // "passt" und kein weiterer Trigger mehr ausgelöst würde. Die Anzahl
    // automatischer Retries ist begrenzt (MAX_PERIOD_RETRIES), damit bei
    // einer dauerhaft falsch konfigurierten Entity nicht endlos oft die
    // Statistik-API angefragt wird.
    //
    // WICHTIG: Hier wird bewusst NICHT auf "!this._periodLoading" geprüft -
    // ein neuer Zeitraum-Wechsel darf sofort einen neuen Request auslösen,
    // auch während noch ein älterer Request läuft (z.B. bei schnellem
    // mehrfachem Klicken). Die Generation-ID in _loadPeriodValues sorgt
    // dafür, dass nur das Ergebnis des jeweils NEUESTEN Requests übernommen
    // wird; veraltete, noch laufende Requests schreiben ihr Ergebnis nicht
    // mehr in _periodValues. Ohne dieses sofortige Re-Triggern müsste man
    // sonst auf das Ende des alten Requests warten, bevor der neue überhaupt
    // erst gestartet wird - das war die Ursache für "3-4 Klicks nötig".
    // Wird außerhalb des synchronen Render-Pfads per Promise nachgezogen und
    // löst danach selbst einen Re-Render aus (siehe _loadPeriodValues).
    const periodDataMissing =
      !this._periodValues ||
      this._periodValues.period !== this._energyPeriod ||
      this._periodValues.produced === null;
    const alreadyLoadingThisPeriod = this._periodLoadingFor === this._energyPeriod;
    if (
      periodDataMissing &&
      !alreadyLoadingThisPeriod &&
      this._periodRetryCount < MAX_PERIOD_RETRIES
    ) {
      this._loadPeriodValues();
    }

    const havePeriodData =
      this._periodValues && this._periodValues.period === this._energyPeriod;
    const produced = havePeriodData ? this._periodValues.produced : null;
    const flows = havePeriodData ? this._periodValues.flows : null;
    const periodTiles = havePeriodData ? this._periodValues.tiles : [];

    // Dezimalstellen-Anzahl ist pro Zeitraum konfigurierbar (z.B. Tag mit 2,
    // Jahr mit 0 Nachkommastellen) und gilt für ALLE Zahlen im Tageswerte-Tab:
    // Verbraucht, Energiefluss, Kacheln.
    const decimals = this._decimalsForPeriod(this._energyPeriod);

    // Minimum: Sensor hat Vorrang vor fester Zahl, normalisiert auf kWh.
    // Bogen-Min/Max bleibt fest tagesbezogen (eigene SQL-Sensoren), egal
    // welcher Zeitraum für "Erzeugt" gewählt ist.
    let energyMin = null;
    if (cfg.energy_min_entity) {
      const minRaw = this._getNumericState(cfg.energy_min_entity);
      const minUnit =
        this._getState(cfg.energy_min_entity)?.attributes
          ?.unit_of_measurement || cfg.unit;
      if (minRaw !== null) {
        energyMin = this._normalizeToUnit(minRaw, minUnit, cfg.unit);
      }
    } else if (
      cfg.energy_min !== null &&
      cfg.energy_min !== undefined &&
      cfg.energy_min !== ""
    ) {
      const parsed = parseFloat(cfg.energy_min);
      energyMin = Number.isNaN(parsed) ? null : parsed;
    }

    let energyMax = null;
    if (cfg.energy_max_entity) {
      const maxRaw = this._getNumericState(cfg.energy_max_entity);
      const maxUnit =
        this._getState(cfg.energy_max_entity)?.attributes
          ?.unit_of_measurement || cfg.unit;
      if (maxRaw !== null) {
        energyMax = this._normalizeToUnit(maxRaw, maxUnit, cfg.unit);
      }
    } else if (
      cfg.energy_max !== null &&
      cfg.energy_max !== undefined &&
      cfg.energy_max !== ""
    ) {
      const parsed = parseFloat(cfg.energy_max);
      energyMax = Number.isNaN(parsed) ? null : parsed;
    }

    // Bei Zeitraum "Gesamt" ergibt ein Min/Max-Vergleich keinen Sinn -> Bogen
    // wird stattdessen voll gefüllt angezeigt (0 bis aktueller Wert).
    const isTotal = this._energyPeriod === "total";
    const minMax =
      !isTotal && energyMin !== null && energyMax !== null
        ? { min: energyMin, max: energyMax }
        : null;

    let fraction = 0;
    if (isTotal) {
      fraction = produced !== null && produced > 0 ? 1 : 0;
    } else if (minMax && produced !== null && minMax.max > minMax.min) {
      fraction = Math.max(
        0,
        Math.min(1, (produced - minMax.min) / (minMax.max - minMax.min))
      );
    } else if (minMax && produced !== null && minMax.max === minMax.min) {
      fraction = 0.5;
    }

    const startPoint = pointOnArc(0);
    const endPoint = pointOnArc(1);
    const markerPoint = pointOnArc(fraction);
    const fullArcPath = describeArcPath(0, 1);
    const progressArcPath = fraction > 0 ? describeArcPath(0, fraction) : "";

    const arcColor = this._colorForValue(produced, cfg.energy_color_stops, "#1565c0");
    const producedColor = this._colorForValue(produced, cfg.energy_color_stops, "#1565c0");
    const producedUnit = cfg.unit;

    const startLabel = isTotal
      ? `0 ${cfg.unit}`
      : minMax
      ? `${this._fmt(minMax.min, decimals)} ${cfg.unit}`
      : "–";
    const endLabel = isTotal
      ? produced !== null
        ? `${this._fmt(produced, decimals)} ${cfg.unit}`
        : "–"
      : minMax
      ? `${this._fmt(minMax.max, decimals)} ${cfg.unit}`
      : "–";

    // ---- String-Kacheln (kWh, periodenabhängig) ----
    const tileCountClass =
      periodTiles.length === 3
        ? "tiles-3"
        : periodTiles.length <= 2
        ? "tiles-2"
        : "tiles-4";

    const tilesHtml = periodTiles.length
      ? `<div class="power-tiles ${tileCountClass}">
           ${periodTiles
             .map((t) => {
               const label = t.name || t.entity;
               const valueKwh = t.periodValue;
               const valid = valueKwh !== null && valueKwh !== undefined;

               return `
                 <div class="power-tile">
                   <div class="power-tile-name">${label}</div>
                   <div class="power-tile-value">${
                     valid ? this._fmt(valueKwh, decimals) + " kWh" : "–"
                   }</div>
                 </div>
               `;
             })
             .join("")}
         </div>`
      : "";

    // ---- Energiefluss: Haus / Batterie / Netz, periodenabhängig (kWh) ----
    const flowsHtml = flows
      ? `<div class="energy-flows">
           ${this._renderFlowItem("house", "PV", flows.house, "#ff9800", "kWh", decimals)}
           ${this._renderFlowItem("battery", "Batterie", flows.battery, "#4db6ac", "kWh", decimals)}
           ${this._renderFlowItem("grid", "Netz", flows.grid, "#488fc2", "kWh", decimals)}
         </div>`
      : "";

    const periodLabels = {
      day: "Tag",
      week: "Woche",
      month: "Monat",
      year: "Jahr",
      total: "Gesamt",
    };
    const periodSelectorHtml = `
      <div class="period-selector">
        ${Object.entries(periodLabels)
          .map(
            ([key, label]) => `
              <button class="period-btn ${this._energyPeriod === key ? "active" : ""}" data-period="${key}">${label}</button>
            `
          )
          .join("")}
      </div>
    `;

    const loadingOverlay = this._periodLoading
      ? `<div class="period-loading">Lade Daten …</div>`
      : "";

    return `
      ${periodSelectorHtml}
      <div class="energy-tab-body" style="position:relative;">
        ${loadingOverlay}
        <svg viewBox="0 0 300 170" class="arc-svg">
          <path d="${fullArcPath}" class="arc-bg" />
          ${progressArcPath ? `<path d="${progressArcPath}" class="arc-progress" style="stroke:${arcColor}" />` : ""}
          <circle cx="${startPoint.x}" cy="${startPoint.y}" r="4" class="dot-edge" />
          <circle cx="${endPoint.x}" cy="${endPoint.y}" r="4" class="dot-edge" />
          <g transform="translate(${markerPoint.x}, ${markerPoint.y})">
            <circle r="11" class="marker-glow" style="fill:${arcColor}" />
            <circle r="7" class="marker-core" style="fill:${arcColor}" />
          </g>
          <text x="${startPoint.x}" y="${startPoint.y + 20}" class="edge-label" text-anchor="middle">${startLabel}</text>
          <text x="${endPoint.x}" y="${endPoint.y + 20}" class="edge-label" text-anchor="middle">${endLabel}</text>
          <text x="${cx}" y="${cy - 6}" class="power-value-svg" text-anchor="middle" style="fill:${producedColor}">
            ${produced !== null ? this._fmt(produced, decimals) + " " + producedUnit : "–"}
          </text>
          <text x="${cx}" y="${cy + 14}" class="power-label-svg" text-anchor="middle">Verbraucht</text>
        </svg>
        ${flowsHtml}
        ${tilesHtml}
      </div>
    `;
  }

  // ---- Tab: Live (Leistung) ----------------------------------------------------

  _renderLiveTab() {
    const cfg = this._config;
    const { cx, cy, pointOnArc, describeArcPath } = this._arcGeometry();

    const currentPower = cfg.power_entity
      ? this._getNumericState(cfg.power_entity)
      : null;
    const powerUnit = cfg.power_entity
      ? this._getState(cfg.power_entity)?.attributes?.unit_of_measurement || "W"
      : "W";

    // Maximalwert: Sensor hat Vorrang vor fester Zahl. Wird auf die Einheit
    // von power_entity normalisiert, damit die Fraction-Berechnung stimmt.
    // Minimum ist immer fix 0.
    let powerMax = null;
    if (cfg.power_max_entity) {
      const maxRaw = this._getNumericState(cfg.power_max_entity);
      const maxUnit =
        this._getState(cfg.power_max_entity)?.attributes
          ?.unit_of_measurement || powerUnit;
      if (maxRaw !== null) {
        powerMax = this._normalizeToUnit(maxRaw, maxUnit, powerUnit);
      }
    } else if (cfg.power_max !== null && cfg.power_max !== undefined && cfg.power_max !== "") {
      const parsed = parseFloat(cfg.power_max);
      powerMax = Number.isNaN(parsed) ? null : parsed;
    }

    const minMax = powerMax !== null ? { min: 0, max: powerMax, current: currentPower } : null;
    let fraction = 0;
    if (minMax && currentPower !== null && minMax.max > 0) {
      fraction = Math.max(0, Math.min(1, currentPower / minMax.max));
    }

    const startPoint = pointOnArc(0);
    const endPoint = pointOnArc(1);
    const markerPoint = pointOnArc(fraction);
    const fullArcPath = describeArcPath(0, 1);
    const progressArcPath = fraction > 0 ? describeArcPath(0, fraction) : "";

    const arcColor = this._colorForValue(currentPower, cfg.power_color_stops, "#1565c0");

    const startLabel = minMax ? this._fmtPower(minMax.min, powerUnit) : this._fmtPower(0, powerUnit);
    const endLabel = minMax ? this._fmtPower(minMax.max, powerUnit) : "–";

    const tiles = (cfg.power_tiles || []).filter((t) => t && t.entity).slice(0, MAX_TILES);
    const tileCountClass =
      tiles.length === 3 ? "tiles-3" : tiles.length <= 2 ? "tiles-2" : "tiles-4";

    const tilesHtml = tiles.length
      ? `<div class="power-tiles ${tileCountClass}">
           ${tiles
             .map((t) => {
               const ent = this._getState(t.entity);
               const rawVal = ent ? parseFloat(ent.state) : null;
               const unit = ent?.attributes?.unit_of_measurement || "W";
               const label = t.name || t.entity;
               const valid = rawVal !== null && !Number.isNaN(rawVal);

               return `
                 <div class="power-tile">
                   <div class="power-tile-name">${label}</div>
                   <div class="power-tile-value">${
                     valid ? this._fmtPower(rawVal, unit) : "–"
                   }</div>
                 </div>
               `;
             })
             .join("")}
         </div>`
      : "";

    // ---- Energiefluss: Haus / Batterie / Netz ----
    // Zeigt nur den Betrag des Stroms, der zum jeweiligen Ziel fließt -
    // keine Richtungspfeile. Farben angelehnt an die Standardfarben des
    // Home Assistant Energy-Dashboards.
    const flows = this._getEnergyFlows(currentPower, "flow_", "W");
    const flowsHtml = flows
      ? `<div class="energy-flows">
           ${this._renderFlowItem("house", "PV", flows.house, "#ff9800", "W")}
           ${this._renderFlowItem("battery", "Batterie", flows.battery, "#4db6ac", "W")}
           ${this._renderFlowItem("grid", "Netz", flows.grid, "#488fc2", "W")}
         </div>`
      : "";

    return `
      <svg viewBox="0 0 300 170" class="arc-svg">
        <path d="${fullArcPath}" class="arc-bg" />
        ${progressArcPath ? `<path d="${progressArcPath}" class="arc-progress" style="stroke:${arcColor}" />` : ""}
        <circle cx="${startPoint.x}" cy="${startPoint.y}" r="4" class="dot-edge" />
        <circle cx="${endPoint.x}" cy="${endPoint.y}" r="4" class="dot-edge" />
        <g transform="translate(${markerPoint.x}, ${markerPoint.y})">
          <circle r="11" class="marker-glow" style="fill:${arcColor}" />
          <circle r="7" class="marker-core" style="fill:${arcColor}" />
        </g>
        <text x="${startPoint.x}" y="${startPoint.y + 20}" class="edge-label" text-anchor="middle">${startLabel}</text>
        <text x="${endPoint.x}" y="${endPoint.y + 20}" class="edge-label" text-anchor="middle">${endLabel}</text>
        <text x="${cx}" y="${cy - 6}" class="power-value-svg" text-anchor="middle" style="fill:${arcColor}">
          ${this._fmtPower(currentPower, powerUnit)}
        </text>
        <text x="${cx}" y="${cy + 14}" class="power-label-svg" text-anchor="middle">Aktuelle Leistung</text>
      </svg>
      ${flowsHtml}
      ${tilesHtml}
    `;
  }

  /**
   * Rendert ein einzelnes Flow-Item (Haus/Batterie/Netz) mit Icon und Betrag.
   * Zeigt nur den Betrag (kein Vorzeichen, keine Richtungspfeile) - Farbe ist
   * fest pro Kanal, angelehnt an die Home-Assistant-Energy-Dashboard-Farben.
   */
  _renderFlowItem(kind, label, value, color, unit, decimals) {
    const valueStr =
      value === null
        ? "–"
        : unit === "kWh"
        ? `${this._fmt(Math.abs(value), decimals)} kWh`
        : this._fmtPower(Math.abs(value), "W");

    const icons = {
      house: `<circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />`,
      battery: `<path d="M7 7h8v2h2v6h-2v2H7V7zM5 10H3v4h2z" />`,
      grid: `<path d="M13 2 4 14h6l-1 8 9-12h-6z" />`,
    };

    return `
      <div class="flow-item">
        <svg viewBox="0 0 24 24" class="flow-icon" style="fill:${color}; color:${color};">
          ${icons[kind] || ""}
        </svg>
        <div class="flow-label">${label}</div>
        <div class="flow-value" style="color:${color}">${valueStr}</div>
      </div>
    `;
  }

  _styles() {
    return `
      <style>
        ha-card.pv-card {
          padding: 16px;
          display: block;
        }
        .card-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-bottom: 14px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .title {
          font-size: 1.1em;
          font-weight: 500;
          color: var(--primary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tabs {
          display: flex;
          gap: 4px;
          background: rgba(128,128,128,0.1);
          border-radius: 8px;
          padding: 3px;
          flex-shrink: 0;
        }
        .tab-btn {
          border: none;
          background: transparent;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.8em;
          font-weight: 600;
          color: var(--secondary-text-color, #888);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .tab-btn.active {
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .tab-content {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .period-selector {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 10px;
        }
        .period-btn {
          border: 1px solid var(--divider-color, #ccc);
          background: transparent;
          padding: 4px 10px;
          border-radius: 14px;
          font-size: 0.75em;
          font-weight: 600;
          color: var(--secondary-text-color, #888);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .period-btn.active {
          background: var(--primary-color, #03a9f4);
          border-color: var(--primary-color, #03a9f4);
          color: #fff;
        }
        .energy-tab-body {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .period-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85em;
          color: var(--secondary-text-color, #888);
          background: var(--card-background-color, rgba(255,255,255,0.6));
          opacity: 0.85;
          z-index: 2;
          border-radius: 8px;
        }
        .arc-svg {
          width: 100%;
          max-width: 320px;
          height: auto;
          overflow: visible;
        }
        .arc-bg {
          fill: none;
          stroke: var(--divider-color, #e0e0e0);
          stroke-width: 10;
          stroke-linecap: round;
        }
        .arc-progress {
          fill: none;
          stroke-width: 10;
          stroke-linecap: round;
        }
        .dot-edge {
          fill: var(--secondary-text-color, #888);
        }
        .marker-glow {
          opacity: 0.35;
        }
        .marker-core {
          stroke: #fff;
          stroke-width: 2;
        }
        .edge-label {
          font-size: 11px;
          fill: var(--secondary-text-color, #888);
        }
        .kwh-value {
          font-size: 20px;
          font-weight: 700;
        }
        .kwh-unit {
          font-size: 10px;
          font-weight: 400;
          fill: var(--secondary-text-color, #888);
        }
        .kwh-label {
          font-size: 9px;
          fill: var(--secondary-text-color, #888);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .kwh-divider {
          stroke: var(--divider-color, #e0e0e0);
          stroke-width: 1;
        }
        .power-value-svg {
          font-size: 26px;
          font-weight: 700;
          fill: var(--primary-text-color);
        }
        .power-label-svg {
          font-size: 11px;
          fill: var(--secondary-text-color, #888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .autarky-value-svg {
          font-size: 13px;
          font-weight: 600;
          fill: var(--secondary-text-color, #888);
        }
        .energy-flows {
          width: 100%;
          display: flex;
          justify-content: space-around;
          gap: 8px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid rgba(128, 128, 128, 0.3);
        }
        .flow-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          min-width: 0;
        }
        .flow-icon {
          width: 22px;
          height: 22px;
        }
        .flow-label {
          font-size: 0.75em;
          color: var(--secondary-text-color, #888);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .flow-value {
          font-size: 0.95em;
          font-weight: 700;
          white-space: nowrap;
        }
        .power-tiles {
          width: 100%;
          display: grid;
          gap: 8px;
          margin-top: 14px;
        }
        .power-tiles.tiles-4,
        .power-tiles.tiles-2 {
          grid-template-columns: repeat(2, 1fr);
        }
        .power-tiles.tiles-3 {
          grid-template-columns: repeat(3, 1fr);
        }
        .power-tile {
          background: rgba(128,128,128,0.08);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .power-tile-name {
          font-size: 0.75em;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          opacity: 0.55;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .power-tile-value {
          font-size: 1.1em;
          font-weight: 700;
          color: var(--primary-text-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .power-tile-sub {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          font-size: 0.7em;
          color: var(--secondary-text-color, #888);
          margin-top: 1px;
        }
        .power-tile-sub span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
    `;
  }
}

// ---- Visueller Editor --------------------------------------------------------

class ConsumptionArcCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    if (!Array.isArray(this._config.power_tiles)) {
      this._config.power_tiles = [];
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _render() {
    if (!this._config) return;
    const tiles = this._config.power_tiles || [];
    const energyTiles = this._config.energy_tiles || [];

    this.innerHTML = `
      <div style="padding: 8px 0; display: flex; flex-direction: column; gap: 12px;">
        ${this._field("title", "Titel", this._config.title || "")}
        ${this._selectField("default_tab", "Standard-Tab", this._config.default_tab || "energy", [
          { value: "energy", label: "Tageswerte (Energie)" },
          { value: "live", label: "Live (Leistung)" },
        ])}

        <hr style="border-color: var(--divider-color, #444); width: 100%;" />
        <div style="font-size:0.85em; font-weight:600; color: var(--primary-text-color);">📅 Tageswerte (Verbrauch, kWh)</div>
        ${this._field("produced_entity", "Entity: verbrauchte kWh heute", this._config.produced_entity || "")}
        ${this._field("energy_min", "Min-Verbrauch fest (Zahl in kWh) – ignoriert falls Sensor unten gesetzt", this._config.energy_min ?? "")}
        ${this._field("energy_min_entity", "Entity: Min-Verbrauch (Sensor, hat Vorrang vor fester Zahl)", this._config.energy_min_entity || "")}
        ${this._field("energy_max", "Max-Verbrauch fest (Zahl in kWh) – ignoriert falls Sensor unten gesetzt", this._config.energy_max ?? "")}
        ${this._field("energy_max_entity", "Entity: Max-Verbrauch (Sensor, hat Vorrang vor fester Zahl)", this._config.energy_max_entity || "")}
        ${this._colorStopsSection("energy_color_stops", "🎨 Farbschwellen Tageswerte (kWh)", this._config.energy_color_stops || [])}

        <div style="width:100%;">
          <label style="display:block; font-size:0.85em; margin-bottom:6px; color: var(--secondary-text-color, #888);">
            🔢 Nachkommastellen je Zeitraum (gilt für Verbraucht, Energiefluss &amp; Kacheln)
          </label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${this._decimalsField("decimals_day", "Tag", this._config.decimals_day)}
            ${this._decimalsField("decimals_week", "Woche", this._config.decimals_week)}
            ${this._decimalsField("decimals_month", "Monat", this._config.decimals_month)}
            ${this._decimalsField("decimals_year", "Jahr", this._config.decimals_year)}
            ${this._decimalsField("decimals_total", "Gesamt", this._config.decimals_total)}
          </div>
        </div>

        <div style="font-size:0.7em; color: var(--secondary-text-color, #888); margin-top:4px;">Quellen des Verbrauchs heute. Mindestens 2 von 3 Werten angeben, der dritte wird aus der bisher verbrauchten kWh-Menge berechnet.</div>
        ${this._flowEntityField("energy_flow_house_entity", "energy_flow_house_invert", "Entity: PV-Eigenverbrauch heute (kWh)", this._config.energy_flow_house_entity, this._config.energy_flow_house_invert)}
        ${this._flowEntityField("energy_flow_battery_entity", "energy_flow_battery_invert", "Entity: aus Batterie heute (kWh)", this._config.energy_flow_battery_entity, this._config.energy_flow_battery_invert)}
        ${this._flowEntityField("energy_flow_grid_entity", "energy_flow_grid_invert", "Entity: Netzbezug heute (kWh)", this._config.energy_flow_grid_entity, this._config.energy_flow_grid_invert)}

        <div style="font-size:0.85em; font-weight:600; color: var(--primary-text-color); margin-top:6px;">🔢 Verbraucher-Kacheln Tageswerte (max. 4, kWh)</div>
        ${this._tilesSection(energyTiles, "energy_tiles", "kWh")}

        <hr style="border-color: var(--divider-color, #444); width: 100%;" />
        <div style="font-size:0.85em; font-weight:600; color: var(--primary-text-color);">⚡ Live (Leistung, W)</div>
        ${this._field("power_entity", "Entity: aktuelle PV-Leistung (W)", this._config.power_entity || "")}
        <div style="font-size:0.7em; color: var(--secondary-text-color, #888);">Minimum ist immer 0 W.</div>
        ${this._field("power_max", "Max-Leistung fest (Zahl in W, z.B. 6000) – ignoriert falls Sensor unten gesetzt", this._config.power_max ?? "")}
        ${this._field("power_max_entity", "Entity: Max-Leistung (Sensor, hat Vorrang vor fester Zahl)", this._config.power_max_entity || "")}
        ${this._colorStopsSection("power_color_stops", "🎨 Farbschwellen Live (W)", this._config.power_color_stops || [])}

        <hr style="border-color: var(--divider-color, #444); width: 100%;" />
        <div style="font-size:0.85em; font-weight:600; color: var(--primary-text-color);">🔀 Energiefluss Live (PV / Batterie / Netz, W)</div>
        <div style="font-size:0.7em; color: var(--secondary-text-color, #888);">
          Quellen des aktuellen Verbrauchs. Mindestens 2 von 3 Werten angeben, der dritte wird aus der aktuellen Verbrauchsleistung berechnet. Ohne mind. 2 Werte wird die Sektion ausgeblendet.
          "Invertieren" dreht das Vorzeichen um, falls dein Sensor andersrum zählt.
        </div>
        ${this._flowEntityField("flow_house_entity", "flow_house_invert", "Entity: PV-Eigenverbrauch aktuell (W)", this._config.flow_house_entity, this._config.flow_house_invert)}
        ${this._flowEntityField("flow_battery_entity", "flow_battery_invert", "Entity: aus Batterie aktuell (W)", this._config.flow_battery_entity, this._config.flow_battery_invert)}
        ${this._flowEntityField("flow_grid_entity", "flow_grid_invert", "Entity: Netzbezug aktuell (W)", this._config.flow_grid_entity, this._config.flow_grid_invert)}

        <hr style="border-color: var(--divider-color, #444); width: 100%;" />
        <div style="font-size:0.85em; font-weight:600; color: var(--primary-text-color);">🔢 Verbraucher-Kacheln Live (max. 4, W)</div>
        ${this._tilesSection(tiles, "power_tiles", "W")}
      </div>
    `;

    this.querySelectorAll("input[data-key], select[data-key]").forEach((input) => {
      input.addEventListener("change", (ev) => {
        const key = ev.target.dataset.key;
        this._config = { ...this._config, [key]: ev.target.value };
        this._emitChange();
        if (key === "default_tab") this._render();
      });
    });

    this.querySelectorAll("input[data-checkbox-key]").forEach((input) => {
      input.addEventListener("change", (ev) => {
        const key = ev.target.dataset.checkboxKey;
        this._config = { ...this._config, [key]: ev.target.checked };
        this._emitChange();
      });
    });

    this.querySelectorAll("input[data-stops-key]").forEach((input) => {
      input.addEventListener("change", (ev) => {
        const stopsKey = ev.target.dataset.stopsKey;
        const idx = parseInt(ev.target.dataset.index);
        const field = ev.target.dataset.field;
        const stops = [...(this._config[stopsKey] || [])];
        stops[idx] = { ...stops[idx], [field]: ev.target.value };
        this._config = { ...this._config, [stopsKey]: stops };
        this._emitChange();
      });
    });

    this.querySelectorAll("[data-remove-stop]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stopsKey = btn.dataset.removeStop;
        const idx = parseInt(btn.dataset.index);
        const stops = [...(this._config[stopsKey] || [])];
        stops.splice(idx, 1);
        this._config = { ...this._config, [stopsKey]: stops };
        this._emitChange();
        this._render();
      });
    });

    this.querySelectorAll("[data-add-stop]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stopsKey = btn.dataset.addStop;
        const stops = [...(this._config[stopsKey] || [])];
        stops.push({ value: 0, color: "#1565c0" });
        this._config = { ...this._config, [stopsKey]: stops };
        this._emitChange();
        this._render();
      });
    });

    // Kachel-Felder (Name/Entity/Module) ändern - generisch für power_tiles
    // und energy_tiles, gesteuert über data-tile-config-key.
    this.querySelectorAll("input[data-tile-field]").forEach((input) => {
      input.addEventListener("change", (ev) => {
        const idx = parseInt(ev.target.dataset.tileIndex);
        const field = ev.target.dataset.tileField;
        const configKey = ev.target.dataset.tileConfigKey;
        const tiles = [...(this._config[configKey] || [])];
        tiles[idx] = { ...tiles[idx], [field]: ev.target.value };
        this._config = { ...this._config, [configKey]: tiles };
        this._emitChange();
      });
    });

    // Kachel entfernen
    this.querySelectorAll("[data-remove-tile]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const configKey = btn.dataset.removeTile;
        const idx = parseInt(btn.dataset.index);
        const tiles = [...(this._config[configKey] || [])];
        tiles.splice(idx, 1);
        this._config = { ...this._config, [configKey]: tiles };
        this._emitChange();
        this._render();
      });
    });

    // Kachel hinzufügen (max. 4 je Sektion)
    this.querySelectorAll("[data-add-tile]").forEach((addTileBtn) => {
      addTileBtn.addEventListener("click", () => {
        const configKey = addTileBtn.dataset.addTile;
        const tiles = [...(this._config[configKey] || [])];
        if (tiles.length >= MAX_TILES) return;
        tiles.push({ name: "", entity: "" });
        this._config = { ...this._config, [configKey]: tiles };
        this._emitChange();
        this._render();
      });
    });
  }

  _emitChange() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _tilesSection(tiles, configKey, unit) {
    const isEnergy = unit === "kWh";
    const rows = tiles
      .map(
        (tile, idx) => `
        <div style="border:1px solid var(--divider-color, #444); border-radius:6px; padding:8px; margin-bottom:8px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <input
              type="text"
              data-tile-field="name"
              data-tile-config-key="${configKey}"
              data-tile-index="${idx}"
              value="${tile.name || ""}"
              placeholder="Anzeigename (optional)"
              style="flex:1; box-sizing:border-box; padding:6px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
            />
            <input
              type="text"
              data-tile-field="entity"
              data-tile-config-key="${configKey}"
              data-tile-index="${idx}"
              value="${tile.entity || ""}"
              placeholder="${isEnergy ? "sensor.kueche_kwh_heute" : "sensor.kueche_leistung"}"
              style="flex:1.4; box-sizing:border-box; padding:6px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
            />
            <button
              data-remove-tile="${configKey}"
              data-index="${idx}"
              style="padding:6px 10px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); cursor:pointer;"
            >✕</button>
          </div>
        </div>
      `
      )
      .join("");

    const canAddMore = tiles.length < MAX_TILES;

    return `
      <div style="width:100%;">
        <div style="font-size:0.7em; color: var(--secondary-text-color, #888); margin-bottom:8px;">
          Bis zu 4 Kacheln, z.B. für einzelne Verbraucher/Stromkreise (Küche, Heizung, ...). Name ist optional (Standard: Entity-ID).
        </div>
        ${rows}
        ${
          canAddMore
            ? `<button
                 data-add-tile="${configKey}"
                 style="margin-top:4px; padding:6px 12px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); cursor:pointer;"
               >+ Kachel hinzufügen (${tiles.length}/4)</button>`
            : `<div style="font-size:0.75em; color: var(--secondary-text-color, #888);">Maximum von 4 Kacheln erreicht.</div>`
        }
      </div>
    `;
  }

  _colorStopsSection(stopsKey, title, stops) {
    const rows = stops
      .map(
        (stop, idx) => `
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
          <input
            type="number"
            data-stops-key="${stopsKey}"
            data-index="${idx}"
            data-field="value"
            value="${stop.value ?? 0}"
            placeholder="Schwellwert"
            style="flex:1; box-sizing:border-box; padding:6px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
          />
          <input
            type="color"
            data-stops-key="${stopsKey}"
            data-index="${idx}"
            data-field="color"
            value="${stop.color || "#1565c0"}"
            style="width:42px; height:34px; padding:2px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff);"
          />
          <button
            data-remove-stop="${stopsKey}"
            data-index="${idx}"
            style="padding:6px 10px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); cursor:pointer;"
          >✕</button>
        </div>
      `
      )
      .join("");

    return `
      <div style="width:100%;">
        <label style="display:block; font-size:0.85em; margin-bottom:6px; color: var(--secondary-text-color, #888);">
          ${title}
        </label>
        <div style="font-size:0.7em; color: var(--secondary-text-color, #888); margin-bottom:8px;">
          Ab erreichtem Schwellwert gilt die zugehörige Farbe. Ohne Eintrag bleibt die Standardfarbe.
        </div>
        ${rows}
        <button
          data-add-stop="${stopsKey}"
          style="margin-top:4px; padding:6px 12px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); cursor:pointer;"
        >+ Stufe hinzufügen</button>
      </div>
    `;
  }

  _selectField(key, label, value, options) {
    return `
      <div>
        <label style="display:block; font-size:0.85em; margin-bottom:4px; color: var(--secondary-text-color, #888);">
          ${label}
        </label>
        <select
          data-key="${key}"
          style="width:100%; box-sizing:border-box; padding:8px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
        >
          ${options
            .map(
              (opt) =>
                `<option value="${opt.value}" ${opt.value === value ? "selected" : ""}>${opt.label}</option>`
            )
            .join("")}
        </select>
      </div>
    `;
  }

  _field(key, label, value) {
    return `
      <div>
        <label style="display:block; font-size:0.85em; margin-bottom:4px; color: var(--secondary-text-color, #888);">
          ${label}
        </label>
        <input
          data-key="${key}"
          type="text"
          value="${value}"
          style="width:100%; box-sizing:border-box; padding:8px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
        />
      </div>
    `;
  }

  /** Kompaktes Label + Zahlenfeld (0-6) für die Dezimalstellen-Einstellung eines Zeitraums. */
  _decimalsField(key, label, value) {
    const v = value === undefined || value === null ? 2 : value;
    return `
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
        <label style="font-size:0.7em; color: var(--secondary-text-color, #888);">${label}</label>
        <input
          data-key="${key}"
          type="number"
          min="0"
          max="6"
          step="1"
          value="${v}"
          style="width:56px; box-sizing:border-box; padding:6px; text-align:center; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
        />
      </div>
    `;
  }

  /** Entity-Feld + "Invertieren"-Checkbox in einer Zeile, für Energiefluss-Kanäle. */
  _flowEntityField(entityKey, invertKey, label, entityValue, invertValue) {
    return `
      <div>
        <label style="display:block; font-size:0.85em; margin-bottom:4px; color: var(--secondary-text-color, #888);">
          ${label}
        </label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input
            data-key="${entityKey}"
            type="text"
            value="${entityValue || ""}"
            style="flex:1; box-sizing:border-box; padding:8px; border:1px solid var(--divider-color, #ccc); border-radius:4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000);"
          />
          <label style="display:flex; align-items:center; gap:4px; font-size:0.75em; color: var(--secondary-text-color, #888); white-space:nowrap;">
            <input
              data-checkbox-key="${invertKey}"
              type="checkbox"
              ${invertValue ? "checked" : ""}
            />
            Invertieren
          </label>
        </div>
      </div>
    `;
  }
}

customElements.define("consumption-arc-card", ConsumptionArcCard);
customElements.define("consumption-arc-card-editor", ConsumptionArcCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "consumption-arc-card",
  name: "Consumption Arc Card",
  description:
    "Umschaltbare Tabs: Tageswerte (kWh-Bogen) und Live (Leistungs-Bogen + Verbrauchs-Kacheln).",
});
