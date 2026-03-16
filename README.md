# MixGame

MixGame, birden fazla oyunu ayni proje altinda toplayacak sekilde kurgulanan bir web uygulamasidir. Ilk aktif oyun klasik 101 masasidir.

## Su an ne hazir?

- Yerelde calisan `Vite + React + TypeScript` projesi
- `101` icin arayuzlu bir masa ekranı
- Rastgele tas dagitimi
- Gosterge ve okey hesaplama
- Her oyuncu icin otomatik acilis puani analizi
- Sonradan yeni oyun eklemeye uygun katalog yapisi

## Komutlar

```bash
npm install
npm run dev
npm run build
```

PowerShell script politikasindan dolayi gerekirse `npm.cmd run dev` ve `npm.cmd run build` kullanabilirsin.

## Dosya haritasi

- `src/App.tsx`: MixGame ana ekranini ve 101 masasi arayuzunu cizer.
- `src/lib/o101.ts`: 101 tas destesi, gosterge, okey, dagitim ve temel el analizi mantigini tutar.
- `src/App.css`: Ana tasarim ve responsive duzen.
- `src/index.css`: Global stil sifirlari.

## Sonraki gelisim adimlari

1. Oyuncunun tas cekip atabildigi tam tur akisini eklemek
2. Gercek kurallara uygun okey/joker destekli daha gelismis seri hesaplama yazmak
3. Skor tablosu ve oyun sonu ekranini eklemek
4. Cok oyunculu altyapi icin backend baglantisi kurmak
5. `Sudoku` gibi diger oyunlari ayni katalog altina eklemek

## Deploy onerileri

Bu proje statik olarak build edilebilir. Ilk yayin icin su secenekler uygundur:

- Vercel
- Netlify
- GitHub Pages

Build ciktilari `dist/` klasorune yazilir.

## GitHub'a yukleme

Asagidaki komutlarla projeyi GitHub'a ilk kez gonderebilirsin:

```bash
git add .
git commit -m "Initial MixGame setup"
git remote add origin <GITHUB_REPO_URL>
git push -u origin main
```

Notlar:

- `node_modules/` ve `dist/` zaten `.gitignore` icinde, GitHub'a gitmeyecek.
- `.github/workflows/ci.yml` dosyasi sayesinde `main` branch'ine push atinca GitHub otomatik `lint` ve `build` calistiracak.
- Repository olustururken GitHub tarafinda bos bir repo acman yeterli; README veya `.gitignore` secmene gerek yok.
