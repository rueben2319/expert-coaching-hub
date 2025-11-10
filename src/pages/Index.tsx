import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, BookOpen, TrendingUp, Star } from "lucide-react";

const sampleCourses = [
  {
    id: "c1",
    title: "Foundations of Product Management",
    coach: "Ava Johnson",
    duration: "6 weeks",
    students: 1280,
    image: "/placeholder.svg",
  },
  {
    id: "c2",
    title: "Intro to Growth Marketing",
    coach: "Liam Smith",
    duration: "4 weeks",
    students: 920,
    image: "/placeholder.svg",
  },
  {
    id: "c3",
    title: "Advanced Coaching Techniques",
    coach: "Sophia Lee",
    duration: "8 weeks",
    students: 540,
    image: "/placeholder.svg",
  },
];

const sampleCoaches = [
  { id: "co1", name: "Ava Johnson", title: "Product Coach", reviews: 124 },
  { id: "co2", name: "Liam Smith", title: "Growth Coach", reviews: 98 },
  { id: "co3", name: "Sophia Lee", title: "Leadership Coach", reviews: 76 },
];

const sampleReviews = [
  { id: "r1", name: "Mark", rating: 5, text: "Transformed my career — the coaching was practical and supportive." },
  { id: "r2", name: "Rita", rating: 5, text: "Amazing course structure and actionable feedback from coaches." },
  { id: "r3", name: "Joel", rating: 4, text: "Great insights and measurable progress over the weeks." },
];

const CourseCard = ({ course }: { course: typeof sampleCourses[number] }) => (
  <div className="bg-card/50 rounded-2xl shadow-sm overflow-hidden">
    <div className="h-40 bg-muted-foreground/5 flex items-center justify-center">
      {course.image && course.image !== "/placeholder.svg" ? (
        <img 
          src={course.image} 
          alt={`${course.title} course cover image`}
          className="h-28 object-contain"
          loading="lazy"
        />
      ) : (
        <div 
          className="h-28 w-full bg-muted flex items-center justify-center"
          aria-label={`${course.title} course - no image available`}
        >
          <BookOpen className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
    <div className="p-4">
      <h4 className="font-semibold text-lg">{course.title}</h4>
      <p className="text-sm text-muted-foreground">{course.coach} • {course.duration}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{course.students.toLocaleString()} students</div>
        <Button size="sm" className="px-3" onClick={() => { window.location.href = '/auth'; }}>
          View
        </Button>
      </div>
    </div>
  </div>
);

const CoachCard = ({ coach }: { coach: typeof sampleCoaches[number] }) => (
  <div className="bg-gradient-to-br from-white/20 to-card/20 border rounded-2xl p-4 text-center">
    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 text-primary">
      <Users className="w-7 h-7" />
    </div>
    <h5 className="font-semibold">{coach.name}</h5>
    <p className="text-sm text-muted-foreground">{coach.title}</p>
    <div className="mt-2 text-sm text-muted-foreground">{coach.reviews} reviews</div>
  </div>
);

const ReviewItem = ({ r }: { r: typeof sampleReviews[number] }) => (
  <div className="flex-shrink-0 w-80 bg-card/30 rounded-2xl p-4 mr-4">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-full bg-muted-foreground/10 flex items-center justify-center">{r.name[0]}</div>
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="flex items-center text-yellow-400 text-sm">
          {Array.from({ length: r.rating }).map((_, i) => (
            <Star key={i} className="w-4 h-4" />
          ))}
        </div>
      </div>
    </div>
    <div className="text-sm text-muted-foreground">{r.text}</div>
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  // Removed automatic redirect - now showing dashboard button instead
  // This allows logged-in users to view the landing page

  if (loading) {
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
      {/* Skip Navigation Link - WCAG 2.1 Level A Requirement */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>
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
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                <Button
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  onClick={() => navigate("/auth")}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block mb-6 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
              Professional Coaching Platform
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-tight">
              Transform Learning Through Coaching
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Connect with expert coaches, create engaging courses, and accelerate your growth journey
            </p>
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
                    onClick={() => navigate("/auth")}
                  >
                    Start Learning
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8"
                    onClick={() => navigate("/auth")}
                  >
                    Become a Coach
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-semibold mb-6 text-center">Featured Courses</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {sampleCourses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 bg-card/30 backdrop-blur-sm rounded-3xl my-12">
          <h2 className="text-2xl font-semibold mb-6 text-center">Top Coaches</h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {sampleCoaches.map((co) => (
              <CoachCard key={co.id} coach={co} />
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-semibold mb-6 text-center">What students say</h2>
          <div className="overflow-x-auto py-2 flex items-start px-2">
            {sampleReviews.map((r) => (
              <ReviewItem key={r.id} r={r} />
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12 bg-gradient-to-r from-primary/10 to-accent/10 rounded-3xl my-12">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl font-semibold mb-4">Ready to start?</h3>
            <p className="text-muted-foreground mb-6">Join thousands of learners and start accelerating your growth with expert coaches.</p>
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
                    Get Started
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

export default Index;
