import "@/styles/globals.css";

interface LayoutProps {
  children: React.ReactNode;
}

export default function IframeLayout({ children }: LayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-transparent">
      <head>
        <style>{`
          html {
            width: 100%;
            height: 100%;
            background: transparent !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            width: 100% !important;
            height: 100% !important;
            background: transparent !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #__next {
            width: 100% !important;
            height: 100% !important;
          }
          
          /* Hide Next.js error overlay completely */
          #__next-error-overlay,
          div[id*="__next-error"],
          div[data-nextjs-dialog],
          div[data-nextjs-toast],
          #__next-build-watcher,
          #__next-dev-overlay,
          nextjs-portal,
          [data-nextjs-dialog-overlay],
          [data-nextjs-toast-container],
          [data-nextjs-error-overlay] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: fixed !important;
            z-index: -99999 !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }
        `}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function removeErrorOverlay() {
                  // Remove all possible error overlay elements
                  const selectors = [
                    '#__next-error-overlay',
                    '[id*="__next-error"]',
                    '[data-nextjs-dialog]',
                    '[data-nextjs-toast]',
                    '#__next-build-watcher',
                    '#__next-dev-overlay',
                    'nextjs-portal',
                    '[data-nextjs-dialog-overlay]',
                    '[data-nextjs-toast-container]',
                    '[data-nextjs-error-overlay]'
                  ];
                  
                  selectors.forEach(selector => {
                    try {
                      const elements = document.querySelectorAll(selector);
                      elements.forEach(el => {
                        if (el && el.parentNode) {
                          el.remove();
                        }
                      });
                    } catch(e) {}
                  });
                  
                  // Also check for elements with "Issue" text
                  const allDivs = document.querySelectorAll('div');
                  allDivs.forEach(div => {
                    if (div.textContent && div.textContent.includes('Issue') && 
                        (div.style.backgroundColor === 'rgb(220, 38, 38)' || 
                         div.classList.toString().includes('error') ||
                         div.classList.toString().includes('overlay'))) {
                      div.remove();
                    }
                  });
                }
                
                // Run immediately
                removeErrorOverlay();
                
                // Watch for new overlays
                const observer = new MutationObserver(() => {
                  removeErrorOverlay();
                });
                
                observer.observe(document.body, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['id', 'class', 'data-nextjs']
                });
                
                // Run on DOMContentLoaded
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', removeErrorOverlay);
                }
                
                // Run on load
                window.addEventListener('load', removeErrorOverlay);
                
                // Run periodically as backup
                setInterval(removeErrorOverlay, 100);
              })();
            `,
          }}
        />
      </head>
      <body className="bg-transparent overflow-hidden antialiased" style={{ height: "560px", width: "380px", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
