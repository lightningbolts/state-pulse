import React from "react";

const testimonials = [
  {
    quote:
      "StatePulse keeps me informed about legislation that actually impacts my community. The alerts are a game changer!",
    name: "Alex R.",
    role: "Civic Volunteer",
  },
  {
    quote:
      "I love how easy it is to track bills across multiple states. The analytics help me spot trends fast.",
    name: "Morgan T.",
    role: "Policy Analyst",
  },
  {
    quote:
      "The clean design and real-time updates make StatePulse my go-to for state policy research.",
    name: "Jamie L.",
    role: "Journalist",
  },
];

export default function TestimonialCarousel() {
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="w-full max-w-2xl mx-auto my-12">
      <div className="relative bg-card rounded-xl shadow-lg px-8 py-10 text-center min-h-[180px] transition-all duration-500">
        <blockquote className="text-xl md:text-2xl font-medium text-muted-foreground leading-relaxed mb-6 min-h-[72px]">
          “{testimonials[index].quote}”
        </blockquote>
        <div className="flex flex-col items-center">
          <span className="font-semibold text-primary text-lg">{testimonials[index].name}</span>
          <span className="text-sm text-muted-foreground">{testimonials[index].role}</span>
        </div>
        <div className="flex justify-center gap-2 mt-4">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={`h-2 w-6 rounded-full transition-all duration-300 ${
                i === index ? "bg-accent" : "bg-muted"
              }`}
              onClick={() => setIndex(i)}
              aria-label={`Show testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
