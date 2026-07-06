"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "statepulse:scroll";

export function ScrollRestoration() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (prevPath.current && prevPath.current !== pathname) {
      try {
        sessionStorage.setItem(`${STORAGE_KEY}:${prevPath.current}`, String(window.scrollY));
      } catch {
        // ignore storage errors
      }
    }

    let restored = false;
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY}:${pathname}`);
      if (saved != null) {
        window.scrollTo(0, Number(saved));
        restored = true;
      }
    } catch {
      // ignore storage errors
    }

    if (!restored) {
      window.scrollTo(0, 0);
    }

    prevPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        try {
          sessionStorage.setItem(`${STORAGE_KEY}:${pathname}`, String(window.scrollY));
        } catch {
          // ignore storage errors
        }
      }, 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
