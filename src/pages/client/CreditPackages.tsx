import { DashboardLayout } from "@/components/DashboardLayout";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { CreditWallet } from "@/components/CreditWallet";

export default function CreditPackages() {
  const { packages, packagesLoading, purchaseCredits } = useCredits();

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Buy Credits</h1>
          <p className="text-muted-foreground mt-2">
            Purchase credits to enroll in premium courses
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <CreditWallet showActions={false} />
          </div>

          <div className="lg:col-span-3">
            {packagesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages?.map((pkg) => {
                  const totalCredits = Number(pkg.credits) + Number(pkg.bonus_credits || 0);
                  const hasBonus = pkg.bonus_credits && pkg.bonus_credits > 0;
                  const pricePerCredit = pkg.price_mwk / totalCredits;

                  return (
                    <Card 
                      key={pkg.id} 
                      className={`relative ${hasBonus ? 'border-primary shadow-lg' : ''}`}
                    >
                      {hasBonus && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-gradient-to-r from-orange-500 to-pink-500">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Best Value
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-xl">{pkg.name}</CardTitle>
                        {pkg.description && (
                          <CardDescription className="text-sm">
                            {pkg.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="text-center py-4 bg-muted rounded-lg">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-5xl font-bold text-primary">
                              {totalCredits}
                            </span>
                            <span className="text-muted-foreground">credits</span>
                          </div>
                          
                          {hasBonus && (
                            <div className="mt-2 flex items-center justify-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {pkg.credits} base
                              </Badge>
                              <Badge variant="default" className="text-xs">
                                +{pkg.bonus_credits} bonus
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-sm text-muted-foreground">Price</span>
                            <span className="text-2xl font-bold">
                              MWK {pkg.price_mwk.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Per credit</span>
                            <span>MWK {pricePerCredit.toFixed(2)}</span>
                          </div>
                        </div>

                        <Button 
                          className="w-full"
                          size="lg"
                          onClick={() => purchaseCredits.mutate(pkg.id)}
                          disabled={purchaseCredits.isPending}
                        >
                          {purchaseCredits.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Purchase Now"
                          )}
                        </Button>

                        <div className="pt-2 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-600" />
                            <span>Instant delivery</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-600" />
                            <span>Secure payment via PayChangu</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-600" />
                            <span>No expiration date</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">How Credits Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <p className="font-medium text-foreground">Purchase Credits</p>
                <p>Choose a package and complete payment via PayChangu</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <p className="font-medium text-foreground">Browse Courses</p>
                <p>Explore premium courses with credit pricing</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <p className="font-medium text-foreground">Enroll & Learn</p>
                <p>Use your credits to enroll and get instant access</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
