import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AgentPromptItem } from '../../../services/admin.service';

export const PromptCard = ({ prompt }: { prompt: AgentPromptItem }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-lg border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-900 text-sm">{prompt.name}</span>
          {prompt.description && <p className="text-xs text-gray-500 mt-1">{prompt.description}</p>}
          <span className="text-xs font-mono text-gray-300 mt-1 block">{prompt.promptKey}</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <pre className="p-3 bg-gray-50 rounded-md text-xs overflow-x-auto max-h-64 overflow-y-auto leading-relaxed" dir="ltr">{prompt.promptText}</pre>
        </div>
      )}
    </div>
  );
};
