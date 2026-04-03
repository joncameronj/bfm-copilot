'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Tick02Icon, Alert02Icon } from '@hugeicons/core-free-icons';

interface ParsedValue {
  markerName: string;
  markerId: string;
  value: number;
  unit: string | null;
  confidence: number;
}

interface PdfUploadProps {
  onValuesExtracted: (values: Record<string, number>, extractionConfidence?: number) => void;
  className?: string;
}

export function PdfUpload({ onValuesExtracted, className }: PdfUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [parsedValues, setParsedValues] = useState<ParsedValue[]>([]);
  const [editableValues, setEditableValues] = useState<ParsedValue[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Sync editable values when parsed values change
  useEffect(() => {
    setEditableValues([...parsedValues]);
  }, [parsedValues]);

  // Update a value in the editable list
  const updateValue = useCallback((index: number, newValue: number) => {
    setEditableValues((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: newValue };
      return updated;
    });
  }, []);

  // Remove a value from the editable list
  const removeValue = useCallback((index: number) => {
    setEditableValues((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Valid file types
  const isValidFileType = (file: File): boolean => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const mimeValid = validTypes.some((t) => file.type.includes(t));
    const extValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    return mimeValid || extValid;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!isValidFileType(file)) {
      toast.error('Please upload a PDF, JPEG, or PNG file');
      return;
    }

    setIsUploading(true);
    setParsedValues([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/labs/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse lab file');
      }

      const data = await response.json();

      if (!data.success) {
        toast.error('Could not extract values from this file. Try a clearer scan.');
        return;
      }

      if (data.values.length === 0) {
        if (data.unmatchedCount > 0) {
          toast.error(
            `${data.unmatchedCount} lab values were found but none matched known markers. ` +
            'Try uploading a standard LabCorp or Quest panel.'
          );
        } else {
          toast.error('No lab values found in this file.');
        }
        return;
      }

      setParsedValues(data.values);
      setShowPreview(true);

      const methodLabel = data.extractionMethod === 'vision' ? '(via image analysis)' : '';
      toast.success(`Found ${data.values.length} lab values ${methodLabel}`);

      if (data.unmatchedCount > 0) {
        toast(`${data.unmatchedCount} values could not be matched`, {
          icon: '⚠️',
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse lab file');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleApplyValues = () => {
    const values: Record<string, number> = {};
    const matchedValues = editableValues.filter((pv) => pv.markerId);
    matchedValues.forEach((pv) => {
      values[pv.markerId] = pv.value;
    });

    // Calculate average confidence for matched values
    const avgConfidence = matchedValues.length > 0
      ? matchedValues.reduce((sum, pv) => sum + pv.confidence, 0) / matchedValues.length
      : 0;

    onValuesExtracted(values, avgConfidence);
    setShowPreview(false);
    setParsedValues([]);
    setEditableValues([]);
    toast.success(`${matchedValues.length} values applied to form`);
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setParsedValues([]);
    setEditableValues([]);
  };

  return (
    <div className={className}>
      {/* Preview Modal */}
      {showPreview && editableValues.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Review Extracted Lab Values</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Edit values, remove incorrect matches, then apply to form.
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              <div className="space-y-3">
                {editableValues.map((pv, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg border flex items-center gap-3',
                      pv.confidence >= 0.7
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                    )}
                  >
                    {/* Confidence indicator */}
                    <div className="flex-shrink-0">
                      {pv.confidence >= 0.7 ? (
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                          <HugeiconsIcon icon={Tick02Icon} size={14} className="text-green-600" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                          <HugeiconsIcon icon={Alert02Icon} size={14} className="text-yellow-600" />
                        </div>
                      )}
                    </div>

                    {/* Marker name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 text-sm truncate">
                        {pv.markerName}
                      </p>
                      {pv.confidence < 0.7 && (
                        <p className="text-xs text-yellow-700">
                          Low confidence match
                        </p>
                      )}
                      {!pv.markerId && (
                        <p className="text-xs text-red-600">
                          Unmatched - will be skipped
                        </p>
                      )}
                    </div>

                    {/* Editable value input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={pv.value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            updateValue(index, val);
                          }
                        }}
                        className="w-24 px-3 py-1.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                      />
                      {pv.unit && (
                        <span className="text-sm text-neutral-500 w-16 truncate">
                          {pv.unit}
                        </span>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeValue(index)}
                      className="flex-shrink-0 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove this value"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {editableValues.length === 0 && (
                <p className="text-center text-neutral-500 py-8">
                  All values removed. Cancel to start over.
                </p>
              )}
            </div>

            <div className="p-6 border-t flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                {editableValues.filter((v) => v.markerId).length} matched values
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancelPreview}>
                  Cancel
                </Button>
                <Button
                  onClick={handleApplyValues}
                  disabled={editableValues.filter((v) => v.markerId).length === 0}
                >
                  Apply {editableValues.filter((v) => v.markerId).length} Values
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-neutral-900 bg-neutral-100'
            : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <>
              <div className="w-10 h-10 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
              <p className="text-neutral-900 font-medium">Analyzing lab file...</p>
              <p className="text-sm text-neutral-400">
                This can take up to 30 seconds for large reports
              </p>
            </>
          ) : (
            <>
              <svg
                className={cn('w-10 h-10', isDragActive ? 'text-neutral-900' : 'text-neutral-400')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {isDragActive ? (
                <p className="text-neutral-900 font-medium">Drop your lab file here</p>
              ) : (
                <>
                  <p className="text-neutral-600">
                    Drag & drop a lab report (PDF or image), or{' '}
                    <span className="text-neutral-900 font-medium underline">browse</span>
                  </p>
                  <p className="text-sm text-neutral-400">PDF, JPEG, PNG up to 50MB</p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
