'use client';

import { useEffect, useState } from 'react';

interface Prompt {
  id: string;
  text: string;
}

export default function EditPromptPage() {
  const [text, setText] = useState('');
  const [promptId, setPromptId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPrompt();
  }, []);

  const fetchPrompt = async () => {
    try {
      const response = await fetch('/api/prompt');
      if (!response.ok) throw new Error('Failed to fetch prompt');
      const data: Prompt = await response.json();
      setText(data.text);
      setPromptId(data.id);
    } catch (err) {
      setError('Failed to load prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(`/api/prompt/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Failed to update prompt');

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to update prompt');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <span className='loading loading-spinner loading-lg'></span>
      </div>
    );
  }

  return (
    <div className='w-full h-full'>
      <div className='card bg-base-100 shadow-xl'>
        <div className='card-body'>
          <h2 className='card-title text-2xl mb-6'>Edit prompt</h2>

          {error && (
            <div className='alert alert-error mb-4'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='stroke-current shrink-0 h-6 w-6'
                fill='none'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className='alert alert-success mb-4'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='stroke-current shrink-0 h-6 w-6'
                fill='none'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <span>Prompt updated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className='flex flex-col h-full'>
            <div className='form-control flex-grow'>
              <textarea
                className='textarea textarea-bordered w-full flex-grow min-h-[60vh]'
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Enter your text here...'
                required
                disabled={isSaving}
              />
            </div>

            <div className='card-actions justify-end mt-6'>
              <button type='submit' className='btn btn-primary' disabled={isSaving}>
                {isSaving ? (
                  <>
                    <span className='loading loading-spinner'></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
