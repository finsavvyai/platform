/**
 * ProductMap — hierarchical planning view inspired by Dossier.
 * Three levels: Product (top), Workflow columns, Feature cards.
 * CSS Grid layout, dark theme, localStorage persistence.
 */

import { useState, useCallback } from 'react';
import { FeatureCard } from './FeatureCard';
import { AddCardModal, type ModalMode } from './AddCardModal';
import {
  type ProductMapData, type CardStatus, type ApprovalState,
  loadMapData, saveMapData, generateId,
} from './types';
import * as S from './styles';

export function ProductMap() {
  const [data, setData] = useState<ProductMapData>(loadMapData);
  const [modal, setModal] = useState<{ mode: ModalMode; workflowId?: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState(false);

  const persist = useCallback((next: ProductMapData) => {
    setData(next);
    saveMapData(next);
  }, []);

  const handleSaveModal = useCallback((input: {
    title: string; description: string; tags: string[]; contextFiles: string[];
  }) => {
    if (!modal) return;
    const next = { ...data, workflows: [...data.workflows] };
    if (modal.mode === 'workflow') {
      next.workflows.push({
        id: generateId(), name: input.title,
        description: input.description, cards: [],
      });
    } else if (modal.workflowId) {
      const wf = next.workflows.find((w) => w.id === modal.workflowId);
      if (wf) {
        wf.cards = [...wf.cards, {
          id: generateId(), title: input.title, description: input.description,
          status: 'planned', tags: input.tags, contextFiles: input.contextFiles,
        }];
      }
    }
    persist(next);
    setModal(null);
  }, [modal, data, persist]);

  const handleStatusChange = useCallback((cardId: string, status: CardStatus) => {
    const next = { ...data, workflows: data.workflows.map((w) => ({
      ...w, cards: w.cards.map((c) => c.id === cardId ? { ...c, status } : c),
    }))};
    persist(next);
  }, [data, persist]);

  const handleApprovalChange = useCallback(
    (cardId: string, approval: ApprovalState, note?: string) => {
      const next = { ...data, workflows: data.workflows.map((w) => ({
        ...w,
        cards: w.cards.map((c) =>
          c.id === cardId
            ? {
              ...c,
              approval,
              reviewNote: approval === 'rejected' ? (note ?? c.reviewNote ?? '') : undefined,
              reviewedAt: new Date().toISOString(),
            }
            : c,
        ),
      }))};
      persist(next);
    },
    [data, persist],
  );

  const handleProductSave = useCallback((name: string, description: string) => {
    persist({ ...data, product: { name, description } });
    setEditingProduct(false);
  }, [data, persist]);

  const handleDeleteWorkflow = useCallback((wfId: string) => {
    persist({ ...data, workflows: data.workflows.filter((w) => w.id !== wfId) });
  }, [data, persist]);

  return (
    <div style={S.pageStyle} role="main" aria-label="Product Map">
      <header style={S.headerStyle}>
        <button style={S.backBtn} onClick={() => { window.location.hash = ''; }}
          aria-label="Back to landing page">
          Back
        </button>
        <h1 style={S.pageTitleStyle}>Product Map</h1>
      </header>

      <ProductHeader product={data.product} editing={editingProduct}
        onEdit={() => setEditingProduct(true)} onSave={handleProductSave} />

      <div style={S.gridContainer}>
        {data.workflows.map((wf) => (
          <div key={wf.id} style={S.columnStyle}>
            <div style={S.columnHeader}>
              <h3 style={S.columnTitle}>{wf.name}</h3>
              <button style={S.deleteBtn} onClick={() => handleDeleteWorkflow(wf.id)}
                aria-label={`Delete ${wf.name}`}>x</button>
            </div>
            {wf.description && <p style={S.columnDesc}>{wf.description}</p>}
            <div style={S.cardsStack}>
              {wf.cards.map((card) => (
                <FeatureCard
                  key={card.id}
                  card={card}
                  onStatusChange={handleStatusChange}
                  onApprovalChange={handleApprovalChange}
                />
              ))}
            </div>
            <button style={S.addCardBtn}
              onClick={() => setModal({ mode: 'card', workflowId: wf.id })}
              aria-label={`Add card to ${wf.name}`}>
              + Add Card
            </button>
          </div>
        ))}
        <button style={S.addColumnBtn} onClick={() => setModal({ mode: 'workflow' })}
          aria-label="Add workflow column">
          + Add Workflow
        </button>
      </div>

      {modal && (
        <AddCardModal mode={modal.mode}
          onSave={handleSaveModal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function ProductHeader({ product, editing, onEdit, onSave }: {
  product: { name: string; description: string };
  editing: boolean;
  onEdit: () => void;
  onSave: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description);

  if (!editing) {
    return (
      <div style={S.productBar} onClick={onEdit} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onEdit()}
        aria-label="Edit product details">
        <h2 style={S.productName}>{product.name}</h2>
        <p style={S.productDesc}>{product.description}</p>
      </div>
    );
  }

  return (
    <div style={S.productBar}>
      <input style={S.editInput} value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Product name" aria-label="Product name" />
      <input style={S.editInput} value={desc} onChange={(e) => setDesc(e.target.value)}
        placeholder="Product description" aria-label="Product description" />
      <button style={S.saveProdBtn} onClick={() => onSave(name, desc)}>Save</button>
    </div>
  );
}
