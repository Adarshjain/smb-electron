// src/hooks/usePrintSection.ts
import { useReactToPrint } from 'react-to-print';
import { type RefObject } from 'react';

export function usePrintSection(
  ref: RefObject<HTMLElement | null>,
  fileName: string
) {
  return useReactToPrint({
    contentRef: ref,
    documentTitle: fileName,
    preserveAfterPrint: false,
    pageStyle: `
      @page {
        size: A4;
        margin: 0 !important;
      }
      @media print {
      :root {
      --input: rgba(0, 0, 0, 0.1) !important;
      }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }
        body {
          -webkit-print-color-adjust: exact;
        }
        .pdf {
          margin: 0 !important;
          padding: 0 !important;
            width: 100%;
            max-width: 100%;
            min-width: 100%;
          table {
            font-size: 10px !important;
          }
          td {
            padding: 0;
            padding-inline: 4px;
            height: 20px !important;
          }
        }
        .pdf-header {
          display: block; 
          margin-bottom: 12px;
        }
      }
    `,
  });
}
