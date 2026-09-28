import { CheckCircle2, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import PageBar from '@/components/layout/PageBar';
import RequirementsEditor from '@/components/tender/RequirementsEditor';
import RetrieveButton from '@/components/tender/RetrieveButton';
import RetryAnalysisButton from '@/components/tender/RetryAnalysisButton';
import { createClient } from '@supabase/supabase-js';
import { readProvenance } from '@/lib/ocr/provenance';

// We do data fetching here server-side!
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function AnalysisPage(props: Props) {
  const params = await props.params;

  // 1. Fetch DB
  const { data: tender, error } = await supabase
    .from('tenders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !tender) {
    return <div className="p-8 text-center text-danger font-bold">Error: Tender not found.</div>;
  }

  // 2. Fetch requirements that belong to this tender
  const { data: reqs } = await supabase
    .from('tender_requirements')
    .select('*')
    .eq('tender_id', params.id);

  // If status is still 'uploaded', we could trigger an API right here (server-side fetch) 
  // or instruct the client to ping it. For simplicity, let's trigger it directly here if missing.
  let requirements = reqs || [];
  let isAnalyzing = tender.status === 'uploaded';

  // Requirement provenance (native PDF text vs OCR), if recorded
  const provenance = await readProvenance(supabase, params.id);
  
  if (isAnalyzing && typeof fetch !== 'undefined') {
    // In a real app we'd use a background worker. For prototype, we do it inline or client-side fetch.
    // However, server rendering will block until done, which could be slow.
    // So we will just show a "Processing..." state and use a Client Component for polling.
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <Header />
      
      <PageBar titleKey="tenderAnalysis" backHref="/" backLabelKey="backToDashboard" />

      <main className="flex-grow p-4 md:p-8 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-text-primary mb-2">
             {tender.filename} 
          </h2>
          <div className="flex flex-wrap gap-4 text-text-secondary text-sm">
            <span><strong>File:</strong> {tender.filename}</span>
            <span><strong>Status:</strong> {tender.status}</span>
            {tender.status === 'analyzed' ? (
               <span className="flex items-center gap-1 text-success font-medium">
                 <CheckCircle2 size={16} /> Extraction Complete
               </span>
            ) : tender.status === 'analysis_failed' ? (
               <span className="flex items-center gap-1 text-danger font-medium">
                 <span className="text-lg leading-none">!</span> AI extraction failed. Please retry later.
               </span>
            ) : (
               <span className="flex items-center gap-1 text-warning font-medium">
                 <Loader2 className="animate-spin" size={16} /> Analyzing PDF Structure (Refresh in 10s...)
               </span>
            )}
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border-primary shadow-sm overflow-hidden mb-8">
          <div className="p-4 bg-gray-50 border-b border-border-primary flex justify-between items-center">
            <h3 className="font-semibold text-primary">Extracted Technical Requirements</h3>
            {requirements.length > 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{requirements.length} Found</span>}
          </div>
          <RequirementsEditor
            initialRequirements={requirements}
            pageCount={tender.page_count || null}
            provenance={provenance?.requirementMethods || null}
            ocrUsed={provenance?.ocrUsed || false}
          />
        </div>

        {tender.status === 'analysis_failed' && (
          <div className="flex justify-center mb-8">
            <RetryAnalysisButton tenderId={params.id} />
          </div>
        )}

        <div className="flex justify-end">
          <RetrieveButton
            tenderId={params.id}
            requirementCount={requirements.length}
            disabled={tender.status !== 'analyzed' || requirements.length === 0}
          />
        </div>
      </main>
    </div>
  );
}
