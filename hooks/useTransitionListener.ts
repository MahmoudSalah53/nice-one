import { useEffect, useRef } from "react";

/**
 * Hook to listen for clicks on transition buttons with specific textContent values
 * and URL changes. Uses a document-level click listener and checks the clicked element's textContent.
 *
 * Monitors for buttons with the following textContent:
 * - "اختيار الرحلة"
 * - "اختيار"
 * - "متابعة"
 * - "رجوع"
 * - "التالي"
 * - Any button containing "الدفع"
 *
 * Also monitors URL changes (navigation, back/forward, programmatic navigation).
 *
 * @param callback - Function to call when any of the monitored buttons is clicked or URL changes
 */
export const useTransitionListener = (callback: () => void) => {
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Handle button clicks
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if the clicked element is a button or inside a button
      const button = target.closest("button");
      if (!button) {
        return;
      }

      const buttonText = button.textContent?.trim() || "";

      // Check for exact matches
      if (
        // buttonText.includes("الدفع") ||
        // buttonText === "اختيار الرحلة" ||
        buttonText === "اختيار" ||
        buttonText === "متابعة" ||
        buttonText === "رجوع" ||
        buttonText === "التالي"
      ) {
        console.log(
          `[TRANSITION BUTTONS] Detected click on button with text: "${buttonText}"`
        );
        setTimeout(() => {
          callbackRef.current();
        }, 1000);
        return;
      }
    };

    // Attach listener to document with capture phase to catch all clicks
    document.addEventListener("click", handleDocumentClick, true);

    // Cleanup
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, []); // Empty deps - callback is accessed via ref

  // Handle URL changes
  useEffect(() => {
    let currentUrl = window.location.href;

    const handleUrlChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        console.log(
          `[TRANSITION BUTTONS] URL changed from "${currentUrl}" to "${newUrl}"`
        );
        currentUrl = newUrl;
        callbackRef.current();
      }
    };

    // Listen for browser back/forward navigation
    window.addEventListener("popstate", handleUrlChange);

    // Intercept pushState and replaceState to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      // Use setTimeout to ensure URL has updated
      setTimeout(handleUrlChange, 0);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      // Use setTimeout to ensure URL has updated
      setTimeout(handleUrlChange, 0);
    };

    // Cleanup
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []); // Empty deps - callback is accessed via ref
};
