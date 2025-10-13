import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";

interface CoachPackage {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  max_clients: number | null;
  is_active: boolean;
}

const CoachPackages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CoachPackage | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_monthly: "",
    yearly_discount: "",
    price_yearly: "",
    features: "",
    max_clients: "",
    is_active: false,
  });

  // Auto-calculate yearly price when monthly price or discount changes
  useEffect(() => {
    const monthlyPrice = parseFloat(formData.price_monthly) || 0;
    const discountPercent = parseFloat(formData.yearly_discount) || 0;
    const calculatedYearlyPrice = monthlyPrice * 12;
    const discountAmount = (calculatedYearlyPrice * discountPercent) / 100;
    const yearlyPrice = calculatedYearlyPrice - discountAmount;

    if (monthlyPrice > 0) {
      setFormData(prev => ({
        ...prev,
        price_yearly: yearlyPrice.toString()
      }));
    }
  }, [formData.price_monthly, formData.yearly_discount]);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["coach_packages", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_packages")
        .select("*")
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CoachPackage[];
    },
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: any) => {
      const packageData = {
        coach_id: user!.id,
        name: data.name,
        description: data.description,
        price_monthly: parseFloat(data.price_monthly),
        price_yearly: parseFloat(data.price_yearly),
        features: data.features.split('\n').filter((f: string) => f.trim()),
        max_clients: data.max_clients ? parseInt(data.max_clients) : null,
        is_active: data.is_active,
      };

      const { data: result, error } = await supabase
        .from("coach_packages")
        .insert(packageData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Package created successfully!");
      queryClient.invalidateQueries({ queryKey: ["coach_packages", user?.id] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create package: " + error.message);
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const packageData = {
        name: data.name,
        description: data.description,
        price_monthly: parseFloat(data.price_monthly),
        price_yearly: parseFloat(data.price_yearly),
        features: data.features.split('\n').filter((f: string) => f.trim()),
        max_clients: data.max_clients ? parseInt(data.max_clients) : null,
        is_active: data.is_active,
      };

      const { data: result, error } = await supabase
        .from("coach_packages")
        .update(packageData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Package updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["coach_packages", user?.id] });
      setEditingPackage(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update package: " + error.message);
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coach_packages")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Package deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["coach_packages", user?.id] });
    },
    onError: (error: any) => {
      toast.error("Failed to delete package: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price_monthly: "",
      yearly_discount: "",
      price_yearly: "",
      features: "",
      max_clients: "",
      is_active: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPackage) {
      updatePackageMutation.mutate({ id: editingPackage.id, data: formData });
    } else {
      createPackageMutation.mutate(formData);
    }
  };

  const handleEdit = (pkg: CoachPackage) => {
    setEditingPackage(pkg);
    const monthlyPrice = pkg.price_monthly;
    const yearlyPrice = pkg.price_yearly;
    const calculatedYearlyPrice = monthlyPrice * 12;
    const discountAmount = calculatedYearlyPrice - yearlyPrice;
    const discountPercent = calculatedYearlyPrice > 0 ? (discountAmount / calculatedYearlyPrice) * 100 : 0;

    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      price_monthly: pkg.price_monthly.toString(),
      yearly_discount: Math.max(0, discountPercent).toString(),
      price_yearly: pkg.price_yearly.toString(),
      features: pkg.features.join('\n'),
      max_clients: pkg.max_clients?.toString() || "",
      is_active: pkg.is_active,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this package?")) {
      deletePackageMutation.mutate(id);
    }
  };

  const togglePublish = async (pkg: CoachPackage) => {
    updatePackageMutation.mutate({
      id: pkg.id,
      data: { ...pkg, is_active: !pkg.is_active }
    });
  };

  return (
    <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Subscription Packages</h1>
            <p className="text-muted-foreground">Create and manage subscription packages for your clients</p>
          </div>
          <Dialog open={isCreateDialogOpen || !!editingPackage} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingPackage(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingPackage ? "Edit Package" : "Create New Package"}</DialogTitle>
                  <DialogDescription>
                    {editingPackage ? "Update your subscription package details" : "Create a new subscription package that clients can subscribe to"}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="col-span-3"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="col-span-3"
                      placeholder="Describe what clients get with this package"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price_monthly" className="text-right">Monthly Price (MWK)</Label>
                    <Input
                      id="price_monthly"
                      type="number"
                      value={formData.price_monthly}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_monthly: e.target.value }))}
                      className="col-span-3"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="yearly_discount" className="text-right">Yearly Discount (%)</Label>
                    <Input
                      id="yearly_discount"
                      type="number"
                      value={formData.yearly_discount}
                      onChange={(e) => setFormData(prev => ({ ...prev, yearly_discount: e.target.value }))}
                      className="col-span-3"
                      placeholder="Percentage discount for yearly subscriptions (e.g., 10)"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="price_yearly" className="text-right">Yearly Price (MWK)</Label>
                    <div className="col-span-3">
                      <Input
                        id="price_yearly"
                        type="number"
                        value={formData.price_yearly}
                        readOnly
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-calculated: Monthly × 12 × (1 - discount%)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="features" className="text-right">Features</Label>
                    <Textarea
                      id="features"
                      value={formData.features}
                      onChange={(e) => setFormData(prev => ({ ...prev, features: e.target.value }))}
                      className="col-span-3"
                      placeholder="Enter each feature on a new line"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="max_clients" className="text-right">Max Clients</Label>
                    <Input
                      id="max_clients"
                      type="number"
                      value={formData.max_clients}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_clients: e.target.value }))}
                      className="col-span-3"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="is_active" className="text-right">Published</Label>
                    <div className="col-span-3">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {formData.is_active ? "Package is visible to clients" : "Package is hidden from clients"}
                      </p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createPackageMutation.isPending || updatePackageMutation.isPending}>
                    {editingPackage ? "Update Package" : "Create Package"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-3 text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading packages...</p>
            </div>
          ) : packages?.length === 0 ? (
            <div className="col-span-3 text-center py-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium">No packages yet</h3>
                    <p className="text-muted-foreground mt-2">Create your first subscription package to start accepting recurring payments from clients.</p>
                    <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Package
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            packages?.map((pkg) => (
              <Card key={pkg.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Monthly:</span>
                      <span className="font-medium">MWK {pkg.price_monthly.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Yearly:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">MWK {pkg.price_yearly.toLocaleString()}</span>
                        {(() => {
                          const monthlyPrice = pkg.price_monthly;
                          const calculatedYearlyPrice = monthlyPrice * 12;
                          const discount = calculatedYearlyPrice - pkg.price_yearly;
                          if (discount > 0) {
                            const savingsPercent = Math.round((discount / calculatedYearlyPrice) * 100);
                            return (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                Save {savingsPercent}%
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    {pkg.max_clients && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Max clients:</span>
                        <span className="font-medium">{pkg.max_clients}</span>
                      </div>
                    )}
                  </div>

                  {pkg.features.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Features:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {pkg.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx}>• {feature}</li>
                        ))}
                        {pkg.features.length > 3 && (
                          <li className="text-muted-foreground">• +{pkg.features.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(pkg)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePublish(pkg)}
                  >
                    {pkg.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(pkg.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CoachPackages;
