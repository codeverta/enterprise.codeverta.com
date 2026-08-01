import React, { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const SafeHTMLRenderer = ({ html }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Render Math Blocks ($$...$$)
    containerRef.current.querySelectorAll(".math-block").forEach((el) => {
      const formula = decodeURIComponent(el.getAttribute("data-math") || "");
      if (formula) {
        katex.render(formula, el, { displayMode: true, throwOnError: false });
      }
    });

    // 2. Render Inline Math ($...$)
    containerRef.current.querySelectorAll(".math-inline").forEach((el) => {
      const formula = decodeURIComponent(el.getAttribute("data-math") || "");
      if (formula) {
        katex.render(formula, el, { displayMode: false, throwOnError: false });
      }
    });
  }, [html]); // Berjalan tepat setiap kali HTML berubah

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
};


export default SafeHTMLRenderer;