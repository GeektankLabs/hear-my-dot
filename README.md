# Hear My Dot

Kleiner, unabhängig geschriebener Chrome-MV3-Prototyp: Sobald ein nicht stummgeschalteter Tab auf **chatgpt.com** Audio meldet, werden andere Tabs desselben Profils stummgeschaltet. Alle ChatGPT-Tabs bleiben ausgenommen, unabhängig vom Pfad. Nach **20 Sekunden Ruhe**, konfigurierbar von 10–20 Sekunden, werden nur selbst vorgenommene Mute-Änderungen zurückgenommen. Bereits stumme Tabs bleiben stumm; manuelle Änderungen haben Vorrang.

## Stand und Umfang

Lokaler Funktionsnachweis mit isolierten Basistests. Noch **nicht in Chrome installiert oder praktisch verifiziert**. Repository: https://github.com/geco91/hear-my-dot — öffentlicher Quellcode unter MIT, Veröffentlichung ausdrücklich freigegeben. Kein Chrome-Web-Store-Release, keine CI, kein Native Helper, keine Mikrofonerkennung, kein Pause/Play, keine Audioaufnahme und keine profilübergreifende Steuerung.

`extension/` enthält die ladbare Extension, `tests/` die kleinen Tests. Keine Paketinstallation nötig: `node --test tests/core.test.mjs`.

## Architektur und Grenzen

- `tabs.onUpdated` und eine erneute Tab-Abfrage erkennen Audioaktivität. `audible` ist Chromes Indikator für kürzlich produzierten Ton, **keine Spracherkennung** und keine Garantie für physisch hörbare Lautsprecherausgabe. Ein offener Call oder erteilte Mikrofonrechte allein lösen nichts aus. Jede Audioart auf chatgpt.com kann auslösen; Chromes eigene kurze Nachlaufzeit kommt zur Ruhezeit hinzu.
- Der Service Worker serialisiert Zustandsänderungen. Vor jeder Mutation wird der Tab erneut gelesen. Zustand in `storage.session` übersteht Worker-Neustarts; `mutedInfo.extensionId` begrenzt die Wiederherstellung auf eigene Änderungen und ermöglicht Wiederaufnahme nach Zustandsverlust. Geschlossene Tabs werden verworfen, verworfene/eingefrorene ChatGPT-Tabs zählen nicht als aktive Quelle. Navigation zu ChatGPT hebt eine eigene Stummschaltung auf.
- Ein Timer plus Alarm sichern die Rückkehr ab. **10–20 Sekunden sind ein Ziel, keine Echtzeitgarantie**: Worker-Suspend, Browser-/Geräteruhe und Alarm-Drosselung können die Rückkehr verzögern. Chrome unterstützt keine atomare Kombination aus Tab-Abfrage und Mute-Schreibzugriff; extrem gleichzeitige manuelle Änderungen bleiben ein praktischer Prüffall.
- Rechte: `storage`, `alarms` und URL-Sichtbarkeit nur für `https://chatgpt.com/*`. Kein breites `tabs`-Leserecht, keine Inhalts-Skripte, keine Netzwerkanfragen. Inkognito ist deaktiviert. Einstellungen liegen lokal; keine Speicherung von Audio, Verlauf oder Tab-URLs.
- Die ursprüngliche profilübergreifende Idee ist zurückgestellt. Dafür wären koordinierte Extension-Instanzen und gegebenenfalls ein lokaler Native-Messaging-Broker zu prüfen. Ein Helper allein erhält keinen profilübergreifenden Chrome-Tab-Zugriff. Das überschreitet diesen Nachweis.

## Späterer manueller Test, erst nach Freigabe

In einem separaten Testprofil `extension/` als entpackte Erweiterung laden. Zwei ChatGPT-Tabs und zwei andere Audio-Tabs öffnen; einen anderen Tab schon vorher stummschalten. Offener stiller Call darf nichts ändern. Bei ChatGPT-Audio müssen andere Tabs stumm werden, beide ChatGPT-Tabs ausgenommen bleiben. Kurze Pausen dürfen keine Rückkehr auslösen; nach der Ruhezeit muss nur der vorher hörbare Tab zurückkehren. Danach manuelles Mute/Unmute, neue Tabs, Navigation, Quelltab-Schließen, Worker-Neustart und Schlaf/Wach prüfen. Vor Entfernen über die Optionen deaktivieren und die Rückkehr abwarten: eine entfernte/deaktivierte Extension kann keinen Wiederherstellungscode mehr ausführen.

## Herkunft und Lizenz

Eigener Code unter MIT, siehe LICENSE. [audio-tab-finder](https://github.com/FrancisGregori/audio-tab-finder) ist ausschließlich eine funktionale Idee; kein Fork, keine Code- oder Assetübernahme. Seine Lizenz wurde nicht als Nutzungsgrundlage verwendet.

## Technische Quellen

- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs): Audioindikator, MutedInfo und Tab-Ereignisse.
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage): Session-Zustand für Service Worker.
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms): verzögerte Ausführung und Geräte-Ruhe.
- [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging): mögliche spätere Koordination, hier nicht implementiert.
