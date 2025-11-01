import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { User, Lock, Trash2, Save, Camera, BookOpen, Plus, Users, BarChart3, Calendar, Video, Wallet, CreditCard, Shield, Upload, Loader2 as LoaderIcon } from "lucide-react";
import { getProfileSidebarSections } from "@/config/navigation";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check } from "lucide-react";
import { CreditWallet } from "@/components/CreditWallet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function Profile() {
  const { user, role, signOut, refreshUser } = useAuth();
  const { packages, packagesLoading, purchaseCredits } = useCredits();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Determine user role and navigation
  const userRole = (role as string | null) || user?.user_metadata?.role || "client";
  const dashboardPath = userRole === "coach" ? "/coach" : userRole === "admin" ? "/admin" : "/client";

  const sidebarSections = getProfileSidebarSections(userRole);

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      email: user?.email || "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      // Update profile in profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
        })
        .eq("id", user?.id);

      if (profileError) throw profileError;

      // Update email in auth if changed
      if (data.email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email,
        });
        if (emailError) throw emailError;
      }
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password.",
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // Note: In a real app, you'd want to handle this server-side
      // This is a simplified version for demonstration
      const { error } = await supabase.auth.admin.deleteUser(user?.id || "");
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully.",
      });
      signOut();
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account.",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile && !profileForm.formState.isDirty) {
      profileForm.reset({
        full_name: profile.full_name || "",
        email: user?.email || "",
      });
    }
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    } else if (user?.user_metadata?.avatar_url) {
      setAvatarUrl(user.user_metadata.avatar_url);
    }
  }, [profile, user?.email, profileForm]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    deleteAccountMutation.mutate();
  };

  const uploadAvatar = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user?.id) {
      toast({
        title: "Not authenticated",
        description: "Please sign in again to upload an avatar.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAvatarUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          upsert: false,
          cacheControl: "3600",
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (profileUpdateError) {
        throw profileUpdateError;
      }

      const { error: userUpdateError } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          avatar_url: publicUrl,
        },
      });

      if (userUpdateError) {
        throw userUpdateError;
      }

      setAvatarUrl(publicUrl);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error: any) {
      console.error("Avatar upload failed", error);
      toast({
        title: "Upload failed",
        description: error.message || "Unable to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAvatarUploading(false);
    }
  }, [queryClient, user]);

  if (profileLoading) {
    return (
      <DashboardLayout
        sidebarSections={sidebarSections}
        brandName="Experts Coaching Hub"
      >
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebarSections={sidebarSections}
      brandName="Experts Coaching Hub"
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="credits" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Credits
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <CardTitle>Profile Information</CardTitle>
                </div>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6">
                  <div className="relative">
                    <Avatar className="h-20 w-20 text-lg">
                      <AvatarImage src={avatarUrl || undefined} alt={profile?.full_name || user?.email || "Profile avatar"} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Profile Picture</p>
                      <p className="text-xs text-muted-foreground">Upload a square image (recommended 400x400px).</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <Input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={uploadAvatar}
                        disabled={avatarUploading}
                        className="cursor-pointer"
                      />
                      <Button type="button" variant="outline" onClick={() => document.getElementById("avatar-upload")?.click()} disabled={avatarUploading}>
                        <Upload className="h-4 w-4 mr-2" />
                        {avatarUploading ? "Uploading..." : "Upload New"}
                      </Button>
                    </div>
                  </div>
                </div>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                      className="w-full"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits Tab */}
          <TabsContent value="credits" className="space-y-6">
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
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            {/* Change Password */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  <CardTitle>Change Password</CardTitle>
                </div>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter current password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Enter new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="w-full"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions that will permanently affect your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Delete Account</h4>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all associated data
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all your data from our servers, including:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>Your profile information</li>
                              <li>All courses you've created (if you're a coach)</li>
                              <li>Your learning progress (if you're a student)</li>
                              <li>All associated content and data</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Yes, delete my account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
