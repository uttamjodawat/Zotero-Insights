# Zotero Knowledge Dashboard

A high-performance research analytics dashboard for Zotero users. Synthesize your research activity, track reading habits, and visualize your "Knowledge Foundation" through deep annotation metrics.

## Features

- **Knowledge Library**: A prioritized view of your most heavily annotated research items.
- **Contribution Map**: Visual heat-map of your research and sync activity.
- **Productivity Metrics**: Track velocity (capture rate), knowledge density, and library coverage.
- **Real-time Sync**: Intelligent polling that respects Zotero API limits and versioning.
- **Smart Filtering**: Filter by reading status, tags, and collections.
- **PDF Integration**: One-click opening of items directly in Zotero via `zotero://` URI schemes.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Motion (Animation), Lucide Icons.
- **Backend**: Node.js (Express), Axios (OAuth & API Proxying).
- **Visualization**: Recharts (D3-based).

## Setup & Local Development

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd zotero-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file in the root directory and add:
   ```env
   # If you use Zotero OAuth (optional)
   ZOTERO_CLIENT_ID=your_client_id
   ZOTERO_CLIENT_SECRET=your_client_secret
   ```

4. **Run the application**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Production Readiness

- **API Optimization**: Uses `Last-Modified-Version` headers to skip unnecessary API calls if the library hasn't changed.
- **Security**: Backend proxying ensures Zotero API keys and OAuth secrets are never exposed to the client-side browser.
- **Responsive**: Fully optimized for mobile, tablet, and desktop views with a "Swiss-Modern" design aesthetic.

## License

MIT
