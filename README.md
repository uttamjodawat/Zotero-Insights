# Zotero Knowledge Dashboard

A precision-engineered research analytics dashboard for Zotero users. Transform your bibliographic data into a "Knowledge Foundation" through deep annotation metrics, activity tracking, and intelligent collection analysis.

## 🛡️ Privacy & Security

**Your data stays with you.** This application is built with a **Client-Side Only Architecture**:
- **Direct Peer-to-Peer Communication**: The app communicates directly from your browser to the official Zotero API.
- **Zero Intermediaries**: No backend server, no database cloud, and no proxy acts as a middleman.
- **Encrypted Local Storage**: Your API keys and library metadata are stored exclusively in your browser's `localStorage`.
- **Stateless Execution**: The application does not track you. Once the browser session ends, the only thing that remains is your locally cached Zotero metadata.

## 🚀 Key Features

### 1. Research Intelligence (Dashboard)
- **Skimming Coverage**: Tracks what percentage of your library has been "skimmed" (items with 2+ annotations).
- **Library Mastery**: Visualizes your progress in marking items as "Read," helping you bridge the gap between collection and consumption.
- **Consistency Tracker**: Monitors your research frequency with a 7-day rolling activity streak.
- **Collection Focus**: A specialized metric that compares the **Total Items** in a collection against the **Summation of Skimmed Items (2+ annotations)**. This allows you to differentiate between "archival" collections and "active research" zones.

### 2. Knowledge Foundation
- **Deep Analysis View**: Automatically surface your most heavily analyzed research materials based on annotation counts.
- **Configurable Scale**: Toggle between viewing the Top 10, 20, 50, 100, or 200 most impactful items in your library.
- **Intelligent Sorting**: Items are prioritized by annotation density, with recent modifications serving as a secondary tie-breaker.

### 3. Zotero Desktop Integration
- **Deep Linking**: One-click opening of items directly in the Zotero desktop app via `zotero://` URI schemes.
- **PDF Protocol**: If an item has an attached PDF, the dashboard will attempt to open it directly in the Zotero PDF viewer.

### 4. Smart Sync Engine
- **Incremental Sync**: The dashboard uses Zotero's `Last-Modified-Version` protocols to perform delta updates, saving bandwidth and respecting API rate limits.
- **Group Support**: Seamlessly switch between your personal library and shared group libraries.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animation**: [Motion](https://motion.dev/) (formerly Framer Motion)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Viz**: [Recharts](https://recharts.org/)

## 📖 Setup & Usage

### Local Development

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   npm install
   ```

2. **Run**:
   ```bash
   npm run dev
   ```

3. **Configure**:
   - Obtain your **Zotero API Key** from [Zotero Settings](https://www.zotero.org/settings/keys).
   - Enter your **User ID** (found on the same settings page).
   - If using a group, provide the **Group ID** and set the library type to `Groups`.

## 🎨 Design Philosophy

The dashboard follows a **Swiss-Modern** aesthetic:
- **High Contrast**: Bold typography and clean whitespace.
- **Information Density**: Maximum utility without visual clutter.
- **Motion-Driven**: Staggered entrances and smooth transitions to improve perceived performance and spatial orientation.

---

*Built with ❤️ for the research community.*
