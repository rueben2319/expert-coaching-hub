import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  BookOpen,
  Calendar,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CertificateData {
  certificate_id: string;
  course_title: string;
  student_name: string;
  coach_name: string;
  issued_at: string;
  expires_at: string | null;
  verification_status: string;
  is_valid: boolean;
}

export function CertificateVerification() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certificateId) return;

    const verifyCertificate = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .rpc('verify_certificate', { p_certificate_id: certificateId });

        if (error) throw error;
        
        if (data && data.length > 0) {
          setCertificate(data[0]);
        } else {
          setError("Certificate not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to verify certificate");
      } finally {
        setLoading(false);
      }
    };

    verifyCertificate();
  }, [certificateId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string, isValid: boolean) => {
    if (!isValid) {
      return "bg-red-100 text-red-800";
    }
    
    switch (status) {
      case "valid":
        return "bg-green-100 text-green-800";
      case "expired":
        return "bg-orange-100 text-orange-800";
      case "revoked":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string, isValid: boolean) => {
    if (!isValid) {
      return <XCircle className="w-5 h-5 text-red-600" />;
    }
    
    switch (status) {
      case "valid":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "expired":
        return <Clock className="w-5 h-5 text-orange-600" />;
      case "revoked":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Award className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-pulse" />
          <p className="text-lg">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-8">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-semibold mb-2">Certificate Not Found</h2>
            <p className="text-muted-foreground">
              {error || "The certificate ID you entered is not valid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Award className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Certificate Verification</h1>
          </div>
          <p className="text-muted-foreground">
            Verify the authenticity of course completion certificates
          </p>
        </div>

        {/* Verification Result */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(certificate.verification_status, certificate.is_valid)}
                Verification Result
              </CardTitle>
              <Badge className={getStatusColor(certificate.verification_status, certificate.is_valid)}>
                {certificate.is_valid ? "Valid" : "Invalid"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Certificate Details */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Certificate ID</label>
                  <p className="font-mono text-sm">{certificate.certificate_id}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Student Name</label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <p className="font-medium">{certificate.student_name}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Course Title</label>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <p className="font-medium">{certificate.course_title}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Issued By</label>
                  <p className="font-medium">{certificate.coach_name}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <p>{formatDate(certificate.issued_at)}</p>
                  </div>
                </div>
                
                {certificate.expires_at && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <p>{formatDate(certificate.expires_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Status */}
            <div className={`p-4 rounded-lg border ${
              certificate.is_valid 
                ? "bg-green-50 border-green-200" 
                : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-start gap-3">
                {getStatusIcon(certificate.verification_status, certificate.is_valid)}
                <div>
                  <h4 className="font-semibold mb-1">
                    {certificate.is_valid ? "Certificate is Valid" : "Certificate is Invalid"}
                  </h4>
                  <p className="text-sm">
                    {certificate.is_valid 
                      ? "This certificate has been verified and is authentic."
                      : "This certificate could not be verified or has been invalidated."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => window.navigator.clipboard.writeText(window.location.href)}
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Copy Verification Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>This verification system ensures the authenticity of course completion certificates.</p>
          <p>For inquiries, please contact the course provider.</p>
        </div>
      </div>
    </div>
  );
}
