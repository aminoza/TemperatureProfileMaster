import React, { useState, useEffect } from 'react';
import { getProfiles, createProfile, updateProfile, deleteProfile } from './services/dbService';
import { TemperatureProfile } from './types';
import ProfileEditor from './components/ProfileEditor';
import ProfileCard from './components/ProfileCard';
import { Plus, Thermometer, Loader2, Trash2, AlertTriangle } from 'lucide-react';

export default function App() {
  const [profiles, setProfiles] = useState<TemperatureProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<TemperatureProfile | null>(null);
  
  // Delete Modal State
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const data = await getProfiles();
      // Sort by updated recently
      const sorted = data.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      setProfiles(sorted);
    } catch (error) {
      console.error("Failed to fetch profiles", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setCurrentProfile(null);
    setIsEditing(true);
  };

  const handleEdit = (profile: TemperatureProfile) => {
    setCurrentProfile(profile);
    setIsEditing(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent opening the editor
    setProfileToDelete(id);
  };

  const confirmDelete = async () => {
    if (!profileToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteProfile(profileToDelete);
      // Optimistically update list or re-fetch
      await fetchProfiles();
      setProfileToDelete(null);
    } catch (error) {
      console.error("Error deleting profile", error);
      alert("Failed to delete profile. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (profile: TemperatureProfile) => {
    let savedId = profile.id;
    if (profile.id) {
      await updateProfile(profile.id, profile);
    } else {
      savedId = await createProfile(profile);
    }
    
    // Do not close editor automatically. 
    // Just refresh the list in background.
    fetchProfiles();
    
    return savedId;
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCurrentProfile(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative print:h-auto print:bg-white">
      {!isEditing && (
        /* Header only visible when not editing to give full screen to editor */
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
          <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Thermometer className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
                Temperature Profile Master
              </h1>
            </div>
            
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              New Profile
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={isEditing ? "h-screen print:h-auto print:overflow-visible" : "w-full px-4 sm:px-6 lg:px-8 py-8 print:w-full"}>
        {isEditing ? (
          <ProfileEditor
            initialProfile={currentProfile}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className="text-lg">Loading profiles...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <Thermometer className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-medium text-gray-900">No profiles yet</h3>
                <p className="mt-2 text-lg text-gray-500 max-w-sm mx-auto mb-8">
                  Get started by creating your first temperature profile.
                </p>
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Profile
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onEdit={() => handleEdit(profile)}
                    onDelete={(e) => profile.id && handleDeleteClick(e, profile.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-full flex-shrink-0">
                 <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Delete Profile?</h3>
                <p className="text-base text-gray-500 mt-1">
                  Are you sure you want to delete this profile? This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setProfileToDelete(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 text-base"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 min-w-[120px] justify-center text-base"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Deleting</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}