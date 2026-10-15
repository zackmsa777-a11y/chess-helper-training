# Privacy Policy / Polityka prywatności – Chess Helper

*Last updated / Ostatnia aktualizacja: 2026-10-15*

## English

**Chess Helper does not collect, store on any server, share or sell any personal data.**

### What the extension does with data
- It reads the position of the chess board on **lichess.org** and **chess.com** pages (the pieces on the board and, on Lichess, a few elements such as the clocks, player names and the page address) only to work out whose move it is, to run the analysis and to detect live games.
- The analysis is done by Stockfish (WebAssembly) **locally in your browser**. The position is never sent anywhere.
- The extension makes **no network requests** of its own: no analytics, no telemetry, no tracking, no advertising, no remote code. All code, including the engine, is packaged in the extension.

### What is stored
- Your settings (number of lines, depth, colors, language, window opacity and position, collapsed sections, the date you last confirmed the fair-play notice) are stored **only in your browser**, in `chrome.storage.local` and in the `localStorage` of lichess.org / chess.com.
- Because `localStorage` belongs to the visited site, scripts of that site could technically read it. It contains only these interface preferences, nothing else.
- You can erase everything with the “Restore factory settings” button or by removing the extension.

### Permissions
- **Access to lichess.org and chess.com** – to read the board and draw the arrows and the panel.
- **storage** – to save the settings described above.
- **offscreen** – to run the engine in an offscreen document.

### “Buy the author a coffee” button
The panel footer contains a button that links to the author's page on **buycoffee.to**. The button image is bundled with the extension, so displaying it sends no request. Only if you **click** the link does your browser open buycoffee.to, and from then on that service's own terms and privacy policy apply. The extension passes no data to it.

### Third parties
The extension does not share data with third parties. Stockfish.js and chess.js are bundled libraries and run locally (see `THIRD-PARTY-NOTICES.txt`).

### Changes and contact
If this policy changes, the new version will be published in this file. Questions: please open an issue at https://github.com/dzejson91/chess-helper-chrome-extension/issues

---

## Polski

**Chess Helper nie zbiera, nie zapisuje na żadnym serwerze, nie udostępnia ani nie sprzedaje żadnych danych osobowych.**

### Co rozszerzenie robi z danymi
- Odczytuje pozycję szachownicy na stronach **lichess.org** i **chess.com** (figury na planszy oraz, na Lichess, kilka elementów strony, takich jak zegary, nazwy graczy i adres strony) wyłącznie po to, by ustalić, czyj jest ruch, wykonać analizę i rozpoznać partie na żywo.
- Analizę wykonuje Stockfish (WebAssembly) **lokalnie w Twojej przeglądarce**. Pozycja nigdy nie jest nigdzie wysyłana.
- Rozszerzenie **samo nie wykonuje żadnych zapytań sieciowych**: bez analityki, telemetrii, śledzenia, reklam i zdalnego kodu. Cały kod, wraz z silnikiem, jest zapakowany w rozszerzenie.

### Co jest zapisywane
- Twoje ustawienia (liczba wariantów, głębokość, kolory, język, przezroczystość i położenie okna, zwinięte sekcje, data ostatniego potwierdzenia komunikatu fair play) są zapisywane **tylko w Twojej przeglądarce**: w `chrome.storage.local` oraz w `localStorage` stron lichess.org / chess.com.
- Ponieważ `localStorage` należy do odwiedzanej strony, jej skrypty mogłyby go technicznie odczytać. Są tam wyłącznie wymienione preferencje interfejsu.
- Wszystko możesz wyczyścić przyciskiem „Przywróć ustawienia fabryczne” albo usuwając rozszerzenie.

### Uprawnienia
- **Dostęp do lichess.org i chess.com** – odczyt planszy oraz rysowanie strzałek i panelu.
- **storage** – zapis opisanych wyżej ustawień.
- **offscreen** – uruchomienie silnika w dokumencie offscreen.

### Przycisk „Postaw kawę dla autora”
W stopce panelu jest przycisk z linkiem do strony autora w serwisie **buycoffee.to**. Obrazek przycisku jest dołączony do rozszerzenia, więc jego wyświetlenie nie wysyła żadnych zapytań. Dopiero po **kliknięciu** linku przeglądarka otwiera buycoffee.to i od tej chwili obowiązują regulamin i polityka prywatności tego serwisu. Rozszerzenie nie przekazuje mu żadnych danych.

### Podmioty trzecie
Rozszerzenie nie udostępnia danych podmiotom trzecim. Stockfish.js i chess.js to dołączone biblioteki działające lokalnie (patrz `THIRD-PARTY-NOTICES.txt`).

### Zmiany i kontakt
W razie zmiany polityki nowa wersja zostanie opublikowana w tym pliku. Pytania: zgłoś issue na https://github.com/dzejson91/chess-helper-chrome-extension/issues
