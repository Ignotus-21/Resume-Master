'use client';

// Form primitives + immutable-update helpers shared by the profile tabs.

export const Input = ({ label, value, onChange }: any) => (
  <div>
    <label className="block text-sm font-medium text-[#5f6368] mb-2">{label}</label>
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-[#dadce0] rounded-lg px-4 py-2 bg-[#f8f9fa] text-[#202124] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
    />
  </div>
);

export const TextArea = ({ label, value, onChange }: any) => (
  <div>
    <label className="block text-sm font-medium text-[#5f6368] mb-2">{label}</label>
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-[#dadce0] rounded-lg px-4 py-2 h-32 bg-[#f8f9fa] text-[#202124] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder-slate-600"
    />
  </div>
);

export const updateArrayItem = (profile: any, setProfile: any, arrayName: string, index: number, field: string, value: any) => {
  const newArray = [...(profile[arrayName] || [])];
  if (!newArray[index]) newArray[index] = {};
  newArray[index] = { ...newArray[index], [field]: value };
  setProfile({ ...profile, [arrayName]: newArray });
};

export const removeItem = (profile: any, setProfile: any, arrayName: string, index: number) => {
  const newArray = [...(profile[arrayName] || [])];
  newArray.splice(index, 1);
  setProfile({ ...profile, [arrayName]: newArray });
};
