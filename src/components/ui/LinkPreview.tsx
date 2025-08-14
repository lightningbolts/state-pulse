import React, { useEffect, useState } from 'react';
import { fetchLinkMetadata, LinkMetadata } from '@/lib/linkPreview';

interface LinkPreviewProps {
  url: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchLinkMetadata(url).then((data) => {
      if (mounted) {
        setMetadata(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [url]);

  if (loading) return <div className="link-preview">Loading preview...</div>;
  if (!metadata) return null;

  return (
    <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="link-preview border rounded p-2 flex gap-2 items-center">
      {metadata.image && (
        <img src={metadata.image} alt="preview" className="w-16 h-16 object-cover rounded" />
      )}
      <div>
        <div className="font-bold text-sm">{metadata.title || metadata.url}</div>
        {metadata.description && <div className="text-xs text-gray-600">{metadata.description}</div>}
        <div className="text-xs text-blue-500">{metadata.url}</div>
      </div>
    </a>
  );
};

