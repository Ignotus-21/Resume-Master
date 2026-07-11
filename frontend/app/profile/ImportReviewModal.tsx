'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';

// Review screen for a parsed PDF import: pick which extracted items to merge
// into the current profile before anything is saved.
export const ImportReviewModal = ({ currentProfile, importData, onCancel, onConfirm }: any) => {
  const [merged, setMerged] = useState({ ...currentProfile });
  const [addedItems, setAddedItems] = useState<Record<string, number[]>>({});

  const addItem = (key: string, item: any, index: number) => {
    const newList = [...(merged[key] || []), item];
    setMerged({ ...merged, [key]: newList });
    setAddedItems({
      ...addedItems,
      [key]: [...(addedItems[key] || []), index]
    });
  };

  const [infoUpdated, setInfoUpdated] = useState(false);
  const overwriteInfo = () => {
    setMerged({ ...merged, user: { ...merged.user, ...importData.user } });
    setInfoUpdated(true);
  };

  return (
    <Modal open onClose={onCancel} title="Review Import" panelClassName="max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-8">
          {/* User Info */}
          <div>
            <h3 className="text-lg font-bold text-[#1a73e8] mb-2">Personal Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f8f9fa] p-4 rounded border border-[#dadce0]">
                <div className="font-bold text-xs text-[#5f6368] uppercase mb-2">Current</div>
                <div className="text-sm text-[#202124] space-y-1">
                    {Object.entries(currentProfile.user || {}).map(([k, v]: any) => (
                        v && <div key={k}><span className="text-[#5f6368]">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : v}</div>
                    ))}
                </div>
              </div>
              <div className="bg-[#f8f9fa] p-4 rounded border border-[#1a73e8]">
                <div className="font-bold text-xs text-[#1a73e8] uppercase mb-2">New (from PDF)</div>
                <div className="text-sm text-[#202124] space-y-1 mb-3">
                    {Object.entries(importData.user || {}).map(([k, v]: any) => (
                        v && <div key={k}><span className="text-[#1a73e8]">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : v}</div>
                    ))}
                </div>
                <button
                  onClick={overwriteInfo}
                  className="w-full bg-[#1a73e8] text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition"
                >
                  {infoUpdated ? 'Info Updated ✓' : 'Use New Info'}
                </button>
              </div>
            </div>
          </div>

          {/* Arrays (Dynamic Sections) */}
          {Object.keys(importData).filter(key => Array.isArray(importData[key])).map((key) => (
            <div key={key}>
              <h3 className="text-lg font-bold text-[#1a73e8] mb-2 capitalize">{key}</h3>
              <div className="bg-[#f8f9fa] p-4 rounded border border-[#dadce0]">
                 <p className="text-sm text-[#5f6368] mb-3">
                   Found <strong>{importData[key]?.length || 0}</strong> items.
                 </p>
                 {importData[key]?.length > 0 && (
                   <div className="space-y-3">
                     {importData[key].map((item: any, i: number) => {
                       const isAdded = addedItems[key]?.includes(i);
                       // Determine display labels dynamically
                       const mainLabel = item.company || item.institution || item.title || item.name || item.organization || 'Unknown Item';
                       const subLabel = item.role || item.degree || item.issuer || item.subtitle || item.number || '';

                       return (
                         <div key={i} className="flex justify-between items-center p-3 bg-[#f8f9fa] rounded border border-[#dadce0]">
                           <div className="text-sm text-[#202124]">
                             <div className="font-bold">{mainLabel}</div>
                             {subLabel && <div className="text-[#5f6368]">{subLabel}</div>}
                           </div>
                           <button
                             onClick={() => addItem(key, item, i)}
                             disabled={isAdded}
                             className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                               isAdded
                                 ? 'bg-[#e6f4ea] text-[#1e8e3e] border border-[#1e8e3e]/30 cursor-default'
                                 : 'bg-[#1a73e8] text-white hover:bg-blue-500'
                             }`}
                           >
                             {isAdded ? 'Added' : 'Add'}
                           </button>
                         </div>
                       );
                     })}
                   </div>
                 )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 mt-6 border-t border-[#dadce0] flex justify-end gap-4">
          <button type="button" onClick={onCancel} className="px-6 py-2 text-[#5f6368] hover:text-[#202124]">Cancel</button>
          <button
            type="button"
            onClick={() => onConfirm(merged)}
            className="px-8 py-2 bg-[#1e8e3e] text-white rounded-lg font-bold hover:bg-[#188038] shadow-lg transition"
          >
            Confirm & Save Changes
          </button>
        </div>
    </Modal>
  );
};
