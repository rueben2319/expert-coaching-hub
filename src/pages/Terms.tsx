import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, FileText, Scale, AlertCircle, Users, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Experts Coaching Hub</span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Terms of Service</h1>
          </div>
          <p className="text-muted-foreground">Last updated: January 2025</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                Agreement to Terms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                By accessing and using Experts Coaching Hub ("the Platform"), you agree to be bound by these 
                Terms of Service and all applicable laws and regulations. If you do not agree with any of 
                these terms, you are prohibited from using this Platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Accounts
              </CardTitle>
              <CardDescription>Your responsibilities as a platform user</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Account Creation</h3>
                <p className="text-muted-foreground mb-2">
                  To use certain features, you must create an account. You agree to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Maintain the security of your password and account</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized access</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Account Types</h3>
                <p className="text-muted-foreground">
                  <strong>Students:</strong> Can enroll in courses, attend coaching sessions, and access learning materials.
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Coaches:</strong> Can create courses, host sessions, and provide coaching services subject to 
                  verification and approval.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content and Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Platform Content</h3>
                <p className="text-muted-foreground">
                  All content on the Platform, including text, graphics, logos, and software, is the property 
                  of Experts Coaching Hub or its content suppliers and is protected by intellectual property laws.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">User-Generated Content</h3>
                <p className="text-muted-foreground">
                  When you upload or post content (courses, materials, comments), you grant us a non-exclusive, 
                  worldwide, royalty-free license to use, reproduce, and distribute that content on the Platform. 
                  You retain ownership of your content.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Coach Content Rights</h3>
                <p className="text-muted-foreground">
                  Coaches retain ownership of their course materials. By posting courses, coaches grant enrolled 
                  students a limited, non-transferable license to access and use the materials for personal learning only.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payments and Refunds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Course Purchases</h3>
                <p className="text-muted-foreground">
                  All prices are listed in the local currency (MWK). Prices may change at any time, but 
                  changes will not affect existing purchases. Payment processing is handled securely through 
                  third-party providers.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Credit System</h3>
                <p className="text-muted-foreground">
                  The Platform uses a credit-based system. Credits can be purchased and used to enroll in 
                  courses or book coaching sessions. Credits are non-refundable once purchased, but can be 
                  used within your account.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Refund Policy</h3>
                <p className="text-muted-foreground">
                  Course refunds may be requested within 7 days of enrollment if less than 20% of the course 
                  has been completed. Refunds are processed as platform credits, not cash refunds.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Coach Payments</h3>
                <p className="text-muted-foreground">
                  Coaches earn revenue from course enrollments and sessions. Payments are processed according 
                  to the coach agreement and are subject to platform fees. Coaches can request withdrawals 
                  according to the withdrawal policy.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acceptable Use Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">You agree NOT to:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Use the Platform for any illegal purpose or in violation of any laws</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Upload malicious code or attempt to compromise platform security</li>
                <li>Impersonate others or provide false information</li>
                <li>Share your account credentials with others</li>
                <li>Download or copy course materials for redistribution</li>
                <li>Use automated systems to access the Platform (bots, scrapers)</li>
                <li>Interfere with other users' access to the Platform</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Disclaimers and Limitations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Service "As Is"</h3>
                <p className="text-muted-foreground">
                  The Platform is provided "as is" and "as available" without warranties of any kind, either 
                  express or implied. We do not guarantee uninterrupted, secure, or error-free service.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Educational Content</h3>
                <p className="text-muted-foreground">
                  Course content and coaching advice are for educational purposes only. We do not guarantee 
                  specific results or outcomes from using our Platform.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Third-Party Content</h3>
                <p className="text-muted-foreground">
                  We are not responsible for the accuracy, quality, or appropriateness of user-generated 
                  content, including courses created by coaches.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Limitation of Liability</h3>
                <p className="text-muted-foreground">
                  To the maximum extent permitted by law, Experts Coaching Hub shall not be liable for any 
                  indirect, incidental, special, consequential, or punitive damages resulting from your use 
                  or inability to use the Platform.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We may terminate or suspend your account immediately, without prior notice, for any violation 
                of these Terms. Upon termination, your right to use the Platform will immediately cease.
              </p>
              <p className="text-muted-foreground">
                You may terminate your account at any time through your account settings. Termination does not 
                entitle you to a refund of any purchased credits or courses.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modifications to Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We reserve the right to modify these Terms at any time. We will provide notice of significant 
                changes by posting the new Terms on this page and updating the "Last updated" date. Your 
                continued use of the Platform after changes constitutes acceptance of the modified Terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governing Law</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of Malawi, without 
                regard to its conflict of law provisions. Any disputes arising from these Terms or your use 
                of the Platform shall be subject to the exclusive jurisdiction of the courts of Malawi.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="space-y-1 text-muted-foreground">
                <p>Email: legal@expertscoaching.com</p>
                <p>Support: support@expertscoaching.com</p>
                <p>Address: Experts Coaching Hub, Lilongwe, Malawi</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-center sm:text-left">
              &copy; 2025 Experts Coaching Hub. All rights reserved.
            </p>
            <div className="flex gap-6">
              <button onClick={() => navigate("/privacy")} className="text-muted-foreground hover:text-foreground">
                Privacy
              </button>
              <button onClick={() => navigate("/terms")} className="text-muted-foreground hover:text-foreground">
                Terms
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
