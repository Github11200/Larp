// Chunk 6 · Route table + app shell. Feature screens live in src/features/<chunk>.
import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { FollowUpsPage } from "./features/followups/FollowUpsPage";
import { LivePage } from "./features/live/LivePage";
import { EventsPage } from "./features/prep/EventsPage";
import { PersonPage } from "./features/prep/PersonPage";
import { ProfilePage } from "./features/profile/ProfilePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<EventsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="people/:id" element={<PersonPage />} />
          <Route path="followups" element={<FollowUpsPage />} />
        </Route>
        {/* Live mode is full-screen: no nav. */}
        <Route path="live" element={<LivePage />} />
      </Routes>
    </BrowserRouter>
  );
}
