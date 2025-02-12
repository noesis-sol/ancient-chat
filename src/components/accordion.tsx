'use client';
import { useState } from 'react';

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

const AccordionSection = ({ data }: AccordionSectionProps) => {
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [accordionData, setAccordionData] = useState<AccordionItem[]>(data);
  const [weights, setWeights] = useState<{ [key: string]: number }>({});
  const [loadingToggles, setLoadingToggles] = useState<{ [key: string]: boolean }>({});
  const [loadingWeights, setLoadingWeights] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (index: number) => {
    setOpenSection(openSection === index ? null : index);
  };

  if (!accordionData?.length) {
    return null;
  }

  const onDelete = async (title: string) => {
    setIsDeleting(true);
    try {
      const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/indexes/${title}`, {
        method: 'DELETE'
      });
      const { success } = (await result.json()) as { success: boolean };
      if (success) {
        removeSection(title);
        setDeleteTitle(null);
      }
    } catch (error) {
      console.error('Failed to delete section:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const removeSection = (title: string) => {
    const index = accordionData.findIndex((section) => section.title === title);
    if (index !== -1) {
      const newAccordionData = [...accordionData];
      newAccordionData.splice(index, 1);
      setAccordionData(newAccordionData);
      setOpenSection(null);
    }
  };

  const toggleActive = async (title: string, currentState: boolean) => {
    setLoadingToggles((prev) => ({ ...prev, [title]: true }));

    try {
      const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/indexes/${title}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentState })
      });

      const { success } = await result.json();
      if (success) {
        setAccordionData((prev) =>
          prev.map((item) => (item.title === title ? { ...item, isActive: !item.isActive } : item))
        );
      }
    } catch (error) {
      console.error('Failed to toggle active state:', error);
    } finally {
      setLoadingToggles((prev) => ({ ...prev, [title]: false }));
    }
  };

  const updateWeight = async (title: string, weight: number) => {
    const index = accordionData.findIndex((item) => item.title === title);
    if (index === -1) return;

    setLoadingWeights((prev) => ({ ...prev, [title]: true }));

    const updatedItem = {
      ...accordionData[index],
      weight
    };

    try {
      const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/indexes/${title}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: updatedItem.title,
          id: updatedItem.id,
          is_active: updatedItem.isActive,
          weight: updatedItem.weight
        } as {
          name: string;
          id: string;
          is_active: boolean;
          weight: number;
        })
      });

      const { success } = await result.json();
      if (success) {
        setAccordionData((prev) => prev.map((item) => (item.title === title ? updatedItem : item)));
        setWeights((prev) => {
          const newWeights = { ...prev };
          delete newWeights[title];
          return newWeights;
        });
      }
    } catch (error) {
      console.error('Failed to update weight:', error);
    } finally {
      setLoadingWeights((prev) => ({ ...prev, [title]: false }));
    }
  };

  const handleWeightChange = (title: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
      setWeights((prev) => ({
        ...prev,
        [title]: numValue
      }));
    }
  };

  return (
    <>
      <div className='w-full mx-auto space-y-2'>
        {accordionData.map((section, index) => (
          <div key={index} className='border rounded-lg overflow-hidden'>
            <div className='flex justify-between items-center p-4'>
              <span className='font-medium'>{section.title}</span>

              <div className='flex items-center gap-4'>
                <div className='relative'>
                  <input
                    type='checkbox'
                    checked={!!section.isActive}
                    onChange={() => toggleActive(section.title, section.isActive)}
                    disabled={loadingToggles[section.title]}
                    className={`toggle checked:bg-primary ${
                      loadingToggles[section.title] ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  {loadingToggles[section.title] && (
                    <div className='absolute inset-0 flex items-center justify-center'>
                      <div className='w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin'></div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleSection(index)}
                  className='p-4 text-left flex justify-between items-center hover:cursor-pointer'
                >
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${
                      openSection === index ? 'transform rotate-180' : ''
                    }`}
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
                openSection === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
              } overflow-hidden`}
            >
              <div className='p-4 flex justify-between items-center'>
                <div>{section.content}</div>
                <div className='flex items-center gap-4'>
                  <div className='flex items-center gap-2'>
                    <label className='text-sm'>Weight:</label>
                    <input
                      type='number'
                      min='0'
                      max='1'
                      step='0.1'
                      value={weights[section.title] ?? section.weight ?? 0}
                      onChange={(e) => handleWeightChange(section.title, e.target.value)}
                      disabled={loadingWeights[section.title]}
                      className={`input input-bordered input-sm w-24 ${
                        loadingWeights[section.title] ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <button
                      onClick={() => updateWeight(section.title, weights[section.title] ?? section.weight ?? 0)}
                      disabled={
                        loadingWeights[section.title] || (!weights[section.title] && weights[section.title] !== 0)
                      }
                      className={`btn btn-primary btn-sm ${
                        loadingWeights[section.title] ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loadingWeights[section.title] ? (
                        <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                  <button onClick={() => setDeleteTitle(section.title)} className='btn btn-outline btn-error btn-sm'>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <dialog id='delete_modal' className={`modal ${deleteTitle ? 'modal-open' : ''}`}>
        <div className='modal-box'>
          <h3 className='font-bold text-lg'>Confirm Deletion</h3>
          <p className='py-4'>
            Are you sure you want to delete &quot;{deleteTitle}&quot;? This action cannot be undone.
          </p>
          <div className='modal-action'>
            <button className='btn btn-outline' onClick={() => setDeleteTitle(null)} disabled={isDeleting}>
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
          <button onClick={() => setDeleteTitle(null)}>close</button>
        </form>
      </dialog>
    </>
  );
};

export default AccordionSection;
