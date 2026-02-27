"use client";

import { useEffect } from "react";

export function ThemeInit() {
  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const theme = saved === "light" || saved === "dark" ? saved : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
