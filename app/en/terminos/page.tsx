import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for Vahica.com",
};

export default function TerminosEnPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">Terms of Use</h1>
      <p className="mt-2 text-sm text-[var(--negro)]/60">Last updated: February 2026</p>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">1. Acceptance of terms</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          By accessing or using the website Vahica.com (“the Site”), you agree to be bound by these Terms of Use. If you do not agree with any part of these terms, you must not use the Site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">2. Use of the Site</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          You agree to use the Site lawfully and in accordance with these terms. In particular, you must not:
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1 text-[var(--negro)]/80">
          <li>Use the Site for illegal, fraudulent purposes or in a way that infringes third-party rights.</li>
          <li>Attempt unauthorized access to systems, networks, or data of the Site or third parties.</li>
          <li>Introduce viruses, malware, or any code or content that could damage or interfere with the Site.</li>
          <li>Impersonate others or provide false information when contacting us or interacting with the Site.</li>
          <li>Extract, scrape, or reuse Site content or data at scale through automated means without prior authorization.</li>
        </ul>
        <p className="mt-3 text-[var(--negro)]/80 leading-relaxed">
          We reserve the right to deny access or suspend use of the Site to anyone who breaches these terms or misuses the Site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">3. Intellectual property</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          The Site and its content (text, design, logos, proprietary images, code, and other materials) are protected by intellectual property laws and are owned by Vahica.com or its licensors. Unauthorized reproduction, distribution, modification, or commercial use of such content is prohibited unless expressly stated or granted in writing.
        </p>
        <p className="mt-3 text-[var(--negro)]/80 leading-relaxed">
          News and articles we publish may include material from external sources; in those cases, rights belong to their respective owners and the Site acts as a channel for dissemination, respecting credits and links to original sources where appropriate.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">4. Third-party content</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          The Site may include links to third-party websites, ads, or content (e.g. social networks, advertising platforms, or media). We do not control and are not responsible for the content, privacy policies, or practices of those third parties. Accessing external links is at your own risk; we recommend reading the terms and policies of sites you visit.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">5. Limitation of liability</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          The Site is provided “as is” and “as available.” To the fullest extent permitted by applicable law, Vahica.com and its operators shall not be liable for direct, indirect, incidental, special, or consequential damages arising from use or inability to use the Site, including but not limited to: errors or omissions in content, service interruptions, data loss, or damage from viruses or third-party conduct.
        </p>
        <p className="mt-3 text-[var(--negro)]/80 leading-relaxed">
          Information on the Site is for general information only and does not constitute legal, tax, or professional advice. For important decisions, always consult a qualified professional.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">6. Changes</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          We may modify these Terms of Use at any time. Changes take effect when posted on this page; the “Last updated” date reflects the current version. Continued use of the Site after changes constitutes acceptance of the new terms. We recommend reviewing this page periodically.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">7. Governing law and disputes</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          These terms are governed by the laws applicable in the jurisdiction from which the Site is operated. Any dispute arising from these terms or use of the Site shall be resolved before the competent courts in that jurisdiction, unless applicable law requires otherwise.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">8. Contact</h2>
        <p className="mt-2 text-[var(--negro)]/80 leading-relaxed">
          For questions about these Terms of Use, you can contact us through our{" "}
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
