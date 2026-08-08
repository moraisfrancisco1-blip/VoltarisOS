import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy - VoltarisOS",
  description: "VoltarisOS Privacy Policy - How we handle your data in compliance with GDPR",
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-surface-400 mb-12">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-surface-300 leading-relaxed">
              VoltarisOS ("we", "our", or "us") is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Virtual Power Plant platform, in compliance with the General Data Protection Regulation (GDPR) and other applicable EU data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Data Controller</h2>
            <p className="text-surface-300 leading-relaxed">
              The data controller responsible for your personal data is VoltarisOS. For any data protection inquiries, please contact us at{" "}
              <a href="mailto:dpo@voltarisos.com" className="text-primary-400 hover:text-primary-300">
                dpo@voltarisos.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Data We Collect</h2>
            <p className="text-surface-300 leading-relaxed mb-4">We collect the following categories of personal data:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li><strong>Account Data:</strong> Email address, name, company name, and password (hashed)</li>
              <li><strong>Usage Data:</strong> IP address, browser type, access times, and pages viewed</li>
              <li><strong>Energy Data:</strong> Site configurations, device readings, and consumption patterns</li>
              <li><strong>Trading Data:</strong> VPP bids, market transactions, and optimization decisions</li>
              <li><strong>Payment Data:</strong> Processed securely via Stripe; we do not store card details</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Legal Basis for Processing</h2>
            <p className="text-surface-300 leading-relaxed mb-4">We process your personal data based on:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li><strong>Contract Performance:</strong> To provide our platform services</li>
              <li><strong>Legitimate Interests:</strong> Platform security, fraud prevention, and service improvement</li>
              <li><strong>Legal Obligations:</strong> Compliance with energy sector regulations and tax requirements</li>
              <li><strong>Consent:</strong> For marketing communications (withdrawable at any time)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Retention</h2>
            <p className="text-surface-300 leading-relaxed">
              We retain your personal data only for as long as necessary to fulfill the purposes outlined in this policy. Energy data is retained for up to 5 years for regulatory compliance. Account data is retained for the duration of your account plus 30 days after deletion request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Your Rights (GDPR)</h2>
            <p className="text-surface-300 leading-relaxed mb-4">You have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-2 text-surface-300">
              <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
              <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
            </ul>
            <p className="text-surface-300 leading-relaxed mt-4">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:dpo@voltarisos.com" className="text-primary-400 hover:text-primary-300">
                dpo@voltarisos.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Data Sharing</h2>
            <p className="text-surface-300 leading-relaxed">
              We do not sell your personal data. We may share data with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-surface-300 mt-4">
              <li><strong>Service Providers:</strong> Stripe (payments), hosting providers (infrastructure)</li>
              <li><strong>Energy Market Operators:</strong> When submitting VPP bids to energy markets</li>
              <li><strong>Regulatory Authorities:</strong> When required by law or energy regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. International Transfers</h2>
            <p className="text-surface-300 leading-relaxed">
              Your data is primarily stored within the European Economic Area (EEA). If we transfer data outside the EEA, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Security Measures</h2>
            <p className="text-surface-300 leading-relaxed">
              We implement technical and organizational measures to protect your data, including encryption in transit (TLS 1.3) and at rest, access controls, audit logging, and regular security assessments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Contact Us</h2>
            <p className="text-surface-300 leading-relaxed">
              For any privacy-related questions or complaints, please contact our Data Protection Officer at{" "}
              <a href="mailto:dpo@voltarisos.com" className="text-primary-400 hover:text-primary-300">
                dpo@voltarisos.com
              </a>{" "}
              or write to us at VoltarisOS, Data Protection, Lisbon, Portugal.
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