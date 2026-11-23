# Teachy's

Teachy's is a static, responsive teacher-administration app. It uses browser storage for local data and Supabase for account-based sync.

## Run

Open `index.html` in a browser. The app uses Supabase authentication and the project’s publishable client key from `supabaseConfig.js`.

## Hosting on GitHub Pages

The app files are at the repository root, so GitHub Pages can publish the `main` branch from the root folder. After enabling Pages, add the resulting site URL to Supabase Authentication’s site URL and allowed redirect URLs so sign-in and account links return to the hosted app.

The Supabase database and storage access rules are in `supabase/migrations/`. Student and classroom records are stored per signed-in user; do not add exported backups, private keys, or `.env` files to this repository.
