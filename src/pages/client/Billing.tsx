import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePayments } from "@/hooks/usePayments";
import { toast } from "sonner";
import { isBuilderPreview } from "@/lib/builderPreview";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";
import { CheckCircle, Crown, Star, ArrowRight, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const MOCK_HISTORY = {
  invoices: [
    { id: "inv_1", invoice_number: "INV-2001", amount: 25, currency: "USD", status: "paid", invoice_date: new Date().toISOString(), description: "Course: React Basics" },
  ],
  orders: [
    { id: "ord_1", client_id: "client_1", coach_id: "coach_1", type: "one_time", amount: 25, currency: "USD", status: "paid", transaction_id: "tx_1", course_id: "course_1", created_at: new Date().toISOString() },
  ],
  subscriptions: [],
  transactions: [
    { id: "tx_1", transaction_ref: "txref_1", amount: 25, currency: "USD", status: "success", created_at: new Date().toISOString(), order_id: "ord_1", subscription_id: null },
  ],
};

const ClientBilling = () => {
  const { getPurchaseHistory, createClientOneTimeOrder, getClientSubscriptions, getCoachPackages, createClientSubscription } = usePayments();
  const [coachId, setCoachId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [amount, setAmount] = useState("");

  // Pagination state
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const itemsPerPage = 5;

  const builder = isBuilderPreview();

  const { data: history } = useQuery({
    queryKey: ["purchase_history"],
    queryFn: getPurchaseHistory,
    enabled: !builder,
    initialData: builder ? MOCK_HISTORY : undefined,
  });

  const { data: currentSubscriptions } = useQuery({
    queryKey: ["client_subscriptions"],
    queryFn: getClientSubscriptions,
    enabled: !builder,
  });

  const { data: availablePackages } = useQuery({
    queryKey: ["coach_packages"],
    queryFn: getCoachPackages,
    enabled: !builder,
  });

  const startOneTimePayment = async () => {
    try {
      const amt = Number(amount);
      if (!coachId || !courseId || !amt) {
        toast.error("Coach, course and amount are required");
        return;
      }
      if (builder) {
        toast.success("Builder preview: simulated payment successful");
        return;
      }
      const { checkout_url } = await createClientOneTimeOrder(coachId, courseId, amt);
      window.location.href = checkout_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    }
  };

  const subscribeToPackage = async (coachId: string, packageId: string, billingCycle: "monthly" | "yearly") => {
    try {
      if (builder) {
        toast.success("Builder preview: simulated subscription successful");
        return;
      }
      const { checkout_url } = await createClientSubscription(coachId, packageId, billingCycle);
      window.location.href = checkout_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start subscription");
    }
  };

  const currentPlan = currentSubscriptions?.find(sub => sub.status === 'active');
  const otherPackages = availablePackages?.filter(pkg =>
    !currentSubscriptions?.some(sub =>
      sub.coach_packages?.id === pkg.id && sub.status === 'active'
    )
  );

  // Pagination helpers
  const getPaginatedItems = (items: any[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items?.slice(startIndex, endIndex) || [];
  };

  const getTotalPages = (items: any[]) => {
    return Math.ceil((items?.length || 0) / itemsPerPage);
  };

  const PaginationControls = ({ currentPage, totalPages, onPageChange }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Billing & Payments</h1>

        {/* Current Plan Section */}
        {currentPlan && (
          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-green-600" />
                <div>
                  <CardTitle className="text-green-800">Current Plan</CardTitle>
                  <CardDescription>You have an active subscription</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{currentPlan.coach_packages?.name}</h3>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Coach: {currentPlan.coach_packages?.profiles?.full_name}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {currentPlan.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'} billing
                    </div>
                    {currentPlan.renewal_date && (
                      <div>
                        Renews: {new Date(currentPlan.renewal_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    MWK {currentPlan.billing_cycle === 'monthly'
                      ? currentPlan.coach_packages?.price_monthly
                      : currentPlan.coach_packages?.price_yearly}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    per {currentPlan.billing_cycle === 'monthly' ? 'month' : 'year'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Plans Section */}
        {otherPackages && otherPackages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Available Plans
              </CardTitle>
              <CardDescription>
                {currentPlan ? 'Upgrade or change your coaching plan' : 'Choose a coaching plan to get started'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherPackages.map((pkg) => (
                  <Card key={pkg.id} className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{pkg.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            by {pkg.profiles?.full_name}
                          </p>
                        </div>
                        <Badge variant="outline">{pkg.id}</Badge>
                      </div>
                      {pkg.description && (
                        <CardDescription className="text-sm">{pkg.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Monthly</span>
                          <span className="font-semibold">MWK {pkg.price_monthly}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Yearly</span>
                          <span className="font-semibold">MWK {pkg.price_yearly}</span>
                        </div>
                      </div>

                      {pkg.features && Array.isArray(pkg.features) && pkg.features.length > 0 && (
                        <div className="space-y-1">
                          {Array.isArray(pkg.features) && pkg.features.slice(0, 3).map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              <span>{String(feature)}</span>
                            </div>
                          ))}
                          {Array.isArray(pkg.features) && pkg.features.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{pkg.features.length - 3} more features
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => subscribeToPackage(pkg.profiles.id, pkg.id, 'monthly')}
                      >
                        Monthly
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => subscribeToPackage(pkg.profiles.id, pkg.id, 'yearly')}
                      >
                        Yearly
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Quick one-time purchase</CardTitle>
            <CardDescription>Enter details to purchase a course.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Coach ID" value={coachId} onChange={(e) => setCoachId(e.target.value)} />
            <Input placeholder="Course ID" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
            <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button onClick={startOneTimePayment}>Pay</Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getPaginatedItems(currentSubscriptions, subscriptionPage).map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {sub.coach_packages?.name}
                        <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Coach: {sub.coach_packages?.profiles?.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sub.billing_cycle} • Started {new Date(sub.start_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        MWK {sub.billing_cycle === 'monthly' ? sub.coach_packages?.price_monthly : sub.coach_packages?.price_yearly}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        per {sub.billing_cycle === 'monthly' ? 'month' : 'year'}
                      </div>
                    </div>
                  </div>
                ))}
                {(!currentSubscriptions || currentSubscriptions.length === 0) && (
                  <div className="text-sm text-muted-foreground">No subscriptions yet.</div>
                )}
              </div>
            </CardContent>
            <PaginationControls
              currentPage={subscriptionPage}
              totalPages={getTotalPages(currentSubscriptions)}
              onPageChange={setSubscriptionPage}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getPaginatedItems(history?.invoices, invoicePage).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{inv.description || "Payment"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{inv.amount} {inv.currency}</div>
                      <div className="text-xs text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {(!history?.invoices || history.invoices.length === 0) && (
                  <div className="text-sm text-muted-foreground">No invoices yet.</div>
                )}
              </div>
            </CardContent>
            <PaginationControls
              currentPage={invoicePage}
              totalPages={getTotalPages(history?.invoices)}
              onPageChange={setInvoicePage}
            />
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getPaginatedItems(history?.orders, orderPage).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium">{o.type} {o.course_id ? `• ${o.course_id}` : ""}</div>
                    <div className="text-sm text-muted-foreground">Coach: {o.coach_id}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{o.amount} {o.currency}</div>
                    <div className="text-xs text-muted-foreground">{o.status}</div>
                  </div>
                </div>
              ))}
              {(!history?.orders || history.orders.length === 0) && (
                <div className="text-sm text-muted-foreground">No orders yet.</div>
              )}
            </div>
          </CardContent>
          <PaginationControls
            currentPage={orderPage}
            totalPages={getTotalPages(history?.orders)}
            onPageChange={setOrderPage}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ClientBilling;
