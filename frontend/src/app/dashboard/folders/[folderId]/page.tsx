'use client';
import { useWorkspaceStore } from '@/features/folders/store';
import { fileService } from '@/features/files/services';
import FileViewer from '@/features/files/components/FileViewer';
import { useEffect, useState } from 'react';

export default function FolderPage({ params }: { params: { folderId: string } }) {
  const { folders, selectedFileId } = useWorkspaceStore() as any;
  const [fileDetails, setFileDetails] = useState<any>(null);

  const folder = folders.find((f: any) => f.id === params.folderId);
  const fileSummary = folder?.files?.find((f: any) => f.id === selectedFileId);

  useEffect(() => {
    async function loadFile() {
      if (!selectedFileId) {
        setFileDetails(null);
        return;
      }
      try {
        const res = await fileService.getFile(selectedFileId);
        if (res.success) {
          setFileDetails(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadFile();
  }, [selectedFileId]);

  const handleSaveContent = async (newContent: string) => {
    if (!selectedFileId) return;
    try {
      const res = await fileService.updateFile(selectedFileId, newContent);
      if (res.success) {
        setFileDetails(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-full w-full">
      <FileViewer 
        file={fileDetails} 
        folderName={folder?.name || ''} 
        onSaveContent={handleSaveContent} 
      />
    </div>
  );
}
