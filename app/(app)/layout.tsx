import { RootLayout } from "@/components/root-layout";

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function Layout({ children }: RootLayoutProps) {
  return (
    <RootLayout className="bg-background">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          /* Custom scrollbar for the whole page */
          html::-webkit-scrollbar,
          body::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          
          html::-webkit-scrollbar-track,
          body::-webkit-scrollbar-track {
            background: #000000; /* black */
          }
          
          html::-webkit-scrollbar-thumb,
          body::-webkit-scrollbar-thumb {
            background: #404040; /* neutral-700 */
            border-radius: 6px;
          }
          
          html::-webkit-scrollbar-thumb:hover,
          body::-webkit-scrollbar-thumb:hover {
            background: #525252; /* neutral-600 */
          }
          
          /* Custom scrollbar for textareas */
          textarea::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          textarea::-webkit-scrollbar-track {
            background: #171717; /* neutral-900 */
            border-radius: 4px;
          }
          
          textarea::-webkit-scrollbar-thumb {
            background: #404040; /* neutral-700 */
            border-radius: 4px;
          }
          
          textarea::-webkit-scrollbar-thumb:hover {
            background: #525252; /* neutral-600 */
          }
          
          /* Custom scrollbar for scrollable divs */
          div[class*="overflow"]::-webkit-scrollbar,
          .overflow-y-auto::-webkit-scrollbar,
          .overflow-x-auto::-webkit-scrollbar,
          .overflow-auto::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          
          div[class*="overflow"]::-webkit-scrollbar-track,
          .overflow-y-auto::-webkit-scrollbar-track,
          .overflow-x-auto::-webkit-scrollbar-track,
          .overflow-auto::-webkit-scrollbar-track {
            background: #171717; /* neutral-900 */
            border-radius: 4px;
          }
          
          div[class*="overflow"]::-webkit-scrollbar-thumb,
          .overflow-y-auto::-webkit-scrollbar-thumb,
          .overflow-x-auto::-webkit-scrollbar-thumb,
          .overflow-auto::-webkit-scrollbar-thumb {
            background: #404040; /* neutral-700 */
            border-radius: 4px;
          }
          
          div[class*="overflow"]::-webkit-scrollbar-thumb:hover,
          .overflow-y-auto::-webkit-scrollbar-thumb:hover,
          .overflow-x-auto::-webkit-scrollbar-thumb:hover,
          .overflow-auto::-webkit-scrollbar-thumb:hover {
            background: #525252; /* neutral-600 */
          }
          
          /* Firefox scrollbar for page */
          html, body {
            scrollbar-width: thin;
            scrollbar-color: #404040 #000000;
          }
          
          /* Firefox scrollbar for textareas */
          textarea {
            scrollbar-width: thin;
            scrollbar-color: #404040 #171717;
          }
          
          /* Firefox scrollbar for scrollable divs */
          div[class*="overflow"],
          .overflow-y-auto,
          .overflow-x-auto,
          .overflow-auto {
            scrollbar-width: thin;
            scrollbar-color: #404040 #171717;
          }
        `,
        }}
      />
      {children}
    </RootLayout>
  );
}
