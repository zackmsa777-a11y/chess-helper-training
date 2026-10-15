# Chess Helper (rozszerzenie Chrome, Manifest V3)

> **English:** Chrome extension (Manifest V3) that reads the board on Lichess / Chess.com and shows the best moves, move accuracy and win chances,
> using Stockfish 19 (lite, WASM) running locally in your browser – nothing is sent anywhere. UI: English, Polski, Español, Deutsch.
> Intended for learning and analysis only. **Do not use it in games against other people** – it is against the rules of the chess sites.
> Install: clone the repo, open `chrome://extensions`, enable Developer mode, “Load unpacked” → select the `extension/` folder.
> GPL-3.0-or-later; third-party components: see `THIRD-PARTY-NOTICES.txt`. Not affiliated with Lichess, Chess.com or the Stockfish project.

Wykrywa planszę szachową na stronie, odczytuje pozycję i podpowiada najlepsze ruchy.
Analizę wykonuje **Stockfish 19 (lite, WASM)** uruchomiony lokalnie w przeglądarce –
żadne dane nie są nigdzie wysyłane.

## Instalacja

1. Otwórz `chrome://extensions`, włącz **Tryb dewelopera**.
2. **Załaduj rozpakowane** → wskaż katalog `extension/`.
3. Wejdź na Lichess lub Chess.com (partia z botem, analiza, zadania, własna partia).
   W prawym górnym rogu pojawi się panel, a na planszy strzałki:
   zielona = najlepszy ruch, niebieska / pomarańczowa = kolejne warianty.

Kliknięcie ikony rozszerzenia chowa / pokazuje panel. Panel można przeciągać za nagłówek.

Przycisk **Wł. / Wył.** w nagłówku włącza i wyłącza ciągłą analizę. Przy wyłączonej analizie nie ma żadnych podpowiedzi, a blok „Ustawienia” zwija się (można go ponownie rozwinąć).
Gdy analiza jest włączona, ale **strzałki na planszy są wyłączone**, w panelu pojawia się przycisk **💡 Podpowiedź**:
na 3 sekundy rysuje strzałki na planszy (potem znikają).

## Ustawienia (w panelu)

Domyślnie: 1 wariant, głębokość 10, strona auto, strzałki wł., 1 kolejny ruch gracza, 0 odpowiedzi przeciwnika, numeracja wł., „tylko dla strony z dołu” wł., język English.

- liczba wariantów (1–5) i głębokość analizy,
- strona na ruchu: *auto* / białe / czarne,
- strzałki na planszy (wł./wył.) oraz osobno „moje kolejne ruchy” i „odpowiedzi przeciwnika” (0–4 każde): cienkie strzałki w kolorze wariantu pokazujące następne posunięcia, „kolory wariantów” (5 próbników koloru + przycisk ↺ przywracający domyślne; kolor dotyczy strzałek, kropek i dużego zapisu najlepszego ruchu), oraz „numeruj strzałki” – numer kolejności ruchu (1, 2, 3…) w kółku na strzałce,
- „tylko dla strony z dołu” – podpowiedzi tylko, gdy ruch ma gracz widoczny na dole planszy,
- ustawienia są zapisywane w `chrome.storage.local` oraz w `localStorage` strony (osobno dla każdej witryny, np. lichess.org i chess.com); przy odczycie wygrywa nowszy zapis, dzięki czemu przeżywają przeładowanie / aktualizację rozszerzenia,
- **Przywróć ustawienia fabryczne** (na dole ustawień, wymaga drugiego kliknięcia): wszystkie opcje, kolory, język, położenie i zwinięcie panelu wracają do wartości domyślnych,
- sekcje ustawień (Analiza / Strzałki / Ogólne oraz cały blok „Ustawienia”) można zwijać i rozwijać – stan jest zapamiętywany; gdy panel jest wyższy niż okno przeglądarki, jego zawartość się przewija,
- nieprzezroczystość okna panelu (suwak 40–100%, domyślnie 100%),
- język interfejsu: **English / Polski / Español / Deutsch** (domyślnie English, wybór jest zapamiętywany;
  zapis ruchów zawsze w angielskiej notacji SAN, np. `Nf3`).

## Jak to działa

```
strona ── content.js ──(port)──► offscreen.js ──► Worker: Stockfish (WASM)
            │  adapter strony       (dokument offscreen tworzony przez background.js)
            ├─ wykrycie planszy (największa widoczna)
            ├─ odczyt figur → FEN (position.js)
            └─ panel + nakładka SVG ze strzałkami
```

- **Wykrywanie planszy** – `src/content/adapters.js`. Lichess: `cg-board` (figury odczytywane
  z pozycji elementów na ekranie, więc działa niezależnie od sposobu pozycjonowania);
  Chess.com: `wc-chess-board` (klasy `piece wp square-55`). Plansza jest obserwowana
  `MutationObserver`em, a dodatkowo sprawdzana co sekundę (nawigacja SPA).
- **Strona na ruchu** – z podświetlenia ostatniego ruchu (figura na polu docelowym ma kolor
  tego, kto właśnie ruszał), potem z zegara (Lichess), potem „start = białe”. Jeśli nic z tego
  nie działa, zakładamy ruch strony z dołu (panel to zaznacza) – można wymusić ręcznie.
  Pozycja, w której strona *bez* ruchu miałaby szacha, jest automatycznie odwracana.
- **Roszady** – plansza ich nie zdradza, więc rozszerzenie śledzi pozycję w czasie: prawo
  przepada, gdy król/wieża zostaną zaobserwowani poza polem startowym. Wejście w środku partii
  zakłada, że roszada jest możliwa, jeśli król i wieża stoją na swoich polach.
  **En passant** wyprowadzane jest z ostatniego ruchu piona o dwa pola.
