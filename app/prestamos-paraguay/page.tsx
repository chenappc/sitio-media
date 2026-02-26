import type { Metadata } from "next";
import Link from "next/link";
import AdSense from "@/components/AdSense";
import styles from "./PrestamosParaguay.module.css";

export const metadata: Metadata = {
  title: "Itaú Mi Préstamo: hasta 48 meses para pagar con total flexibilidad",
  description:
    "Conocé el Itaú Mi Préstamo en Paraguay: plazos flexibles, financiación en guaraníes o dólares y aprobación rápida.",
};

export default function PrestamosParaguayPage() {
  return (
    <article className={styles.page}>
      <p className={styles.logo}>Préstamos Paraguay</p>

      <h1 className={styles.h1}>
        Itaú Mi Préstamo: ¡hasta 48 meses para pagar con total flexibilidad!
      </h1>

      <p className={styles.intro}>
        El Itaú Mi Préstamo es una solución financiera práctica y confiable,
        ofrecida por el Banco Itaú en Paraguay. Con plazos flexibles y la
        posibilidad de financiar en guaraníes o dólares, es ideal para quienes
        buscan concretar proyectos personales o organizar sus finanzas.
      </p>

      <AdSense slot="8857811296" />

      <ul className={styles.list}>
        <li className={styles.listItem}>
          ✅ Límite de financiamiento adaptado: hasta Gs. 500.000.000
        </li>
        <li className={styles.listItem}>
          ✅ Plazos flexibles: pagá en hasta 48 meses
        </li>
        <li className={styles.listItem}>
          ✅ Aprobación rápida: hasta 48 horas
        </li>
        <li className={styles.listItem}>
          ✅ Sin necesidad de justificar el uso del dinero
        </li>
        <li className={styles.listItem}>
          ✅ Financiación en guaraníes o dólares
        </li>
      </ul>

      <h2 className={styles.sectionTitle}>
        ¿Por qué recomendamos Itaú Mi Préstamo?
      </h2>
      <p className={styles.body}>
        El Itaú Mi Préstamo combina la credibilidad de uno de los bancos más
        grandes de América Latina con la flexibilidad necesaria para diferentes
        perfiles de clientes. Ya sea para reorganizar deudas, mejorar tu hogar
        o invertir en proyectos personales, este préstamo ofrece condiciones
        accesibles y justas, con un proceso de aprobación rápido y simplificado.
      </p>

      <h2 className={styles.sectionTitle}>
        Opinión del autor sobre Itaú Mi Préstamo
      </h2>
      <p className={styles.body}>
        Elegir el Itaú Mi Préstamo es optar por una solución confiable y
        práctica. El Banco Itaú es reconocido por su solidez en el mercado
        financiero, garantizando seguridad y transparencia en todas las etapas
        del proceso. Además, la flexibilidad en los pagos y la opción de elegir
        entre guaraníes o dólares hacen que este préstamo sea aún más
        ventajoso.
      </p>

      <h2 className={styles.sectionTitle}>
        Tasas y Plazos: Simulación de Crédito
      </h2>
      <p className={styles.body}>
        Si solicitás un préstamo de 15.000.000 Gs con las condiciones ofrecidas
        por Itaú Mi Préstamo, considerando una tasa de interés desde el 15,9%
        anual (tasa real publicada por Itaú Paraguay) y un plazo de 48 meses, el
        monto mensual aproximado sería de 539.218 Gs, resultando en un total de
        25.882.464 Gs al finalizar el plazo. Esta es una simulación estimada. Las
        condiciones finales dependen del perfil del solicitante. Para confirmar
        tasas y condiciones, consultá directamente con Banco Itaú.
      </p>

      <AdSense slot="9784384730" />

      <h2 className={styles.sectionTitle}>
        ¿Cómo solicitar Itaú Mi Préstamo?
      </h2>
      <p className={styles.body}>
        Solicitarlo es rápido y sencillo. Vas a conocer todo lo que necesitás
        saber, solo hacé clic en el botón a continuación:
      </p>

      <div className={styles.ctaWrap}>
        <Link href="/solicitar-prestamo-paraguay" className={styles.ctaBtn}>
          VER MÁS DETALLES →
        </Link>
      </div>

      <footer className={styles.footer}>© 2026 Préstamos Paraguay</footer>
    </article>
  );
}
