import React from "react";

const logos = [
  {
    src: "/trusted-logo1.svg",
    alt: "Trusted Org 1",
  },
  {
    src: "/trusted-logo2.svg",
    alt: "Trusted Org 2",
  },
  {
    src: "/trusted-logo3.svg",
    alt: "Trusted Org 3",
  },
  {
    src: "/trusted-logo4.svg",
    alt: "Trusted Org 4",
  },
];

export default function TrustedByRow() {
  return (
    <div className="w-full max-w-3xl mx-auto my-8 flex flex-col items-center">
      <span className="uppercase text-xs tracking-widest text-muted-foreground mb-4 font-semibold">Trusted by</span>
      <div className="flex flex-wrap justify-center items-center gap-8">
        {logos.map((logo, i) => (
          <img
            key={i}
            src={logo.src}
            alt={logo.alt}
            className="h-8 md:h-10 grayscale opacity-70 hover:opacity-100 hover:grayscale-0 transition-all duration-300"
            style={{ maxWidth: 120 }}
          />
        ))}
      </div>
    </div>
  );
}
