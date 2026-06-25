# Contributing

## Ziel

Dieses Repository ist ein öffentliches Subset von `del_stats_frontend_ext`. Änderungen sollten deshalb so erfolgen, dass sie im privaten Repository leicht nachvollzogen und bei Bedarf übernommen werden können.

## Grundregeln

1. Änderungen klein halten und auf ein Thema begrenzen.
2. Vorhandene Pfade, Dateinamen und Template-Strukturen nach Möglichkeit beibehalten.
3. Keine unnötigen Umbenennungen oder großflächigen Verschiebungen durchführen.
4. Dokumentieren, welche Dateien betroffen sind und warum die Änderung nötig ist.

## Praktische Hinweise

- Bevorzugt gezielte Änderungen statt breiter Umstrukturierungen
- Bestehende AngularJS-Muster nur dann ändern, wenn der Nutzen klar ist
- Bei öffentlichen Änderungen immer mitdenken, ob dieselbe Anpassung im privaten Superset nötig ist
- Wenn ein Change schwer portierbar wäre, zuerst den Ansatz vereinfachen

## Validierung

Derzeit ist im Repository keine standardisierte Build-, Lint- oder Test-Pipeline eingecheckt. Änderungen sollten daher mindestens auf offensichtliche Konsistenz geprüft werden, ohne die bestehende Laufzeitstruktur unnötig zu verändern.
