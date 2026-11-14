import { useState } from "react";
import { RouterProvider } from "react-router/dom";
import { Providers } from "./providers/Runtime.js";
import { createRouter } from "./routes.js";
import "../design/tokens.css";
import "../design/fonts.css";
import "../design/primitives/primitives.css";
import "./styles.css";
export function App() {
  const [router] = useState(createRouter);
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
