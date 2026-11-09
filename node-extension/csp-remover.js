// Remove CSP meta tags from the page
// This runs at document_start before any scripts are loaded

(function() {
  'use strict';
  
  console.log('[Nice One Extension] CSP Remover initialized');
  
  // Function to remove CSP meta tags
  function removeCSPMetaTags() {
    const metaTags = document.querySelectorAll(
      'meta[http-equiv="Content-Security-Policy"], ' +
      'meta[http-equiv="content-security-policy"], ' +
      'meta[http-equiv="X-Content-Security-Policy"], ' +
      'meta[http-equiv="X-WebKit-CSP"]'
    );
    metaTags.forEach(tag => {
      console.log('[Nice One Extension] Removing CSP meta tag:', tag.getAttribute('content')?.substring(0, 100));
      tag.remove();
    });
    return metaTags.length;
  }
  
  // Run immediately
  const removed = removeCSPMetaTags();
  if (removed > 0) {
    console.log(`[Nice One Extension] Removed ${removed} CSP meta tag(s) on initial run`);
  }
  
  // Override document.createElement to intercept meta tag creation
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    const element = originalCreateElement(tagName, options);
    
    if (tagName.toLowerCase() === 'meta') {
      // Intercept setAttribute to catch CSP meta tags
      const originalSetAttribute = element.setAttribute.bind(element);
      element.setAttribute = function(name, value) {
        if (name.toLowerCase() === 'http-equiv' && 
            (value.toLowerCase().includes('content-security-policy') ||
             value.toLowerCase().includes('x-content-security-policy') ||
             value.toLowerCase().includes('x-webkit-csp'))) {
          console.log('[Nice One Extension] Blocked CSP meta tag creation via setAttribute');
          return; // Don't set the attribute
        }
        return originalSetAttribute(name, value);
      };
    }
    
    return element;
  };
  
  // Also observe for dynamically added CSP meta tags
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if it's a meta tag with CSP
          if (node.tagName === 'META') {
            const httpEquiv = node.getAttribute('http-equiv')?.toLowerCase() || '';
            if (httpEquiv.includes('content-security-policy') ||
                httpEquiv.includes('x-content-security-policy') ||
                httpEquiv.includes('x-webkit-csp')) {
              console.log('[Nice One Extension] Removing dynamically added CSP meta tag');
              node.remove();
            }
          }
          
          // Also check children
          if (node.querySelectorAll) {
            const cspMetas = node.querySelectorAll(
              'meta[http-equiv="Content-Security-Policy"], ' +
              'meta[http-equiv="content-security-policy"], ' +
              'meta[http-equiv="X-Content-Security-Policy"], ' +
              'meta[http-equiv="X-WebKit-CSP"]'
            );
            cspMetas.forEach(tag => {
              console.log('[Nice One Extension] Removing CSP meta tag from added subtree');
              tag.remove();
            });
          }
        }
      }
    }
  });
  
  // Start observing immediately on document element
  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
  
  // Also observe document itself for when documentElement is added
  if (document.childNodes.length === 0) {
    const docObserver = new MutationObserver(() => {
      if (document.documentElement) {
        docObserver.disconnect();
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
        removeCSPMetaTags();
      }
    });
    docObserver.observe(document, { childList: true });
  }
  
  // Run again after a short delay to catch any late additions
  setTimeout(removeCSPMetaTags, 0);
  setTimeout(removeCSPMetaTags, 10);
  setTimeout(removeCSPMetaTags, 50);
  setTimeout(removeCSPMetaTags, 100);
  
  // Run on DOMContentLoaded as a final check
  document.addEventListener('DOMContentLoaded', () => {
    const removed = removeCSPMetaTags();
    if (removed > 0) {
      console.log(`[Nice One Extension] Removed ${removed} CSP meta tag(s) on DOMContentLoaded`);
    }
  });
})();
