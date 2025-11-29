import React from 'react';
import { DetectedEntity, EntityType } from '../types';

interface EntityTableProps {
  entities: DetectedEntity[];
}

const getEntityColor = (type: EntityType) => {
  switch (type) {
    case EntityType.PERSON: return 'text-pink-400';
    case EntityType.LOCATION: return 'text-green-400';
    case EntityType.EMAIL_ADDRESS: return 'text-blue-400';
    case EntityType.CREDIT_CARD: return 'text-red-400';
    case EntityType.IP_ADDRESS: return 'text-orange-400';
    case EntityType.PHONE_NUMBER: return 'text-yellow-400';
    case EntityType.DATE_TIME: return 'text-purple-400';
    case EntityType.URL: return 'text-cyan-400';
    default: return 'text-gray-400';
  }
};

const EntityTable: React.FC<EntityTableProps> = ({ entities }) => {
  if (entities.length === 0) return null;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl mt-6">
      <div className="bg-slate-900/50 p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🛡️</span> Detected Entities
        </h3>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">Type</th>
              <th scope="col" className="px-6 py-3 font-medium">Extracted Text</th>
              <th scope="col" className="px-6 py-3 font-medium text-right">Start Index</th>
              <th scope="col" className="px-6 py-3 font-medium text-right">End Index</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {entities.map((entity, index) => (
              <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                <td className={`px-6 py-4 font-mono font-medium ${getEntityColor(entity.type)}`}>
                  {entity.type}
                </td>
                <td className="px-6 py-4 text-slate-200 break-all">
                  {entity.text}
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-500">
                  {entity.startIndex !== undefined ? entity.startIndex : '-'}
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-500">
                  {entity.endIndex !== undefined ? entity.endIndex : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntityTable;
