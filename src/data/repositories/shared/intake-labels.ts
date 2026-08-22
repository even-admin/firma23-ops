import type { SourceDocumentKind } from '@/types/domain';

/** Shared between the synthetic and Supabase intake adapters. */
export const SOURCE_DOCUMENT_KIND_LABELS: Record<SourceDocumentKind, string> = {
  proposal: 'Propuesta',
  executive_report: 'Informe ejecutivo',
  deck: 'Deck',
  quote: 'Cotización',
  sow: 'Alcance de trabajo (SOW)',
};

/** Best-effort kind guess from a filename, used only when a founder uploads
 * a document with no explicit kind selection. Defaults to 'proposal', the
 * most common document-first entry point. */
export function guessSourceDocumentKind(filename: string): SourceDocumentKind {
  const lower = filename.toLowerCase();
  if (lower.includes('sow') || lower.includes('alcance')) return 'sow';
  if (lower.includes('cotiza') || lower.includes('quote')) return 'quote';
  if (lower.includes('deck') || lower.includes('presentacion')) return 'deck';
  if (lower.includes('informe') || lower.includes('reporte') || lower.includes('report')) {
    return 'executive_report';
  }
  return 'proposal';
}
