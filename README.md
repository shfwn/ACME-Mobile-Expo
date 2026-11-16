# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
## NativeWind

- Tailwind dikonfigurasi di `tailwind.config.js` (preset `nativewind/preset`, token warna mengikuti `src/constants/theme.ts`).
- `global.css` diimpor sekali di `src/app/_layout.tsx`; transformasi dilakukan `metro.config.js` via `withNativeWind`.
- `babel.config.js` memakai `jsxImportSource: nativewind` sehingga `className` dikenali TSX.

## Build & Rilis

- `eas.json` berisi profil `development` (dev client, APK), `preview` (APK), dan `production` (AAB + autoIncrement).
- Tidak ada `EXPO_PUBLIC_API_URL`: aplikasi berjalan sepenuhnya di atas SQLite perangkat, tanpa backend.

## Basis Data & Akun

- Skema SQLite dikelola migrasi bertahap di `src/db/client.ts` (`PRAGMA user_version`), bukan `CREATE TABLE IF NOT EXISTS`.
- Semua tabel domain ada di `src/db/schema.ts`; repo-nya: `account.repository.ts`, `repository.ts`, `team.repository.ts`.
- Kata sandi disimpan sebagai digest PBKDF2 berbasis SHA-256 dengan salt acak per akun (`src/db/password.ts`).
- Saat database masih kosong, `accountRepository.ensureBootstrap()` + `seedAccountsIfEmpty()` membuat satu workspace, satu proyek, empat status, dan tiga akun awal (`owner@`, `siti@`, `andi@company.com`, sandi `password123`). Tidak ada to-do, task, atau notifikasi contoh.
- `npm run flow:check` menjalankan smoke test alur login dan CRUD di atas SQLite asli (node:sqlite + Drizzle asli).
