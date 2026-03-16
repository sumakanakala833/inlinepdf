export interface PdfInfoCoreMetadata {
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string[];
  creator: string | null;
  producer: string | null;
  creationDate: string | null;
  modificationDate: string | null;
}

export interface PdfInfoDocumentDetails {
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  isEncrypted: boolean;
}

export interface PdfInfoFontDetails {
  internalNames: string[];
  fontFamilies: string[];
}

export interface PdfInfoResult {
  core: PdfInfoCoreMetadata;
  document: PdfInfoDocumentDetails;
  fonts: PdfInfoFontDetails;
  infoDictionary: Record<string, string>;
  rawXmpMetadata: string | null;
}
