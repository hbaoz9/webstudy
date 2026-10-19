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

const router = createBrowserRouter([
  {
    path: "/*",
    element: <App />,
  },
]);

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
