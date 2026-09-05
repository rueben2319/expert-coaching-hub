import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Star } from "lucide-react";
import type { Certificate } from "@/hooks/useUserCertificates";

interface AchievementsSectionProps {
  certificates: Certificate[];
  isLoading: boolean;
}

export function AchievementsSection({ certificates, isLoading }: AchievementsSectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Latest Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading achievements...</div>
        </CardContent>
      </Card>
    );
  }

  if (!certificates || certificates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Latest Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Award className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Complete courses to earn certificates and achievements</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Latest Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Course Certificates */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Award className="h-4 w-4" />
            Certificates
          </h4>
          <div className="space-y-2">
            {certificates.slice(0, 3).map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{cert.courses.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Issued {new Date(cert.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {cert.verification_status === 'valid' ? 'Valid' : cert.verification_status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Achievement Badges (placeholder for future implementation) */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" />
            Achievements
          </h4>
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>Achievements and badges coming soon!</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
