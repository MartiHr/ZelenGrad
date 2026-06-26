import { createBrowserRouter } from "react-router";

import { AppLayout } from "./layouts/AppLayout";
import { AboutPage } from "./pages/AboutPage";
import { AssetDetailsPage } from "./pages/AssetDetailsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GreenMapPage } from "./pages/GreenMapPage";
import { HomePage } from "./pages/HomePage";
import { IncidentReviewPage } from "./pages/IncidentReviewPage";
import { LoginPage } from "./pages/LoginPage";
import { MyForestPage } from "./pages/MyForestPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { UsersPage } from "./pages/UsersPage";
import { WorklistPage } from "./pages/WorklistPage";
import { ZonesPage } from "./pages/ZonesPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "map", element: <GreenMapPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "my-forest", element: <MyForestPage /> },
      { path: "worklist", element: <WorklistPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "zones", element: <ZonesPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "assets/:assetId", element: <AssetDetailsPage /> },
      { path: "incidents", element: <IncidentReviewPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
