import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service - VoltarisOS",
  description: "VoltarisOS Terms of Service - Platform usage terms and conditions",
};

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-surface-400 mb-12">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-surface-300 leading-relaxed">
              By accessing or using the VoltarisOS platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. These Terms constitute a legally binding agreement between you and VoltarisOS.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p className="text-surface-300 leading-relaxed">
              VoltarisOS is a Virtual Power Plant (VPP) management platform that provides energy optimization, AI-powered forecasting, trading capabilities, and grid management services for energy professionals and organizations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Account Registration</h2>
            <p className="text-surface-300 leading-relaxed mb-4">To access the Service, you must:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li>Create an account with accurate and complete information</li>
              <li>Maintain the security of your login credentials</li>
              <li>Accept these Terms and our Privacy Policy</li>
              <li>Be at least 18 years of age or have parental/guardian consent</li>
              <li>Have authority to bind your organization to these Terms (if registering on behalf of a company)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Subscription and Payment</h2>
            <p className="text-surface-300 leading-relaxed mb-4">
              The Service offers tiered subscription plans (Home, Starter, Pro, Enterprise). By subscribing:
            </p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li>You agree to pay all applicable fees as described in your selected plan</li>
              <li>Payments are processed securely via Stripe</li>
              <li>Subscriptions auto-renew unless cancelled before the renewal date</li>
              <li>Prices are in EUR and exclude applicable VAT</li>
              <li>Refunds are handled on a case-by-case basis within 14 days of purchase</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Acceptable Use</h2>
            <p className="text-surface-300 leading-relaxed mb-4">You agree NOT to:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li>Use the Service for any unlawful purpose or in violation of energy regulations</li>
              <li>Attempt to gain unauthorized access to other accounts or systems</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service to manipulate energy markets or engage in fraudulent trading</li>
              <li>Share your account credentials with unauthorized users</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Upload malicious code or attempt to exploit vulnerabilities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Energy Trading Disclaimer</h2>
            <p className="text-surface-300 leading-relaxed">
              The Service provides AI-powered recommendations and automated trading capabilities. However:
            </p>
            <ul className="list-disc list-inside space-y-2 text-surface-300 mt-4">
              <li>Trading decisions involve inherent financial risk</li>
              <li>Past performance does not guarantee future results</li>
              <li>You are responsible for verifying all trades before execution</li>
              <li>VoltarisOS is not liable for trading losses</li>
              <li>Market conditions may change rapidly and affect outcomes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Intellectual Property</h2>
            <p className="text-surface-300 leading-relaxed">
              All content, features, and functionality of the Service (including but not limited to text, graphics, logos, software, and AI models) are owned by VoltarisOS and protected by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without explicit written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Data Processing</h2>
            <p className="text-surface-300 leading-relaxed">
              Our data processing practices are described in our Privacy Policy. By using the Service, you consent to our processing of your data as described therein. We comply with GDPR and applicable EU data protection regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-surface-300 leading-relaxed">
              To the maximum extent permitted by law, VoltarisOS shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or energy trading losses, even if we have been advised of the possibility of such damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Service Availability</h2>
            <p className="text-surface-300 leading-relaxed">
              We strive for 99.9% uptime but do not guarantee uninterrupted service. We may suspend access for maintenance, security reasons, or if you violate these Terms. We will provide reasonable notice for planned maintenance when possible.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Termination</h2>
            <p className="text-surface-300 leading-relaxed">
              Either party may terminate this agreement with 30 days written notice. VoltarisOS may terminate immediately if you violate these Terms. Upon termination, your right to use the Service ceases, and we will delete your data in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Governing Law</h2>
            <p className="text-surface-300 leading-relaxed">
              These Terms are governed by the laws of Portugal and the European Union. Any disputes shall be resolved in the courts of Lisbon, Portugal, or through arbitration as agreed by both parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Changes to Terms</h2>
            <p className="text-surface-300 leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes via email or through the platform at least 30 days before they take effect. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">14. Contact</h2>
            <p className="text-surface-300 leading-relaxed">
              For questions about these Terms, please contact us at{" "}
              <a href="mailto:legal@voltarisos.com" className="text-primary-400 hover:text-primary-300">
                legal@voltarisos.com
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