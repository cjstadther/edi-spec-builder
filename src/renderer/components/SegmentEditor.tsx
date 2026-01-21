/**
 * Segment Editor Component
 * Allows editing of segment properties, elements, and variants
 */

import React, { useCallback } from 'react';
import { Specification, Loop, Segment, Element, Variant, UsageType } from '../../shared/models/edi-types';
import { v4 as uuidv4 } from 'uuid';
import { UsageSelect } from './UsageSelect';
import { VariantEditor } from './VariantEditor';

interface SegmentEditorProps {
  segment: Segment;
  path: string[];
  specification: Specification;
  onUpdate: (updater: (spec: Specification) => Specification) => void;
}

export function SegmentEditor({ segment, path, specification, onUpdate }: SegmentEditorProps) {
  const updateSegment = useCallback(
    (updates: Partial<Segment>) => {
      onUpdate(spec => {
        const updateInLoops = (loops: Loop[], targetPath: string[], depth: number): Loop[] => {
          return loops.map(loop => {
            if (loop.id === targetPath[depth]) {
              if (depth === targetPath.length - 2) {
                // We're at the parent loop
                return {
                  ...loop,
                  segments: loop.segments.map(s =>
                    s.id === targetPath[depth + 1] ? { ...s, ...updates } : s
                  ),
                };
              }
              return {
                ...loop,
                loops: updateInLoops(loop.loops, targetPath, depth + 1),
              };
            }
            return loop;
          });
        };
        return { ...spec, loops: updateInLoops(spec.loops, path, 0) };
      });
    },
    [onUpdate, path]
  );

  const handleAddElement = useCallback(() => {
    const newPosition = segment.elements.length > 0
      ? Math.max(...segment.elements.map(e => e.position)) + 1
      : 1;

    const newElement: Element = {
      id: uuidv4(),
      position: newPosition,
      name: 'New Element',
      dataType: 'AN',
      minLength: 1,
      maxLength: 50,
      usage: 'O',
    };
    updateSegment({ elements: [...segment.elements, newElement] });
  }, [segment.elements, updateSegment]);

  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<Element>) => {
      const elements = segment.elements.map(e =>
        e.id === elementId ? { ...e, ...updates } : e
      );
      updateSegment({ elements });
    },
    [segment.elements, updateSegment]
  );

  const handleDeleteElement = useCallback(
    (elementId: string) => {
      const elements = segment.elements.filter(e => e.id !== elementId);
      updateSegment({ elements });
    },
    [segment.elements, updateSegment]
  );

  const handleAddVariant = useCallback(() => {
    const newVariant: Variant = {
      id: uuidv4(),
      label: 'New Variant',
      discriminators: [],
    };
    updateSegment({ variants: [...(segment.variants || []), newVariant] });
  }, [segment.variants, updateSegment]);

  const handleUpdateVariant = useCallback(
    (variantId: string, updates: Partial<Variant>) => {
      const variants = (segment.variants || []).map(v =>
        v.id === variantId ? { ...v, ...updates } : v
      );
      updateSegment({ variants });
    },
    [segment.variants, updateSegment]
  );

  const handleDeleteVariant = useCallback(
    (variantId: string) => {
      const variants = (segment.variants || []).filter(v => v.id !== variantId);
      updateSegment({ variants });
    },
    [segment.variants, updateSegment]
  );

  const handleDeleteSegment = useCallback(() => {
    if (!confirm('Are you sure you want to delete this segment?')) return;

    onUpdate(spec => {
      const deleteFromLoops = (loops: Loop[], targetPath: string[], depth: number): Loop[] => {
        return loops.map(loop => {
          if (loop.id === targetPath[depth]) {
            if (depth === targetPath.length - 2) {
              return {
                ...loop,
                segments: loop.segments.filter(s => s.id !== targetPath[depth + 1]),
              };
            }
            return {
              ...loop,
              loops: deleteFromLoops(loop.loops, targetPath, depth + 1),
            };
          }
          return loop;
        });
      };
      return { ...spec, loops: deleteFromLoops(spec.loops, path, 0) };
    });
  }, [onUpdate, path]);

  // Drag and drop state for elements
  const dragItem = React.useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragItem.current === null) return;

    const sourceIndex = dragItem.current;
    if (sourceIndex === targetIndex) return;

    const newElements = [...segment.elements];
    const [removed] = newElements.splice(sourceIndex, 1);
    newElements.splice(targetIndex, 0, removed);
    updateSegment({ elements: newElements });

    dragItem.current = null;
  }, [segment.elements, updateSegment]);

  return (
    <div className="editor">
      <div className="card">
        <div className="card-header">
          <h3>
              {segment.name} - {segment.description}
              {segment.maxUse > 1 && <span className="repeat-badge array" style={{ marginLeft: '8px' }}>[{segment.maxUse}]</span>}
            </h3>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteSegment}>
            Delete Segment
          </button>
        </div>
        <div className="card-body">
          <div className="section">
            <h4 className="section-title">Basic Properties</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Segment ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={segment.name}
                  onChange={e => updateSegment({ name: e.target.value })}
                  maxLength={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={segment.description}
                  onChange={e => updateSegment({ description: e.target.value })}
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
                  value={segment.usage}
                  onChange={usage => updateSegment({ usage })}
                />
                {segment.baseUsage && segment.usage !== segment.baseUsage && (
                  <span className="form-hint">Base: {segment.baseUsage}</span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Min Repeat</label>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  value={segment.minUse}
                  onChange={e => updateSegment({ minUse: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Max Repeat</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={segment.maxUse}
                  onChange={e => updateSegment({ maxUse: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            {segment.usage === 'C' && (
              <div className="form-group mt-4">
                <label className="form-label">Condition Description</label>
                <textarea
                  className="form-textarea"
                  value={segment.conditionDescription || ''}
                  onChange={e => updateSegment({ conditionDescription: e.target.value })}
                  placeholder="Describe when this segment is required..."
                />
              </div>
            )}
          </div>

          <div className="section">
            <h4 className="section-title">Comments & Example</h4>
            <div className="form-group">
              <label className="form-label">Comments</label>
              <textarea
                className="form-textarea"
                value={segment.comments || ''}
                onChange={e => updateSegment({ comments: e.target.value })}
                placeholder="Add implementation notes or comments..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Example</label>
              <input
                type="text"
                className="form-input font-mono"
                value={segment.example?.value || ''}
                onChange={e => updateSegment({ example: e.target.value ? { value: e.target.value } : undefined })}
                placeholder={`${segment.name}*...*~`}
              />
              <span className="form-hint">Full segment example (e.g., N1*ST*Acme Corp*92*12345~)</span>
            </div>
          </div>

          <div className="section">
            <div className="flex items-center justify-between mb-4">
              <h4 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                Variants ({(segment.variants || []).length})
              </h4>
              <button className="btn btn-secondary btn-sm" onClick={handleAddVariant}>
                + Add Variant
              </button>
            </div>
            {(segment.variants || []).map(variant => (
              <VariantEditor
                key={variant.id}
                variant={variant}
                onUpdate={updates => handleUpdateVariant(variant.id, updates)}
                onDelete={() => handleDeleteVariant(variant.id)}
              />
            ))}
          </div>

          <div className="section">
            <div className="flex items-center justify-between mb-4">
              <h4 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                Elements ({segment.elements.length})
              </h4>
              <button className="btn btn-secondary btn-sm" onClick={handleAddElement}>
                + Add Element
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th style={{ width: '50px' }}>Pos</th>
                  <th>Name</th>
                  <th style={{ width: '80px' }}>Type</th>
                  <th style={{ width: '100px' }}>Length</th>
                  <th style={{ width: '80px' }}>Usage</th>
                  <th style={{ width: '60px' }}>Codes</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {segment.elements.map((element, index) => (
                  <ElementRow
                    key={element.id}
                    element={element}
                    index={index}
                    onUpdate={updates => handleUpdateElement(element.id, updates)}
                    onDelete={() => handleDeleteElement(element.id)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ElementRowProps {
  element: Element;
  index: number;
  onUpdate: (updates: Partial<Element>) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

function ElementRow({ element, index, onUpdate, onDelete, onDragStart, onDragOver, onDrop }: ElementRowProps) {
  return (
    <tr
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      style={{ cursor: 'grab' }}
    >
      <td style={{ cursor: 'grab', color: '#718096' }}>⋮⋮</td>
      <td>
        <input
          type="number"
          className="form-input"
          style={{ width: '50px', padding: '4px 8px' }}
          value={element.position}
          onChange={e => onUpdate({ position: parseInt(e.target.value) || 1 })}
          min={1}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-input"
          style={{ padding: '4px 8px' }}
          value={element.name}
          onChange={e => onUpdate({ name: e.target.value })}
        />
      </td>
      <td>
        <select
          className="form-select"
          style={{ padding: '4px 8px' }}
          value={element.dataType}
          onChange={e => onUpdate({ dataType: e.target.value })}
        >
          <option value="AN">AN</option>
          <option value="ID">ID</option>
          <option value="N0">N0</option>
          <option value="N2">N2</option>
          <option value="R">R</option>
          <option value="DT">DT</option>
          <option value="TM">TM</option>
        </select>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="number"
            className="form-input"
            style={{ width: '45px', padding: '4px 8px' }}
            value={element.minLength}
            onChange={e => onUpdate({ minLength: parseInt(e.target.value) || 0 })}
            min={0}
          />
          -
          <input
            type="number"
            className="form-input"
            style={{ width: '45px', padding: '4px 8px' }}
            value={element.maxLength}
            onChange={e => onUpdate({ maxLength: parseInt(e.target.value) || 1 })}
            min={1}
          />
        </div>
      </td>
      <td>
        <UsageSelect
          value={element.usage}
          onChange={usage => onUpdate({ usage })}
          compact
        />
      </td>
      <td style={{ textAlign: 'center' }}>
        {element.codeValues && element.codeValues.length > 0 ? (
          <span className="text-sm text-muted">{element.codeValues.filter(c => c.included).length}</span>
        ) : '-'}
      </td>
      <td>
        <button className="btn btn-secondary btn-sm btn-icon" onClick={onDelete} title="Delete element">
          ×
        </button>
      </td>
    </tr>
  );
}
