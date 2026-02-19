## Quick Start Guide

Follow these steps to run the project locally:

1. **Install pnpm globally** (if you don't have it):

   ```sh
   npm install -g pnpm
   ```

2. **Install project dependencies:**

   ```sh
   pnpm install
   ```

3. **Install Playwright browsers:**

   ```sh
   pnpm playwright install
   ```

4. **Build the project:**

   ```sh
   pnpm build
   ```

5. **Start the development server:**

   ```sh
   pnpm dev
   ```

   You should see output similar to:

   ```
   > @finsweet/developer-starter@0.0.0 dev ...
   > cross-env NODE_ENV=development node ./bin/build.js

   ┌─────────┬──────────────────────────────────┬────────────────────────────────────────────────────────────────┐
   │ (index) │ File Location                    │ Import Suggestion                                              │
   ├─────────┼──────────────────────────────────┼────────────────────────────────────────────────────────────────┤
   │ 0       │ 'http://localhost:3000/index.js' │ '<script defer src="http://localhost:3000/index.js"></script>' │
   └─────────┴──────────────────────────────────┴────────────────────────────────────────────────────────────────┘
   ```

6. View the live site:

- [https://flower-f0640b.webflow.io/](https://flower-f0640b.webflow.io/)
