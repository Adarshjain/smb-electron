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
        size: A4 landscape;
        margin: 5mm;
      }
      @media print {
        :root {
        --input: rgba(0, 0, 0, 0.1) !important;
        }
        html, body {
          width: 297mm;
          height: 210mm;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
        }
        body {
          -webkit-print-color-adjust: exact;
        }
        .pdf {
          width: 297mm !important;
          min-height: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          
          table {
            font-size: 12px !important;
            margin: 2px;
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
