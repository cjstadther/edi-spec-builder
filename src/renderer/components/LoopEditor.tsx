/**
 * Loop Editor Component
 * Allows editing of loop properties, variants, and structure
 */

import React, { useCallback } from 'react';
import { Specification, Loop, Segment, Variant, UsageType } from '../../shared/models/edi-types';
import { v4 as uuidv4 } from 'uuid';
import { UsageSelect } from './UsageSelect';
import { VariantEditor } from './VariantEditor';

interface LoopEditorProps {
  loop: Loop;
  path: string[];
  specification: Specification;
  onUpdate: (updater: (spec: Specification) => Specification) => void;
}

export function LoopEditor({ loop, path, specification, onUpdate }: LoopEditorProps) {
  const updateLoop = useCallback(
    (updates: Partial<Loop>) => {
      onUpdate(spec => {
        const updateLoopInTree = (loops: Loop[], targetPath: string[], depth: number): Loop[] => {
          return loops.map(l => {
            if (l.id === targetPath[depth]) {
              if (depth === targetPath.length - 1) {
                return { ...l, ...updates };
              }
              return {
                ...l,
                loops: updateLoopInTree(l.loops, targetPath, depth + 1),
              };
            }
            return l;
          });
        };
        return { ...spec, loops: updateLoopInTree(spec.loops, path, 0) };
      });
    },
    [onUpdate, path]
  );

  const handleAddSegment = useCallback(() => {
    const newSegment: Segment = {
      id: uuidv4(),
      name: 'SEG',
      description: 'New Segment',
      usage: 'O',
      minUse: 0,
      maxUse: 1,
      elements: [],
    };
    updateLoop({ segments: [...loop.segments, newSegment] });
  }, [loop.segments, updateLoop]);

  const handleAddNestedLoop = useCallback(() => {
    const newLoop: Loop = {
      id: uuidv4(),
      name: 'LOOP',
      description: 'New Nested Loop',
      usage: 'O',
      minUse: 0,
      maxUse: 1,
      segments: [],
      loops: [],
    };
    updateLoop({ loops: [...loop.loops, newLoop] });
  }, [loop.loops, updateLoop]);

  const handleAddVariant = useCallback(() => {
    const newVariant: Variant = {
      id: uuidv4(),
      label: 'New Variant',
      discriminators: [],
    };
    updateLoop({ variants: [...(loop.variants || []), newVariant] });
  }, [loop.variants, updateLoop]);

  const handleUpdateVariant = useCallback(
    (variantId: string, updates: Partial<Variant>) => {
      const variants = (loop.variants || []).map(v =>
        v.id === variantId ? { ...v, ...updates } : v
      );
      updateLoop({ variants });
    },
    [loop.variants, updateLoop]
  );

  const handleDeleteVariant = useCallback(
    (variantId: string) => {
      const variants = (loop.variants || []).filter(v => v.id !== variantId);
      updateLoop({ variants });
    },
    [loop.variants, updateLoop]
  );

  const handleDeleteLoop = useCallback(() => {
    if (!confirm('Are you sure you want to delete this loop?')) return;

    onUpdate(spec => {
      const deleteFromLoops = (loops: Loop[], targetPath: string[], depth: number): Loop[] => {
        if (depth === targetPath.length - 1) {
          return loops.filter(l => l.id !== targetPath[depth]);
        }
        return loops.map(l => {
          if (l.id === targetPath[depth]) {
            return { ...l, loops: deleteFromLoops(l.loops, targetPath, depth + 1) };
          }
          return l;
        });
      };
      return { ...spec, loops: deleteFromLoops(spec.loops, path, 0) };
    });
  }, [onUpdate, path]);

  const handleDeleteSegment = useCallback((segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;
    updateLoop({ segments: loop.segments.filter(s => s.id !== segmentId) });
  }, [loop.segments, updateLoop]);

  const handleDeleteNestedLoop = useCallback((loopId: string) => {
    if (!confirm('Are you sure you want to delete this nested loop?')) return;
    updateLoop({ loops: loop.loops.filter(l => l.id !== loopId) });
  }, [loop.loops, updateLoop]);

  // Drag and drop state
  const dragItem = React.useRef<{ index: number; type: 'segment' | 'loop' } | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number, type: 'segment' | 'loop') => {
    dragItem.current = { index, type };
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number, targetType: 'segment' | 'loop') => {
    e.preventDefault();
    if (!dragItem.current) return;

    const { index: sourceIndex, type: sourceType } = dragItem.current;

    // Only allow reordering within the same type
    if (sourceType !== targetType) return;
    if (sourceIndex === targetIndex) return;

    if (sourceType === 'segment') {
      const newSegments = [...loop.segments];
      const [removed] = newSegments.splice(sourceIndex, 1);
      newSegments.splice(targetIndex, 0, removed);
      updateLoop({ segments: newSegments });
    } else {
      const newLoops = [...loop.loops];
      const [removed] = newLoops.splice(sourceIndex, 1);
      newLoops.splice(targetIndex, 0, removed);
      updateLoop({ loops: newLoops });
    }

    dragItem.current = null;
  }, [loop.segments, loop.loops, updateLoop]);

  return (
    <div className="editor">
      <div className="card">
        <div className="card-header">
          <h3>
              {loop.name} Loop
              {loop.maxUse > 1 && <span className="repeat-badge array" style={{ marginLeft: '8px' }}>[{loop.maxUse}]</span>}
            </h3>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteLoop}>
            Delete Loop
          </button>
        </div>
        <div className="card-body">
          <div className="section">
            <h4 className="section-title">Basic Properties</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Loop ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={loop.name}
                  onChange={e => updateLoop({ name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={loop.description || ''}
                  onChange={e => updateLoop({ description: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="section">
            <h4 className="section-title">Usage & Cardinality</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Usage</label>
                <UsageSelect
                  value={loop.usage}
                  onChange={usage => updateLoop({ usage })}
                />
                {loop.baseUsage && loop.usage !== loop.baseUsage && (
                  <span className="form-hint">Base: {loop.baseUsage}</span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Min Repeat</label>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  value={loop.minUse}
                  onChange={e => updateLoop({ minUse: parseInt(e.target.value) || 0 })}
                />
                {loop.baseMinUse !== undefined && loop.minUse !== loop.baseMinUse && (
                  <span className="form-hint">Base: {loop.baseMinUse}</span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Max Repeat</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={loop.maxUse}
                  onChange={e => updateLoop({ maxUse: parseInt(e.target.value) || 1 })}
                />
                {loop.baseMaxUse !== undefined && loop.maxUse !== loop.baseMaxUse && (
                  <span className="form-hint">Base: {loop.baseMaxUse}</span>
                )}
              </div>
            </div>

            {loop.usage === 'C' && (
              <div className="form-group mt-4">
                <label className="form-label">Condition Description</label>
                <textarea
                  className="form-textarea"
                  value={loop.conditionDescription || ''}
                  onChange={e => updateLoop({ conditionDescription: e.target.value })}
                  placeholder="Describe when this loop is required..."
                />
              </div>
            )}
          </div>

          <div className="section">
            <h4 className="section-title">Comments</h4>
            <div className="form-group">
              <textarea
                className="form-textarea"
                value={loop.comments || ''}
                onChange={e => updateLoop({ comments: e.target.value })}
                placeholder="Add implementation notes or comments..."
              />
            </div>
          </div>

          <div className="section">
            <div className="flex items-center justify-between mb-4">
              <h4 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                Variants ({(loop.variants || []).length})
              </h4>
              <button className="btn btn-secondary btn-sm" onClick={handleAddVariant}>
                + Add Variant
              </button>
            </div>
            {(loop.variants || []).map(variant => (
              <VariantEditor
                key={variant.id}
                variant={variant}
                onUpdate={updates => handleUpdateVariant(variant.id, updates)}
                onDelete={() => handleDeleteVariant(variant.id)}
              />
            ))}
          </div>

          <div className="section">
            <h4 className="section-title">Contents</h4>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={handleAddSegment}>
                + Add Segment
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleAddNestedLoop}>
                + Add Nested Loop
              </button>
            </div>
            <div className="mt-4">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}></th>
                    <th>Type</th>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Usage</th>
                    <th>Repeat</th>
                    <th style={{ width: '60px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loop.segments.map((seg, index) => (
                    <tr
                      key={seg.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index, 'segment')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index, 'segment')}
                      style={{ cursor: 'grab' }}
                    >
                      <td style={{ cursor: 'grab', color: '#718096' }}>⋮⋮</td>
                      <td><span className="usage-badge optional">SEG</span></td>
                      <td>{seg.name}</td>
                      <td>{seg.description}</td>
                      <td><UsageBadge usage={seg.usage} /></td>
                      <td><RepeatBadge maxUse={seg.maxUse} /></td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDeleteSegment(seg.id)}
                          title="Delete segment"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                  {loop.loops.map((l, index) => (
                    <tr
                      key={l.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index, 'loop')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index, 'loop')}
                      style={{ cursor: 'grab' }}
                    >
                      <td style={{ cursor: 'grab', color: '#718096' }}>⋮⋮</td>
                      <td><span className="usage-badge mandatory">LOOP</span></td>
                      <td>{l.name}</td>
                      <td>{l.description}</td>
                      <td><UsageBadge usage={l.usage} /></td>
                      <td><RepeatBadge maxUse={l.maxUse} /></td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => handleDeleteNestedLoop(l.id)}
                          title="Delete loop"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageBadge({ usage }: { usage: UsageType }) {
  const classMap: Record<UsageType, string> = {
    M: 'mandatory',
    O: 'optional',
    C: 'conditional',
  };
  const labelMap: Record<UsageType, string> = {
    M: 'M',
    O: 'O',
    C: 'C',
  };
  return <span className={`usage-badge ${classMap[usage]}`}>{labelMap[usage]}</span>;
}

function RepeatBadge({ maxUse }: { maxUse: number }) {
  const isArray = maxUse > 1;
  return (
    <span 
      className={`repeat-badge ${isArray ? 'array' : 'single'}`}
      title={isArray ? `Array (up to ${maxUse})` : 'Single'}
    >
      {isArray ? `[${maxUse}]` : '1'}
    </span>
  );
}
