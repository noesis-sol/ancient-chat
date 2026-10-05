'use client';
import { MAX_WEIGHT, MIN_WEIGHT, parseWeight, sendIndexAction } from '@/utils/index-actions';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AccordionItem = {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  weight: number;
};

interface AccordionSectionProps {
  data: AccordionItem[];
}

const TOAST_DURATION_MS = 6000;

const AccordionSection = ({ data }: AccordionSectionProps) => {
  // Section state is keyed by index id, so it follows the right row when the list changes.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [accordionData, setAccordionData] = useState<AccordionItem[]>(data);
  const [syncedData, setSyncedData] = useState<AccordionItem[]>(data);
  // What the admin typed, kept as text so partial input like "0." stays editable.
  const [weightDrafts, setWeightDrafts] = useState<{ [id: string]: string }>({});
  const [loadingToggles, setLoadingToggles] = useState<{ [id: string]: boolean }>({});
  const [loadingWeights, setLoadingWeights] = useState<{ [id: string]: boolean }>({});
  // A new object per failure, so a repeated message restarts the timer.
  const [toast, setToast] = useState<{ message: string } | null>(null);

  // router.refresh() (e.g. after an upload) passes new data: show it.
  if (data !== syncedData) {
    setSyncedData(data);
    setAccordionData(data);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  const openDeleteModal = (title: string) => {
    setDeleteError(null);
    setDeleteTitle(title);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteTitle(null);
    setDeleteError(null);
  };

  const onDelete = async (title: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    const result = await sendIndexAction(`/api/indexes/${encodeURIComponent(title)}`, { method: 'DELETE' });
    setIsDeleting(false);
    if (result.ok) {
      setAccordionData((prev) => prev.filter((item) => item.title !== title));
      setDeleteTitle(null);
    } else {
      setDeleteError(`Could not delete "${title}": ${result.message}`);
    }
  };

  const toggleActive = async ({ id, title, isActive }: AccordionItem) => {
    setLoadingToggles((prev) => ({ ...prev, [id]: true }));
    const result = await sendIndexAction(`/api/indexes/${encodeURIComponent(title)}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive: !isActive })
    });
    if (result.ok) {
      setAccordionData((prev) => prev.map((item) => (item.id === id ? { ...item, isActive: !isActive } : item)));
    } else {
      setToast({ message: `Could not ${isActive ? 'deactivate' : 'activate'} "${title}": ${result.message}` });
    }
    setLoadingToggles((prev) => ({ ...prev, [id]: false }));
  };

  const updateWeight = async ({ id, title }: AccordionItem, weight: number) => {
    setLoadingWeights((prev) => ({ ...prev, [id]: true }));
    const result = await sendIndexAction(`/api/indexes/${encodeURIComponent(title)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ weight })
    });
    if (result.ok) {
      setAccordionData((prev) => prev.map((item) => (item.id === id ? { ...item, weight } : item)));
      setWeightDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setToast({ message: `Could not save the weight of "${title}": ${result.message}` });
    }
    setLoadingWeights((prev) => ({ ...prev, [id]: false }));
  };

  if (!accordionData.length) {
    return (
      <div className='w-full border border-dashed rounded-lg p-8 text-center'>
        <p className='font-medium'>No indexes yet</p>
        <p className='text-sm opacity-70 mt-1'>Use &quot;Add new indexes&quot; to upload files and create one.</p>
      </div>
    );
  }

  return (
    <>
      <div className='w-full mx-auto space-y-2'>
        {accordionData.map((section) => {
          const draft = weightDrafts[section.id];
          const draftWeight = draft === undefined ? null : parseWeight(draft);
          const draftInvalid = draft !== undefined && draftWeight === null;
          const canSave = draftWeight !== null && draftWeight !== section.weight;
          const isOpen = openSection === section.id;
          return (
            <div key={section.id} className='border rounded-lg overflow-hidden'>
              <div className='flex justify-between items-center p-4'>
                <span className='font-medium'>{section.title}</span>

                <div className='flex items-center gap-4'>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      aria-label={`${section.title} active`}
                      checked={!!section.isActive}
                      onChange={() => toggleActive(section)}
                      disabled={loadingToggles[section.id]}
                      className={`toggle checked:bg-primary ${
                        loadingToggles[section.id] ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    {loadingToggles[section.id] && (
                      <div className='absolute inset-0 flex items-center justify-center'>
                        <div className='w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin'></div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${section.title}`}
                    className='p-4 text-left flex justify-between items-center hover:cursor-pointer'
                  >
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                className={`transition-all duration-200 ease-in-out ${
                  isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                } overflow-hidden`}
              >
                <div className='p-4 flex justify-between items-center'>
                  <div>{section.content}</div>
                  <div className='flex items-center gap-4'>
                    <form
                      className='flex items-center gap-2'
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (canSave) updateWeight(section, draftWeight);
                      }}
                    >
                      <label className='text-sm' htmlFor={`weight-${section.id}`}>
                        Weight:
                      </label>
                      <input
                        id={`weight-${section.id}`}
                        type='text'
                        inputMode='decimal'
                        value={draft ?? String(section.weight ?? 0)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setWeightDrafts((prev) => ({ ...prev, [section.id]: value }));
                        }}
                        disabled={loadingWeights[section.id]}
                        aria-invalid={draftInvalid}
                        title={`A share from ${MIN_WEIGHT} to ${MAX_WEIGHT}, relative to the other active indexes`}
                        className={`input input-bordered input-sm w-24 ${draftInvalid ? 'input-error' : ''} ${
                          loadingWeights[section.id] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                      <button
                        type='submit'
                        disabled={loadingWeights[section.id] || !canSave}
                        className={`btn btn-primary btn-sm ${
                          loadingWeights[section.id] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {loadingWeights[section.id] ? (
                          <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </form>
                    <button onClick={() => openDeleteModal(section.title)} className='btn btn-outline btn-error btn-sm'>
                      Delete
                    </button>
                  </div>
                </div>
                {draftInvalid && (
                  <p className='px-4 pb-4 text-sm text-error'>
                    Enter a number from {MIN_WEIGHT} to {MAX_WEIGHT}.
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <p className='text-sm opacity-70'>
          Weights are relative: chat splits its retrieved chunks between the active indexes in proportion to their
          weights. New indexes start at {MAX_WEIGHT}, so lower the others to favour one.
        </p>
      </div>

      {toast && (
        <div className='toast toast-end'>
          <div role='alert' className='alert alert-error'>
            <span>{toast.message}</span>
            <button className='btn btn-ghost btn-sm' aria-label='Dismiss' onClick={() => setToast(null)}>
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <dialog id='delete_modal' className={`modal ${deleteTitle ? 'modal-open' : ''}`}>
        <div className='modal-box'>
          <h3 className='font-bold text-lg'>Confirm Deletion</h3>
          <p className='py-4'>
            Are you sure you want to delete &quot;{deleteTitle}&quot;? This action cannot be undone.
          </p>
          {deleteError && (
            <div role='alert' className='alert alert-error'>
              <span>{deleteError}</span>
            </div>
          )}
          <div className='modal-action'>
            <button className='btn btn-outline' onClick={closeDeleteModal} disabled={isDeleting}>
              Cancel
            </button>
            <button
              className='btn btn-error'
              onClick={() => deleteTitle && onDelete(deleteTitle)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
        <form method='dialog' className='modal-backdrop'>
          <button type='button' onClick={closeDeleteModal}>
            close
          </button>
        </form>
      </dialog>
    </>
  );
};

export default AccordionSection;
