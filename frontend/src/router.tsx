import { createBrowserRouter } from "react-router";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./layouts/AppLayout";
import { AboutPage } from "./pages/AboutPage";
import { AssetDetailsPage } from "./pages/AssetDetailsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GreenMapPage } from "./pages/GreenMapPage";
import { HomePage } from "./pages/HomePage";
import { IncidentReviewPage } from "./pages/IncidentReviewPage";
import { IncidentDetailsPage } from "./pages/IncidentDetailsPage";
import { LoginPage } from "./pages/LoginPage";
import { MaintenanceTaskDetailsPage } from "./pages/MaintenanceTaskDetailsPage";
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
      {
        path: "dashboard",
        element: (
          <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
            <DashboardPage />
          </ProtectedRoute>
        )
      },
      {
        path: "my-forest",
        element: (
          <ProtectedRoute roles={["CITIZEN"]}>
            <MyForestPage />
          </ProtectedRoute>
        )
      },
      {
        path: "worklist",
        element: (
          <ProtectedRoute roles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
            <WorklistPage />
          </ProtectedRoute>
        )
      },
      {
        path: "worklist/:taskId",
        element: (
          <ProtectedRoute roles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
            <MaintenanceTaskDetailsPage />
          </ProtectedRoute>
        )
      },
      { path: "register", element: <RegisterPage /> },
      { path: "login", element: <LoginPage /> },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        )
      },
      {
        path: "zones",
        element: (
          <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
            <ZonesPage />
          </ProtectedRoute>
        )
      },
      {
        path: "users",
        element: (
          <ProtectedRoute roles={["ADMIN"]}>
            <UsersPage />
          </ProtectedRoute>
        )
      },
      { path: "assets/:assetId", element: <AssetDetailsPage /> },
      {
        path: "incidents",
        element: (
          <ProtectedRoute roles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
            <IncidentReviewPage />
          </ProtectedRoute>
        )
      },
      {
        path: "incidents/:incidentId",
        element: (
          <ProtectedRoute roles={["EMPLOYEE", "MANAGER", "ADMIN"]}>
            <IncidentDetailsPage />
          </ProtectedRoute>
        )
      },
      { path: "about", element: <AboutPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
