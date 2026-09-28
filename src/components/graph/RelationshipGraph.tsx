'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

// Stable type maps (module scope): React Flow warns in dev (error #002) if it
// ever receives a freshly-created nodeTypes/edgeTypes object, so these must
// never be inlined in the render path. Empty objects keep default rendering.
const nodeTypes = {};
const edgeTypes = {};

interface RelationshipGraphProps {
  standardId: string;
  standardNumber: string;
}

interface RelatedNode {
  id: string;
  standard_number: string;
  title: string;
  relationship_type?: string;
}

export default memo(function RelationshipGraph({ standardId, standardNumber }: RelationshipGraphProps) {
  const { t } = useAccessibility();
  const [verified, setVerified] = useState<RelatedNode[]>([]);
  const [sameSector, setSameSector] = useState<RelatedNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/relationships?standardId=${standardId}`);
        const data = await res.json();
        if (res.ok) {
          setVerified(data.verified || []);
          setSameSector(data.sameSector || []);
        }
      } catch {
        // Graph stays in its honest empty state on failure
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [standardId]);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [
      {
        id: 'center',
        position: { x: 250, y: 40 },
        data: { label: standardNumber },
        style: { backgroundColor: '#1A5FB4', color: '#fff', fontWeight: 'bold' }
      },
    ];
    const edges: Edge[] = [];

    verified.slice(0, 4).forEach((rel, i) => {
      const nodeId = `verified-${rel.id}`;
      nodes.push({
        id: nodeId,
        position: { x: 60 + i * 220, y: 170 },
        data: { label: rel.standard_number },
        style: { backgroundColor: '#E8F5E9', border: '1px solid #18794E' }
      });
      edges.push({
        id: `e-center-${nodeId}`,
        source: 'center',
        target: nodeId,
        label: rel.relationship_type || 'related',
      });
    });

    const yOffset = verified.length > 0 ? 300 : 170;
    sameSector.slice(0, 3).forEach((rel, i) => {
      const nodeId = `sector-${rel.id}`;
      nodes.push({
        id: nodeId,
        position: { x: 60 + i * 220, y: yOffset },
        data: { label: rel.standard_number },
        style: { backgroundColor: '#F7F8FA', border: '1px dashed #5B6573' }
      });
      edges.push({
        id: `e-center-${nodeId}`,
        source: 'center',
        target: nodeId,
        label: t('sameSector'),
        style: { strokeDasharray: '5 5' },
      });
    });

    return { nodes, edges };
  }, [standardNumber, verified, sameSector, t]);

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center text-sm text-text-secondary" style={{ minHeight: '300px' }}>Loading relationships...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col" style={{ minHeight: '300px' }}>
      <div className="flex items-center gap-4 px-3 pt-2 text-xs text-text-secondary flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-solid border-text-secondary" /> {t('legendVerified')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-dashed border-text-secondary" /> {t('legendHeuristic')}
        </span>
      </div>
      {verified.length === 0 && (
        <p className="text-xs text-text-secondary px-3 pt-1">
          {t('noVerifiedRels')}
        </p>
      )}
      <div className="flex-grow">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
});
