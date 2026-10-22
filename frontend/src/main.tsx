import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App";
import "./styles/globals.css";

import { TeacherAccountProvider } from "./contexts/TeacherAccountContext";
import { TeacherDataProvider } from "./contexts/TeacherDataContext";
import { TeacherQuestionsProvider } from "./contexts/TeacherQuestionsContext";
import { TeacherAssignmentsProvider } from "./contexts/TeacherAssignmentsContext";
import { StudentAccountProvider } from "./contexts/StudentAccountContext";
import { AuthProvider } from "./contexts/AuthContext";
import { checkApiHealth } from "./service/api/client";

const router = createBrowserRouter([
  {
    path: "/*",
    element: <App />,
  },
]);

if (import.meta.env.DEV) {
  checkApiHealth()
    .then((data) => {
      if (data.status !== "ok" || data.service !== "webstudy-api") {
        throw new Error("Unexpected API health response");
      }

      console.info("[WebStudy API] Connected to Laravel");
    })
    .catch((error: unknown) => {
      console.error("[WebStudy API] Connection failed:", error);
    });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudentAccountProvider>
      <TeacherAccountProvider>
        <AuthProvider>
          <TeacherDataProvider>
            <TeacherQuestionsProvider>
              <TeacherAssignmentsProvider>
                <RouterProvider router={router} />
              </TeacherAssignmentsProvider>
            </TeacherQuestionsProvider>
          </TeacherDataProvider>
        </AuthProvider>
      </TeacherAccountProvider>
    </StudentAccountProvider>
  </StrictMode>,
);
