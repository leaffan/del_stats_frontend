# DEL Hockey Stats Frontend

Öffentliches Frontend für DEL-Hockeystatistiken. Das Repository enthält ein statisches AngularJS-Frontend zur Darstellung von Spieler-, Team- und Karrieredaten.

## Projektstatus

- Architektur: statische Single-Page-App mit AngularJS 1.7
- Styling: Bootstrap 4, Angular Material, projektinterne CSS-Dateien
- Datenquellen: JSON/CSV-Dateien aus `data/` sowie externe Assets
- Besonderheit: Dieses Repository ist ein **öffentliches Subset** von `del_stats_frontend_ext`

## Repository-Struktur

- `/index.html` – Einstiegspunkt der Anwendung
- `/js` – AngularJS-App, Routing und Controller
- `/css` – Stylesheets
- `/cfg` – Konfigurations- und Spaltendefinitionen
- `/custom_directives` – AngularJS-Templates für wiederverwendete Tabellen und UI-Blöcke
- `/*.html` – Routen-Templates

## Lokale Nutzung

Da es sich um ein statisches Frontend handelt, reicht ein einfacher lokaler Webserver:

```bash
cd /home/runner/work/del_stats_frontend/del_stats_frontend
python3 -m http.server 8000
```

Danach kann die Anwendung unter `http://localhost:8000/index.html` geöffnet werden.

## Datenhinweise

- Das Repository enthält nicht alle laufzeitrelevanten Daten im Git-Tracking.
- Mehrere Seiten erwarten Dateien unter `data/`.
- Änderungen an Datenexporten oder internen Datenquellen müssen mit dem privaten Repository `del_stats_frontend_ext` abgestimmt bleiben.

## Wartungsprinzipien

Um Änderungen zwischen dem öffentlichen und dem privaten Repository nachvollziehbar zu halten:

1. Änderungen klein und thematisch klar halten.
2. Bestehende Dateistruktur und Pfade möglichst beibehalten.
3. Refactorings nur durchführen, wenn sie einen klaren Mehrwert haben und leicht portierbar sind.
4. In Änderungsbeschreibungen immer angeben, welche Dateien und welches Verhalten betroffen sind.

## Aktuelle Verbesserungspotenziale

- README, Contributor-Dokumentation und Repository-Hygiene weiter ausbauen
- Konfiguration wie Saisonwerte und Datenquellen stärker zentralisieren
- Automatisierte Prüfungen und CI ergänzen
- Große Controller schrittweise in kleinere Einheiten aufteilen

## Beitragen

Siehe `/home/runner/work/del_stats_frontend/del_stats_frontend/CONTRIBUTING.md`.
