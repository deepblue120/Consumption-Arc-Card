# Consumption Arc Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)

Eine Custom Lovelace Card für Home Assistant, die deinen Hausverbrauch (oder einen beliebigen anderen Energie-Verbrauchsbereich) als Halbkreis-Bogen visualisiert — Schwesterkarte der [PV Arc Card](https://github.com/deepblue120/pv-arc-card), strukturell identisch aufgebaut, aber für Verbrauch statt Erzeugung.

![Screenshot](docs/screenshot-energy.png)
![Screenshot](docs/screenshot-live.png)

## Funktionen

**Tab "Tageswerte"**
- Halbkreis-Bogen von Min- bis Max-Verbrauch eines Tages, Marker zeigt den verbrauchten Energiebetrag im gewählten Zeitraum
- Zeitraum-Auswahl: Tag / Woche / Monat / Jahr / Gesamt — Werte werden direkt aus der Home-Assistant-Langzeitstatistik berechnet (gleiche Methode wie das offizielle Energy-Dashboard), kein zusätzlicher Sensor pro Zeitraum nötig
- Energiefluss-Sektion: zeigt, woher der verbrauchte Strom kam (PV-Eigenverbrauch / Batterie / Netzbezug), zeitraumabhängig in kWh
- Bis zu 4 frei konfigurierbare Verbraucher-Kacheln (z. B. Küche, Heizung, Sonstiges)

**Tab "Live"**
- Halbkreis-Bogen von 0 bis Max-Leistung, Marker zeigt aktuelle Verbrauchsleistung
- Energiefluss-Sektion: PV / Batterie / Netz in Watt
- Bis zu 4 Verbraucher-Kacheln

**Weitere Eigenschaften**
- Frei konfigurierbare Farbschwellen (Bogen-Farbe ändert sich je nach Verbrauchshöhe)
- Nachkommastellen separat pro Zeitraum einstellbar
- Vollständig über den visuellen Editor konfigurierbar, kein YAML nötig (geht aber auch)

## Installation

### Über HACS (empfohlen)

1. HACS öffnen → Menü (⋮) oben rechts → **Benutzerdefinierte Repositories**
2. Repository-URL eintragen: `https://github.com/deepblue120/consumption-arc-card`
3. Kategorie: **Dashboard**
4. **Hinzufügen**, dann die Karte in HACS suchen und installieren
5. Home Assistant neu laden (Browser-Cache leeren, `Strg+Shift+R`)

### Manuell

1. [`consumption-arc-card.js`](dist/consumption-arc-card.js) herunterladen
2. Nach `/config/www/consumption-arc-card.js` kopieren
3. In **Einstellungen → Dashboards → Ressourcen** hinzufügen:
   - URL: `/local/consumption-arc-card.js`
   - Typ: **JavaScript-Modul**
4. Browser-Cache leeren (`Strg+Shift+R`)

## Verwendung

Karte im Dashboard hinzufügen, Typ: `custom:consumption-arc-card`. Über den visuellen Editor lassen sich alle Entities, Farben und Optionen einstellen — alternativ direkt per YAML:

```yaml
type: custom:consumption-arc-card
title: Hausverbrauch
default_tab: energy

# Tageswerte (kWh)
produced_entity: sensor.hausverbrauch_energie_gesamt_taeglich
energy_min_entity: sensor.hausverbrauch_energie_min_heute
energy_max_entity: sensor.hausverbrauch_energie_max_heute
energy_color_stops:
  - { value: 0, color: "#2e7d32" }
  - { value: 15, color: "#1565c0" }
  - { value: 25, color: "#c62828" }
energy_flow_house_entity: sensor.pv_eigenverbrauch_heute_kwh
energy_flow_battery_entity: sensor.batterie_entladen_heute_kwh
energy_flow_grid_entity: sensor.netzbezug_heute_kwh
energy_tiles:
  - { name: "Küche", entity: sensor.kueche_kwh_heute }
  - { name: "Heizung", entity: sensor.heizung_kwh_heute }

# Live (W)
power_entity: sensor.hausverbrauch_leistung_gesamt
power_max_entity: input_number.hausverbrauch_peak_allzeit
flow_house_entity: sensor.pv_eigenverbrauch_aktuell
flow_battery_entity: sensor.batterie_leistung
flow_grid_entity: sensor.netz_leistung
power_tiles:
  - { name: "Küche", entity: sensor.kueche_leistung }
  - { name: "Heizung", entity: sensor.heizung_leistung }
```

Eine vollständige Liste aller Optionen mit Erklärung steht im Kopfkommentar von [`dist/consumption-arc-card.js`](dist/consumption-arc-card.js).

## Voraussetzungen

- Für die Zeitraum-Auswahl (Woche/Monat/Jahr/Gesamt) im Tageswerte-Tab benötigt `produced_entity` (und optional die Energiefluss-/Kachel-Entities) `state_class: total` oder `total_increasing` mit aktivierter Langzeitstatistik in Home Assistant.

## Lizenz

[MIT](LICENSE)
