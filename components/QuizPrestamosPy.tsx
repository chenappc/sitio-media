"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./QuizPrestamosPy.module.css";

const TOTAL_STEPS = 5;

const STEP_1_OPTIONS = [
  "Mejorar tu casa",
  "Comprar un vehículo",
  "Pagar deudas",
  "Otras necesidades personales",
] as const;

const STEP_2_OPTIONS = [
  "Menos de 6 meses",
  "Entre 6 y 12 meses",
  "Entre 1 y 2 años",
  "Más de 2 años",
] as const;

const STEP_3_OPTIONS = [
  "Menos de Gs 5.000.000",
  "Entre Gs 5.000.000 y Gs 15.000.000",
  "Entre Gs 15.000.000 y Gs 30.000.000",
  "Más de Gs 30.000.000",
] as const;

const STEP_4_OPTIONS = [
  "Buena calificación",
  "Mala calificación",
] as const;

function useHashStep() {
  const [step, setStep] = useState(1);

  const setStepAndHash = useCallback(
    (s: number) => {
      setStep(s);
      if (typeof window !== "undefined") {
        window.location.hash = `paso${s}`;
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const m = hash.match(/^#paso(\d+)$/);
    const n = m ? Math.min(parseInt(m[1], 10), TOTAL_STEPS) : 1;
    setStep(n);
    if (!hash || !m) window.location.hash = "paso1";
  }, []);

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash;
      const m = hash.match(/^#paso(\d+)$/);
      if (m) setStep(Math.min(parseInt(m[1], 10), TOTAL_STEPS));
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return [step, setStepAndHash] as const;
}

export default function QuizPrestamosPy() {
  const [step, setStep] = useHashStep();
  const [selected1, setSelected1] = useState<string | null>(null);
  const [selected2, setSelected2] = useState<string | null>(null);
  const [selected3, setSelected3] = useState<string | null>(null);
  const [selected4, setSelected4] = useState<string | null>(null);

  const handleStep1 = (value: string) => {
    setSelected1(value);
    setTimeout(() => setStep(2), 280);
  };
  const handleStep2 = (value: string) => {
    setSelected2(value);
    setTimeout(() => setStep(3), 280);
  };
  const handleStep3 = (value: string) => {
    setSelected3(value);
    setTimeout(() => setStep(4), 280);
  };
  const handleStep4 = (value: string) => {
    setSelected4(value);
    setTimeout(() => setStep(5), 280);
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.logo}>Préstamos Paraguay</p>

      <h1 className={styles.pageTitle}>
        Descubrí el mejor préstamo para vos
      </h1>
      <p className={styles.subtitle}>
        Respondé las preguntas a continuación para que nuestro sistema elija el
        mejor préstamo para vos.
      </p>

      <div className={styles.card}>
        <div className={styles.progressWrap}>
          <div
            className={styles.progressBar}
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {step === 1 && (
          <>
            <h2 className={styles.stepTitle}>
              ¿Para qué necesitás el préstamo?
            </h2>
            <div className={styles.options}>
              {STEP_1_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.optionBtn} ${selected1 === opt ? styles.selected : ""}`}
                  onClick={() => handleStep1(opt)}
                >
                  <span className={styles.optionLabel}>
                    {opt}
                    {selected1 === opt && <span className={styles.check}>✓</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className={styles.stepTitle}>
              ¿A qué plazo querés pagarlo?
            </h2>
            <div className={styles.options}>
              {STEP_2_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.optionBtn} ${selected2 === opt ? styles.selected : ""}`}
                  onClick={() => handleStep2(opt)}
                >
                  <span className={styles.optionLabel}>
                    {opt}
                    {selected2 === opt && <span className={styles.check}>✓</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className={styles.stepTitle}>¿Cuánto necesitás?</h2>
            <div className={styles.options}>
              {STEP_3_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.optionBtn} ${selected3 === opt ? styles.selected : ""}`}
                  onClick={() => handleStep3(opt)}
                >
                  <span className={styles.optionLabel}>
                    {opt}
                    {selected3 === opt && <span className={styles.check}>✓</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className={styles.stepTitle}>
              ¿Cómo estás en Informconf?
            </h2>
            <div className={styles.options}>
              {STEP_4_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.optionBtn} ${selected4 === opt ? styles.selected : ""}`}
                  onClick={() => handleStep4(opt)}
                >
                  <span className={styles.optionLabel}>
                    {opt}
                    {selected4 === opt && <span className={styles.check}>✓</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <div className={styles.finalStep}>
            <h2 className={styles.finalTitle}>¡Casi listo!</h2>
            <Link href="/prestamos-paraguay" className={styles.ctaBtn}>
              Ver mi oferta de préstamo →
            </Link>
            <p className={styles.sponsoredNote}>
              Para continuar, pueden mostrarse opciones patrocinadas.
            </p>
          </div>
        )}
      </div>

      <footer className={styles.fixedFooter}>
        Este cuestionario es gratuito y puede incluir contenido patrocinado.
      </footer>
    </div>
  );
}
