import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

export function TermsPage() {
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
            <FileText className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1
              className="text-3xl sm:text-4xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Terms of Service
            </h1>
            <p className="text-foreground-muted text-sm">Last updated: January 2025</p>
          </div>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-foreground-muted">
              By accessing or using SanLang, you agree to be bound by these Terms of Service. If you
              do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-foreground-muted">
              SanLang is an AI-powered language learning platform that provides vocabulary building,
              flashcards, reading practice, and exam preparation tools for Japanese, English, and
              French learners.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. User Accounts</h2>
            <p className="text-foreground-muted mb-4">To use our service, you must:</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Create an account with accurate information</li>
              <li>Be at least 13 years old (or have parental consent)</li>
              <li>Keep your account credentials secure</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Subscription and Billing</h2>
            <p className="text-foreground-muted mb-4">
              SanLang offers free and premium subscription tiers:
            </p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Free tier includes limited monthly credits</li>
              <li>Premium subscriptions are billed monthly or annually</li>
              <li>You can cancel your subscription at any time</li>
              <li>Refunds are handled according to our refund policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Acceptable Use</h2>
            <p className="text-foreground-muted mb-4">You agree not to:</p>
            <ul className="list-disc list-inside text-foreground-muted space-y-2 ml-4">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
              <li>Use automated tools to scrape or extract data</li>
              <li>Share your account with others</li>
              <li>Submit content that is harmful, offensive, or violates others&apos; rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. AI-Generated Content</h2>
            <p className="text-foreground-muted">
              Our service uses AI to generate learning content including sentences, flashcards, and
              feedback. While we strive for accuracy, AI-generated content may contain errors. Users
              should verify critical information independently. We are not responsible for decisions
              made based on AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Intellectual Property</h2>
            <p className="text-foreground-muted">
              All content on SanLang, including text, graphics, logos, and software, is owned by
              SanLang or its licensors and is protected by intellectual property laws. You may not
              reproduce, distribute, or create derivative works without our permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. User Content</h2>
            <p className="text-foreground-muted">
              You retain ownership of content you submit (such as practice sentences). By submitting
              content, you grant us a license to use it to provide and improve our services. You are
              responsible for ensuring you have the rights to any content you submit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-foreground-muted">
              SanLang is provided &ldquo;as is&rdquo; without warranties of any kind. We do not
              guarantee that the service will be uninterrupted, error-free, or that it will meet
              your specific learning goals. We do not guarantee exam success or specific learning
              outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Limitation of Liability</h2>
            <p className="text-foreground-muted">
              To the maximum extent permitted by law, SanLang shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
            <p className="text-foreground-muted">
              We may modify these terms at any time. We will notify users of significant changes via
              email or in-app notification. Continued use of the service after changes constitutes
              acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Termination</h2>
            <p className="text-foreground-muted">
              We may suspend or terminate your account if you violate these terms. You may also
              close your account at any time. Upon termination, your right to use the service will
              cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Contact</h2>
            <p className="text-foreground-muted">
              For questions about these terms, please contact us at{" "}
              <a href="mailto:legal@sanlang.app" className="text-accent hover:underline">
                legal@sanlang.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
