import type { Metadata } from "next";
import AdSense from "@/components/AdSense";
import styles from "./SolicitarPrestamoParaguay.module.css";

export const metadata: Metadata = {
  title: "Mi préstamo Itaú: documentos necesarios y cómo solicitarlo",
  description:
    "Conocé los requisitos y pasos para solicitar el Itaú Mi Préstamo en Paraguay.",
};

const ITAU_URL = "https://www.itau.com.py/prestamos/miprestamo";

export default function SolicitarPrestamoParaguayPage() {
  return (
    <article className={styles.page}>
      <p className={styles.logo}>Préstamos Paraguay</p>

      <h1 className={styles.h1}>
        Mi préstamo Itaú: conocé los documentos necesarios y cómo solicitarlo
      </h1>

      <p className={styles.intro}>
        El Itaú Mi Préstamo es una opción versátil y confiable, ideal para
        quienes buscan cumplir sus objetivos financieros de manera ágil y
        sencilla. Con plazos flexibles, pagos accesibles y la seguridad de una
        institución reconocida, te ofrece libertad y confianza en cada paso.
      </p>

      {/* Slot anterior: 8857811296 */}
      <AdSense slot="7922354756" />

      <h2 className={styles.sectionTitle}>
        ¿Cuáles son los requisitos para solicitar el Mi Préstamo?
      </h2>
      <ul className={styles.list}>
        <li className={styles.listItem}>
          👉 Ser mayor de edad y residente en Paraguay
        </li>
        <li className={styles.listItem}>
          👉 Documento de identidad vigente (cédula paraguaya)
        </li>
        <li className={styles.listItem}>
          👉 Comprobante de ingresos actualizado (máximo 60 días)
        </li>
        <li className={styles.listItem}>
          👉 Comprobante de domicilio (factura de agua, luz o teléfono)
        </li>
        <li className={styles.listItem}>
          👉 Si sos contribuyente del IVA: declaración jurada de los últimos 6
          meses
        </li>
      </ul>

      <h2 className={styles.sectionTitle}>¡Un consejo para vos!</h2>
      <p className={styles.body}>
        Antes de solicitar un préstamo, calculá tus ingresos y gastos
        mensuales. Esto te va a ayudar a elegir un monto y plazo que se ajusten
        a tus posibilidades, evitando desequilibrios financieros en el futuro.
      </p>

      {/* Slot anterior: 9784384730 */}
      <AdSense slot="7922354756" />

      <h2 className={styles.sectionTitle}>
        ¿Cómo solicitar el préstamo de Banco Itaú?
      </h2>
      <p className={styles.body}>
        Si estás interesado en conocer más sobre este préstamo, hacé clic en el
        botón a continuación para visitar el sitio oficial y obtener toda la
        información que necesitás:
      </p>

      <div className={styles.ctaWrap}>
        <a
          href={ITAU_URL}
          target="_blank"
          rel="nofollow noopener"
          className={styles.ctaBtn}
        >
          Acceder al Sitio Oficial
        </a>
        <p className={styles.note}>
          Serás redirigido al sitio oficial de Banco Itaú Paraguay. Vahica.com
          no es responsable de las condiciones finales del producto.
        </p>
      </div>

      <footer className={styles.footer}>© 2026 Préstamos Paraguay</footer>
    </article>
  );
}
