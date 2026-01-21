/**
 * Tree Navigation Component
 * Displays hierarchical structure of loops, segments, and elements
 */

import React, { useCallback } from 'react';
import { Specification, Loop, Segment, Element } from '../../shared/models/edi-types';
import { v4 as uuidv4 } from 'uuid';

export interface TreeSelection {
  type: 'loop' | 'segment' | 'element';
  id: string;
}

interface TreeNavigationProps {
  specification: Specification;
  selection: TreeSelection | null;
  expandedNodes: Set<string>;
  onSelect: (selection: TreeSelection | null) => void;
  onToggleExpand: (nodeId: string) => void;
  onUpdate: (updater: (spec: Specification) => Specification) => void;
}

export function TreeNavigation({
  specification,
  selection,
  expandedNodes,
  onSelect,
  onToggleExpand,
  onUpdate,
}: TreeNavigationProps) {
  const handleAddLoop = useCallback(() => {
    const newLoop: Loop = {
      id: uuidv4(),
      name: 'NEW',
      description: 'New Loop',
      usage: 'O',
      minUse: 0,
      maxUse: 1,
      segments: [],
      loops: [],
    };

    onUpdate(spec => ({
      ...spec,
      loops: [...spec.loops, newLoop],
    }));
  }, [onUpdate]);

  return (
    <div className="tree-navigation">
      {specification.loops.map((loop, index) => (
        <LoopTreeItem
          key={loop.id}
          loop={loop}
          depth={0}
          index={index}
          selection={selection}
          expandedNodes={expandedNodes}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onUpdate={onUpdate}
          parentPath={[]}
        />
      ))}
      <div style={{ padding: '8px 16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={handleAddLoop}>
          + Add Loop
        </button>
      </div>
    </div>
  );
}

interface LoopTreeItemProps {
  loop: Loop;
  depth: number;
  index: number;
  selection: TreeSelection | null;
  expandedNodes: Set<string>;
  onSelect: (selection: TreeSelection | null) => void;
  onToggleExpand: (nodeId: string) => void;
  onUpdate: (updater: (spec: Specification) => Specification) => void;
  parentPath: string[];
}

function LoopTreeItem({
  loop,
  depth,
  index,
  selection,
  expandedNodes,
  onSelect,
  onToggleExpand,
  onUpdate,
  parentPath,
}: LoopTreeItemProps) {
  const isExpanded = expandedNodes.has(loop.id);
  const isSelected = selection?.type === 'loop' && selection.id === loop.id;
  const hasChildren = loop.segments.length > 0 || loop.loops.length > 0;
  const currentPath = [...parentPath, loop.id];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect({ type: 'loop', id: loop.id });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(loop.id);
  };

  return (
    <div className="tree-item" style={{ paddingLeft: depth * 16 }}>
      <div
        className={`tree-item-header ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <span className="tree-toggle" onClick={handleToggle}>
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span className="tree-icon loop">L</span>
        <span className="tree-item-name">{loop.name}</span>
        {loop.maxUse > 1 && <span className="tree-array-badge" title={`Repeats up to ${loop.maxUse}`}>[]</span>}
        <span className="tree-item-meta">{loop.usage}</span>
      </div>

      {isExpanded && (
        <div className="tree-children">
          {loop.segments.map((segment, segIndex) => (
            <SegmentTreeItem
              key={segment.id}
              segment={segment}
              depth={depth + 1}
              index={segIndex}
              selection={selection}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onUpdate={onUpdate}
              loopPath={currentPath}
            />
          ))}
          {loop.loops.map((childLoop, loopIndex) => (
            <LoopTreeItem
              key={childLoop.id}
              loop={childLoop}
              depth={depth + 1}
              index={loopIndex}
              selection={selection}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onUpdate={onUpdate}
              parentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SegmentTreeItemProps {
  segment: Segment;
  depth: number;
  index: number;
  selection: TreeSelection | null;
  expandedNodes: Set<string>;
  onSelect: (selection: TreeSelection | null) => void;
  onToggleExpand: (nodeId: string) => void;
  onUpdate: (updater: (spec: Specification) => Specification) => void;
  loopPath: string[];
}

function SegmentTreeItem({
  segment,
  depth,
  index,
  selection,
  expandedNodes,
  onSelect,
  onToggleExpand,
  loopPath,
}: SegmentTreeItemProps) {
  const isExpanded = expandedNodes.has(segment.id);
  const isSelected = selection?.type === 'segment' && selection.id === segment.id;
  const hasElements = segment.elements.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect({ type: 'segment', id: segment.id });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(segment.id);
  };

  return (
    <div className="tree-item" style={{ paddingLeft: depth * 16 }}>
      <div
        className={`tree-item-header ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <span className="tree-toggle" onClick={handleToggle}>
          {hasElements ? (isExpanded ? '▼' : '▶') : ''}
        </span>
        <span className="tree-icon segment">S</span>
        <span className="tree-item-name">{segment.name}</span>
        {segment.maxUse > 1 && <span className="tree-array-badge" title={`Repeats up to ${segment.maxUse}`}>[]</span>}
        <span className="tree-item-meta">{segment.usage}</span>
      </div>

      {isExpanded && hasElements && (
        <div className="tree-children">
          {segment.elements.map((element, elIndex) => (
            <ElementTreeItem
              key={element.id}
              element={element}
              depth={depth + 1}
              index={elIndex}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ElementTreeItemProps {
  element: Element;
  depth: number;
  index: number;
  selection: TreeSelection | null;
  onSelect: (selection: TreeSelection | null) => void;
}

function ElementTreeItem({
  element,
  depth,
  selection,
  onSelect,
}: ElementTreeItemProps) {
  const isSelected = selection?.type === 'element' && selection.id === element.id;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect({ type: 'element', id: element.id });
  };

  return (
    <div className="tree-item" style={{ paddingLeft: depth * 16 }}>
      <div
        className={`tree-item-header ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
      >
        <span className="tree-toggle" />
        <span className="tree-item-name" style={{ fontSize: '12px', color: '#718096' }}>
          {String(element.position).padStart(2, '0')} - {element.name}
        </span>
        <span className="tree-item-meta">{element.usage}</span>
      </div>
    </div>
  );
}
