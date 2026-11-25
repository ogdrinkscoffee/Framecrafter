import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { DomTreeNode } from '../types/editor';

interface DomOutlineTreeProps {
  nodes: DomTreeNode[];
  selectedNodeKey: string | null;
  onSelectNode: (nodeId: string) => void;
  onHoverNode: (nodeId: string | null) => void;
}

function collectAncestorKeys(
  nodes: DomTreeNode[],
  targetKey: string,
  trail: string[] = []
): string[] | null {
  for (const node of nodes) {
    const idMatch = node.veId === targetKey || node.rtId === targetKey || node.nodeKey === targetKey;
    if (idMatch) {
      return trail;
    }
    if (node.children.length > 0) {
      const childTrail = collectAncestorKeys(node.children, targetKey, [...trail, node.nodeKey]);
      if (childTrail) return childTrail;
    }
  }
  return null;
}

export const DomOutlineTree: React.FC<DomOutlineTreeProps> = ({
  nodes,
  selectedNodeKey,
  onSelectNode,
  onHoverNode,
}) => {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // Auto-expand ancestor branches when user selects an element on the Live Canvas
  useEffect(() => {
    if (!selectedNodeKey || nodes.length === 0) return;
    const ancestors = collectAncestorKeys(nodes, selectedNodeKey);
    if (!ancestors || ancestors.length === 0) return;
    setCollapsedMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of ancestors) {
        if (next[k]) {
          next[k] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedNodeKey, nodes]);

  const toggleNode = (nodeKey: string) => {
    setCollapsedMap((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  return (
    <section
      aria-label="Page DOM Hierarchy Tree"
      className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)]"
      onMouseLeave={() => onHoverNode(null)}
    >
      <div className="h-8 px-3 flex items-center justify-between border-b border-[var(--studio-border-subtle)]">
        <span className="studio-section-header flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.4} />
          DOM Hierarchy
        </span>
        <span className="text-[11px] font-mono-tabular text-[var(--studio-muted-soft)]">
          {nodes.length} root{nodes.length === 1 ? '' : 's'}
        </span>
      </div>

      {nodes.length === 0 ? (
        <div className="px-3 py-4 text-[11px] text-[var(--studio-muted-soft)] text-center">
          Switch to Live Canvas to inspect page elements.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto builder-scroll py-1.5 px-1.5 space-y-0.5">
          {nodes.map((node) => (
            <TreeBranch
              key={node.nodeKey}
              node={node}
              depth={0}
              selectedNodeKey={selectedNodeKey}
              collapsedMap={collapsedMap}
              onToggle={toggleNode}
              onSelectNode={onSelectNode}
              onHoverNode={onHoverNode}
            />
          ))}
        </div>
      )}
    </section>
  );
};

interface TreeBranchProps {
  node: DomTreeNode;
  depth: number;
  selectedNodeKey: string | null;
  collapsedMap: Record<string, boolean>;
  onToggle: (nodeKey: string) => void;
  onSelectNode: (nodeId: string) => void;
  onHoverNode: (nodeId: string | null) => void;
}

const TreeBranch: React.FC<TreeBranchProps> = ({
  node,
  depth,
  selectedNodeKey,
  collapsedMap,
  onToggle,
  onSelectNode,
  onHoverNode,
}) => {
  const targetId = node.veId || node.rtId || node.nodeKey;
  const hasChildren = node.children.length > 0;
  const isCollapsed = Boolean(collapsedMap[node.nodeKey]);
  const isSelected =
    Boolean(selectedNodeKey) &&
    (selectedNodeKey === node.veId ||
      selectedNodeKey === node.rtId ||
      selectedNodeKey === node.nodeKey);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] transition-colors ${
          isSelected
            ? 'bg-indigo-500/18 text-[var(--studio-text-strong)] ring-1 ring-indigo-500/40'
            : 'text-[var(--studio-text)] hover:bg-[var(--studio-elevated)] hover:text-[var(--studio-text-strong)]'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onMouseEnter={() => onHoverNode(targetId)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.nodeKey);
            }}
            aria-label={isCollapsed ? `Expand ${node.tagName}` : `Collapse ${node.tagName}`}
            className="p-0.5 rounded text-[var(--studio-muted-soft)] hover:text-[var(--studio-text-strong)] shrink-0 cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => onSelectNode(targetId)}
          data-testid={`dom-tree-item-${targetId}`}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
        >
          <span
            className={`font-mono-tabular text-[11.5px] font-medium shrink-0 ${
              isSelected
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-cyan-700 dark:text-cyan-400'
            }`}
          >
            &lt;{node.tagName}&gt;
          </span>
          {node.idAttr ? (
            <span className="font-mono-tabular text-[11.5px] text-amber-700 dark:text-amber-300 truncate">
              #{node.idAttr}
            </span>
          ) : node.classPreview ? (
            <span className="font-mono-tabular text-[11.5px] text-[var(--studio-muted)] truncate">
              .{node.classPreview}
            </span>
          ) : null}
          {node.textPreview && (
            <span className="text-[10.5px] text-[var(--studio-muted-soft)] truncate ml-auto max-w-28">
              &ldquo;{node.textPreview}&rdquo;
            </span>
          )}
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="ml-2 border-l border-[var(--studio-border-subtle)]">
          {node.children.map((child) => (
            <TreeBranch
              key={child.nodeKey}
              node={child}
              depth={depth + 1}
              selectedNodeKey={selectedNodeKey}
              collapsedMap={collapsedMap}
              onToggle={onToggle}
              onSelectNode={onSelectNode}
              onHoverNode={onHoverNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};
