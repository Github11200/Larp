// Chunk 6 · Route table + app shell. Feature screens live in src/features/<chunk>.
import { BrowserRouter, Route, Routes } from "react-router";
import { FirstRunGate } from "./components/FirstRunGate";
import { Layout } from "./components/Layout";
import { FollowUpsPage } from "./features/followups/FollowUpsPage";
import { LivePage } from "./features/live/LivePage";
import { EventsPage } from "./features/prep/EventsPage";
import { PersonPage } from "./features/prep/PersonPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { SetupPage } from "./features/setup/SetupPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <FirstRunGate>
                <EventsPage />
              </FirstRunGate>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="people/:id" element={<PersonPage />} />
          <Route path="followups" element={<FollowUpsPage />} />
        </Route>
        {/* Full-screen flows: no tab bar. */}
        <Route path="setup/:step?" element={<SetupPage />} />
        <Route path="live" element={<LivePage />} />
      </Routes>
    </BrowserRouter>
  );
}
