import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Vahica.com",
};

export default function PrivacidadEnPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[var(--negro)]/60">Last updated: February 2026</p>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">1. Data controller</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          The website Vahica.com (“the Site”) is operated by the project owners. This policy describes how we collect, use, and protect information from visitors and users of the Site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">2. Data we collect</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          We may collect: usage data (IP address, browser, pages visited); cookies and similar technologies; and information you provide when contacting us (name, email, message).
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">3. Use of cookies</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          We use cookies for the Site to work properly, to analyze traffic, and to display advertising (for example through Google AdSense). You can configure your browser to reject cookies; some features may then be unavailable.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">4. Google AdSense</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          The Site may show ads from Google AdSense. Google and its partners may use cookies to show ads based on your visits and to measure performance. Google’s data collection is governed by Google’s{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--rojo)] underline hover:no-underline">
            Privacy Policy
          </a>
          . You can manage ads in{" "}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-[var(--rojo)] underline hover:no-underline">
            Google Ads Settings
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">5. Your rights</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          Depending on applicable law, you may have the right to access, rectify, delete, or restrict processing of your data, object to processing, withdraw consent, and lodge a complaint with a data protection authority. To exercise these rights, contact us through the contact page.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">6. Retention and security</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          We keep your data only as long as necessary for the purposes described or as required by law. We apply reasonable measures to protect information against unauthorized access, loss, or alteration.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">7. Changes to this policy</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          We may update this policy from time to time. The “Last updated” date will reflect changes. We encourage you to review this page occasionally.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">8. Contact</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          For questions about this policy or your personal data, you can reach us via our{" "}
          <Link href="/en/contacto" className="text-[var(--rojo)] underline hover:no-underline">
            contact
          </Link>{" "}
          page.
        </p>
      </section>

      <p className="mt-10 pt-6 border-t border-[var(--negro)]/10">
        <Link href="/en" className="text-[var(--rojo)] underline hover:no-underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
