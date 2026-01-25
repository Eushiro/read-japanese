import { Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrivacyPage() {
  return (
    <div className="min-h-screen py-8 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Privacy Policy
            </h1>
            <p className="text-foreground-muted text-sm">Last updated: January 2025</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              1. Information We Collect
            </h2>
            <p className="text-foreground-muted mb-4">
              We collect information you provide directly to us when you:
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Create an account (email address, name)</li>
              <li>Use our learning features (vocabulary, flashcards, progress)</li>
              <li>Subscribe to premium features (payment information via Stripe)</li>
              <li>Contact us for support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-foreground-muted mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Personalize your learning experience with AI-powered features</li>
              <li>Process transactions and send related information</li>
              <li>Track your learning progress and adapt difficulty levels</li>
              <li>Send technical notices, updates, and support messages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              3. AI and Data Processing
            </h2>
            <p className="text-foreground-muted mb-4">
              Our platform uses AI to enhance your learning experience. This includes:
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Generating personalized sentences and flashcards</li>
              <li>Evaluating your writing practice submissions</li>
              <li>Adapting content difficulty to your proficiency level</li>
              <li>Creating audio pronunciations using text-to-speech</li>
            </ul>
            <p className="text-foreground-muted mt-4">
              Your learning data may be processed by third-party AI providers (OpenRouter, Google
              Gemini) to deliver these features. We do not use your personal data to train AI
              models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Data Sharing</h2>
            <p className="text-foreground-muted mb-4">We may share your information with:</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>
                <strong>Stripe</strong> - for payment processing
              </li>
              <li>
                <strong>Clerk</strong> - for authentication
              </li>
              <li>
                <strong>PostHog</strong> - for product analytics (anonymized)
              </li>
              <li>
                <strong>Sentry</strong> - for error tracking (anonymized)
              </li>
              <li>
                <strong>AI Providers</strong> - to generate learning content
              </li>
            </ul>
            <p className="text-foreground-muted mt-4">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Retention</h2>
            <p className="text-foreground-muted">
              We retain your account and learning data for as long as your account is active. You
              can request deletion of your account and associated data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Security</h2>
            <p className="text-foreground-muted">
              We implement industry-standard security measures to protect your data, including
              encrypted connections (HTTPS), secure authentication, and access controls. However, no
              method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Your Rights</h2>
            <p className="text-foreground-muted mb-4">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Cookies and Tracking</h2>
            <p className="text-foreground-muted">
              We use essential cookies for authentication and session management. We also use
              analytics cookies (PostHog) to understand how users interact with our platform. You
              can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              9. Changes to This Policy
            </h2>
            <p className="text-foreground-muted">
              We may update this privacy policy from time to time. We will notify you of any changes
              by posting the new policy on this page and updating the &ldquo;Last updated&rdquo;
              date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Contact Us</h2>
            <p className="text-foreground-muted">
              If you have any questions about this privacy policy or our data practices, please
              contact us at{" "}
              <a href="mailto:privacy@sanlang.app" className="text-accent hover:underline">
                privacy@sanlang.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
