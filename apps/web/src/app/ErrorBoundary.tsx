import { Component, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useMessages } from "../i18n/messages.js";
import { Button } from "../design/primitives/controls.js";

export function RouteError() {
  const { t } = useMessages();
  return (
    <section className="f1-page" role="alert">
      <h1>{t("error.route")}</h1>
      <p>{t("error.generic")}</p>
      <Button
        variant="primary"
        onClick={() => {
          window.location.reload();
        }}
      >
        {t("error.reload")}
      </Button>
    </section>
  );
}
class Boundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}
export function ScreenBoundary({
  children,
  resetKey,
}: {
  children: ReactNode;
  resetKey?: string;
}) {
  const location = useLocation();
  const { t } = useMessages();
  return (
    <Boundary
      key={resetKey ?? location.pathname}
      fallback={(retry) => (
        <section className="f1-page" role="alert">
          <h1>{t("error.route")}</h1>
          <Button variant="primary" onClick={retry}>
            {t("error.reload")}
          </Button>
        </section>
      )}
    >
      {children}
    </Boundary>
  );
}
