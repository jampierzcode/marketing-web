import { Link, Route, Routes } from "react-router-dom";
import RestaurantsPage from "./pages/RestaurantsPage";
import RestaurantDetailPage from "./pages/RestaurantDetailPage";
import CampaignWizardPage from "./pages/CampaignWizardPage";

export default function App() {
  return (
    <div
      style={{
        fontFamily: "system-ui",
        padding: 16,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Marketing AI (MVP)</h2>
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/">Restaurantes</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<RestaurantsPage />} />
        <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
        <Route
          path="/restaurants/:id/campaign"
          element={<CampaignWizardPage />}
        />
      </Routes>
    </div>
  );
}
