import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faChartLine, faCircleInfo, faClipboardList, faDrawPolygon, faFlag, faGaugeHigh, faHome, faLeaf, faListCheck, faMap, faRightFromBracket, faRightToBracket, faSignInAlt, faSignOutAlt, faTree, faTriangleExclamation, faUser, faUserPlus, faUsers } from "@fortawesome/free-solid-svg-icons";

import { AuthProvider } from "./auth/AuthContext";
import { router } from "./router";
import "./styles/global.css";

library.add(
  faChartLine, faCircleInfo, faClipboardList, faDrawPolygon, faFlag,
  faGaugeHigh, faHome, faLeaf, faListCheck, faMap,
  faRightFromBracket, faRightToBracket, faSignInAlt, faSignOutAlt,
  faTree, faTriangleExclamation, faUser, faUserPlus, faUsers
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
