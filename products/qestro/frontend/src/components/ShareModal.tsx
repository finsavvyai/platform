import { useState } from 'react';
import { X, Link, Check } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [emailInput, setEmailInput] = useState('');
  const [sharedUsers, setSharedUsers] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleAddUser = () => {
    if (emailInput.trim() && !sharedUsers.includes(emailInput.trim())) {
      setSharedUsers([...sharedUsers, emailInput.trim()]);
      setEmailInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddUser();
    }
  };

  const handleRemoveUser = (email: string) => {
    setSharedUsers(sharedUsers.filter(user => user !== email));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      console.log('✅ Link copied to clipboard');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-slate-800 rounded-xl max-w-lg w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-50">Share</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Emails</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Select existing user or enter email..."
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
              />
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium transition-colors shadow-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Shared Users List */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Shared with</label>
            <div className="min-h-[80px] max-h-[200px] overflow-y-auto bg-slate-700 border border-slate-600 rounded-lg p-3">
              {sharedUsers.length === 0 ? (
                <p className="text-slate-500 text-sm">No users added yet...</p>
              ) : (
                <div className="space-y-2">
                  {sharedUsers.map((email) => (
                    <div key={email} className="flex items-center justify-between bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 shadow-sm">
                      <span className="text-slate-50 text-sm font-medium">{email}</span>
                      <button
                        onClick={() => handleRemoveUser(email)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Public Access Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">General access</label>
            <div className="flex items-center gap-3 bg-slate-700 border border-slate-600 rounded-lg p-3">
              <input
                type="checkbox"
                id="public-access"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="public-access" className="text-slate-50 text-sm cursor-pointer font-medium">
                Anyone with the link can access this site
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex justify-between items-center">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 hover:bg-slate-700 rounded-lg text-slate-200 font-medium transition-colors"
          >
            {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Link className="w-4 h-4" />}
            {copySuccess ? 'Copied!' : 'Copy Link'}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 border border-slate-600 hover:bg-slate-700 rounded-lg text-slate-200 font-medium transition-colors">
              Cancel
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium transition-colors shadow-sm">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
