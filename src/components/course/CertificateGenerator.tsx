import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Award, Share2, ExternalLink, Calendar, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Certificate {
  id: string;
  course_id: string;
  certificate_id: string;
  issued_at: string;
  expires_at: string | null;
  verification_status: string;
  courses: {
    title: string;
    coach_id: string;
  };
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface CertificateGeneratorProps {
  userId: string;
  courseId?: string;
  showAllCertificates?: boolean;
}

export function CertificateGenerator({ 
  userId, 
  courseId, 
  showAllCertificates = false 
}: CertificateGeneratorProps) {
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const queryClient = useQueryClient();

  const { data: certificates, isLoading } = useQuery({
    queryKey: ["user-certificates", userId, courseId],
    queryFn: async () => {
      let query = supabase
        .from("course_certificates")
        .select(`
          *,
          courses (
            title,
            coach_id
          ),
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq("user_id", userId);

      if (courseId) {
        query = query.eq("course_id", courseId);
      }

      const { data, error } = await query.order("issued_at", { ascending: false });

      if (error) throw error;
      return data as Certificate[];
    },
    enabled: !!userId,
  });

  const downloadMutation = useMutation({
    mutationFn: async (certificateId: string) => {
      // This would call an edge function to generate and download the certificate
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { certificateId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, certificateId) => {
      // Create download link
      const link = document.createElement('a');
      link.href = data.certificateUrl;
      link.download = `certificate-${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Certificate downloaded",
        description: "Your certificate has been downloaded successfully."
      });
    },
    onError: () => {
      toast({
        title: "Download failed",
        description: "Unable to download certificate. Please try again.",
        variant: "destructive",
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (certificateId: string) => {
      const { data, error } = await supabase.functions.invoke("share-certificate", {
        body: { certificateId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Copy shareable link to clipboard
      navigator.clipboard.writeText(data.shareUrl);
      toast({
        title: "Link copied",
        description: "Certificate link copied to clipboard."
      });
    },
    onError: () => {
      toast({
        title: "Share failed",
        description: "Unable to generate share link.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "valid":
        return "bg-green-100 text-green-800";
      case "expired":
        return "bg-red-100 text-red-800";
      case "revoked":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const CertificatePreview = ({ certificate }: { certificate: Certificate }) => (
    <div className="space-y-6">
      {/* Certificate Visual Preview */}
      <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-8 text-center">
        <div className="absolute top-4 right-4">
          <Badge className={getStatusColor(certificate.verification_status)}>
            {certificate.verification_status}
          </Badge>
        </div>
        
        <Award className="w-16 h-16 mx-auto mb-4 text-indigo-600" />
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Certificate of Completion</h3>
        
        <p className="text-lg text-gray-700 mb-6">
          This is to certify that
        </p>
        
        <div className="bg-white rounded-lg px-6 py-3 mb-6 inline-block">
          <p className="text-xl font-semibold text-gray-900">
            {certificate.profiles.full_name}
          </p>
        </div>
        
        <p className="text-gray-700 mb-6">
          has successfully completed the course
        </p>
        
        <div className="bg-white rounded-lg px-6 py-3 mb-6 inline-block">
          <p className="text-lg font-medium text-gray-900">
            {certificate.courses.title}
          </p>
        </div>
        
        <div className="flex justify-center gap-8 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Issued: {formatDate(certificate.issued_at)}</span>
          </div>
          {certificate.expires_at && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Expires: {formatDate(certificate.expires_at)}</span>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-xs text-gray-500">
          Certificate ID: {certificate.certificate_id}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Button
          onClick={() => downloadMutation.mutate(certificate.id)}
          disabled={downloadMutation.isPending}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          {downloadMutation.isPending ? "Generating..." : "Download PDF"}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => shareMutation.mutate(certificate.certificate_id)}
          disabled={shareMutation.isPending}
          className="flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          {shareMutation.isPending ? "Generating..." : "Share"}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => window.open(`/verify/${certificate.certificate_id}`, '_blank')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Verify
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="text-center py-8">Loading certificates...</div>;
  }

  if (!certificates || certificates.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
          <p className="text-muted-foreground">
            Complete courses to earn certificates of achievement.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (courseId && certificates.length > 0) {
    // Show single certificate for specific course
    return <CertificatePreview certificate={certificates[0]} />;
  }

  // Show all certificates
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Certificates</h2>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {certificates.map((certificate) => (
          <Card key={certificate.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <Badge className={getStatusColor(certificate.verification_status)}>
                    {certificate.verification_status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold line-clamp-2">
                    {certificate.courses.title}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{certificate.profiles.full_name}</span>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>Issued: {formatDate(certificate.issued_at)}</span>
                  </div>
                  {certificate.expires_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>Expires: {formatDate(certificate.expires_at)}</span>
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground font-mono">
                  ID: {certificate.certificate_id}
                </div>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full" 
                      onClick={() => setSelectedCertificate(certificate)}
                    >
                      View Certificate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Certificate of Completion</DialogTitle>
                    </DialogHeader>
                    {selectedCertificate && (
                      <CertificatePreview certificate={selectedCertificate} />
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