- Numeru posunięcia nie da się odczytać z samej planszy, dlatego warianty są bez numeracji.

## Dodanie kolejnego języka

Dopisz słownik w `src/content/i18n.js` (te same klucze co `en`; test `npm test` pilnuje zgodności),
nazwę języka w `LANGS` oraz plik `extension/_locales/<kod>/messages.json` (nazwa i opis w Chrome).

## Dodanie kolejnej strony

Dopisz adapter w `src/content/adapters.js` (`findBoards()` + `read(el)` zwracające 64 pola,
orientację i podświetlone pola ostatniego ruchu), dodaj host do `content_scripts.matches`
w `extension/manifest.json` i przebuduj.

## Rozwój

```bash
npm install
npm run build   # bundluje src/content → extension/content.js (z chess.js)
npm test        # testy logiki pozycji (FEN, tura, roszady, en passant, SAN)
```

Pliki silnika w `extension/engine/` pochodzą z pakietu npm `stockfish@19.0.1`
(`stockfish-19-lite-single.{js,wasm}`) – licencja GPL-3.0, patrz `extension/engine/Copying.txt`.
Silniejszy (ale ~94 MB) wariant można podmienić, zmieniając nazwę pliku w `extension/offscreen.js`.

## Ściąga z ruchów figur

Przycisk **i** w nagłówku panelu pokazuje / chowa krótkie objaśnienie, jak poruszają się figury (z roszadą, biciem w przelocie i promocją).

## Wsparcie autora

W stopce panelu (zawsze widocznej, także przy zwiniętym panelu) jest przycisk „Postaw kawę dla autora” (buycoffee.to). Obrazek jest dołączony lokalnie
(`extension/img/buycoffee-pl.png` dla języka polskiego, `buycoffee-en.png` dla pozostałych), więc samo wyświetlenie panelu nie wysyła żadnych zapytań; sieć jest używana dopiero po kliknięciu linku.

## Licencja

Copyright (C) 2026 Krystian Jasnos <e-json.com>

GPL-3.0-or-later – patrz `LICENSE`. Komponenty zewnętrzne (Stockfish.js, chess.js): `THIRD-PARTY-NOTICES.txt`.
Pliki licencyjne są kopiowane do `extension/` przy `npm run build` (pliki `LICENSE.txt` i `THIRD-PARTY-NOTICES.txt` w `extension/` to kopie – edytuj te z katalogu głównego).

## Dokładność ruchów

Opcja „Pokaż dokładność ruchów” (Analiza) dodaje w panelu tabelkę: dla białych i czarnych dokładność **ostatniego ruchu**
oraz **średnią** ze wszystkich ruchów (arytmetyczną; w dymku liczba ruchów). Wzór wzorowany na Lichess (wyniki mogą się od niego nieco różnić): z oceny pozycji przed ruchem i po nim
liczona jest utrata szans na wygraną, a z niej dokładność 0–100%. Czwarta kolumna to **szanse na wygraną** w bieżącej pozycji (ocena silnika przeliczona tym samym wzorem na procent; zielone ≥60%, czerwone ≤40%).
Pogrubiony jest ostatni wykonany ruch; kolory: ≥90% zielony, ≥70% żółty, poniżej czerwony.

- Ruchy są rozpoznawane jako legalne przejścia między kolejnymi pozycjami na planszy; skok do innej pozycji (np. cofnięcie na planszy analizy) zeruje statystykę.
- Wymaga oceny każdej pozycji. Dlatego silnik liczy w tle także w turze przeciwnika (przy „tylko dla strony z dołu”) i **przy wyłączonej analizie** – bez pokazywania wariantów i strzałek; statystyka jest widoczna zawsze, gdy opcja jest włączona.
- Wyjątek: w wykrytej grze na żywo z człowiekiem (patrz niżej) przy wyłączonej analizie silnik nie liczy nic i statystyka jest ukryta.
- Oceny płytsze niż głębokość 8 są pomijane (ruch bez wartości, „–”).

## Wykrywanie gry na żywo

Rozszerzenie próbuje rozpoznać, że grasz na żywo z innym graczem (adresy `/play/online`, `/game/live/…`, `/game/daily/…`, `/game/<numer>` na Chess.com;
partia w trakcie gry na Lichess, w której przeciwnik nie jest botem i partia się nie skończyła). Wtedy pokazuje czerwone ostrzeżenie (że to oszustwo łamiące regulaminy serwisów, grożące blokadą konta)
i **automatycznie wyłącza analizę**. Nie blokuje jednak niczego na stałe – można ją włączyć ręcznie, a rozszerzenie nie wyłączy jej ponownie
na tej stronie. Po wyjściu z partii (analiza, zadania, bot, zakończona partia) analiza wraca, jeśli to my ją wyłączyliśmy.
To heurystyka (adres strony + kilka elementów DOM), nie gwarancja – i nie zabezpieczenie przed oszukiwaniem.
Logika: `src/content/livegame.js`.

## Uczciwa gra

Narzędzie jest przeznaczone do nauki, analizy własnych partii, zadań i gry z botami.
Panel pokazuje komunikat „graj fair play”, dopóki nie klikniesz „Rozumiem” – wtedy zgoda jest zapamiętywana i komunikat wraca dopiero następnego dnia.
Korzystanie z podpowiedzi silnika w partiach z żywymi przeciwnikami łamie regulaminy Lichess
i Chess.com (i jest po prostu nieuczciwe) – może skutkować zablokowaniem konta.

Projekt nie jest powiązany z Lichess, Chess.com ani projektem Stockfish; nazwy te służą wyłącznie do wskazania obsługiwanych stron i użytego silnika.
