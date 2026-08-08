import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Cookie Policy - VoltarisOS",
  description: "VoltarisOS Cookie Policy - How we use cookies and tracking technologies",
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold font-display tracking-tight text-white mb-4">
          Cookie Policy
        </h1>
        <p className="text-surface-400 mb-12">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. What Are Cookies</h2>
            <p className="text-surface-300 leading-relaxed">
              Cookies are small text files that are stored on your device when you visit a website. They are widely used to make websites work more efficiently and provide useful information to website owners. This policy explains how VoltarisOS uses cookies and similar tracking technologies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Cookies</h2>
            <p className="text-surface-300 leading-relaxed">
              VoltarisOS uses cookies for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-surface-300 mt-4">
              <li><strong>Essential Cookies:</strong> Required for the platform to function (authentication, security)</li>
              <li><strong>Functional Cookies:</strong> Remember your preferences (language, theme, dashboard layout)</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our platform</li>
              <li><strong>Marketing Cookies:</strong> Used to deliver relevant content and measure campaign effectiveness</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Types of Cookies We Use</h2>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border border-surface-700 rounded-lg">
                <thead className="bg-surface-800">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-white border-b border-surface-700">Category</th>
                    <th className="px-4 py-3 text-sm font-semibold text-white border-b border-surface-700">Purpose</th>
                    <th className="px-4 py-3 text-sm font-semibold text-white border-b border-surface-700">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-surface-300">
                  <tr className="border-b border-surface-800">
                    <td className="px-4 py-3">Authentication</td>
                    <td className="px-4 py-3">Keep you logged in securely</td>
                    <td className="px-4 py-3">Session / 72 hours</td>
                  </tr>
                  <tr className="border-b border-surface-800">
                    <td className="px-4 py-3">Preferences</td>
                    <td className="px-4 py-3">Remember your settings</td>
                    <td className="px-4 py-3">1 year</td>
                  </tr>
                  <tr className="border-b border-surface-800">
                    <td className="px-4 py-3">Analytics</td>
                    <td className="px-4 py-3">Track usage patterns</td>
                    <td className="px-4 py-3">2 years</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">Security</td>
                    <td className="px-4 py-3">CSRF protection, rate limiting</td>
                    <td className="px-4 py-3">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Third-Party Cookies</h2>
            <p className="text-surface-300 leading-relaxed">
              Some cookies are placed by third-party services that we use:
            </p>
            <ul className="list-disc list-inside space-y-2 text-surface-300 mt-4">
              <li><strong>Stripe:</strong> Payment processing (does not track browsing behavior)</li>
              <li><strong>Cloudflare:</strong> Security and performance optimization</li>
              <li><strong>Google Fonts:</strong> Typography (no tracking)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Managing Cookies</h2>
            <p className="text-surface-300 leading-relaxed mb-4">
              You can control and manage cookies in several ways:
            </p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li><strong>Browser Settings:</strong> Most browsers allow you to block or delete cookies</li>
              <li><strong>Cookie Banner:</strong> On your first visit, you can accept or reject non-essential cookies</li>
              <li><strong>Opt-Out Links:</strong> Some third parties provide opt-out mechanisms</li>
            </ul>
            <p className="text-surface-300 leading-relaxed mt-4">
              Please note that blocking essential cookies may prevent the platform from functioning correctly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Cookie Consent</h2>
            <p className="text-surface-300 leading-relaxed">
              In accordance with the ePrivacy Directive and GDPR, we request your consent before placing non-essential cookies on your device. You can withdraw your consent at any time through our cookie settings or by clearing your browser cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Do Not Track</h2>
            <p className="text-surface-300 leading-relaxed">
              Some browsers have a "Do Not Track" feature. While we respect user privacy, there is currently no industry standard for how to respond to DNT signals. We continue to monitor developments in this area.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Changes to This Policy</h2>
            <p className="text-surface-300 leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our data practices. We encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Contact Us</h2>
            <p className="text-surface-300 leading-relaxed">
              If you have any questions about our use of cookies, please contact us at{" "}
              <a href="mailto:dpo@voltarisos.com" className="text-primary-400 hover:text-primary-300">
                dpo@voltarisos.com
              </a>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-8">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-surface-500">
          <p>&copy; {new Date().getFullYear()} VoltarisOS. All rights reserved.</p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/legal/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/legal/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/legal/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}