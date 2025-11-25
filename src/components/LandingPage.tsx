import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Star, 
  TrendingUp, 
  Clock,
  DollarSign,
  User,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  level: 'introduction' | 'intermediate' | 'advanced';
  tag: string | null;
  category: string | null;
  price_credits: number;
  is_free: boolean;
  created_at: string;
  coach_id: string;
  coach_name: string;
  coach_avatar: string | null;
  student_count: number;
}

interface Coach {
  id: string;
  full_name: string;
  avatar_url: string | null;
  course_count: number;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  course_title: string;
}

interface LandingPageData {
  courses: Course[];
  coaches: Coach[];
  testimonials: Testimonial[];
  stats: {
    total_courses: number;
    total_coaches: number;
    total_students: number;
  };
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [data, setData] = useState<LandingPageData | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchLandingPageData();
  }, []);

  const fetchLandingPageData = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-public-data`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching landing page data:', error);
      toast.error('Failed to load content');
      // Fallback to sample data if API fails
      setData({
        courses: [],
        coaches: [],
        testimonials: [],
        stats: { total_courses: 0, total_coaches: 0, total_students: 0 }
      });
    } finally {
      setLoadingData(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'introduction': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const CourseCard: React.FC<{ course: Course }> = ({ course }) => (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="relative h-48 bg-gradient-to-br from-primary/10 to-accent/5">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          {course.is_free ? (
            <Badge className="bg-green-500">Free</Badge>
          ) : (
            <Badge variant="secondary">
              <DollarSign className="w-3 h-3 mr-1" />
              {course.price_credits}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge className={getLevelColor(course.level)}>
            {course.level}
          </Badge>
          {course.tag && (
            <Badge variant="outline">{course.tag}</Badge>
          )}
        </div>
        <CardTitle className="text-lg mb-2 line-clamp-2">{course.title}</CardTitle>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {course.description}
        </p>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{course.student_count} students</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="w-4 h-4" />
            <span>{course.coach_name}</span>
          </div>
        </div>
        <Button 
          className="w-full group-hover:bg-primary/90"
          onClick={() => navigate('/auth')}
        >
          Enroll Now
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );

  const CoachCard: React.FC<{ coach: Coach }> = ({ coach }) => (
    <Card className="text-center hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          {coach.avatar_url ? (
            <img
              src={coach.avatar_url}
              alt={coach.full_name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <Users className="w-10 h-10 text-primary-foreground" />
          )}
        </div>
        <h3 className="font-semibold text-lg mb-1">{coach.full_name}</h3>
        <p className="text-sm text-muted-foreground mb-2">Expert Coach</p>
        <div className="flex items-center justify-center gap-2 text-sm">
          <BookOpen className="w-4 h-4" />
          <span>{coach.course_count} courses</span>
        </div>
      </CardContent>
    </Card>
  );

  const TestimonialCard: React.FC<{ testimonial: Testimonial }> = ({ testimonial }) => (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-center gap-1 mb-3">
          {[...Array(testimonial.rating)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-muted-foreground mb-4 italic">"{testimonial.content}"</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{testimonial.name}</div>
            <div className="text-sm text-muted-foreground">{testimonial.role}</div>
            <div className="text-xs text-primary">{testimonial.course_title}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Experts Coaching Hub</span>
          </div>
          <div className="flex gap-2">
            {user && role ? (
              <Button
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                onClick={() => navigate(`/${role}`)}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
                <Button
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  onClick={() => navigate('/auth')}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
              Professional Coaching Platform
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
              Transform Your Career Through Expert Coaching
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Learn from industry experts, gain practical skills, and accelerate your professional growth
            </p>
            
            {/* Stats */}
            {data && (
              <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-10">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{data.stats.total_courses}</div>
                  <div className="text-sm text-muted-foreground">Courses</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{data.stats.total_coaches}</div>
                  <div className="text-sm text-muted-foreground">Expert Coaches</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{data.stats.total_students}</div>
                  <div className="text-sm text-muted-foreground">Students</div>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-4 justify-center">
              {user && role ? (
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-lg px-8"
                  onClick={() => navigate(`/${role}`)}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-lg px-8"
                    onClick={() => navigate('/auth')}
                  >
                    Start Learning
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8"
                    onClick={() => navigate('/auth')}
                  >
                    Become a Coach
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Featured Courses */}
        {data && data.courses.length > 0 && (
          <section className="container mx-auto px-4 py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Featured Courses</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Discover our most popular courses taught by industry experts
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data.courses.slice(0, 8).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            {data.courses.length > 8 && (
              <div className="text-center mt-8">
                <Button variant="outline" size="lg" onClick={() => navigate('/auth')}>
                  View All Courses
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Expert Coaches */}
        {data && data.coaches.length > 0 && (
          <section className="container mx-auto px-4 py-16 bg-card/30 backdrop-blur-sm rounded-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Meet Our Expert Coaches</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Learn from professionals with real-world experience
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {data.coaches.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          </section>
        )}

        {/* Testimonials */}
        {data && data.testimonials.length > 0 && (
          <section className="container mx-auto px-4 py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">What Our Students Say</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Real stories from students who transformed their careers
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {data.testimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          </section>
        )}

        {/* How It Works */}
        <section className="container mx-auto px-4 py-16 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Sign Up</h3>
              <p className="text-muted-foreground">Create your free account and tell us about your learning goals</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Choose Course</h3>
              <p className="text-muted-foreground">Browse our catalog and enroll in courses that match your interests</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-foreground">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Start Learning</h3>
              <p className="text-muted-foreground">Access course materials and get personalized guidance from expert coaches</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Career?</h3>
            <p className="text-muted-foreground mb-8">
              Join thousands of learners who have accelerated their careers through expert coaching.
            </p>
            <div className="flex gap-4 justify-center">
              {user && role ? (
                <Button 
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 px-8" 
                  onClick={() => navigate(`/${role}`)}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 px-8" onClick={() => navigate('/auth')}>
                    Get Started Free
                  </Button>
                  <Button variant="outline" className="px-8" onClick={() => navigate('/auth')}>
                    Learn More
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-center sm:text-left">
              &copy; 2025 Experts Coaching Hub. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
