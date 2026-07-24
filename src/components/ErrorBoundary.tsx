import { AlertTriangle, RotateCcw, Download } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { exportAllData } from "../services/storage";

/**
 * Letzte Verteidigungslinie: ohne sie wird aus jedem Renderfehler eine weisse
 * Seite ohne Ausweg - und weil alle Daten lokal liegen, sieht das fuer den
 * Nutzer aus wie Datenverlust.
 *
 * Der wichtigste Knopf hier ist deshalb nicht "Neu laden", sondern
 * "Daten sichern": selbst wenn die Oberflaeche kaputt ist, laesst sich der
 * Speicher noch als JSON herausholen.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kein Telemetrie-Versand - die App ist local-first und bleibt es.
    // Die Konsole reicht, um einen Fehlerbericht zusammenzustellen.
    console.error("[S.O.U.L] Renderfehler aufgefangen:", error, info.componentStack);
  }

  private handleExport = (): void => {
    try {
      const blob = new Blob([exportAllData()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `soul-dream-calendar-notfall-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[S.O.U.L] Notfall-Export fehlgeschlagen:", error);
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <AlertTriangle size={32} aria-hidden="true" />
          <h1>Der Schaltkreis ist unterbrochen</h1>
          <p>
            Ein Fehler hat die Anzeige angehalten. <strong>Deine Eintraege sind nicht verloren</strong> -
            sie liegen unveraendert in diesem Browser.
          </p>

          <div className="crash-actions">
            <button type="button" onClick={this.handleExport}>
              <Download size={16} aria-hidden="true" />
              Daten sichern
            </button>
            <button type="button" className="is-primary" onClick={() => window.location.reload()}>
              <RotateCcw size={16} aria-hidden="true" />
              Neu laden
            </button>
          </div>

          <details>
            <summary>Technische Details</summary>
            <pre>{error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
