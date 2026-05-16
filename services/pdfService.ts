import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to the CDN URL corresponding to the library version
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://aistudiocdn.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Iterate through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text items and join them
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
        
      fullText += `--- 第 ${i} 页 ---\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("无法读取 PDF 文件，可能是扫描件或加密文件。");
  }
};